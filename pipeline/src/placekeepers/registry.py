"""Load the shared registry (registry/*.yaml) and check it.

The registry is the single list of every source, layer, lens, suggestion, legal route and partner.
The web app reads the same files, so the rules here follow docs/CONTRACTS.md section 1:

* unknown keys are errors, so a typo fails instead of being ignored;
* ids are lowercase with underscores and unique within their file;
* every cross reference resolves (layer sources and groups, source licenses, suggestion routes and
  partners, lens presets and factor fields);
* every layer has a plain description and at least one source, and every source has a license and
  an attribution line.

Every problem found is collected, so one run shows the whole list.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Annotated, Any, Literal

import yaml
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictFloat,
    StrictInt,
    StringConstraints,
    ValidationError,
    model_validator,
)

REGISTRY_FILES = (
    "licenses",
    "groups",
    "sources",
    "layers",
    "lenses",
    "suggestions",
    "routes",
    "partners",
    "options",
)

ID_PATTERN = r"^[a-z][a-z0-9_]*$"

Id = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Url = Annotated[str, StringConstraints(pattern=r"^https?://\S+$")]
Release = Annotated[str, StringConstraints(pattern=r"^v\d+\.\d+$")]
Weight = Annotated[int, Field(strict=True, ge=0, le=5)]
Evidence = Literal["strong", "moderate", "mixed", "weak", "not_violence", "context"]
Cadence = Literal["daily", "weekly", "monthly", "yearly", "irregular", "frozen"]
AppliesTo = Literal["parcel", "segment", "crash", "stop", "cell"]
EndpointKind = Literal["carto", "arcgis", "url", "osm_extract", "curated", "sparql"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


# ---------------------------------------------------------------------------------------------
# licenses.yaml, groups.yaml, partners.yaml


class License(Strict):
    id: Id
    label: Text
    url: Url
    share_alike: bool


class Group(Strict):
    id: Id
    label: Text
    description: Text


class Partner(Strict):
    id: Id
    name: Text
    url: Url
    one_line: Text


# ---------------------------------------------------------------------------------------------
# sources.yaml


class CartoEndpoint(Strict):
    """A table on the City's Carto SQL API, with an optional SQL filter."""

    kind: Literal["carto"]
    table: Annotated[str, StringConstraints(pattern=ID_PATTERN)]
    where: Text | None = None


class ArcgisEndpoint(Strict):
    """A layer of an ArcGIS feature service: the City's ArcGIS Online services unless `url` names
    another REST services root (for example a partner organization's). A service kept in a folder
    is named with its folder, as ArcGIS lists it (`transportation/lts_network`, added by M3.3)."""

    kind: Literal["arcgis"]
    service: Annotated[str, StringConstraints(pattern=r"^[^/?#&\s][^/?#&]*(/[^/?#&\s][^/?#&]*)*$")]
    layer: Annotated[int, Field(strict=True, ge=0)]
    url: Annotated[str, StringConstraints(pattern=r"^https://\S+/rest/services$")] | None = None


class UrlEndpoint(Strict):
    """A single file at a fixed https link. A `json` reply (added 2026-10-08 by issue #37) needs a
    source specific adapter, which may ask for it with query parameters (`pba_laser`)."""

    kind: Literal["url"]
    url: Url
    format: Literal["csv", "geojson", "parquet", "zip", "json"]


#: An OpenStreetMap tag to keep: a key and a value ("highway=bus_stop"), or a key alone for any
#: value ("shelter"). Keys may hold colons ("gtfs:stop_id"); neither part holds spaces or quotes.
OsmTag = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_:.-]+(=[A-Za-z0-9_:;.-]+)?$")]


