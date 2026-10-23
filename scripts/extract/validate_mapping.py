"""Validate data/mapping/exercise-map.json against the catalog, the dataset and the notes translations.

Checks:
  - every slug in data/source/exercises.json has exactly one mapping entry (and no orphan entries);
  - every datasetId exists in the exercises dataset (and its GIF file is present when the clone is available);
  - match is exact|approx|none; none <=> datasetId null; approx/none carry a Spanish matchNote;
  - no near-duplicate slugs for the same exercise (e.g. "neutral-grip-pullup" vs "neutral-grip-pull-up");
  - technique-suffixed variants ("... (w/ Integrated Partials)", "... (Mechanical Dropset)") map to the same
    dataset exercise as their base exercise when the base exists;
  - every notesEn in program.json has a key in notes-es.json.

Usage (from the repo root): python scripts/extract/validate_mapping.py [--dataset PATH]
Exits with status 1 and lists every failure if something is wrong.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "source"
MAP = ROOT / "data" / "mapping" / "exercise-map.json"
DEFAULT_DATASET = ROOT / ".cache" / "exercises-dataset"

MATCHES = {"exact", "approx", "none"}
# Modifiers that change tempo/technique but not the movement: variants must map like their base exercise.
TECHNIQUE_SUFFIXES = ("-w-integrated-partials", "-mechanical-dropset")
TEMPO_PREFIXES = ("slow-eccentric-", "paused-")
# Spanish-looking text: accented letters or common Spanish function words.
SPANISH_RE = re.compile(r"[áéíóúñ¿¡]|\b(el|la|los|las|en|con|sin|del|una|un|se|que|es|de)\b", re.I)

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def near_key(slug: str) -> str:
    """Collapse spelling variants: drop dashes and plural 's' per token, unify common abbreviations."""
    abbrev = {"dumbbell": "db", "pullup": "pullup", "pulldown": "pulldown", "one": "1", "single": "1"}
    tokens = []
    for t in slug.split("-"):
        t = abbrev.get(t, t)
        if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        tokens.append(t)
    return "".join(tokens)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    args = ap.parse_args()

    exercises = load(SRC / "exercises.json")
    program = load(SRC / "program.json")
    notes_es = load(SRC / "notes-es.json")
    mapping = load(MAP)

    slugs = [e["slug"] for e in exercises]
    slug_set = set(slugs)

    # --- coverage
    missing = sorted(slug_set - mapping.keys())
    orphan = sorted(mapping.keys() - slug_set)
    check(not missing, f"slugs without mapping entry: {missing}")
    check(not orphan, f"mapping entries for unknown slugs: {orphan}")
    check(list(mapping.keys()) == sorted(mapping.keys()), "exercise-map.json keys must be sorted by slug")

    # --- dataset ids
    ds_file = args.dataset / "data" / "exercises.json"
    dataset = {}
    if ds_file.exists():
        dataset = {r["id"]: r for r in load(ds_file)}
    else:
        errors.append(f"dataset not found at {ds_file} (pass --dataset)")

    for slug, m in mapping.items():
        check(set(m.keys()) == {"datasetId", "match", "matchNote"}, f"{slug}: unexpected keys {sorted(m)}")
        did, match, note = m.get("datasetId"), m.get("match"), m.get("matchNote")
        check(match in MATCHES, f"{slug}: bad match {match!r}")
        check((match == "none") == (did is None), f"{slug}: match 'none' iff datasetId is null")
        if did is not None and dataset:
            rec = dataset.get(did)
            check(rec is not None, f"{slug}: datasetId {did} not in dataset")
            if rec is not None and rec.get("gif_url"):
                check((args.dataset / rec["gif_url"]).exists(), f"{slug}: GIF file missing {rec['gif_url']}")
        if match in ("approx", "none"):
            check(isinstance(note, str) and len(note.strip()) >= 10, f"{slug}: {match} requires matchNote")
            check(isinstance(note, str) and bool(SPANISH_RE.search(note)), f"{slug}: matchNote not Spanish: {note!r}")
        else:
            check(note is None, f"{slug}: exact match must have matchNote null")

    # --- near-duplicate slugs
    groups = defaultdict(list)
    for s in slugs:
        groups[near_key(s)].append(s)
    for k, ss in groups.items():
        check(len(ss) == 1, f"near-duplicate slugs (same exercise?): {ss}")

    # --- technique/tempo variants map like their base (same movement => same GIF)
    def core(slug: str) -> str:
        for pre in TEMPO_PREFIXES:
            if slug.startswith(pre):
                slug = slug[len(pre):]
        for suf in TECHNIQUE_SUFFIXES:
            if slug.endswith(suf):
                slug = slug[: -len(suf)]
        return slug

    by_core = defaultdict(list)
    for s in slugs:
        if s in mapping:
            by_core[core(s)].append(s)
    for c, ss in by_core.items():
        ids = {mapping[s]["datasetId"] for s in ss}
        check(len(ids) == 1, f"variants of {c!r} map to different datasetIds: "
                             f"{ {s: mapping[s]['datasetId'] for s in ss} }")

    # --- program references and notes translations
    used = set()
    notes = set()
    for d in program["days"]:
        for p in d["prescriptions"]:
            for k in ("exercise", "sub1", "sub2"):
                if p[k]:
                    used.add(p[k])
            if p.get("notesEn"):
                notes.add(p["notesEn"])
    for wp in load(SRC / "weak-points.json"):
        for o in wp["options"]:
            used.add(o["exercise"])
    check(not (used - slug_set), f"program/weak-points reference unknown slugs: {sorted(used - slug_set)}")
    unused = sorted(slug_set - used)
    check(not unused, f"catalog slugs not referenced anywhere: {unused}")
    missing_notes = sorted(n for n in notes if n not in notes_es)
    check(not missing_notes, f"{len(missing_notes)} notesEn without translation: {missing_notes[:5]}")
    for k, v in notes_es.items():
        check(isinstance(v, str) and v.strip() != "", f"empty translation for note {k[:50]!r}")

    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for e in errors:
            print(" -", e)
        return 1
    c = Counter(m["match"] for m in mapping.values())
    print(f"OK: {len(mapping)} slugs mapped — exact={c['exact']} approx={c['approx']} none={c['none']}; "
          f"{len(notes)} distinct notes translated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
