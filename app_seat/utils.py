# app_seat/utils.py
import re
from urllib.parse import urlparse, parse_qs, unquote

def _to_float(v):
    if v is None:
        return None
    v = str(v).strip().replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None

def _valid_pair(lat, lon):
    return lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180

def _dms_to_dd(d, m, s, hemi):
    dd = float(d) + float(m)/60.0 + float(s)/3600.0
    if hemi.upper() in ("S", "W"):
        dd = -dd
    return dd

def _extract_dms_from_text(text):
    """
    Busca algo como: 16°31'06.2"S 68°04'56.7"W  (o variantes de símbolos)
    Devuelve (lat, lon) o None.
    """
    if not text:
        return None

    # Normaliza comillas raras
    t = unquote(text)
    t = t.replace("º", "°").replace("’", "'").replace("′", "'").replace("”", '"').replace("″", '"')

    # LAT DMS
    # e.g. 16°31'06.2"S  (S/N)
    dms_lat = re.search(
        r"(-?\d+)[°]\s*(\d+)[']\s*([\d.]+)[\"]?\s*([NSns])",
        t
    )
    # LON DMS
    # e.g. 68°04'56.7"W  (W/E)
    dms_lon = re.search(
        r"(-?\d+)[°]\s*(\d+)[']\s*([\d.]+)[\"]?\s*([EWew])",
        t
    )

    if dms_lat and dms_lon:
        lat = _dms_to_dd(dms_lat.group(1), dms_lat.group(2), dms_lat.group(3), dms_lat.group(4))
        lon = _dms_to_dd(dms_lon.group(1), dms_lon.group(2), dms_lon.group(3), dms_lon.group(4))
        if _valid_pair(lat, lon):
            return (lat, lon)
    return None

def extract_lat_lon_from_link(url: str):
    """
    Devuelve (lat, lon) o None para:
    - https://www.google.com/maps?q=-16.5184003,-68.0824217&z=17&hl=es
    - https://www.google.com/.../place/16°31'06.2"S+68°04'56.7"W/@-16.5184003,-68.0849966,17z/...!3d-16.5184003!4d-68.0824217
    - Apple/OSM variantes.
    """
    if not url:
        return None

    url = url.strip()
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)

    # 0) DMS explícito en el path (ejemplo con grados/min/seg)
    dms = _extract_dms_from_text(parsed.path)
    if dms:
        return dms

    # 1) Patrones preferidos de Google: !3dLAT!4dLON (pin exacto)
    m = re.search(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)", url)
    if m:
        lat, lon = _to_float(m.group(1)), _to_float(m.group(2))
        if _valid_pair(lat, lon):
            return (lat, lon)

    # 2) Query params: q=LAT,LON o ll=LAT,LON
    for key in ("q", "ll"):
        if key in qs and qs[key]:
            candidate = unquote(qs[key][0])
            m = re.match(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$", candidate)
            if m:
                lat, lon = _to_float(m.group(1)), _to_float(m.group(2))
                if _valid_pair(lat, lon):
                    return (lat, lon)

    # 3) Segmento /@LAT,LON,ZOOM
    m = re.search(r"/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)", parsed.path)
    if m:
        lat, lon = _to_float(m.group(1)), _to_float(m.group(2))
        if _valid_pair(lat, lon):
            return (lat, lon)

    # 4) Apple Maps: ll=LAT,LON
    if "ll" in qs and qs["ll"]:
        candidate = qs["ll"][0]
        m = re.match(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$", candidate)
        if m:
            lat, lon = _to_float(m.group(1)), _to_float(m.group(2))
            if _valid_pair(lat, lon):
                return (lat, lon)

    # 5) OSM: mlat / mlon
    if "mlat" in qs and "mlon" in qs:
        lat, lon = _to_float(qs["mlat"][0]), _to_float(qs["mlon"][0])
        if _valid_pair(lat, lon):
            return (lat, lon)

    # 6) Como último recurso: detecta dos floats válidos dentro del URL
    floats = re.findall(r"(-?\d+(?:\.\d+)?)", url)
    # Busca un par (lat, lon) válido
    for i in range(len(floats)-1):
        lat, lon = _to_float(floats[i]), _to_float(floats[i+1])
        if _valid_pair(lat, lon):
            return (lat, lon)

    return None
