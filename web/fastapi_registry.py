from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, Type
from datetime import date, datetime
from decimal import Decimal
import importlib
import warnings

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, create_model, ConfigDict

from django.conf import settings
from django.db import models as dm
from django.db.models import Model, Q
from django.db import transaction


# -------- utils: tipos pydantic para campos django --------
def _py_type_for_field(f: dm.Field) -> type:
    """Map a Django field to a corresponding Python type for Pydantic."""
    if isinstance(
        f,
        (
            dm.AutoField,
            dm.BigAutoField,
            dm.IntegerField,
            dm.BigIntegerField,
            dm.SmallIntegerField,
            dm.PositiveIntegerField,
            dm.PositiveSmallIntegerField,
        ),
    ):
        return int
    if isinstance(f, dm.BooleanField):
        return bool
    if isinstance(f, dm.DecimalField):
        return float  # si prefieres str, cámbialo aquí
    if isinstance(f, dm.FloatField):
        return float
    if isinstance(f, dm.DateTimeField):
        return datetime
    if isinstance(f, dm.DateField):
        return date
    if isinstance(f, dm.TimeField):
        return str
    if isinstance(f, dm.JSONField):
        return dict
    if isinstance(f, dm.ForeignKey):
        return int
    if isinstance(f, dm.ManyToManyField):
        return List[int]
    return str  # por defecto: CharField, TextField, SlugField, etc.


def _is_writable(f: dm.Field) -> bool:
    """True si el campo es editable por el usuario (no auto ni read-only)."""
    return getattr(f, "editable", True) and not isinstance(f, (dm.AutoField, dm.BigAutoField))


# -------- generar Input/Output schemas pydantic --------
def make_schemas(
    model: Type[Model],
    *,
    include: Optional[Iterable[str]] = None,
    exclude: Optional[Iterable[str]] = None,
    readonly: Optional[Iterable[str]] = None,
) -> Tuple[Type[BaseModel], Type[BaseModel]]:
    mf = model._meta
    include = set(include or [])
    exclude = set(exclude or [])
    readonly = set(readonly or [])

    # Solo campos concretos (no relaciones reverse)
    fields: List[dm.Field] = [f for f in mf.get_fields() if isinstance(f, dm.Field)]

    if include:
        fields = [f for f in fields if f.name in include]
    if exclude:
        fields = [f for f in fields if f.name not in exclude]

    in_fields: Dict[str, Tuple[type, Any]] = {}
    out_fields: Dict[str, Tuple[type, Any]] = {}

    for f in fields:
        typ = _py_type_for_field(f)
        optional = getattr(f, "null", False) or getattr(f, "blank", False)

        typ_in = Optional[typ] if optional else typ
        typ_out = Optional[typ] if optional else typ
        default_in = None if optional else ...
        default_out = None

        # PK: solo salida
        if f.primary_key:
            out_fields[f.name] = (typ_out, default_out)
            continue

        # M2M
        if isinstance(f, dm.ManyToManyField):
            in_fields[f.name] = (Optional[List[int]], None)
            out_fields[f.name] = (Optional[List[int]], None)
            continue

        # FK
        if isinstance(f, dm.ForeignKey):
            if f.name in readonly or not _is_writable(f):
                out_fields[f.name] = (typ_out, default_out)
            else:
                in_fields[f.name] = (typ_in, None if default_in is ... else default_in)
                out_fields[f.name] = (typ_out, default_out)
            continue

        # campos normales
        if f.name in readonly or not _is_writable(f):
            out_fields[f.name] = (typ_out, default_out)
        else:
            in_fields[f.name] = (typ_in, None if default_in is ... else default_in)
            out_fields[f.name] = (typ_out, default_out)

    # Asegura pk en salida
    if mf.pk and mf.pk.name not in out_fields:
        pk_typ = _py_type_for_field(mf.pk)
        out_fields[mf.pk.name] = (pk_typ, None)

    prefix = model.__name__

    # modelo de entrada
    InputModel = create_model(
        f"{prefix}In",
        __base__=BaseModel,
        __module__=__name__,
        **in_fields,
    )

    # base con config para salida (Pydantic v2)
    ConfigBase = type(
        f"{prefix}OutBase",
        (BaseModel,),
        {"model_config": ConfigDict(from_attributes=True)},
    )

    # modelo de salida
    OutputModel = create_model(
        f"{prefix}Out",
        __base__=ConfigBase,
        __module__=__name__,
        **out_fields,
    )

    # resolver referencias
    InputModel.model_rebuild(force=True)
    OutputModel.model_rebuild(force=True)

    return InputModel, OutputModel


