"""Extract "The Pure Bodybuilding Program - Full Body" PDF into the GymBros source data.

Usage (from the repo root):
    python scripts/extract/extract_pdf.py [path/to/program.pdf]

The PDF path can also be given with the GYMBROS_PDF env var.

Writes:
    data/source/program.json     program / blocks / weeks / days / prescriptions
    data/source/exercises.json   catalog of every exercise name (main, subs, weak-point options)
    data/source/weak-points.json weak point table (pages 4-5) with option slugs
    .cache/program.raw.json      raw per-page extraction (debug aid)

Manual per-cell fixes live in data/source/overrides.json. The hand-authored files
techniques.json, warmup.json and notes-es.json are NOT touched by this script.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/The_Pure_Bodybuilding_Program_-_Full_Body.pdf"
SOURCE_DIR = ROOT / "data" / "source"
CACHE_DIR = ROOT / ".cache"
OVERRIDES = json.loads((SOURCE_DIR / "overrides.json").read_text(encoding="utf-8"))

SESSION_PAGES = range(6, 56)  # 1-based, inclusive 6..55
WEAK_POINT_PAGE = 4

FIELDS = {  # raw field -> table column index
    "name": 1, "technique": 2, "warmup": 3, "sets": 4, "reps": 5,
    "early_rpe": 10, "last_rpe": 11, "rest": 12, "sub1": 13, "sub2": 14, "notes": 15,
}

TECHNIQUES = {
    "N/A": None,
    "Long-length Partials (on all reps of the last set)": "long_length_partials",
    "Myo-reps": "myo_reps",
    "Dropset": "dropset",
    "Mechanical Dropset (on all sets)": "mechanical_dropset",
    "Integrated Partials (on all sets)": "integrated_partials",
    "Pec Static Stretch (30 sec hold)": "static_stretch_pec",
    "Quad Static Stretch (30 sec hold)": "static_stretch_quad",
    "Calf Static Stretch (30 sec)": "static_stretch_calf",
}

BANNERS_ES = {
    "BLOCK 1: 5-WEEK BUILD PHASE": "BLOQUE 1: FASE DE CONSTRUCCIÓN DE 5 SEMANAS",
    "SEMI-DELOAD WEEK: AVOID FAILURE AND TRAIN LIGHTER THIS WEEK TO PROMOTE RECOVERY AND TO PREPARE FOR THE NEXT 5 WEEKS!":
        "SEMANA DE SEMI-DESCARGA: EVITA EL FALLO Y ENTRENA MÁS LIGERO ESTA SEMANA PARA FAVORECER LA RECUPERACIÓN "
        "Y PREPARARTE PARA LAS SIGUIENTES 5 SEMANAS",
    "BLOCK 2: 5-WEEK NOVELTY PHASE": "BLOQUE 2: FASE DE NOVEDAD DE 5 SEMANAS",
}

BLOCKS = [
    {
        "number": 1, "name": "Build Phase", "nameEs": "Fase de construcción",
        "description": (
            "Bloque de 5 semanas para construir la base. Las dos primeras semanas la mayoría de las series "
            "se quedan en RPE ~7-9 (1-3 repeticiones en reserva) y con pocas técnicas de intensidad, para "
            "adaptarte a entrenar todo el cuerpo con alta frecuencia. A partir de la semana 3 la intensidad sube "
            "y casi todas las series llegan a RPE 9-10. La semana 5 es de semi-descarga: evita el fallo y entrena más ligero."
        ),
    },
    {
        "number": 2, "name": "Novelty Phase", "nameEs": "Fase de novedad",
        "description": (
            "Bloque de 5 semanas que cambia la selección de ejercicios para dar un estímulo nuevo: aparecen "
            "superseries, series compuestas (remo + Kelso shrug), pirámides inversas, parciales integradas y "
            "dropsets mecánicos. La mayoría de las series se llevan a RPE 9-10, con la última serie cerca del fallo o al fallo."
        ),
    },
]

# Weak point table (pages 4-5). Option order per column must follow the PDF; YouTube ids are read
# from the page hyperlinks, column by column, top to bottom.
WEAK_POINTS = [
    ("shoulders", "Shoulders", "Hombros",
     [("Cuffed Behind-The-Back Lateral Raise", None), ("Machine Lateral Raise", None), ("Dumbbell Lateral Raise", None)],
     [("Machine Shoulder Press", None), ("Smith Machine Shoulder Press", None), ("Standing DB Arnold Press", None)]),
    ("lats", "Lats (“Back Width”)", "Dorsales (“amplitud de espalda”)",
     [("Cable Lat Prayer", None), ("DB Lat Pullover", None), ("Machine Lat Pullover", None)],
     [("Lat-Focused Cable Row", None), ("Elbows-In 1-Arm DB Row", None), ("Half-Kneeling 1-Arm Lat Pulldown", None)]),
    ("quads", "Quads", "Cuádriceps",
     [("Leg Extension", None), ("Reverse Nordics", None)],
     [("Single-Leg Leg Press", None), ("Sissy Squat", None)]),
    ("glutes", "Glutes", "Glúteos",
     [("Machine Hip Abduction", None), ("Cable Hip Abduction", None), ("Lateral Band Walk", None)],
     [("Barbell Hip Thrust", None), ("Single-Leg DB Hip Thrust", None)]),
    ("chest", "Chest", "Pecho",
     [("Low Incline DB Flye", None), ("Low-To-High Cable Crossover", None)],
     [("Chest Press Machine", "incline if upper pecs are lagging, flat if entire chest is lagging"),
      ("Dumbbell Chest Press", "incline if upper pecs are lagging, flat if entire chest is lagging")]),
    ("neck", "Neck", "Cuello",
     [("Plate-Loaded Neck Curls", None)],
     [("Head Harness Neck Extension", None), ("Plate-Loaded Neck Extension", None)]),
]

WEAK_POINT_GUIDANCE = [
    ("hamstrings", "Hamstrings", "Isquiotibiales",
     "There is a lot of hamstrings volume in this program. If they are a weak point for you, simply focus on "
     "executing the exercises listed with your best effort and execution rather than adding more volume.",
     "El programa ya tiene mucho volumen de isquiotibiales. Si son tu punto débil, concéntrate en ejecutar los "
     "ejercicios indicados con tu mejor esfuerzo y técnica en lugar de añadir más volumen."),
    ("calves", "Calves", "Pantorrillas",
     "Rather than adding more calf training volume, focus on the execution of the sets given in the program first. "
     "Ensure you are pausing at the bottom of each rep and reaching a high level of effort. Feel free to sprinkle in "
     "1-2 extra sets per exercise if they are a major priority for you.",
     "En lugar de añadir más volumen de pantorrilla, primero enfócate en ejecutar bien las series del programa. "
     "Haz una pausa abajo en cada repetición y alcanza un nivel alto de esfuerzo. Si son una gran prioridad para ti, "
     "puedes añadir 1-2 series extra por ejercicio."),
    ("mid_back", "Mid-Back (“Back Thickness”)", "Espalda media (“grosor de espalda”)",
     "There is a lot of mid-back volume in this program. If this is a weak point for you, simply focus on executing "
     "the exercises listed with your best effort and execution rather than adding more volume. Really focus on "
     "squeezing your shoulder blades together on the positive and feeling your back pull apart on the negative when "
     "doing mid-back focused rows.",
     "El programa ya tiene mucho volumen de espalda media. Si es tu punto débil, concéntrate en ejecutar los ejercicios "
     "indicados con tu mejor esfuerzo y técnica en lugar de añadir más volumen. En los remos enfocados en espalda media, "
     "junta con fuerza las escápulas en la fase concéntrica y siente cómo se estira la espalda en la excéntrica."),
    ("upper_traps", "Upper Traps", "Trapecio superior",
     "The upper traps shouldn’t require a high level of volume to grow, especially when there is a lot of mid-back "
     "work. Before adding sets, focus on the execution of the sets given in the program first. Ensure you are "
     "squeezing your traps at the top of each rep and reaching a high level of effort. Feel free to sprinkle in 1-2 "
     "extra sets per exercise if they are a major priority for you.",
     "El trapecio superior no necesita mucho volumen para crecer, sobre todo cuando hay mucho trabajo de espalda media. "
     "Antes de añadir series, enfócate en ejecutar bien las del programa: aprieta el trapecio arriba en cada repetición "
     "y alcanza un nivel alto de esfuerzo. Si es una gran prioridad para ti, puedes añadir 1-2 series extra por ejercicio."),
    ("abs", "Abs", "Abdominales",
     "The abs shouldn’t require a high level of volume to grow. If you are wanting to see your abs, your diet will be "
     "mainly responsible for lowering your level of abdominal fat to allow them to show through. Before adding sets, "
     "focus on the execution of the sets given in the program first. Ensure you are allowing your lower back to round "
     "on crunches and leg raises as you squeeze your abs. Feel free to sprinkle in 1-2 extra sets per exercise if they "
     "are a major priority for you.",
     "Los abdominales no necesitan mucho volumen para crecer. Si quieres que se vean, la dieta es la principal "
     "responsable de bajar la grasa abdominal. Antes de añadir series, enfócate en ejecutar bien las del programa: deja "
     "que la zona lumbar se redondee en los crunches y elevaciones de piernas mientras contraes el abdomen. Si son una "
     "gran prioridad para ti, puedes añadir 1-2 series extra por ejercicio."),
    ("biceps", "Biceps", "Bíceps",
     "Because there is a dedicated arm day in this program and the biceps will get plenty of indirect work back "
     "exercises, adding even more sets would probably not be productive and would most likely fall under the “junk "
     "volume” category.",
     "Como el programa tiene un día dedicado a brazos y los bíceps reciben mucho trabajo indirecto en los ejercicios de "
     "espalda, añadir más series probablemente no sería productivo y caería en la categoría de “volumen basura”."),
    ("triceps", "Triceps", "Tríceps",
     "Because there is a dedicated arm day in this program and the triceps will get plenty of indirect work from "
     "pressing, adding even more sets would probably not be productive and would most likely fall under the “junk "
     "volume” category.",
     "Como el programa tiene un día dedicado a brazos y los tríceps reciben mucho trabajo indirecto en los empujes, "
     "añadir más series probablemente no sería productivo y caería en la categoría de “volumen basura”."),
]


# ---------------------------------------------------------------- text helpers
def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def fix_text(s: str) -> str:
    """Generic cleanup for notes: replacements, joined hyphenated line-breaks, stray spaces."""
    s = clean(s)
    for r in OVERRIDES["textReplacements"]:
        s = s.replace(r["from"], r["to"])
    s = re.sub(r"(\w)- (\w)", r"\1-\2", s)  # "Behind- The-Back" -> "Behind-The-Back"
    s = re.sub(r"\s+([.,;:!?])", r"\1", s)  # trailing " ." etc.
    return s.strip()


SUPERSET_RE = re.compile(r"^(?:Superset\s+)?([AB])([12])\s*:\s*", re.I)


def normalize_name(raw: str) -> tuple[str, str | None, int | None]:
    """Return (canonical name, superset group, superset order)."""
    s = clean(raw)
    group = order = None
    m = SUPERSET_RE.match(s)
    if m:
        group, order = m.group(1).upper(), int(m.group(2))
        s = s[m.end():]
    s = re.sub(r"(\w)- (\w)", r"\1-\2", s)
    s = OVERRIDES["nameAliases"].get(s, s)
    return s, group, order


def slugify(name: str) -> str:
    s = name.lower().replace("&", " and ").replace("°", "").replace("+", " plus ")
    s = re.sub(r"[/\\]", " ", s)
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s-]+", "-", s)
    return s.strip("-")


def video_id(uri: str | None) -> str | None:
    if not uri:
        return None
    m = re.search(r"(?:youtu\.be/|v=|/shorts/|/embed/)([\w-]{11})", uri)
    return m.group(1) if m else None


def link_in(page, bbox) -> str | None:
    if not bbox:
        return None
    x0, top, x1, bottom = bbox
    for h in page.hyperlinks:
        cx, cy = (h["x0"] + h["x1"]) / 2, (h["top"] + h["bottom"]) / 2
        if x0 <= cx <= x1 and top <= cy <= bottom:
            return h["uri"]
    return None


# ---------------------------------------------------------------- extraction
def extract_sessions(pdf) -> list[dict]:
    out = []
    for pn in SESSION_PAGES:
        page = pdf.pages[pn - 1]
        table = page.find_tables()[0]
        rows, rowobjs = table.extract(), table.rows
        hi = next(i for i, r in enumerate(rows) if any("SET 1" in (x or "") for x in r))
        banner = clean(rows[0][0]) if hi >= 2 else ""
        week = clean(rows[hi - 1][0])
        first = hi + 1
        raw_day = next((x for x in (r[0] for r in rows[first:]) if x), "")
        day = clean(raw_day[::-1])  # rotated text comes out reversed
        rest = "restday" in re.sub(r"\s", "", page.extract_text().lower())
        exercises = []
        for r, ro in zip(rows[first:], rowobjs[first:]):
            if not clean(r[1]):
                continue
            ex = {k: clean(r[i]) for k, i in FIELDS.items()}
            cells = ro.cells
            ex["video"] = link_in(page, cells[1])
            ex["sub1_video"] = link_in(page, cells[13])
            ex["sub2_video"] = link_in(page, cells[14])
            exercises.append(ex)
        out.append(dict(page=pn, block=banner, week=week, day=day, rest_day_after=rest, exercises=exercises))
    return out


def repair_note_overflow(sessions: list[dict]) -> list[int]:
    """A notes cell can overflow into the next row: the tail of row i (no final punctuation) continues
    at the start of row i+1 (which then begins in lowercase). Move the dangling sentence down."""
    fixed = []
    for s in sessions:
        exs = s["exercises"]
        for a, b in zip(exs, exs[1:]):
            na, nb = a["notes"], b["notes"]
            if na and nb and not re.search(r"[.!?)\"”]$", na) and nb[0].islower():
                # last sentence of a = everything after the last sentence terminator
                m = re.search(r"^(.*[.!?)\"”])\s+(.+)$", na)
                if not m:
                    continue
                a["notes"], tail = m.group(1), m.group(2)
                b["notes"] = f"{tail} {nb}"
                fixed.append(s["page"])
    expected = OVERRIDES.get("expectedNoteOverflows", [])
    if sorted(fixed) != sorted(expected):
        print(f"WARNING: note overflow repaired on pages {fixed}, expected {expected}", file=sys.stderr)
    return fixed


def apply_cell_overrides(sessions: list[dict]) -> None:
    by_page = {s["page"]: s for s in sessions}
    for o in OVERRIDES.get("cells", []):
        ex = by_page[o["page"]]["exercises"][o["position"] - 1]
        if "expect" in o and ex[o["field"]] != o["expect"]:
            raise SystemExit(f"override mismatch p{o['page']}#{o['position']}.{o['field']}: {ex[o['field']]!r}")
        ex[o["field"]] = o["value"]


def extract_weak_point_links(pdf) -> tuple[list[str], list[str]]:
    """YouTube ids of the weak point table, per column (Exercise #1, Exercise #2), top to bottom.
    Options wrapping onto two lines carry two identical consecutive links; they are collapsed."""
    page = pdf.pages[WEAK_POINT_PAGE - 1]
    mid = page.width * 0.6
    cols: tuple[list, list] = ([], [])
    for h in sorted(page.hyperlinks, key=lambda h: h["top"]):
        col = cols[0] if h["x0"] < mid else cols[1]
        vid = video_id(h["uri"])
        if col and col[-1] == vid:
            continue
        col.append(vid)
    return cols


# ---------------------------------------------------------------- build outputs
class Catalog:
    def __init__(self):
        self.items: dict[str, dict] = {}

    def add(self, raw_name: str, uri_or_id: str | None, where: str) -> str:
        name, _, _ = normalize_name(raw_name)
        slug = slugify(name)
        vid = video_id(uri_or_id) if uri_or_id and len(uri_or_id) != 11 else uri_or_id
        cur = self.items.get(slug)
        if cur is None:
            self.items[slug] = {"slug": slug, "name": name, "youtubeId": vid}
        else:
            if cur["youtubeId"] is None:
                cur["youtubeId"] = vid
            elif vid and cur["youtubeId"] != vid:
                print(f"WARNING: {slug} has videos {cur['youtubeId']} and {vid} ({where})", file=sys.stderr)
        return slug


def build_program(sessions: list[dict], catalog: Catalog) -> dict:
    weeks, days = [], []
    for s in sessions:
        week_no = int(re.search(r"\d+", s["week"]).group())
        block_no = 1 if week_no <= 5 else 2
        position = len([d for d in days if d["week"] == week_no]) + 1
        if position == 1:
            banner = s["block"] or None
            weeks.append({
                "number": week_no, "block": block_no, "isDeload": week_no == 5,
                "banner": banner, "bannerEs": BANNERS_ES[banner] if banner else None,
            })
        prescriptions = []
        for i, ex in enumerate(s["exercises"], start=1):
            raw = ex["name"]
            technique = TECHNIQUES[ex["technique"]]
            base = {
                "position": i,
                "technique": technique,
                "warmupText": ex["warmup"],
                "workingSets": int(ex["sets"]),
                "repsText": ex["reps"],
                "earlyRpeText": ex["early_rpe"],
                "lastRpeText": ex["last_rpe"],
                "restText": ex["rest"],
                "notesEn": fix_text(ex["notes"]),
            }
            if raw.startswith("Weak Point Exercise"):
                optional = "optional" in raw.lower()
                prescriptions.append({
                    "position": i, "slot": "weak_point_2" if re.search(r"Exercise\s*2", raw) else "weak_point_1",
                    "exercise": None, "sub1": None, "sub2": None,
                    "supersetGroup": None, "supersetOrder": None,
                    **{k: v for k, v in base.items() if k != "position"},
                    "isOptional": optional,
                })
                continue
            _, group, order = normalize_name(raw)
            where = f"p{s['page']}#{i}"
            prescriptions.append({
                "position": i, "slot": "exercise",
                "exercise": catalog.add(raw, ex["video"], where),
                "sub1": catalog.add(ex["sub1"], ex["sub1_video"], where),
                "sub2": catalog.add(ex["sub2"], ex["sub2_video"], where),
                "supersetGroup": group, "supersetOrder": order,
                **{k: v for k, v in base.items() if k != "position"},
                "isOptional": False,
            })
        days.append({
            "week": week_no, "position": position, "name": s["day"],
            "kind": "arms_weak_points" if "Weak Point" in s["day"] else "full_body",
            "restAfter": s["rest_day_after"],
            "prescriptions": prescriptions,
        })
    return {
        "program": {"slug": "pure-bodybuilding-full-body",
                    "name": "The Pure Bodybuilding Program – Full Body", "author": "Jeff Nippard"},
        "blocks": BLOCKS,
        "weeks": weeks,
        "days": days,
    }


def build_weak_points(pdf, catalog: Catalog) -> list[dict]:
    col_links = extract_weak_point_links(pdf)
    expected = [sum(len(wp[3 + c]) for wp in WEAK_POINTS) for c in (0, 1)]
    if [len(c) for c in col_links] != expected:
        raise SystemExit(f"weak point links per column {[len(c) for c in col_links]} != expected {expected}")
    iters = [iter(col_links[0]), iter(col_links[1])]
    out = []
    for key, en, es, opt1, opt2 in WEAK_POINTS:
        options = []
        for slot, opts in ((1, opt1), (2, opt2)):
            for pos, (name, note) in enumerate(opts, start=1):
                vid = next(iters[slot - 1])
                slug = catalog.add(name, vid, f"weak point {key}/{slot}")
                options.append({"slot": slot, "position": pos, "exercise": slug, "note": note})
        out.append({"key": key, "nameEn": en, "nameEs": es, "guidanceEn": None, "guidanceEs": None,
                    "options": options})
    for key, en, es, gen, ges in WEAK_POINT_GUIDANCE:
        out.append({"key": key, "nameEn": en, "nameEs": es, "guidanceEn": gen, "guidanceEs": ges, "options": []})
    return out


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")


def main() -> None:
    pdf_path = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GYMBROS_PDF", DEFAULT_PDF))
    pdf = pdfplumber.open(pdf_path)

    sessions = extract_sessions(pdf)
    write_json(CACHE_DIR / "program.raw.json", sessions)

    fixed = repair_note_overflow(sessions)
    apply_cell_overrides(sessions)

    catalog = Catalog()
    program = build_program(sessions, catalog)
    weak_points = build_weak_points(pdf, catalog)

    write_json(SOURCE_DIR / "program.json", program)
    write_json(SOURCE_DIR / "weak-points.json", weak_points)
    write_json(SOURCE_DIR / "exercises.json", list(catalog.items.values()))

    n_presc = sum(len(d["prescriptions"]) for d in program["days"])
    print(f"days={len(program['days'])} prescriptions={n_presc} exercises={len(catalog.items)} "
          f"note-overflow-fixed-pages={fixed}")


if __name__ == "__main__":
    main()