class OsmExtractEndpoint(Strict):
    """An OpenStreetMap extract (keys added 2026-10-04 by M2.2, docs/CONTRACTS.md section 1).

    With `url` (an .osm.pbf file, such as Geofabrik's Pennsylvania extract) the pipeline downloads
    the file and keeps the elements that carry one of `tags` inside the city, so a later layer adds
    its tags here without new code. Without either key (the base map) the site makes the file and
    the pipeline never fetches it."""

    kind: Literal["osm_extract"]
    url: Annotated[str, StringConstraints(pattern=r"^https://\S+\.osm\.pbf$")] | None = None
    tags: list[OsmTag] = []

    @model_validator(mode="after")
    def _url_and_tags_go_together(self) -> OsmExtractEndpoint:
        if self.url is not None and not self.tags:
            raise ValueError("an extract with a url needs tags (which elements to keep)")
        if self.url is None and self.tags:
            raise ValueError("tags need a url (the extract to read them from)")
        if len(set(self.tags)) != len(self.tags):
            raise ValueError(f"a tag is listed twice: {self.tags}")
        return self


class CuratedEndpoint(Strict):
    """A hand edited file in data/curated/."""

    kind: Literal["curated"]
    path: Annotated[str, StringConstraints(pattern=r"^data/curated/[A-Za-z0-9_.-]+\.ya?ml$")]


class SparqlEndpoint(Strict):
    """A SPARQL query service, such as Wikidata's (added 2026-10-05 by M3.2, docs/CONTRACTS.md
    section 1). The query lives in the source's adapter, as a Carto adapter's columns do: one
    small query a week, sent with the project's User-Agent."""

    kind: Literal["sparql"]
    url: Annotated[str, StringConstraints(pattern=r"^https://\S+$")]


Endpoint = Annotated[
    CartoEndpoint
    | ArcgisEndpoint
    | UrlEndpoint
    | OsmExtractEndpoint
    | CuratedEndpoint
    | SparqlEndpoint,
    Field(discriminator="kind"),
]


class Health(Strict):
    min_rows: Annotated[int, Field(strict=True, ge=0)]
    max_drop_pct: Annotated[float, Field(ge=0, le=100)]
    newest_field: Annotated[str, StringConstraints(pattern=r"^[a-z_][a-z0-9_]*$")] | None = None
    max_age_days: Annotated[int, Field(strict=True, gt=0)] | None = None

    @model_validator(mode="after")
    def _age_needs_a_field(self) -> Health:
        if self.max_age_days is not None and self.newest_field is None:
            raise ValueError("max_age_days needs newest_field (which field holds the record date?)")
        return self


class Source(Strict):
    id: Id
    name: Text
    publisher: Text
    homepage: Url
    endpoint: Endpoint
    license: Id
    attribution: Text
    cadence: Cadence
    health: Health
    release: Release


# ---------------------------------------------------------------------------------------------
# layers.yaml


class Option(Strict):
    value: str
    label: Text


Number = StrictInt | StrictFloat


class Setting(Strict):
    """A layer setting. Keys by type (docs/CONTRACTS.md section 1): a choice has `options`; a
    toggle has no other keys; a range has `min`, `max` and an optional `step` (default 1). Keys
    that do not belong to the type are an error, exactly as in the web app's check."""

    id: Id
    label: Text
    type: Literal["toggle", "choice", "range"]
    default: str | bool | int | float
    options: Annotated[list[Option], Field(min_length=1)] | None = None
    min: Number | None = None
    max: Number | None = None
    step: Number | None = None

    @model_validator(mode="after")
    def _keys_fit_the_type(self) -> Setting:
        present = {
            key for key in ("options", "min", "max", "step") if getattr(self, key) is not None
        }
        allowed = {"choice": {"options"}, "toggle": set(), "range": {"min", "max", "step"}}
        extra = sorted(present - allowed[self.type])
        if extra:
            raise ValueError(f"a {self.type} setting cannot have {', '.join(extra)}")
        if self.type == "choice":
            if self.options is None:
                raise ValueError("a choice setting needs options")
            values = [option.value for option in self.options]
            if len(set(values)) != len(values):
                raise ValueError(f"option values repeat: {values}")
            if not isinstance(self.default, str) or self.default not in values:
                raise ValueError(f"default {self.default!r} is not one of the options {values}")
        elif self.type == "toggle":
            if not isinstance(self.default, bool):
                raise ValueError("a toggle default must be true or false")
        else:
            if self.min is None or self.max is None:
                raise ValueError("a range setting needs min and max")
            if self.min >= self.max:
                raise ValueError("a range setting needs min below max")
            if isinstance(self.default, bool) or not isinstance(self.default, int | float):
                raise ValueError("a range default must be a number")
            if not self.min <= self.default <= self.max:
                raise ValueError(f"default {self.default} is outside {self.min} to {self.max}")
            if self.step is not None and self.step <= 0:
                raise ValueError("a range step must be above 0")
        return self