class ModelOptions(BaseModel):
    """Opciones por modelo para la generación del API."""
    include: Optional[List[str]] = None
    exclude: Optional[List[str]] = None
    readonly: Optional[List[str]] = None
    search_fields: Optional[List[str]] = None
    default_order: Optional[str] = None

    # auth para todo el router (si no usas auth_methods)
    auth: Optional[bool] = None

    # auth por método HTTP (override sobre 'auth')
    # ejemplos: ["GET"], ["POST","PUT","PATCH"], ["DELETE"], etc.
    auth_methods: Optional[List[str]] = None


def _default_search_fields(model: Type[Model]) -> List[str]:
    """Campos por defecto para búsqueda si no se especifica."""
    names = []
    for f in model._meta.get_fields():
        if not isinstance(f, dm.Field):
            continue
        if isinstance(
            f,
            (
                dm.CharField,
                dm.TextField,
                dm.SlugField,
                dm.EmailField,
                dm.URLField,
            ),
        ):
            names.append(f.name)
    return names[:5]


def _apply_search(qs, q: Optional[str], search_fields: Optional[List[str]]):
    if q and search_fields:
        cond = Q()
        for f in search_fields:
            cond |= Q(**{f"{f}__icontains": q})
        qs = qs.filter(cond)
    return qs


def _apply_filters(qs, filters: List[str]):
    for expr in filters:
        if "=" not in expr:
            continue
        k, v = expr.split("=", 1)
        qs = qs.filter(**{k: v})
    return qs


def _needs_auth(method: str, opts: ModelOptions) -> bool:
    if opts.auth_methods:
        return method.upper() in {m.upper() for m in opts.auth_methods}
    return bool(opts.auth)


# -------- router CRUD genérico --------
def build_router(
    model: Type[Model],
    opts: ModelOptions,
    auth_dependency: Optional[Callable] = None,
) -> APIRouter:
    InSchema, OutSchema = make_schemas(
        model,
        include=opts.include,
        exclude=opts.exclude,
        readonly=opts.readonly,
    )

    app_label = model._meta.app_label
    model_name = model._meta.model_name
    tag = f"{app_label}.{model_name}"
    r = APIRouter(prefix=f"/api/{app_label}/{model_name}", tags=[tag])

    # tipo de la pk dinámico
    pk_typ = _py_type_for_field(model._meta.pk)

    # ---- LIST (GET /)
    deps_list = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("GET", opts)) else []

    @r.get("/", response_model=List[OutSchema], dependencies=deps_list)
    def list_items(
        q: Optional[str] = None,
        filters: List[str] = Query(default=[]),
        order: Optional[str] = None,
        limit: int = Query(50, ge=1, le=500),
        offset: int = Query(0, ge=0),
    ):
        qs = model.objects.all()
        qs = _apply_search(qs, q, opts.search_fields or _default_search_fields(model))
        qs = _apply_filters(qs, filters)
        qs = qs.order_by(order or opts.default_order or model._meta.pk.name)

        objs = list(qs[offset: offset + limit])
        out = []
        for obj in objs:
            data: Dict[str, Any] = {}
            for name in OutSchema.model_fields:
                if name == model._meta.pk.name:
                    data[name] = getattr(obj, name)
                    continue
                f = obj._meta.get_field(name)
                if isinstance(f, dm.ManyToManyField):
                    data[name] = list(getattr(obj, name).values_list("pk", flat=True))
                else:
                    v = getattr(obj, name)
                    if isinstance(v, Decimal):
                        v = float(v)
                    data[name] = v
            out.append(OutSchema(**data))
        return out

    # ---- RETRIEVE (GET /{pk})
    deps_retrieve = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("GET", opts)) else []

    @r.get("/{pk}", response_model=OutSchema, dependencies=deps_retrieve)
    def retrieve(pk: pk_typ):
        try:
            obj = model.objects.get(pk=pk)
        except model.DoesNotExist:
            raise HTTPException(status_code=404, detail="Not found")
        data: Dict[str, Any] = {}
        for name in OutSchema.model_fields:
            if name == model._meta.pk.name:
                data[name] = getattr(obj, name)
                continue
            f = obj._meta.get_field(name)
            if isinstance(f, dm.ManyToManyField):
                data[name] = list(getattr(obj, name).values_list("pk", flat=True))
            else:
                v = getattr(obj, name)
                if isinstance(v, Decimal):
                    v = float(v)
                data[name] = v
        return OutSchema(**data)

    # ---- CREATE (POST /)
    deps_create = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("POST", opts)) else []

    @r.post("/", response_model=OutSchema, status_code=201, dependencies=deps_create)
    def create(item: InSchema):
        payload = item.model_dump(exclude_unset=True)
        m2m_values: Dict[str, List[int]] = {}
        for name, value in list(payload.items()):
            f = model._meta.get_field(name)
            if isinstance(f, dm.ManyToManyField):
                m2m_values[name] = value or []
                payload.pop(name, None)
        with transaction.atomic():
            obj = model.objects.create(**payload)
            for name, ids in m2m_values.items():
                getattr(obj, name).set(ids)
        return retrieve(getattr(obj, model._meta.pk.name))

    # ---- UPDATE (PUT /{pk})
    deps_update_put = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("PUT", opts)) else []

    @r.put("/{pk}", response_model=OutSchema, dependencies=deps_update_put)
    def update_put(pk: pk_typ, item: InSchema):
        return _update_common(model, pk, item)

    # ---- UPDATE (PATCH /{pk})
    deps_update_patch = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("PATCH", opts)) else []

    @r.patch("/{pk}", response_model=OutSchema, dependencies=deps_update_patch)
    def update_patch(pk: pk_typ, item: InSchema):
        return _update_common(model, pk, item)

    # ---- DELETE (DELETE /{pk})
    deps_delete = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("DELETE", opts)) else []

    @r.delete("/{pk}", status_code=204, dependencies=deps_delete)
    def delete(pk: pk_typ):
        deleted, _ = model.objects.filter(pk=pk).delete()
        if not deleted:
            raise HTTPException(status_code=404, detail="Not found")

    return r


