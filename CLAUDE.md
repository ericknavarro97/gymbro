# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

GymBros is a mobile-first Spanish web app for following Jeff Nippard's *Pure Bodybuilding Program – Full Body* (10 weeks, 50 sessions, 315 exercise prescriptions) with weekly load tracking. Each exercise shows an animated GIF from the [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), plus the PDF's YouTube demo as a fallback. Specs live in `docs/`:
- `PLAN.md`: product spec and data model.
- `API.md`: server API reference.
- `UI.md`: component inventory and page patterns. Read it before touching UI.
- `E2E-REPORT.md`: end-to-end test results.

## Commands

```bash
docker compose up -d              # Postgres 17 on localhost:5434 (5433 is used by another local project)
pnpm db:migrate && pnpm db:seed   # schema + catalog (seed is idempotent, never touches user tables)
pnpm media:copy                   # copy mapped GIF/JPG from .cache/exercises-dataset → public/media/exercises/
pnpm dev                          # http://localhost:3000

pnpm typecheck | pnpm lint | pnpm build
pnpm test                         # unit + integration (integration needs the seeded local DB)
pnpm test:unit                    # pure domain tests only
pnpm exec vitest run tests/unit/reps-scheme.test.ts        # single file
pnpm exec vitest run --project unit -t "per_set"            # single test by name
pnpm db:generate                  # after editing src/server/db/schema/* → new SQL migration
```

Data pipeline (only needed when source data changes):
- `scripts/extract/extract_pdf.py` regenerates `data/source/*.json` from the PDF. The PDF path comes from the argument, from `GYMBROS_PDF`, or from the iCloud default. Its requirements are in `scripts/extract/requirements.txt` (pdfplumber).
- `validate_source.py` and `validate_mapping.py`, in the same folder, assert the counts and the coverage of the mapping.

## Architecture

**Data flow.**
- The PDF becomes `data/source/program.json`, `exercises.json`, `techniques.json`, `weak-points.json`, `warmup.json` and `notes-es.json`.
- `data/mapping/exercise-map.json` is hand-curated: PDF exercise slug → dataset id, with `match: exact|approx|none` and a Spanish `matchNote`.
- `scripts/seed.ts` loads all of it, plus fields from `.cache/exercises-dataset/data/exercises.json`, into read-only **catalog** tables. User data lives in separate tables.
- Exercises are keyed by slug everywhere. Fix a near-duplicate name with `nameAliases` in `data/source/overrides.json`, not by hand-editing the JSON.

**Server layer (`src/server/`).** UI code never touches the DB directly.
- `domain/`: pure functions with no DB or Next imports, safe to import from client components. They parse the PDF's closed set of formats: reps schemes (`fixed`, `range`, `per_set` "4, 6, 8", `mechanical_dropset` "5,4,3+", `compound` "8-10 + 4-6" Kelso Shrug), RPE, rest and warm-up counts. They also hold warm-up calculation, unit conversion, progression suggestion, next-workout selection and weekly top-set aggregation.
- `repositories/` hold the Drizzle queries. `services/` hold the business logic: they take `userId` first, throw `ServiceError{code}` and import nothing from Next.
- `actions/*.actions.ts` are `"use server"` wrappers: `requireUser()`, then the service, then `toResult()`. They return `{ok:true,data} | {ok:false,error}`. `toResult` rethrows Next control-flow errors (redirect/notFound).
- Authorization is by ownership: every query is scoped by `user_id`, and another user's ids come back as `NOT_FOUND`.

**Tracking model.**
- Tables chain `program_runs` → `workout_logs` (one per `workout_day` per run) → `exercise_logs` (one per prescription, with `performed_exercise_id`) → `set_logs` (weight + unit as entered, reps, optional rpe, `segment_reps` for dropset/compound).
- History and "semana pasada" are looked up by **performed exercise**, not by prescription. A substitute keeps its own history, and the same exercise appearing on different days or blocks shares one history.
- Restarting the program creates a new run and keeps the old history.
- Weight units are **per exercise card**, not global: gyms mix lb and kg equipment.
  - `SessionStore.getItemUnit` defaults to the unit of that exercise's saved sets, then last performance, then the Perfil unit. No schema field is involved; it is derived from `set_logs.weight_unit`.
  - Switching units relabels the typed numbers (no conversion) and re-saves them. Display surfaces (history, chart) convert to the Perfil unit.