class LayerDefault(Strict):
    field: bool
    analysis: bool


class Layer(Strict):
    id: Id
    label: Text
    group: Id
    description: Text
    sources: Annotated[list[Id], Field(min_length=1)]
    # A relative path under the data root. Segments cannot start with a dot or a slash.
    file: Annotated[
        str,
        StringConstraints(pattern=r"^[A-Za-z0-9_][A-Za-z0-9_.-]*(/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$"),
    ]
    source_layer: Id
    geometry: Literal["point", "line", "polygon"]
    style: Id
    evidence: Evidence
    default: LayerDefault
    #: the slug of a content page (content/<slug>.md) that shows how anyone can help improve this
    #: layer's data, linked from "About this layer" (added 2026-10-04 by M2.2)
    guide: Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]*$")] | None = None
    settings: list[Setting] = []
    release: Release


# ---------------------------------------------------------------------------------------------
# lenses.yaml


class Factor(Strict):
    id: Id
    label: Text
    field: Annotated[str, StringConstraints(pattern=r"^f_[a-z][a-z0-9_]*$")]
    evidence: Evidence
    default_weight: Weight
    explain: Text


class Preset(Strict):
    id: Id
    label: Text
    weights: dict[Id, Weight]


class Lens(Strict):
    id: Id
    label: Text
    applies_to: AppliesTo
    description: Text
    factors: Annotated[list[Factor], Field(min_length=1)]
    presets: list[Preset] = []
    release: Release


# ---------------------------------------------------------------------------------------------
# suggestions.yaml and routes.yaml


class Suggestion(Strict):
    id: Id
    label: Text
    applies_to: AppliesTo
    summary: Text
    evidence: Evidence
    cost: Text
    # Legal route first: every suggestion names at least one lawful route.
    routes: Annotated[list[Id], Field(min_length=1)]
    partners: list[Id] = []
    default_on: bool
    release: Release


class Link(Strict):
    label: Text
    url: Url


class Route(Strict):
    id: Id
    label: Text
    who: Text
    #: a caution shown before the steps whenever the route appears (docs/ETHICS.md), such as the
    #: conservatorship abuse warning
    warning: Text | None = None
    steps: Annotated[list[Text], Field(min_length=1)]
    cost: Text
    timeline: Text
    links: list[Link] = []
    last_checked: date
    status: Literal["verified", "confirm"]


# ---------------------------------------------------------------------------------------------
# options.yaml


class AppOption(Setting):
    """An app wide option (docs/CONTRACTS.md section 1): a setting that is not tied to one map
    layer, such as whether the browser may ask the City's servers for live data. It has the keys
    of a layer setting plus a plain description. The pipeline does not use options; it only
    checks them, so a registry the web app accepts never breaks the pipeline."""

    description: Text
    release: Release


MODELS: dict[str, type[Strict]] = {
    "licenses": License,
    "groups": Group,
    "sources": Source,
    "layers": Layer,
    "lenses": Lens,
    "suggestions": Suggestion,
    "routes": Route,
    "partners": Partner,
    "options": AppOption,
}


# ---------------------------------------------------------------------------------------------
# Loading


class RegistryError(Exception):
    """The registry has problems. `problems` lists each one as a readable line."""

    def __init__(self, problems: list[str]):
        self.problems = problems
        super().__init__(f"{len(problems)} registry problem(s):\n" + "\n".join(problems))


@dataclass(frozen=True)
class Registry:
    root: Path
    licenses: dict[str, License]
    groups: dict[str, Group]
    sources: dict[str, Source]
    layers: dict[str, Layer]
    lenses: dict[str, Lens]
    suggestions: dict[str, Suggestion]
    routes: dict[str, Route]
    partners: dict[str, Partner]
    options: dict[str, AppOption]

    def summary(self) -> str:
        parts = [f"{len(getattr(self, name))} {name}" for name in REGISTRY_FILES]
        return ", ".join(parts)


