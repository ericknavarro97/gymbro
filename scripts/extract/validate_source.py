"""Validate data/source/*.json produced by extract_pdf.py (+ hand-authored files).

Usage (from the repo root): python scripts/extract/validate_source.py
Exits with status 1 and lists every failure if something is wrong.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "source"

TECHNIQUE_KEYS = {"long_length_partials", "myo_reps", "dropset", "mechanical_dropset", "integrated_partials",
                  "static_stretch_pec", "static_stretch_quad", "static_stretch_calf"}
WEAK_POINT_KEYS = {"shoulders", "lats", "quads", "glutes", "chest", "neck", "hamstrings", "calves", "mid_back",
                   "upper_traps", "abs", "biceps", "triceps"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
YT_RE = re.compile(r"^[\w-]{11}$")

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


def load(name: str):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def main() -> int:
    program = load("program.json")
    exercises = load("exercises.json")
    techniques = load("techniques.json")
    weak_points = load("weak-points.json")
    warmup = load("warmup.json")

    # --- exercises catalog
    slugs = [e["slug"] for e in exercises]
    dup = [s for s, n in Counter(slugs).items() if n > 1]
    check(not dup, f"duplicate slugs: {dup}")
    names = [e["name"] for e in exercises]
    check(len(set(names)) == len(names), "duplicate exercise names")
    for e in exercises:
        check(bool(SLUG_RE.match(e["slug"])), f"bad slug {e['slug']!r}")
        check(e["youtubeId"] is None or bool(YT_RE.match(e["youtubeId"])), f"bad youtubeId for {e['slug']}")
        check(not re.search(r"\w- \w|^(Superset )?[AB][12]:|\s{2,}", e["name"]), f"unnormalized name {e['name']!r}")
    catalog = {e["slug"]: e for e in exercises}

    # --- program structure
    weeks, days = program["weeks"], program["days"]
    check([b["number"] for b in program["blocks"]] == [1, 2], "blocks must be 1 and 2")
    check(len(weeks) == 10 and [w["number"] for w in weeks] == list(range(1, 11)), "need weeks 1..10")
    check(len(days) == 50, f"expected 50 days, got {len(days)}")
    per_week = Counter(d["week"] for d in days)
    check(all(per_week[w] == 5 for w in range(1, 11)), f"5 days per week expected: {dict(per_week)}")
    for d in days:
        check([p["position"] for p in d["prescriptions"]] == list(range(1, len(d["prescriptions"]) + 1)),
              f"week {d['week']} day {d['position']}: positions not contiguous")
    week5 = next(w for w in weeks if w["number"] == 5)
    check(week5["isDeload"] is True, "week 5 must be deload")
    check(sum(w["isDeload"] for w in weeks) == 1, "only week 5 is deload")
    for w in weeks:
        check(w["block"] == (1 if w["number"] <= 5 else 2), f"week {w['number']} wrong block")
        check((w["banner"] is None) == (w["bannerEs"] is None), f"week {w['number']} banner/bannerEs mismatch")

    prescriptions = [p for d in days for p in d["prescriptions"]]
    check(len(prescriptions) == 315, f"expected 315 prescriptions, got {len(prescriptions)}")

    main_slugs = set()
    for d in days:
        where = f"week {d['week']} {d['name']}"
        check(d["kind"] in ("full_body", "arms_weak_points"), f"{where}: bad kind")
        groups = Counter()
        for p in d["prescriptions"]:
            w = f"{where} #{p['position']}"
            check(p["technique"] is None or p["technique"] in TECHNIQUE_KEYS, f"{w}: bad technique {p['technique']}")
            check(isinstance(p["workingSets"], int) and 1 <= p["workingSets"] <= 4, f"{w}: bad workingSets")
            for k in ("warmupText", "repsText", "earlyRpeText", "lastRpeText", "restText", "notesEn"):
                check(bool(p[k]), f"{w}: empty {k}")
            check(not re.search(r"\s{2,}|\s[.,;:!?]|\w- \w", p["notesEn"]), f"{w}: dirty note {p['notesEn'][:60]!r}")
            check(bool(re.search(r"[.!?)\"”]$", p["notesEn"])), f"{w}: note does not end a sentence")
            check(p["notesEn"][0].isupper() or p["notesEn"][0].isdigit(), f"{w}: note starts lowercase")
            if p["slot"] == "exercise":
                for k in ("exercise", "sub1", "sub2"):
                    check(p[k] in catalog, f"{w}: {k}={p[k]!r} not in exercises.json")
                main_slugs.add(p["exercise"])
                check(not p["isOptional"], f"{w}: exercise slot marked optional")
            else:
                check(p["slot"] in ("weak_point_1", "weak_point_2"), f"{w}: bad slot {p['slot']}")
                check(p["exercise"] is None and p["sub1"] is None and p["sub2"] is None, f"{w}: weak point with slugs")
                check(p["isOptional"] == (p["slot"] == "weak_point_2"), f"{w}: isOptional mismatch")
                check(d["kind"] == "arms_weak_points", f"{w}: weak point outside arms day")
            if p["supersetGroup"]:
                check(p["supersetOrder"] in (1, 2), f"{w}: bad supersetOrder")
                groups[p["supersetGroup"]] += 1
        check(all(n == 2 for n in groups.values()), f"{where}: superset groups must have 2 members {dict(groups)}")

    for s in sorted(main_slugs):
        check(bool(catalog[s]["youtubeId"]), f"main exercise {s} has no youtubeId")

    # --- techniques
    check({t["key"] for t in techniques} == TECHNIQUE_KEYS, "techniques.json keys mismatch")
    for t in techniques:
        check(t["scope"] in ("last_set", "all_sets", "between_sets"), f"technique {t['key']} bad scope")
        check(bool(t["name"] and t["nameEs"] and t["descriptionEs"]), f"technique {t['key']} missing text")

    # --- weak points
    check({w["key"] for w in weak_points} == WEAK_POINT_KEYS, "weak-points.json keys mismatch")
    for w in weak_points:
        if w["options"]:
            check(w["guidanceEn"] is None, f"weak point {w['key']} has options and guidance")
            check({o["slot"] for o in w["options"]} == {1, 2}, f"weak point {w['key']} needs slot 1 and 2 options")
            for o in w["options"]:
                check(o["exercise"] in catalog, f"weak point {w['key']}: {o['exercise']} not in exercises.json")
                check(bool(catalog.get(o["exercise"], {}).get("youtubeId")), f"weak point option {o['exercise']} no video")
        else:
            check(bool(w["guidanceEn"] and w["guidanceEs"]), f"weak point {w['key']} needs guidance")

    # --- warmup
    check(len(warmup["general"]) >= 1, "warmup.general empty")
    by_count = Counter(s["setsCount"] for s in warmup["specific"])
    check(by_count == Counter({1: 1, 2: 2, 3: 3}), f"warmup.specific shape {dict(by_count)}")
    check(len(warmup["programNotesEs"]) >= 1, "warmup.programNotesEs empty")

    # --- notes-es.json (optional, produced by a later step)
    notes_es_path = SRC / "notes-es.json"
    if notes_es_path.exists():
        notes_es = json.loads(notes_es_path.read_text(encoding="utf-8"))
        missing = {p["notesEn"] for p in prescriptions} - set(notes_es)
        check(not missing, f"notes-es.json missing {len(missing)} notes")

    if errors:
        print(f"FAIL ({len(errors)} problems)")
        for e in errors:
            print(" -", e)
        return 1
    print(f"OK: {len(weeks)} weeks, {len(days)} days, {len(prescriptions)} prescriptions, "
          f"{len(exercises)} exercises ({len(main_slugs)} used as main), {len(techniques)} techniques, "
          f"{len(weak_points)} weak points")
    return 0


if __name__ == "__main__":
    sys.exit(main())