**Auth.**
- Better Auth (`src/server/auth/auth.ts`) with username + password. Email is synthesized as `<username>@gymbros.local`.
- The cookie session lasts 30 days. `SIGNUP_CODE` (when set) is enforced server-side.
- `src/proxy.ts` (Next 16's replacement for middleware) protects every app route and `/media/*`. It normalizes encoded paths, since the licensed GIFs must not be publicly downloadable. The public path rules live in `auth/public-paths.ts`.

**Next 16 + Cache Components (`cacheComponents: true`).**
- Read request data (`requireUser`, cookies, headers, `params`) only inside a `<Suspense>` child, never in a layout and never inside `"use cache"`. Otherwise `pnpm build` fails.
- Next keeps visited routes alive in `<Activity>`. Client state can therefore outlive navigation (see `docs/UI.md` § Activity). The session screen is keyed by log id + unit + weak point for this reason.
- Media under `/media/...` must use plain `<img>`, never `next/image`, because it is auth-gated.

**Session logging screen (`src/components/session/`).**
- A client store autosaves each set through `saveSet` (one save in flight per set, re-sending edits made during a save).
- It keeps localStorage drafts keyed by workout log, which record the unit they were typed in.

## Deploy (Vercel + Neon)

- Vercel project `gymbros-app` lives in the **Personal** scope (`personal-3e00d805`), framework `nextjs`. Production is https://gymbros-app.vercel.app.
- Database: Neon (`gymbros-db`, region iad1/us-east-1), provisioned through the Vercel Marketplace. It injects `DATABASE_URL` (pooled; `client.ts` uses `prepare: false`) and `DATABASE_URL_UNPOOLED`.
- Other production env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_TIME_ZONE`. `SIGNUP_CODE` is unset (open sign-up); setting it again and redeploying brings back the required invite-code field.
- Migrations and seed are **not** run by the build. Run them from local against `DATABASE_URL_UNPOOLED`:
  `vercel env pull .cache/neon.prod.env --environment production`, then `DATABASE_URL=<unpooled> pnpm db:migrate && pnpm db:seed`.
  The seed needs `.cache/exercises-dataset`.
- The project is connected to GitHub: every push to `main` deploys to production automatically. Manual deploys use `vercel deploy --prod`; `.vercelignore` keeps `.cache`/`.env*` out of the upload.
- `gymbros-app.vercel.app` is registered as a domain on someone else's Vercel project, so it can't be a project domain. It is a **manual alias**: after every production deploy run `vercel alias set <deployment-url> gymbros-app.vercel.app`. The automatic production domain is `gymbros-app-two.vercel.app`.
- Vercel Deployment Protection (SSO) is disabled for this project. The app has its own auth, and `*.vercel.app` aliases would otherwise hit Vercel's login wall.

## Gotchas

- Tunnels (ngrok) in dev need `DEV_ALLOWED_ORIGINS` (e.g. `*.ngrok-free.app`, read by `next.config.ts`) and `TRUSTED_ORIGINS` (the full https origin, read by Better Auth) in `.env`. Without them the page never hydrates.
- Forms using `onSubmit` must keep `method="post"`. Otherwise a non-hydrated page submits credentials as a GET query string.
- Media license: the GIFs/JPGs are © Gym visual, not covered by the dataset's MIT license. Keep them behind auth and keep the "© Gym visual — gymvisual.com" credit (`<MediaCredit/>`) on any screen that shows them. The PDF is a paid product: never commit it (`*.pdf` is gitignored). The repo is public by the owner's choice.
- E2E testing uses the `agent-browser` CLI. On this machine its bundled Chrome hangs on screenshots, so prefix commands with `AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. Test users are named `e2e_*`; delete them afterwards.
- Parallel `agent-browser` runs cross-wire: separate `--session`/`--namespace` daemons end up driving each other's Chrome. For parallel testers, start one Chrome per tester with its own `--remote-debugging-port=<unique>` and `--user-data-dir`, and attach with `agent-browser --cdp <port>`. Give each tester a uniquely named helper script; the scratchpad is shared.
