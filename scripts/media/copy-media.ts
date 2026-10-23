/**
 * Copy ONLY the mapped GIF/JPG media from the local dataset clone into
 * public/media/exercises/<datasetId>.{gif,jpg} (PLAN §2.4).
 *
 *   source: .cache/exercises-dataset/videos/<id>-*.gif
 *           .cache/exercises-dataset/images/<id>-*.jpg
 *   input:  data/mapping/exercise-map.json  ({ "<slug>": { datasetId, … } })
 *
 * Usage: pnpm media:copy [--prune]   (--prune deletes files no longer mapped)
 * Media is © Gym visual — show the credit wherever a GIF is displayed.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const DATASET = path.join(ROOT, ".cache/exercises-dataset");
const MAP_FILE = path.join(ROOT, "data/mapping/exercise-map.json");
const OUT = path.join(ROOT, "public/media/exercises");
const prune = process.argv.includes("--prune");

type ExerciseMap = Record<string, { datasetId: string | null }>;
type DatasetExercise = { id: string; gif_url?: string; image?: string };

function main() {
  if (!existsSync(MAP_FILE)) {
    console.error(`Missing ${path.relative(ROOT, MAP_FILE)} — nothing to copy.`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(DATASET)) {
    console.error(`Missing dataset clone at ${path.relative(ROOT, DATASET)}.`);
    process.exitCode = 1;
    return;
  }

  const map = JSON.parse(readFileSync(MAP_FILE, "utf8")) as ExerciseMap;
  const ids = [...new Set(Object.values(map).map((e) => e.datasetId).filter((x): x is string => !!x))].sort();

  // Prefer the dataset's own paths; fall back to the "<id>-*.<ext>" filename pattern.
  const byId = new Map<string, DatasetExercise>();
  const dsFile = path.join(DATASET, "data/exercises.json");
  if (existsSync(dsFile)) {
    for (const d of JSON.parse(readFileSync(dsFile, "utf8")) as DatasetExercise[]) byId.set(d.id, d);
  }
  const listing = {
    videos: existsSync(path.join(DATASET, "videos")) ? readdirSync(path.join(DATASET, "videos")) : [],
    images: existsSync(path.join(DATASET, "images")) ? readdirSync(path.join(DATASET, "images")) : [],
  };
  const find = (id: string, dir: "videos" | "images", ext: string, hint?: string): string | null => {
    if (hint && existsSync(path.join(DATASET, hint))) return path.join(DATASET, hint);
    const name = listing[dir].find((f) => f.startsWith(`${id}-`) && f.endsWith(ext));
    return name ? path.join(DATASET, dir, name) : null;
  };

  mkdirSync(OUT, { recursive: true });
  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  const missing: string[] = [];
  const wanted = new Set<string>();

  for (const id of ids) {
    const ds = byId.get(id);
    const jobs: [string | null, string][] = [
      [find(id, "videos", ".gif", ds?.gif_url), `${id}.gif`],
      [find(id, "images", ".jpg", ds?.image), `${id}.jpg`],
    ];
    for (const [src, outName] of jobs) {
      wanted.add(outName);
      if (!src) {
        missing.push(outName);
        continue;
      }
      const dest = path.join(OUT, outName);
      const size = statSync(src).size;
      bytes += size;
      if (existsSync(dest) && statSync(dest).size === size) {
        skipped++;
        continue;
      }
      copyFileSync(src, dest);
      copied++;
    }
  }

  let pruned = 0;
  if (prune) {
    for (const f of readdirSync(OUT)) {
      if (/\.(gif|jpg)$/.test(f) && !wanted.has(f)) {
        unlinkSync(path.join(OUT, f));
        pruned++;
      }
    }
  }

  console.log(
    `media:copy — ${ids.length} mapped ids · ${copied} copied · ${skipped} up to date` +
      `${prune ? ` · ${pruned} pruned` : ""} · ${(bytes / 1024 / 1024).toFixed(1)} MB total`,
  );
  if (missing.length) {
    console.warn(`  ! ${missing.length} file(s) not found in dataset: ${missing.join(", ")}`);
  }
}

main();
