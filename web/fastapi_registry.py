# web/fastapi_registry.py
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
from django.core.exceptions import FieldDoesNotExist


# ============================================================
# Mapear tipos Django -> tipos Python/Pydantic
# ============================================================

def _py_type_for_field(f: dm.Field) -> type:
    """Mapea un campo Django a tipo Python apropiado para Pydantic."""
    # Números
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
    # UUID
    if isinstance(f, dm.UUIDField):
        # Puedes usar 'str' para simplificar, o 'uuid.UUID' si prefieres tipo fuerte.
        return str
    # Boolean
    if isinstance(f, dm.BooleanField):
        return bool
    # Decimales / flotantes
    if isinstance(f, dm.DecimalField):
        return float  # si prefieres str, cámbialo aquí
    if isinstance(f, dm.FloatField):
        return float
    # Fechas/horas
    if isinstance(f, dm.DateTimeField):
        return datetime
    if isinstance(f, dm.DateField):
        return date
    if isinstance(f, dm.TimeField):
        return str
    # JSON
    if isinstance(f, dm.JSONField):
        return dict
    # FK: usar el tipo del campo target (pk remoto)
    if isinstance(f, dm.ForeignKey):
        # target_field es el campo remoto (usualmente pk)
        target: dm.Field = f.target_field
        return _py_type_for_field(target)
    # M2M: lista de PKs remotos
    if isinstance(f, dm.ManyToManyField):
        remote_pk_typ = _py_type_for_field(f.target_field)
        return List[remote_pk_typ]  # type: ignore[valid-type]
    # Por defecto: strings (Char/Text/Slug/Email/URL, etc.)
    return str


def _is_writable(f: dm.Field) -> bool:
    """True si el campo es editable por el usuario (no auto ni read-only)."""
    return getattr(f, "editable", True) and not isinstance(f, (dm.AutoField, dm.BigAutoField))