class _UniqueKeyLoader(yaml.SafeLoader):
    """A YAML loader that refuses a key repeated in one mapping (a common silent typo)."""


def _mapping_without_repeats(loader: _UniqueKeyLoader, node: yaml.MappingNode) -> dict:
    loader.flatten_mapping(node)
    seen: set[Any] = set()
    for key_node, _ in node.value:
        key = loader.construct_object(key_node, deep=True)
        if key in seen:
            raise yaml.constructor.ConstructorError(
                None, None, f"key {key!r} appears twice", key_node.start_mark
            )
        seen.add(key)
    return loader.construct_mapping(node, deep=True)


_UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping_without_repeats
)


def read_yaml(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return yaml.load(handle, Loader=_UniqueKeyLoader)  # noqa: S506 (safe loader subclass)


def _describe(error: dict[str, Any]) -> str:
    loc = [str(part) for part in error["loc"]]
    kind = error["type"]
    if kind == "extra_forbidden":
        where = ".".join(loc[:-1])
        return f"{where + ': ' if where else ''}unknown key '{loc[-1]}'"
    if kind == "missing":
        where = ".".join(loc[:-1])
        return f"{where + ': ' if where else ''}missing key '{loc[-1]}'"
    where = ".".join(loc)
    prefix = f"{where}: " if where else ""
    if kind == "string_too_short":
        return f"{prefix}must not be empty"
    if kind == "string_pattern_mismatch":
        pattern = error.get("ctx", {}).get("pattern", "")
        return f"{prefix}{error['input']!r} does not match the expected form {pattern}"
    if kind == "literal_error":
        expected = error.get("ctx", {}).get("expected", "")
        return f"{prefix}{error['input']!r} is not one of {expected}"
    if kind == "union_tag_invalid":
        ctx = error.get("ctx", {})
        return (
            f"{prefix}unknown kind {ctx.get('tag')!r}; expected one of {ctx.get('expected_tags')}"
        )
    message = error["msg"]
    if message.startswith("Value error, "):
        message = message[len("Value error, ") :]
    return f"{prefix}{message}"


def _label(entry: Any, index: int) -> str:
    if isinstance(entry, dict) and isinstance(entry.get("id"), str):
        return f"entry {index + 1} ({entry['id']})"
    return f"entry {index + 1}"


def _parse_file(
    path: Path, model: type[Strict], problems: list[str], invalid: set[str]
) -> dict[str, Any]:
    """Parse one registry file into {id: model}, appending readable problems. Ids of entries
    that fail are added to `invalid`, so references to them do not repeat the problem."""
    rel = f"registry/{path.name}"
    if not path.is_file():
        problems.append(f"{rel}: file is missing")
        return {}
    try:
        data = read_yaml(path)
    except yaml.YAMLError as exc:
        problems.append(f"{rel}: not valid YAML: {exc}".replace("\n", " "))
        return {}
    if data is None:
        data = []
    if not isinstance(data, list):
        problems.append(f"{rel}: the file must be a list of entries")
        return {}
    parsed: dict[str, Any] = {}
    for index, entry in enumerate(data):
        label = _label(entry, index)
        if not isinstance(entry, dict):
            problems.append(f"{rel}: {label}: each entry must be a mapping of keys to values")
            continue
        try:
            item = model.model_validate(entry)
        except ValidationError as exc:
            for error in exc.errors():
                problems.append(f"{rel}: {label}: {_describe(error)}")
            if isinstance(entry.get("id"), str):
                invalid.add(entry["id"])
            continue
        if item.id in parsed:
            problems.append(f"{rel}: {label}: id '{item.id}' is used more than once")
            continue
        parsed[item.id] = item
    return parsed


def _cross_check(
    reg: dict[str, dict[str, Any]],
    invalid: dict[str, set[str]],
    repo_root: Path | None,
    problems: list[str],
) -> None:
    # An entry that failed its own checks is already reported; count its id as present here.
    licenses = reg["licenses"].keys() | invalid["licenses"]
    groups = reg["groups"].keys() | invalid["groups"]
    sources = reg["sources"].keys() | invalid["sources"]
    routes = reg["routes"].keys() | invalid["routes"]
    partners = reg["partners"].keys() | invalid["partners"]

    for source in reg["sources"].values():
        where = f"registry/sources.yaml: {source.id}"
        if source.license not in licenses:
            problems.append(f"{where}: license '{source.license}' is not in registry/licenses.yaml")
        endpoint = source.endpoint
        curated = isinstance(endpoint, CuratedEndpoint) and repo_root is not None
        if curated and not (repo_root / endpoint.path).is_file():
            problems.append(f"{where}: curated file {endpoint.path} does not exist")

    for layer in reg["layers"].values():
        where = f"registry/layers.yaml: {layer.id}"
        if layer.group not in groups:
            problems.append(f"{where}: group '{layer.group}' is not in registry/groups.yaml")
        for source_id in layer.sources:
            if source_id not in sources:
                problems.append(f"{where}: source '{source_id}' is not in registry/sources.yaml")
        if len(set(layer.sources)) != len(layer.sources):
            problems.append(f"{where}: a source is listed twice")
        setting_ids = [setting.id for setting in layer.settings]
        if len(set(setting_ids)) != len(setting_ids):
            problems.append(f"{where}: setting ids repeat: {setting_ids}")
        if layer.guide and repo_root is not None:
            page = repo_root / "content" / f"{layer.guide}.md"
            if not page.is_file():
                problems.append(f"{where}: guide page content/{layer.guide}.md does not exist")

    for lens in reg["lenses"].values():
        where = f"registry/lenses.yaml: {lens.id}"
        factor_ids = [factor.id for factor in lens.factors]
        fields = [factor.field for factor in lens.factors]
        if len(set(factor_ids)) != len(factor_ids):
            problems.append(f"{where}: factor ids repeat: {factor_ids}")
        if len(set(fields)) != len(fields):
            problems.append(f"{where}: factor fields repeat: {fields}")
        if lens.id == "violence":
            for factor in lens.factors:
                if factor.evidence == "not_violence":
                    problems.append(
                        f"{where}: factor '{factor.id}' has no violence evidence and cannot be in "
                        "the violence lens"
                    )
        preset_ids = [preset.id for preset in lens.presets]
        if len(set(preset_ids)) != len(preset_ids):
            problems.append(f"{where}: preset ids repeat: {preset_ids}")
        for preset in lens.presets:
            for factor_id in preset.weights:
                if factor_id not in factor_ids:
                    problems.append(
                        f"{where}: preset '{preset.id}' weights unknown factor '{factor_id}'"
                    )

    for suggestion in reg["suggestions"].values():
        where = f"registry/suggestions.yaml: {suggestion.id}"
        for route_id in suggestion.routes:
            if route_id not in routes:
                problems.append(f"{where}: route '{route_id}' is not in registry/routes.yaml")
        for partner_id in suggestion.partners:
            if partner_id not in partners:
                problems.append(f"{where}: partner '{partner_id}' is not in registry/partners.yaml")


def load_registry(registry_dir: Path, *, repo_root: Path | None = None) -> Registry:
    """Load and check every registry file. Raises RegistryError listing all problems."""
    problems: list[str] = []
    if not registry_dir.is_dir():
        raise RegistryError([f"{registry_dir}: registry folder not found"])
    expected = {f"{name}.yaml" for name in REGISTRY_FILES}
    for path in sorted(registry_dir.iterdir()):
        if path.suffix in {".yaml", ".yml"} and path.name not in expected:
            problems.append(
                f"registry/{path.name}: unknown registry file (expected one of {sorted(expected)})"
            )
    invalid: dict[str, set[str]] = {name: set() for name in REGISTRY_FILES}
    parsed = {
        name: _parse_file(registry_dir / f"{name}.yaml", MODELS[name], problems, invalid[name])
        for name in REGISTRY_FILES
    }
    _cross_check(parsed, invalid, repo_root, problems)
    if problems:
        raise RegistryError(problems)
    return Registry(root=registry_dir, **parsed)
