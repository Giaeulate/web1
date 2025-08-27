# views.py
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .models import Venue, SeatMap, Section, Row, Seat

import json
from math import isfinite


def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


# --------- util de agrupado por Y (filas) ----------
def _cluster_rows_y(points, tolerance):
    """
    points: [{"cx": float, "cy": float, ...}, ...]
    Agrupa por Y con tolerancia y devuelve:
      [{ "y": y_prom, "items": [point,...] }, ...] ordenado arriba->abajo.
    """
    pts = sorted(points, key=lambda p: p["cy"])
    clusters = []
    for p in pts:
        if not clusters:
            clusters.append({"ys": [p["cy"]], "items": [p]})
            continue
        last = clusters[-1]
        last_mean = sum(last["ys"]) / len(last["ys"])
        if abs(p["cy"] - last_mean) <= tolerance:
            last["ys"].append(p["cy"])
            last["items"].append(p)
        else:
            clusters.append({"ys": [p["cy"]], "items": [p]})

    out = []
    for c in clusters:
        y_mean = sum(c["ys"]) / len(c["ys"])
        out.append({"y": y_mean, "items": sorted(c["items"], key=lambda it: it["cx"])})
    out.sort(key=lambda c: c["y"])
    return out


def _row_name_for_index(idx: int) -> str:
    # A, B, C ... R27, etc.
    return chr(ord("A") + idx) if idx < 26 else f"R{idx + 1}"


def _sync_canvas_to_models(venue: Venue, data: dict) -> None:
    """
    Sincroniza el JSON de Fabric con Section/Row/Seat del venue.
    - Borra secciones que ya no existan en el canvas.
    - Upsert de secciones presentes (actualiza category y order si ese campo existe).
    - Recrea filas/asientos desde los círculos del canvas.
    """
    fabric = (data or {}).get("fabric", {})
    objects = fabric.get("objects", [])

    # --- 1) Secciones del canvas ---
    sections_from_canvas = []
    for obj in objects:
        if obj.get("kind") == "section" and obj.get("type") in ("polygon", "polyline", "path"):
            name = (obj.get("section_name") or "Sección").strip()
            key = obj.get("section_key") or name.lower()
            category = obj.get("category") or ""
            order_val = obj.get("section_order")
            if order_val is None:
                order_val = obj.get("order") or 0
            sections_from_canvas.append({
                "name": name,
                "key": key,
                "category": category,
                "order": int(order_val),
            })

    # --- 2) BORRADO: todo lo que no esté en el canvas desaparece de la BD ---
    names_in_canvas = {s["name"] for s in sections_from_canvas}
    if names_in_canvas:
        Section.objects.filter(venue=venue).exclude(name__in=names_in_canvas).delete()
    else:
        Section.objects.filter(venue=venue).delete()

    # --- 3) UPSERT de secciones presentes ---
    section_by_key = {}
    for sec in sections_from_canvas:
        defaults = {"category": sec["category"]}
        if hasattr(Section, "order"):  # por si tu modelo sí tiene 'order'
            defaults["order"] = sec["order"]

        s, _created = Section.objects.get_or_create(
            venue=venue, name=sec["name"], defaults=defaults
        )

        to_update = []
        if getattr(s, "category", "") != sec["category"]:
            s.category = sec["category"]
            to_update.append("category")
        if hasattr(Section, "order") and getattr(s, "order", 0) != sec["order"]:
            s.order = sec["order"]
            to_update.append("order")
        if to_update:
            s.save(update_fields=to_update)

        section_by_key[sec["key"]] = s

    # --- 4) Recolectar seats por sección ---
    seats_by_section = {}
    for obj in objects:
        if obj.get("kind") == "seat" and obj.get("type") == "circle":
            skey = obj.get("section_key") or ""
            if not skey or skey not in section_by_key:
                continue
            left, top, radius = obj.get("left"), obj.get("top"), obj.get("radius")
            if not (isfinite(left) and isfinite(top) and isfinite(radius)):
                continue
            cx = float(left) + float(radius)
            cy = float(top) + float(radius)
            seats_by_section.setdefault(skey, []).append({
                "cx": cx,
                "cy": cy,
                "number": str(obj.get("number") or "").strip(),
                "seat_type": obj.get("seat_type") or "standard",
            })

    # --- 5) Limpiar filas/asientos de secciones presentes y recrearlas ---
    for section in section_by_key.values():
        section.rows.all().delete()

    ui = data.get("ui", {}) if isinstance(data, dict) else {}
    gapY = ui.get("gapY") if isinstance(ui, dict) else None
    tolerance = 0.6 * (gapY if isinstance(gapY, (int, float)) else 26) or 15.0

    for skey, items in seats_by_section.items():
        section = section_by_key[skey]
        clusters = _cluster_rows_y(items, tolerance)
        for i, cluster in enumerate(clusters):
            row = Row.objects.create(section=section, name=_row_name_for_index(i), order=i)
            for seat_idx, it in enumerate(cluster["items"], start=1):
                Seat.objects.create(
                    row=row,
                    number=(it["number"] or str(seat_idx)),
                    seat_type=it["seat_type"],
                )


@require_http_methods(["GET"])
def seatmap_load(request, venue_id: int):
    venue = get_object_or_404(Venue, pk=venue_id)
    seatmap = venue.seatmaps.order_by("-created_at").first()
    if not seatmap or not seatmap.data:
        return JsonResponse({
            "ok": True,
            "data": {
                "engine": "fabric",
                "legend": [],
                "ui": {"gapX": 24, "gapY": 26},
                "fabric": {"version": "5.3.0", "objects": []},
            },
        })
    return JsonResponse({"ok": True, "data": seatmap.data})


@require_http_methods(["POST"])
@transaction.atomic
def seatmap_save(request, venue_id: int):
    venue = get_object_or_404(Venue, pk=venue_id)
    body = _parse_json_body(request)
    data = body.get("data")
    if not data:
        return JsonResponse({"ok": False, "error": "Sin payload"}, status=400)

    # 1) Guardar JSON para re-editar
    seatmap, _ = SeatMap.objects.get_or_create(venue=venue, name="Diseño actual")
    seatmap.data = data
    seatmap.save()

    # 2) Sincronizar a las tablas (incluye BORRADOS)
    _sync_canvas_to_models(venue, data)

    return JsonResponse({"ok": True, "seatmap_id": seatmap.id})