# ============================================================
# Generación de esquemas Pydantic (Entrada/Salida)
# ============================================================

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

        # M2M → entrada/salida listas de PKs
        if isinstance(f, dm.ManyToManyField):
            out_fields[f.name] = (Optional[List[_py_type_for_field(f.target_field)]], None)  # type: ignore[valid-type]
            in_fields[f.name] = (Optional[List[_py_type_for_field(f.target_field)]], None)   # type: ignore[valid-type]
            continue

        # FK → id simple (pk remota)
        if isinstance(f, dm.ForeignKey):
            if f.name in readonly or not _is_writable(f):
                out_fields[f.name] = (typ_out, default_out)
            else:
                in_fields[f.name] = (typ_in, None if default_in is ... else default_in)
                out_fields[f.name] = (typ_out, default_out)
            continue

        # Campos normales
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

    # base con config para salida (Pydantic v2) y expansiones extra
    ConfigBase = type(
        f"{prefix}OutBase",
        (BaseModel,),
        {"model_config": ConfigDict(from_attributes=True, extra="allow")},
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


# ============================================================
# Opciones por modelo
# ============================================================

class ModelOptions(BaseModel):
    include: Optional[List[str]] = None
    exclude: Optional[List[str]] = None
    readonly: Optional[List[str]] = None
    search_fields: Optional[List[str]] = None
    default_order: Optional[str] = None
    auth: Optional[bool] = None
    auth_methods: Optional[List[str]] = None

    # Expansiones
    expand_allowed: Optional[List[str]] = None
    expand_default: Optional[List[str]] = None
    expand_max_depth: int = 2


# ============================================================
# Búsqueda, filtros, auth
# ============================================================

def _default_search_fields(model: Type[Model]) -> List[str]:
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


# ============================================================
# Expansiones (expand=foo&expand=bar.baz)
# ============================================================

def _parse_expand(paths: List[str]) -> Dict[str, dict]:
    """
    Convierte ["events.seats.section", "owner"] en:
    {"events": {"seats": {"section": {}}}, "owner": {}}
    """
    tree: Dict[str, dict] = {}
    for p in paths:
        cur = tree
        for part in filter(None, p.split(".")):
            cur = cur.setdefault(part, {})
    return tree


def _prune_expand(tree: Dict[str, dict], allowed: Optional[List[str]], max_depth: int) -> Dict[str, dict]:
    if not tree:
        return {}
    if not allowed and max_depth >= 99:
        return tree  # sin restricciones
    allowed = set(allowed or [])

    def dfs(node: Dict[str, dict], prefix: str, depth: int) -> Dict[str, dict]:
        if depth > max_depth:
            return {}
        out = {}
        for key, sub in node.items():
            full = f"{prefix}.{key}" if prefix else key
            if not allowed or any(full == a or a.startswith(full + ".") for a in allowed):
                out[key] = dfs(sub, full, depth + 1)
        return out

    return dfs(tree, "", 1)


# ============================================================
# Serialización consistente (maneja PKs, FK ids, M2M pks, Decimals)
# ============================================================

def _value_as_primitive(obj: Model, field: dm.Field, name: str) -> Any:
    """
    Devuelve el valor "plano" para un campo concreto:
    - PK como valor primitivo
    - FK como <name>_id
    - M2M como lista de pks
    - Decimals a float
    """
    if isinstance(field, dm.ManyToManyField):
        return list(getattr(obj, name).values_list("pk", flat=True))
    if isinstance(field, dm.ForeignKey):
        # usar el campo real *_id del FK
        return getattr(obj, field.attname)
    v = getattr(obj, name)
    if isinstance(v, Decimal):
        return float(v)
    return v


def _build_out_data(obj: Model, OutSchema: Type[BaseModel]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    pk_name = obj._meta.pk.name
    for name in OutSchema.model_fields:
        # PK
        if name == pk_name:
            data[name] = getattr(obj, name)
            continue
        # Campo concreto (si existe)
        try:
            f = obj._meta.get_field(name)
            if isinstance(f, dm.Field):
                data[name] = _value_as_primitive(obj, f, name)
                continue
        except FieldDoesNotExist:
            # Puede ser un campo "extra" (lo llenará expand)
            pass
        # Valor directo si no es Field (o campo dinámico)
        v = getattr(obj, name, None)
        if isinstance(v, Decimal):
            v = float(v)
        data[name] = v
    return data


# Cache simple de OutSchemas por modelo
_SCHEMA_CACHE: Dict[Type[Model], Type[BaseModel]] = {}


def _get_model_opts(model_cls: Type[Model]) -> "ModelOptions":
    cfg = getattr(settings, "GENERIC_API", {}) or {}
    per_model = cfg.get("MODEL_OPTIONS", {}) or {}
    dotted = f"{model_cls._meta.app_label}.{model_cls.__name__}"
    raw = per_model.get(dotted, {}) or {}
    exclude = list(set(raw.get("exclude", []) + (cfg.get("GLOBAL_EXCLUDE_FIELDS", []) or [])))
    return ModelOptions(
        include=raw.get("include"),
        exclude=exclude,
        readonly=raw.get("readonly"),
        search_fields=raw.get("search_fields"),
        default_order=raw.get("default_order"),
        auth=raw.get("auth"),
        auth_methods=raw.get("auth_methods"),
        expand_allowed=raw.get("expand_allowed"),
        expand_default=raw.get("expand_default") or [],
        expand_max_depth=int(raw.get("expand_max_depth", 2)),
    )


def _get_out_schema_for(model_cls: Type[Model]) -> Type[BaseModel]:
    if model_cls in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[model_cls]
    opts = _get_model_opts(model_cls)
    _, Out = make_schemas(model_cls, include=opts.include, exclude=opts.exclude, readonly=opts.readonly)
    _SCHEMA_CACHE[model_cls] = Out
    return Out


def _serialize_with_expand(obj: Optional[Model], base_out_schema: Type[BaseModel], expand_tree: Dict[str, dict]) -> Any:
    if obj is None:
        return None

    data = _build_out_data(obj, base_out_schema)
    if not expand_tree:
        return data

    meta = obj._meta

    for name, sub_tree in expand_tree.items():
        # 1) Campo forward (FK, OneToOne, M2M)
        try:
            f = meta.get_field(name)
            if isinstance(f, (dm.ForeignKey, dm.OneToOneField)):
                child = getattr(obj, name, None)
                child_out = _get_out_schema_for(f.remote_field.model)
                data[name] = _serialize_with_expand(child, child_out, sub_tree)
                continue
            if isinstance(f, dm.ManyToManyField):
                qs = getattr(obj, name).all()
                child_out = _get_out_schema_for(f.remote_field.model)
                data[name] = [_serialize_with_expand(c, child_out, sub_tree) for c in qs]
                continue
        except FieldDoesNotExist:
            pass

        # 2) Relación inversa (child)
        rel = next((r for r in meta.related_objects if r.get_accessor_name() == name), None)
        if rel is not None:
            accessor = getattr(obj, name)
            child_out = _get_out_schema_for(rel.related_model)
            # OneToOne inverso -> objeto; ManyToOne/ManyToMany inverso -> manager
            if hasattr(accessor, "all"):
                qs = accessor.all()
                data[name] = [_serialize_with_expand(c, child_out, sub_tree) for c in qs]
            else:
                data[name] = _serialize_with_expand(accessor, child_out, sub_tree)
            continue

        # Si no existe, ignorar silenciosamente
    return data


# ============================================================
# Router CRUD genérico
# ============================================================

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

    # Tipo dinámico de la pk
    pk_typ = _py_type_for_field(model._meta.pk)

    # ---- LIST (GET /)
    deps_list = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("GET", opts)) else []

    @r.get("/", response_model=List[OutSchema], dependencies=deps_list)  # type: ignore[name-defined]
    def list_items(
        q: Optional[str] = None,
        filters: List[str] = Query(default=[]),
        order: Optional[str] = None,
        limit: int = Query(50, ge=1, le=500),
        offset: int = Query(0, ge=0),
        expand: List[str] = Query(default=[]),
    ):
        qs = model.objects.all()
        qs = _apply_search(qs, q, opts.search_fields or _default_search_fields(model))
        qs = _apply_filters(qs, filters)
        qs = qs.order_by(order or opts.default_order or model._meta.pk.name)

        expand_all = list((opts.expand_default or [])) + list(expand or [])
        tree = _parse_expand(expand_all)
        tree = _prune_expand(tree, opts.expand_allowed, opts.expand_max_depth)

        objs = list(qs[offset: offset + limit])
        return [
            OutSchema(**_serialize_with_expand(obj, OutSchema, tree))  # type: ignore[name-defined]
            for obj in objs
        ]

    # ---- RETRIEVE (GET /{pk})
    deps_retrieve = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("GET", opts)) else []

    @r.get("/{pk}", response_model=OutSchema, dependencies=deps_retrieve)  # type: ignore[name-defined]
    def retrieve(pk: pk_typ, expand: List[str] = Query(default=[])):  # type: ignore[valid-type]
        try:
            obj = model.objects.get(pk=pk)
        except model.DoesNotExist:
            raise HTTPException(status_code=404, detail="Not found")

        expand_all = list((opts.expand_default or [])) + list(expand or [])
        tree = _parse_expand(expand_all)
        tree = _prune_expand(tree, opts.expand_allowed, opts.expand_max_depth)

        return OutSchema(**_serialize_with_expand(obj, OutSchema, tree))  # type: ignore[name-defined]

    # ---- CREATE (POST /)
    deps_create = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("POST", opts)) else []

    @r.post("/", response_model=OutSchema, status_code=201, dependencies=deps_create)  # type: ignore[name-defined]
    def create(item: InSchema):
        payload = item.model_dump(exclude_unset=True)
        m2m_values: Dict[str, List[Any]] = {}

        # Separar M2M
        for name, value in list(payload.items()):
            f = model._meta.get_field(name)
            if isinstance(f, dm.ManyToManyField):
                m2m_values[name] = value or []
                payload.pop(name, None)

        with transaction.atomic():
            obj = model.objects.create(**payload)
            for name, ids in m2m_values.items():
                getattr(obj, name).set(ids)

        # Serialización consistente
        return retrieve(getattr(obj, model._meta.pk.name))  # type: ignore[arg-type]

    # ---- UPDATE (PUT /{pk})
    deps_update_put = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("PUT", opts)) else []

    @r.put("/{pk}", response_model=OutSchema, dependencies=deps_update_put)  # type: ignore[name-defined]
    def update_put(pk: pk_typ, item: InSchema):  # type: ignore[valid-type]
        return _update_common(model, pk, item)

    # ---- UPDATE (PATCH /{pk})
    deps_update_patch = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("PATCH", opts)) else []

    @r.patch("/{pk}", response_model=OutSchema, dependencies=deps_update_patch)  # type: ignore[name-defined]
    def update_patch(pk: pk_typ, item: InSchema):  # type: ignore[valid-type]
        return _update_common(model, pk, item)

    # ---- DELETE (DELETE /{pk})
    deps_delete = [Depends(auth_dependency)] if (auth_dependency and _needs_auth("DELETE", opts)) else []

    @r.delete("/{pk}", status_code=204, dependencies=deps_delete)  # type: ignore[name-defined]
    def delete(pk: pk_typ):  # type: ignore[valid-type]
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
    m2m_values: Dict[str, List[Any]] = {}

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

    # Serialización igual a retrieve (sin expand)
    OutSchema = _get_out_schema_for(model)
    return OutSchema(**_build_out_data(obj, OutSchema))  # type: ignore[name-defined]


# ============================================================
# Montaje desde settings
# ============================================================

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
        expand_allowed = opt_raw.get("expand_allowed")
        expand_default = opt_raw.get("expand_default")
        expand_max_depth = int(opt_raw.get("expand_max_depth", 2))

        opts = ModelOptions(
            include=include,
            exclude=exclude,
            readonly=readonly,
            search_fields=search_fields,
            default_order=default_order,
            auth=auth,
            auth_methods=auth_methods,
            expand_allowed=expand_allowed,
            expand_default=expand_default or [],
            expand_max_depth=expand_max_depth,
        )

        fastapi_app.include_router(build_router(model, opts, auth_dep))