def _update_common(model: Type[Model], pk, item: BaseModel):
    try:
        obj = model.objects.get(pk=pk)
    except model.DoesNotExist:
        raise HTTPException(status_code=404, detail="Not found")
    payload = item.model_dump(exclude_unset=True)
    m2m_values: Dict[str, List[int]] = {}
    for name, value in list(payload.items()):
        f = model._meta.get_field(name)
        if isinstance(f, dm.ManyToManyField):
            m2m_values[name] = value or []
            payload.pop(name, None)
    for k, v in payload.items():
        setattr(obj, k, v)
    with transaction.atomic():
        obj.save()
        for name, ids in m2m_values.items():
            getattr(obj, name).set(ids)

    # serialización simple (como en retrieve)
    result: Dict[str, Any] = {}
    for f in obj._meta.concrete_fields:
        v = getattr(obj, f.name)
        if isinstance(v, Decimal):
            v = float(v)
        result[f.name] = v
    for m2m in obj._meta.many_to_many:
        result[m2m.name] = list(getattr(obj, m2m.name).values_list("pk", flat=True))
    return result


# -------- helpers de montaje --------
def _load_auth_dependency() -> Optional[Callable]:
    path = (getattr(settings, "GENERIC_API", {}) or {}).get("AUTH_DEPENDENCY")
    if not path:
        return None
    try:
        module_path, func_name = path.split(":")
        module = importlib.import_module(module_path)
        return getattr(module, func_name)
    except Exception as exc:
        warnings.warn(f"Could not load AUTH_DEPENDENCY '{path}': {exc}", RuntimeWarning)
        return None


def mount_from_settings(fastapi_app) -> None:
    """
    Monta routers para todos los modelos según settings.GENERIC_API.
    """
    cfg = getattr(settings, "GENERIC_API", {}) or {}

    allow_apps: Optional[List[str]] = cfg.get("APPS_ALLOWLIST")
    exclude_models: List[str] = cfg.get("MODELS_EXCLUDE", [])
    global_exclude_fields: List[str] = cfg.get("GLOBAL_EXCLUDE_FIELDS", [])
    per_model: Dict[str, Dict[str, Any]] = cfg.get("MODEL_OPTIONS", {})

    auth_dep = _load_auth_dependency()

    from django.apps import apps as django_apps

    for model in django_apps.get_models():
        # filtra por apps
        if allow_apps and model._meta.app_label not in allow_apps:
            continue

        dotted = f"{model._meta.app_label}.{model.__name__}"
        if model._meta.proxy or dotted in set(exclude_models):
            continue

        opt_raw = per_model.get(dotted, {})
        include = opt_raw.get("include")
        exclude = list(set(opt_raw.get("exclude", [])) | set(global_exclude_fields))
        readonly = opt_raw.get("readonly")
        search_fields = opt_raw.get("search_fields")
        default_order = opt_raw.get("default_order")
        auth = opt_raw.get("auth")
        auth_methods = opt_raw.get("auth_methods")

        opts = ModelOptions(
            include=include,
            exclude=exclude,
            readonly=readonly,
            search_fields=search_fields,
            default_order=default_order,
            auth=auth,
            auth_methods=auth_methods,
        )

        fastapi_app.include_router(build_router(model, opts, auth_dep))
