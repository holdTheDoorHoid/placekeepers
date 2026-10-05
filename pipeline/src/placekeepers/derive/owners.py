"""Who owns a parcel: the owner type, and the owner facts behind the flags (docs/ETHICS.md).

Owner types, with the tiles' `ot` code (docs/CONTRACTS.md section 4) and the dossier's
`owner.type`:

    1 individual, 2 company, 3 city, 4 land_bank, 5 redevelopment_authority,
    6 housing_authority, 7 nonprofit, 8 other_public, 0 unknown

The City's owned property layer (LAMAAssets) decides first: its agency field names the City (PUB),
the Land Bank (PLB), the Redevelopment Authority (PRA) or the Philadelphia Housing Development
Corporation (PHDC, typed as other public). Otherwise the owner names as OPA publishes them decide,
by the patterns below, tried in this order:

1. public bodies: the Land Bank, the Redevelopment Authority, a housing authority, PHDC, the City,
   the School District, the Community College, SEPTA, the Commonwealth, federal agencies and
   public authorities;
2. company forms a nonprofit almost never uses: LLC, LP, LLP, LTD, LIMITED;
3. nonprofit words: church, ministries, congregation, foundation, charitable, community
   development corporation, land trust, Neighborhood Gardens, university, hospital, school,
   charter school, academy, college and similar;
4. other company words: INC, CORP, CO, TRUST and TR (trustee), HOLDINGS, PROPERTIES, REALTY,
   INVESTMENTS, GROUP, BANK, FBO and similar;
5. a person's name: at least two words and no digits;
6. unknown.

OPA splits long names across owner_1 and owner_2 ("REDEVELOPMENT AUTHORITY" then "OF
PHILADELPHIA"), so the type is read from both names together. A nonprofit is only recognized
when its name says so; many nonprofits are named like companies and are typed as companies.

Possible estate looks at each owner name on its own (a living co-owner can share the record with
an estate), for words such as EST OF, ESTATE, HEIRS, DECEASED, EXECUTOR or ADMINISTRATOR. Names of
public bodies, companies, trusts and nonprofits never count ("REAL ESTATE", "Z ESTATE GROUP LLC",
"CAMAPLAN ADMINISTRATOR FBO"), nor does a life estate or a life tenant, which do not mean the owner
died.

The absentee check compares the mailing address with the parcel's own address. It is
conservative: an owner who gets mail at the parcel or on the same block (the same street and
hundred, such as the house next door) is not absentee, and an address it cannot read is never
flagged.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass

from placekeepers.derive import wording

OWNER_TYPE_CODES = {
    "unknown": 0,
    "individual": 1,
    "company": 2,
    "city": 3,
    "land_bank": 4,
    "redevelopment_authority": 5,
    "housing_authority": 6,
    "nonprofit": 7,
    "other_public": 8,
}
PUBLIC_TYPES = frozenset(
    {"city", "land_bank", "redevelopment_authority", "housing_authority", "other_public"}
)

# The City owned property layer's agency codes.
AGENCY_TYPES = {
    "PUB": "city",
    "PLB": "land_bank",
    "PRA": "redevelopment_authority",
    "PHDC": "other_public",
}


def match_form(name: str | None) -> str:
    """An owner name in one spelling for pattern matching: capitals without accents, every
    character other than letters, digits, '&' and apostrophes turned into a space, single
    spaces. "L.L.C." becomes "L L C" and "P.A.I.D." becomes "P A I D"."""
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).upper()
    text = text.replace("&", " & ")
    text = re.sub(r"[^A-Z0-9&' ]+", " ", text)
    return " ".join(text.split())


@dataclass(frozen=True)
class PublicPattern:
    type: str
    regex: re.Pattern[str]
    label: str
    #: a short id for the body when routes depend on it (PHDC)
    body: str | None = None


def _p(type_: str, pattern: str, label: str, body: str | None = None) -> PublicPattern:
    return PublicPattern(type_, re.compile(pattern), label, body)


PUBLIC_PATTERNS: tuple[PublicPattern, ...] = (
    _p("land_bank", r"\bLAND BANK\b", "the Philadelphia Land Bank"),
    # Also the misspellings OPA carries ("REDEVEL AUTH OF PHILA", "REDEVLOPMENT AUTHORITY").
    _p(
        "redevelopment_authority",
        r"\bREDEV\w* AUTH|\bPHILA(DELPHIA)? REDEVELOP",
        "the Philadelphia Redevelopment Authority",
    ),
    _p(
        "housing_authority",
        r"\bPHILA(DELPHIA)? HOUSING AUTH",
        "the Philadelphia Housing Authority",
    ),
    _p("housing_authority", r"\bHOUSING AUTH", "a housing authority"),
    _p(
        "other_public",
        r"\bPHDC\b|\bPHILA(DELPHIA)? HOUSING DEV",
        "the Philadelphia Housing Development Corporation (PHDC)",
        body="phdc",
    ),
    # OPA cut this name short: it can be the housing authority or PHDC.
    _p(
        "other_public",
        r"^PHILA(DELPHIA)? HOUSING$",
        "the Philadelphia Housing Authority or PHDC (the name is cut short)",
    ),
    _p(
        "city",
        r"\bCITY OF PHI?LA|\bPHILA(DELPHIA)? CITY OF\b|\bFAIRMOUNT PARK COMM",
        "the City of Philadelphia",
    ),
    _p(
        "other_public",
        r"\bSCHOOL DIST(RICT)? OF PHILA|\bPHILA(DELPHIA)? SCHOOL DIST"
        r"|\bBOARD OF (PUBLIC )?EDUCATION\b",
        "the School District of Philadelphia",
    ),
    _p(
        "other_public",
        r"\bCOMM(UNITY)? COLLEGE OF PHIL",
        "the Community College of Philadelphia",
    ),
    _p("other_public", r"\bSEPTA\b|\bSOUTHEASTERN PENN\w* TRANS", "SEPTA"),
    _p(
        "other_public",
        r"\bCOMMONWEALTH (OF )?P(ENN\w*|A)\b|\bCOMM OF PENN|\bGENERAL STATE AUTH|\bSTATE OF PENN"
        r"|\bPENNDOT\b|\bDEP(AR)?T(MENT)? OF TRANSP",
        "the Commonwealth of Pennsylvania",
    ),
    _p(
        "other_public",
        r"\bHOUSING FINANCE AGENCY\b|\bPHFA\b",
        "the Pennsylvania Housing Finance Agency",
    ),
    _p(
        "other_public",
        r"\bUNITED STATES OF AMERICA\b|\bUNITED STATES POSTAL|\bU S POSTAL|^U S A$",
        "the United States government",
    ),
    _p(
        "other_public",
        r"\bSEC(RETARY)? OF HOUSING|\bHOUSING (AND|&) URBAN DEV",
        "the U.S. Department of Housing and Urban Development",
    ),
    _p(
        "other_public",
        r"\bVET(ERANS?)? AFF|\bVETERANS ADMIN",
        "the U.S. Department of Veterans Affairs",
    ),
    # OPA writes this one many ways, often cut short: "PHILA AUTH IND DEV", "PHILA AUTH & IND
    # DEV", "PHILADELPHIA AUTHORITY FO".
    _p(
        "other_public",
        r"\bAUTH(ORITY)? FOR IND(USTRIAL)? DEV|\bP A I D\b|\bPHILA(DELPHIA)? AUTH(ORITY)?\b",
        "the Philadelphia Authority for Industrial Development",
    ),
    _p(
        "other_public",
        r"\bPHILA(DELPHIA)? REG\w* POR",
        "the Philadelphia Regional Port Authority",
    ),
    _p(
        "other_public",
        r"\bOFFICE OF THE DISTRICT AT|\bDISTRICT ATTORNEY",
        "the Philadelphia District Attorney's Office",
    ),
    _p(
        "other_public",
        r"\bPARKING AUTH|\bPORT AUTH|\bREGIONAL PORT\b|\bCONVENTION CENTER AUTH|\bTURNPIKE COMM"
        r"|\bMUNICIPAL AUTH|\bIND(USTRIAL)? DEV(ELOPMENT)? AUTH|\bSCHOOL (BLDG|BUILDING) AUTH",
        "a public authority",
    ),
    _p("other_public", r"\bGAS WORKS\b", "Philadelphia Gas Works"),
)

FOR_PROFIT = re.compile(
    r"\b(L ?L ?C|P ?L ?L ?C|L ?L ?L ?P|L ?L ?P|LTD|LIMITED|GP)\b|\b(LP)\b|\b(L P|L ?L)$"
)
NONPROFIT = re.compile(
    r"\b(CHURCH(ES)?|MINISTR(Y|IES)|CONGREGATION|SYNAGOGUE|MOSQUE|MASJID|ARCHDIOCESE|DIOCESE"
    r"|PARISH|BAPTIST|METHODIST|EPISCOPAL|LUTHERAN|PRESBYTERIAN|PENTECOSTAL|TABERNACLE"
    r"|KINGDOM HALL|EVANGELICAL|APOSTOLIC|CATHOLIC|NON ?PROFIT|CHARIT(Y|IES|ABLE)|FOUNDATION"
    r"|COMMUNITY DEV\w* CORP\w*|CDC|LAND TRUST|NEIGHBORHOOD GARDENS|HABITAT FOR HUMANITY|YMCA"
    r"|YWCA|UNIVERSITY(?! CITY)|HOSPITAL|HORTICULTURAL SOCIETY|CIVIC ASS\w*|COMMUNITY ASS\w*"
    r"|NEIGHBORHOOD ASS\w*|TOWN WATCH|AMERICAN LEGION"
    # Schools, including charter schools whose names OPA cut short ("ILADELPHIA CHARTER SCHOOL",
    # "FRANKLIN TOWNE CHARTER HI"); a "SCHOOL HOUSE" in an address is not a school.
    r"|SCHOOLS?(?! ?HOUSE)|CHARTER (SCH\w*|SC|HI\w*|ACADEM\w*)|CHARTER$|ACADEMY|ACADEMIES|COLLEGE"
    r"|SEMINARY|MONTESSORI|PREPARATORY)\b"
)
COMPANY = re.compile(
    r"\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|COMPANIES|PARTNERS|PARTNERSHIP"
    r"|ASSOCIATES|ASSOC|ASSN|ASSOCIATION|HOLDINGS?|PROPERT\w*|REALTY|REAL EST(ATE)?|INVEST\w*"
    r"|ENTERPRISES?|GROUP|DEVELOPMENT|DEVELOPERS?|MANAGEMENT|MGMT|VENTURES?|CAPITAL|FUNDS?"
    r"|FUNDING|BANK|MORTGAGE|FINANCIAL|SAVINGS|TRUSTS?|TRUSTEES?|TRST|TRS|TR|T U W|FBO"
    r"|CUSTODIAN|HOMES|BUILDERS?|CONSTRUCTION|CONTRACTORS?|SERVICES|SOLUTIONS|CONDOMINIUMS?"
    r"|ESTATES|APARTMENTS|HOUSING|DBA|RENTALS?|HOMEOWNERS|CAMA ?PLAN|RAILROAD|RAILWAY|CONRAIL"
    r"|AMTRAK|BNY|MELLON)\b|\b(FB|N A)$"
)
UNKNOWN_NAME = re.compile(r"\bUNKNOWN\b|\bNOT AVAILABLE\b|\bNONE\b")
# Generational suffixes and shares of ownership are part of a person's name: JR, SR, 2ND, 03RD,
# III, "1/2 INT".
GENERATION = re.compile(r"\b0?\d(ST|ND|RD|TH)\b|\b\d+ \d+ INT(EREST)?\b")

ESTATE_IGNORE = re.compile(r"\b(LIFE|LF) (EST(ATE)?|TENANT)\b|\bREAL EST(ATE)?\b")
ESTATE = re.compile(
    r"\bEST(ATE)?\b|\bHEIRS?\b|\bDECEASED\b|\bDEC'?D\b|\bEXECUT(OR|ORS|RIX|RICES)\b|\bEXRX?\b"
    r"|\bEXRS\b|\bADMINISTRAT(OR|ORS|RIX)\b|\bADM(R|RX|X)\b|\bPERSONAL REP\w*|\bPERS REP\b"
)
# An owner_1 ending like this continues in owner_2 ("THE TRUSTEES OF THE", "EST OF STEPHEN
# GIRARD").
DANGLING = re.compile(r"\b(OF|THE|AND|&|FOR|FBO|TO)$")


@dataclass(frozen=True)
class OwnerType:
    type: str
    reason: str
    #: a short id for the public body when routes depend on it: the City owned layer's agency
    #: (PUB, PLB, PRA, PHDC) or "phdc" when the name says PHDC
    body: str | None = None

    @property
    def code(self) -> int:
        return OWNER_TYPE_CODES[self.type]

    @property
    def public(self) -> bool:
        return self.type in PUBLIC_TYPES


def _marker(found: re.Match[str], squeeze: bool = False) -> str:
    """The word that decided the type, as written ("L L C" squeezed to LLC for company forms)."""
    text = next(group for group in found.groups() if group)
    return text.replace(" ", "") if squeeze else text


def type_from_name(names: list[str]) -> OwnerType:
    """The owner type from the owner names alone (see the module docstring for the order)."""
    joined = match_form(" ".join(name for name in names if name))
    if not joined:
        return OwnerType("unknown", wording.NO_NAME_REASON)
    for pattern in PUBLIC_PATTERNS:
        if pattern.regex.search(joined):
            return OwnerType(pattern.type, wording.public_name_reason(pattern.label), pattern.body)
    if found := FOR_PROFIT.search(joined):
        return OwnerType("company", wording.marker_reason(_marker(found, squeeze=True)))
    if found := NONPROFIT.search(joined):
        return OwnerType("nonprofit", wording.marker_reason(_marker(found)))
    if found := COMPANY.search(joined):
        return OwnerType("company", wording.marker_reason(_marker(found)))
    if any(re.search(r"\bN A$", unit) for unit in _name_units(names)):
        return OwnerType("company", wording.marker_reason("N A"))
    plain = GENERATION.sub(" ", joined)
    words = [word for word in plain.split() if word not in {"&", "AND"}]
    if UNKNOWN_NAME.search(joined) or any(ch.isdigit() for ch in plain) or len(words) < 2:
        return OwnerType("unknown", wording.UNCLEAR_REASON)
    return OwnerType("individual", wording.INDIVIDUAL_REASON)


def owner_type(names: list[str], agency: str | None) -> OwnerType:
    """The City owned layer's agency first, then the owner names. When the agency and a clearly
    private owner name disagree, the agency still decides (the layer is the City's own list), and
    the reason says to ask which is current."""
    from_names = type_from_name(names)
    agency = (agency or "").strip().upper()
    if agency in AGENCY_TYPES:
        conflict = from_names.type in {"individual", "company", "nonprofit"}
        return OwnerType(AGENCY_TYPES[agency], wording.agency_reason(agency, conflict), agency)
    return from_names


def _name_units(names: list[str]) -> list[str]:
    """Owner names as separate units, joining an owner_1 that runs on into owner_2."""
    units: list[str] = []
    for name in names:
        form = match_form(name)
        if not form:
            continue
        if units and DANGLING.search(units[-1]):
            units[-1] = f"{units[-1]} {form}"
        else:
            units.append(form)
    return units


def _is_organization(unit: str) -> bool:
    return bool(
        any(pattern.regex.search(unit) for pattern in PUBLIC_PATTERNS)
        or FOR_PROFIT.search(unit)
        or NONPROFIT.search(unit)
        or COMPANY.search(unit)
    )


def possible_estate(names: list[str]) -> bool:
    """True when an owner name that belongs to a person carries estate wording."""
    for unit in _name_units(names):
        if _is_organization(unit):
            continue
        if ESTATE.search(ESTATE_IGNORE.sub(" ", unit)):
            return True
    return False


# Mailing addresses
def _words(text: str) -> frozenset[str]:
    return frozenset(text.split())


US_STATES = _words(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ "
    "NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP AA AE AP"
)
UNIT_WORDS = _words(
    "UNIT APT APARTMENT STE SUITE FL FLR FLOOR RM ROOM BLDG BUILDING PH DEPT SPC LOT"
)
DIRECTIONS = _words("N S E W NORTH SOUTH EAST WEST NE NW SE SW")
SUFFIXES = {
    "STREET": "ST",
    "ST": "ST",
    "AVENUE": "AVE",
    "AVE": "AVE",
    "AV": "AVE",
    "ROAD": "RD",
    "RD": "RD",
    "BOULEVARD": "BLVD",
    "BLVD": "BLVD",
    "BLV": "BLVD",
    "DRIVE": "DR",
    "DR": "DR",
    "LANE": "LN",
    "LN": "LN",
    "PLACE": "PL",
    "PL": "PL",
    "TERRACE": "TER",
    "TERR": "TER",
    "TER": "TER",
    "COURT": "CT",
    "CT": "CT",
    "PARKWAY": "PKWY",
    "PKWY": "PKWY",
    "SQUARE": "SQ",
    "SQ": "SQ",
    "CIRCLE": "CIR",
    "CIR": "CIR",
    "ALLEY": "ALY",
    "ALY": "ALY",
    "HIGHWAY": "HWY",
    "HWY": "HWY",
    "PIKE": "PIKE",
    "WAY": "WAY",
    "WALK": "WALK",
    "MALL": "MALL",
    "PLAZA": "PLZ",
    "PLZ": "PLZ",
}
ORDINALS = {
    "FIRST": "1ST",
    "SECOND": "2ND",
    "THIRD": "3RD",
    "FOURTH": "4TH",
    "FIFTH": "5TH",
    "SIXTH": "6TH",
    "SEVENTH": "7TH",
    "EIGHTH": "8TH",
    "NINTH": "9TH",
    "TENTH": "10TH",
}
HOUSE = re.compile(r"^\s*(\d+)\s*[A-Z]?(?:\s*-\s*(\d+)\s*[A-Z]?)?\s+(.+)$")
PO_BOX = re.compile(r"\b(P\s*O\s*BOX|POST OFFICE BOX|PO BOX|BOX \d+)\b")


@dataclass(frozen=True)
class Address:
    low: int
    high: int
    street: tuple[str, ...]


def parse_address(text: str | None) -> Address | None:
    """A street address as house numbers and street words, or None when it has no house number.
    "1304-08 E PASSYUNK AVE" is 1304 to 1308 on PASSYUNK; the direction, the street type and any
    unit ("UNIT #A", "STE 1243") are left out."""
    found = HOUSE.match((text or "").upper())
    if not found:
        return None
    low = int(found.group(1))
    high = low
    if found.group(2):
        tail = found.group(2)
        widened = int(str(low)[: max(0, len(str(low)) - len(tail))] + tail)
        high = widened if widened >= low else low
    words: list[str] = []
    for raw in found.group(3).split():
        if raw.startswith("#"):
            break
        word = re.sub(r"[^A-Z0-9]", "", raw)
        if not word:
            continue
        if word in UNIT_WORDS:
            break
        word = ORDINALS.get(word, word)
        word = re.sub(r"^0+(\d)", r"\1", word)
        words.append(word)
    words = [word for word in words if word not in DIRECTIONS] or words
    if len(words) > 1 and words[-1] in SUFFIXES:
        words = words[:-1]
    if not words:
        return None
    return Address(low, high, tuple(words))


def compare_addresses(parcel: str | None, mailing: str | None) -> str:
    """One of "same" (mail goes to the parcel), "same_block" (the same street and hundred, as the
    house next door), "different", "po_box", or "unknown" when either cannot be read."""
    if mailing and PO_BOX.search(mailing.upper()):
        return "po_box"
    a, b = parse_address(parcel), parse_address(mailing)
    if a is None or b is None:
        return "unknown"
    # "MC CLELLAN" and "MCCLELLAN" are one street.
    if "".join(a.street) != "".join(b.street):
        return "different"
    if a.low <= b.low <= a.high or b.low <= a.low <= b.high:
        return "same"
    if b.low // 100 in {a.low // 100, a.high // 100}:
        return "same_block"
    return "different"


@dataclass(frozen=True)
class Absentee:
    #: "elsewhere_in_city", "po_box_in_city", "outside_city" or "out_of_state"
    scope: str
    city: str | None
    state: str | None

    @property
    def text(self) -> str:
        return wording.absentee_text(self.scope, self.city, self.state)


def split_city_state(text: str | None) -> tuple[str | None, str | None]:
    """("BLUE BELL", "PA") from "BLUE BELL PA"; the state is None when the last word is not a US
    state or territory."""
    words = " ".join((text or "").upper().replace(",", " ").split()).split()
    if not words:
        return None, None
    if words[-1] in US_STATES:
        return (" ".join(words[:-1]) or None), words[-1]
    return " ".join(words), None


def absentee(
    location: str | None,
    mailing_street: str | None,
    mailing_city_state: str | None,
    mailing_zip: str | None,
) -> Absentee | None:
    """Whether the owner gets mail somewhere other than the parcel, and where: out of state,
    elsewhere in Pennsylvania, or elsewhere in Philadelphia. None when the owner gets mail at the
    parcel or on its block, or when the mailing address cannot be read."""
    city, state = split_city_state(mailing_city_state)
    zip5 = re.sub(r"\D", "", mailing_zip or "")[:5]
    if not city and not state and not zip5:
        return None
    if state is not None and state != "PA":
        return Absentee("out_of_state", city, state)
    # Every 191xx ZIP code is Philadelphia, whatever neighborhood the city line names.
    if (city or "").startswith("PHILA") or zip5.startswith("191"):
        match compare_addresses(location, mailing_street):
            case "po_box":
                return Absentee("po_box_in_city", "PHILADELPHIA", "PA")
            case "different":
                return Absentee("elsewhere_in_city", "PHILADELPHIA", "PA")
            case _:
                return None
    if state == "PA":
        return Absentee("outside_city", city, "PA")
    if city:
        # No US state on the city line: most often an address abroad.
        return Absentee("out_of_state", city, None)
    return Absentee("outside_city", None, None)


def mailing_text(parts: list[str | None]) -> str | None:
    """The mailing address as the City publishes it: its lines in order, joined with commas,
    skipping empty and repeated lines. The city line and ZIP code share the last line."""
    lines: list[str] = []
    for part in parts:
        text = " ".join((part or "").split())
        if text and text not in lines:
            lines.append(text)
    return ", ".join(lines) or None


# Owners who hold many parcels
KEY_FORMS = (
    (re.compile(r"\bL L C\b"), "LLC"),
    (re.compile(r"\bL L P\b"), "LLP"),
    (re.compile(r"\bL P$"), "LP"),
    (re.compile(r"\bINCORPORATED\b"), "INC"),
    (re.compile(r"\bCORPORATION\b"), "CORP"),
    (re.compile(r"\bLIMITED LIABILITY COMPANY\b"), "LLC"),
    (re.compile(r"\bCOMPANY\b"), "CO"),
    (re.compile(r"&"), "AND"),
    (re.compile(r"'"), ""),
)


def owner_key(names: list[str]) -> str | None:
    """A conservative key for counting an owner's parcels: every owner name in order, each in one
    spelling (capitals, no punctuation or accents, "L.L.C." as LLC, "&" as AND). Two parcels share
    an owner only when all their owner names match, so different owners are never merged, at the
    cost of missing an owner who appears under two spellings."""
    parts = []
    for name in names:
        form = match_form(name)
        for pattern, replacement in KEY_FORMS:
            form = pattern.sub(replacement, form)
        form = " ".join(form.split())
        if form:
            parts.append(form)
    return " / ".join(parts) or None


def owner_list_id(key: str) -> str:
    """A short stable id for an owner key, used to link a flag to the owner's list of parcels."""
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]
