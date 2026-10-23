# GymBros — Plan maestro

Web app **mobile-first** para seguir *The Pure Bodybuilding Program – Full Body* (Jeff Nippard) con
tracking de cargas semana a semana, usando las animaciones del dataset
[`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset) en lugar de videos,
con botón "Ver video" (YouTube del PDF) como respaldo.

Uso personal. Primero local; después despliegue en **Vercel + Neon (Postgres)**.

---

## 0. Alcance

### Objetivos (v1)
1. Registro e inicio de sesión con usuario + contraseña; toda la información queda ligada al usuario.
2. El programa completo cargado en BD: 2 bloques, 10 semanas, 50 sesiones, 315 prescripciones de ejercicio,
   sustitutos, técnicas de intensidad, tabla de puntos débiles y protocolo de calentamiento.
3. Cada ejercicio muestra **GIF animado + instrucciones en español** (dataset) y **notas del PDF**.
   Botón **"Ver video"** abre el YouTube original del PDF.
4. **Tracking semanal de carga**: en cada sesión registras peso × reps por serie. Al registrar ves lo que
   hiciste **la semana anterior** en ese mismo ejercicio ("S2: 35 lb × 12, 12, 11 → hoy: __").
5. Historial y progresión por ejercicio (carga por semana, gráfica).
6. Diseño para usarse con una mano en el gym: botones grandes, teclado numérico, guardado automático.

### Fuera de alcance (v1)
- App nativa, modo offline completo, notificaciones push.
- Editor de programas propios (solo este programa).
- Social / compartir.
- Recuperación de contraseña por email (no hay email; ver §7).

---

## 1. Stack y decisiones técnicas

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript** | Frontend y backend en un solo proyecto; despliegue nativo en Vercel |
| Backend | **Server Actions** (mutaciones) + **Route Handlers** `app/api/*` (auth, media, lecturas JSON) | Lógica de servidor separada en `src/server/` (servicios + repositorios); la UI nunca toca la BD directo |
| BD | **PostgreSQL 17** — local con Docker Compose; producción **Neon** (vía Vercel Marketplace) | Mismo motor en local y prod |
| ORM / migraciones | **Drizzle ORM + drizzle-kit** | Esquema en TypeScript, migraciones SQL versionadas, ligero en serverless |
| Auth | **Better Auth** (email/password + plugin `username`) con adaptador Drizzle | Sesiones en nuestra propia BD, hash de contraseñas y rate-limit incluidos, sin servicio externo, funciona igual en local y Vercel |
| UI | **Tailwind CSS + shadcn/ui** (Drawer, Sheet, Tabs, Dialog, Sonner) | Componentes accesibles y "mobile-native" (bottom sheets) |
| Validación | **Zod** | Mismos esquemas en server actions y formularios |
| Gráficas | **Recharts** | Progresión de carga por semana |
| Tests | **Vitest** (dominio/parsers) + **Playwright** (e2e en viewport de iPhone) | |
| Paquetes | **pnpm** | |
| Extracción PDF | **Python** (`pdfplumber`) — script único en `scripts/extract/` | Ya probado: extrae las 50 sesiones limpias con links por celda |

> Antes de implementar cada librería se consulta su documentación vigente (context7) para usar la API actual
> (p. ej. `proxy.ts` vs `middleware.ts` en la versión de Next.js instalada).

---

## 2. Fuentes de datos y pipeline

```
PDF ──(scripts/extract/extract_pdf.py)──► data/source/program.json        (estructura del programa)
                                       ► data/source/weak-points.json    (tabla de puntos débiles)
dataset repo ─(clonado en .cache/)────► data/mapping/exercise-map.json   (CURADO A MANO: PDF ↔ dataset)
                                       ► public/media/exercises/*.gif|jpg (solo los ~150 mapeados)
todo lo anterior ──(scripts/seed.ts)──► Postgres (catálogo de solo lectura)
```

### 2.1 Extracción del PDF → `data/source/program.json`
Ya validado en el análisis (pdfplumber con detección de tablas):
- Páginas 6–55 = 50 sesiones. Encabezado de semana en la fila previa a `SET 1`; nombre del día en la
  columna 0, rotado (se invierte la cadena).
- "Mandatory Rest Day" aparece en las páginas de Full Body #2 y Arms & Weak Points → `restAfter: true`.
- Links de YouTube por celda (ejercicio, sustituto 1, sustituto 2) cruzando el bbox del hyperlink con la celda.
  Se guarda solo el **video id** (sin `?si=`).
- Encabezados especiales: p6 "BLOCK 1: 5-WEEK BUILD PHASE", p26 "SEMI-DELOAD WEEK…", p31 "BLOCK 2: 5-WEEK NOVELTY PHASE".

Correcciones conocidas que el script debe manejar:
- Normalizar nombres partidos por guion ("Cuffed Behind- The-Back" → "Cuffed Behind-The-Back", "Pull- Up").
- Prefijos de superserie (`Superset A1:`, `A2:`) → campos `supersetGroup`/`supersetOrder`, no parte del nombre.
- Notas que se desbordan a la fila siguiente (Standing Calf Raise ↔ Slow-Eccentric DB RDL en Full Body #2
  del bloque 2): corregir con un archivo `data/source/overrides.json` aplicado después de extraer.
- Texto con espacios basura ("4     5°", "e cessive") → limpieza de espacios + overrides puntuales.

**Validación automática** (test de Vitest sobre el JSON):
10 semanas · 5 días/semana · 50 sesiones · 315 prescripciones · todos los ejercicios principales con video.

### 2.2 Formatos que hay que parsear (catálogo cerrado, extraído del PDF)
| Campo | Valores encontrados | Representación estructurada |
|---|---|---|
| Reps | `8`, `10`, `8-10`, `10-12`, `10-15`, `12-15`, `8-12`, `10-20`, `4, 6, 8`, `4, 6`, `5,4,3+`, `8-10 + 4-6` | ver §4.2 |
| RPE | `~5`, `~5-6`, `~6`, `~6-7`, `~7`, `~7-8`, `~8`, `~8-9`, `~9`, `~9-10`, `8`, `10` | `{min, max, approx}` |
| Descanso | `~0.5-1 min`, `~1 min`, `~1-2 min`, `~1-3 min`, `~2-3 min`, `~3-4 min`, `~3-5 min`, `N/A` | `{minSec, maxSec}` o null |
| Calentamiento | `0`, `1`, `1-2`, `1-3`, `2`, `2-3`, `2-4` | `{min, max}` |
| Técnica | N/A, Long-length Partials, Myo-reps, Dropset, Mechanical Dropset, Integrated Partials, Pec/Quad/Calf Static Stretch | FK a `techniques` |

Se guarda **siempre el texto original** además del estructurado (para mostrar tal cual el PDF).

### 2.3 Mapeo PDF ↔ dataset → `data/mapping/exercise-map.json` (el corazón del proyecto)
Universo: **136** nombres únicos (principales + sustitutos) + opciones de la tabla de puntos débiles ≈ **150**.

Formato de cada entrada:
```json
{
  "slug": "leg-press",
  "name": "Leg Press",
  "youtubeId": "1yKAQLVV_XI",
  "datasetId": "0739",
  "match": "exact",            // exact | approx | none
  "matchNote": null             // obligatorio si approx/none: qué difiere del PDF
}
```
Proceso:
1. Script `scripts/mapping/candidates.ts` genera, por nombre, los 8 mejores candidatos (búsqueda por tokens
   con sinónimos: DB→dumbbell, machine→lever|sled, flye→fly, RDL→romanian deadlift, 1-arm→one arm…).
2. Script `scripts/mapping/review-sheet.ts` genera `review.html` local: por fila, nombre del PDF + miniatura
   de YouTube + GIFs candidatos, para elegir visualmente.
3. Curación manual (Claude propone, Erick valida). Propuesta inicial de principales en el **Apéndice A**.
4. Test: todo ejercicio referenciado en `program.json` existe en el mapa; todo `approx|none` tiene `matchNote`;
   todo `datasetId` existe en el dataset.

Hallazgos del análisis: ~35 de los 52 principales tienen coincidencia directa, ~15 aproximada y 2 no existen
(Face Pull, DB Calf Jumps). Entre sustitutos/puntos débiles faltan además: Nordic Ham Curl, Copenhagen
Adduction, Belt Squat, Barbell Hip Thrust, Lateral Band Walk, Helms Row, Kelso Shrug, ejercicios de cuello con carga.
Para `none`: se muestra placeholder + "Ver video" como acción principal.

### 2.4 Media
- Copiar **solo** los GIF/JPG mapeados (~150 × ~97 KB ≈ 15 MB) a `public/media/exercises/{datasetId}.gif|jpg`
  con `scripts/media/copy-media.ts` (lee del clon en `.cache/exercises-dataset`, que está en `.gitignore`).
- Mostrar SIEMPRE el crédito **"© Gym visual — gymvisual.com"** en pantallas con GIF (requisito de su licencia).
- El acceso a `/media/*` exige sesión (proxy/middleware de Next.js) — la media no queda pública en internet.

### 2.5 Seed → BD
`pnpm db:seed` (idempotente, `upsert` por slug/claves naturales) carga: programa, bloques, semanas, días,
prescripciones, técnicas, ejercicios (con datos del dataset desnormalizados), puntos débiles y protocolo de calentamiento.
El seed **no toca** tablas de usuario.

---

## 3. Modelo de datos (Drizzle / Postgres)

### 3.1 Auth (generadas por Better Auth)
`user` (id, name, username UNIQUE, email, createdAt…), `session`, `account` (guarda el hash), `verification`.

### 3.2 Catálogo (solo lectura, viene del seed)
```
exercises
  id PK, slug UNIQUE, name            -- nombre del PDF (inglés)
  youtube_id NULL
  dataset_id NULL                     -- "0739"
  match  ENUM(exact, approx, none)
  match_note NULL
  gif_path NULL, thumb_path NULL
  target NULL, secondary_muscles TEXT[], equipment NULL, body_part NULL
  instructions_es TEXT[], instructions_en TEXT[]

techniques
  id PK, key UNIQUE                   -- long_length_partials, myo_reps, dropset, mechanical_dropset,
                                      -- integrated_partials, static_stretch_pec|quad|calf
  name, scope ENUM(last_set, all_sets, between_sets), description_es

programs        id, slug, name, description
blocks          id, program_id, number (1|2), name ("Build Phase" | "Novelty Phase"), description
weeks           id, block_id, number (1..10), is_deload BOOL, banner NULL   -- semana 5 = deload
workout_days    id, week_id, position (1..5), name ("Full Body #1"…"Arms & Weak Points"),
                kind ENUM(full_body, arms_weak_points), rest_after BOOL
prescriptions   id, workout_day_id, position
                slot ENUM(exercise, weak_point_1, weak_point_2)
                exercise_id NULL                       -- NULL en slots de punto débil
                sub1_exercise_id NULL, sub2_exercise_id NULL
                superset_group NULL ('A'|'B'), superset_order NULL (1|2)
                technique_id NULL
                warmup_sets_min, warmup_sets_max
                working_sets INT
                reps_text, reps_scheme JSONB           -- §4.2
                early_rpe_text, early_rpe_min, early_rpe_max
                last_rpe_text,  last_rpe_min,  last_rpe_max
                rest_text, rest_min_sec NULL, rest_max_sec NULL
                notes_en, notes_es NULL
                is_optional BOOL                        -- weak point 2

weak_points         id, key, name_es, name_en, guidance_es NULL   -- hamstrings/calves/... solo guía
weak_point_options  id, weak_point_id, slot (1|2), position, exercise_id, note NULL
warmup_protocol     sets_count (1|2|3), set_number, pct_of_working, reps_text   -- 45/65/85 etc.
general_warmup      position, item, dose                            -- cardio 5-10 min, arm swings…
```

### 3.3 Datos de usuario
```
user_settings
  user_id PK FK, weight_unit ENUM(lb, kg) DEFAULT 'lb'
  weak_point_id NULL, rounding_lb NUMERIC DEFAULT 5, rounding_kg NUMERIC DEFAULT 2.5

program_runs                         -- permite repetir el programa sin perder historial
  id, user_id, program_id, started_on DATE, status ENUM(active, finished, abandoned)
  UNIQUE parcial: un solo 'active' por usuario

workout_logs                          -- "hice la sesión X de la semana Y"
  id, program_run_id, workout_day_id, user_id
  status ENUM(in_progress, completed, skipped)
  started_at, completed_at NULL, notes NULL
  UNIQUE (program_run_id, workout_day_id)

exercise_logs
  id, workout_log_id, prescription_id
  performed_exercise_id               -- principal, sub1, sub2 u opción de punto débil
  notes NULL
  UNIQUE (workout_log_id, prescription_id)

set_logs
  id, exercise_log_id, set_number (1..4)
  weight NUMERIC(6,2) NULL, weight_unit ENUM(lb, kg)
  reps INT NULL, rpe NUMERIC(3,1) NULL
  segment_reps INT[] NULL             -- dropset mecánico 5/4/3+, compuesto 8-10 + 4-6
  updated_at
  UNIQUE (exercise_log_id, set_number)
```
Índices clave: `exercise_logs(performed_exercise_id)`, `workout_logs(user_id, completed_at)`.

**"Carga por semana"**: como cada `workout_log` apunta a un `workout_day` → `week`, la carga de un ejercicio
en la semana N es el máximo/serie top de sus `set_logs` en esa semana. El historial se consulta por
**`performed_exercise_id`** (no por prescripción) para que:
- si hiciste el sustituto, su historial sea el del sustituto;
- ejercicios que se repiten entre días o bloques (Standing Calf Raise, Lying/Seated Leg Curl, Leg Extension,
  Machine Hip Adduction, Cable Crunch, Cuffed Lateral Raise) compartan historial.

---

## 4. Reglas de dominio (`src/server/domain/`, puras y con tests)

### 4.1 Siguiente sesión
`nextWorkout(run)` = primer `workout_day` (orden semana → posición) sin `workout_log` `completed|skipped`.
La pantalla Hoy muestra si toca **descanso** (día previo con `rest_after` completado hoy o ayer —
solo informativo; nunca bloquea). Se puede abrir cualquier sesión manualmente.

### 4.2 Esquemas de reps (`reps_scheme`)
```ts
type RepsScheme =
  | { type: "fixed"; reps: number }                                  // "8", "10"
  | { type: "range"; min: number; max: number }                      // "10-12", "10-20"
  | { type: "per_set"; targets: number[] }                           // "4, 6, 8" (pirámide inversa)
  | { type: "mechanical_dropset"; segments: number[]; lastOpen: true } // "5,4,3+"
  | { type: "compound"; main: Range; finisher: Range; finisherLabel: string } // "8-10 + 4-6" (Kelso Shrug)
```
La UI de cada serie se adapta: `per_set` muestra objetivo por serie; `mechanical_dropset` y `compound`
piden reps por segmento (`segment_reps`).

### 4.3 Calentamiento calculado
Con el peso de la serie 1 (o el de la semana pasada si aún no hay):
- 1 serie: 60% × 6-10 · 2 series: 50% × 6-10, 70% × 4-6 · 3 series: 45% × 6-10, 65% × 4-6, 85% × 3-4.
- Rango "2-4": se usa el protocolo de 3 y se indica "+1 serie libre si la necesitas" (el PDF no define 4).
- Redondeo: múltiplo de 5 lb / 2.5 kg (configurable). Las series de calentamiento **no se registran**.

### 4.4 Referencia "semana pasada" y sugerencia
- `lastPerformance(user, exerciseId, excludeWorkoutLogId)` → series del log más reciente de ese ejercicio.
- Inputs pre-llenados como *placeholder* (no como valor) con el peso anterior.
- Sugerencia (regla propia de doble progresión, marcada como tal en UI): si en la última vez todas las series
  llegaron al **tope del rango** → "Prueba subir peso"; si no → "Mantén el peso y busca más reps".
  Pirámide inversa: se evalúa la serie 1. Semana de deload: no sugerir subir.

### 4.5 Unidades
Se guarda la unidad con la que se registró cada serie. La UI convierte a la unidad del usuario
(1 kg = 2.20462 lb) y redondea solo para mostrar.

---

## 5. Pantallas y flujos (mobile-first, 360–430 px)

Navegación inferior fija: **Hoy · Programa · Historial · Perfil**. Tema claro/oscuro. Objetivos táctiles ≥ 44 px.
Inputs con `inputmode="decimal"` (peso) y `inputmode="numeric"` (reps).

| Ruta | Contenido |
|---|---|
| `/login`, `/registro` | Usuario + contraseña. Registro: nombre, usuario, contraseña (+ código de invitación si `SIGNUP_CODE` está definido) |
| `/bienvenida` (onboarding, 1 vez) | Unidad (lb/kg) · punto débil · fecha de inicio · crea `program_run` |
| `/` **Hoy** | Tarjeta "Semana 3 · Full Body #2" + bloque/deload banner · barra de progreso 10 semanas · botón **Empezar/Continuar** · aviso de descanso · acceso al calentamiento general |
| `/programa` | Bloques → semanas → días (lectura); estado de cada día (hecho/pendiente) |
| `/programa/semana/[n]/dia/[pos]` | Vista previa del día con las prescripciones |
| `/sesion/[workoutLogId]` **Registro** | Lista de tarjetas de ejercicio (superseries agrupadas A1/A2). Cada tarjeta: GIF miniatura (tap → bottom sheet grande), nombre, series × reps, RPE temprano/última, descanso, chip de técnica (tap → explicación), notas plegables, **Ver video**, **Sustituir** (principal/sub1/sub2), línea "Semana pasada: 35 lb × 12·12·11", filas de serie (peso, reps, RPE opcional), calentamiento calculado plegable. Guardado automático por serie. Botón final **Terminar sesión** |
| `/ejercicios/[slug]` | GIF grande, instrucciones en español (pasos), músculos, equipo, aviso si el GIF es aproximado (`match_note`), Ver video, **historial: carga por semana (gráfica + tabla)** |
| `/historial` | Sesiones completadas (fecha, semana, día) → detalle |
| `/perfil` | Unidad, punto débil, redondeo, reiniciar programa (nuevo run), cerrar sesión |

**"Ver video"**: bottom sheet con `iframe` de `youtube-nocookie.com/embed/{id}` + enlace "Abrir en YouTube"
(en el celular abre la app). Disponible para el ejercicio principal y para cada sustituto.

**Punto débil en el día Arms & Weak Points**: los slots `weak_point_1/2` muestran las opciones del punto débil
del usuario; el usuario elige cuál hizo (→ `performed_exercise_id`). El slot 2 se marca "opcional".
Si no eligió punto débil, se le pide en ese momento.

**Robustez en el gym**: cada serie se guarda con server action al salir del input (debounce); si falla la red,
se guarda borrador en `localStorage` y se reintenta (indicador "sin guardar"). Manifest web para
"Agregar a pantalla de inicio" (apariencia de app, sin offline completo).

---

## 6. Backend: superficie de servidor

`src/server/` — nada de esto se importa desde componentes cliente.
```
src/server/
  db/            client.ts, schema/*.ts, migrations/
  auth/          auth.ts (Better Auth), session.ts (requireUser())
  domain/        reps-scheme.ts, rpe.ts, rest.ts, warmup.ts, progression.ts, units.ts, next-workout.ts
  repositories/  program.repo.ts, exercise.repo.ts, logs.repo.ts, settings.repo.ts
  services/      workout.service.ts, history.service.ts, onboarding.service.ts
```
Server Actions (todas validan con Zod y llaman `requireUser()`; cada consulta filtra por `user_id`):
| Acción | Efecto |
|---|---|
| `completeOnboarding(unit, weakPointId, startedOn)` | crea settings + `program_run` |
| `startWorkout(workoutDayId)` | crea/recupera `workout_log` (idempotente) |
| `saveSet(exerciseLogKey, setNumber, weight, unit, reps, rpe?, segmentReps?)` | upsert de `set_log` (crea `exercise_log` si falta) |
| `chooseExercise(workoutLogId, prescriptionId, exerciseId)` | sustitución / opción de punto débil (valida que sea opción permitida) |
| `completeWorkout(workoutLogId)` / `skipWorkout` | cierra la sesión |
| `updateSettings(...)`, `restartProgram()` | perfil |

Route Handlers:
- `app/api/auth/[...all]` → Better Auth.
- `GET app/api/exercises/[slug]/history` → JSON de carga por semana (para la gráfica).
- Protección de `/media/*` y de todas las rutas de app en el proxy/middleware (redirige a `/login`).

---

## 7. Autenticación

- Better Auth, usuario + contraseña (plugin `username`), contraseña mínima 8 caracteres, hash gestionado por la librería.
- Sesión por cookie `httpOnly`, `secure` en prod, duración 30 días con renovación → "entras una vez y te quedas".
- `requireUser()` en cada server action/handler; autorización por propiedad (`user_id`) en repositorios.
- **Registro abierto pero protegido**: si existe la variable `SIGNUP_CODE`, el registro la exige
  (evita que cualquiera con la URL cree cuentas en prod).
- Sin email → sin recuperación de contraseña en v1 (se resetea manualmente en BD si hace falta).

---

## 8. Estructura del repositorio

```
gymBros/
  CLAUDE.md
  docs/PLAN.md
  docker-compose.yml               # postgres:17 en puerto 5434
  .env.example                     # DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SIGNUP_CODE
  drizzle.config.ts
  data/
    source/program.json            # generado desde el PDF (+ overrides.json)
    source/weak-points.json
    source/warmup.json             # protocolo general y específico
    source/techniques.json         # descripciones en español (redacción propia)
    mapping/exercise-map.json      # curado
  scripts/
    extract/extract_pdf.py + requirements.txt
    mapping/candidates.ts, mapping/review-sheet.ts
    media/copy-media.ts
    seed.ts
  public/media/exercises/          # GIF/JPG mapeados (protegidos por proxy)
  src/
    app/(auth)/login, registro
    app/(app)/page.tsx (Hoy), programa/, sesion/[id]/, ejercicios/[slug]/, historial/, perfil/, bienvenida/
    app/api/auth/[...all]/, app/api/exercises/[slug]/history/
    components/ (ui/ de shadcn + workout/, exercise/)
    server/ (§6)
  tests/unit/, tests/e2e/
```
`.gitignore`: `.cache/`, `.env*` (menos `.env.example`), el PDF.
**El repositorio en GitHub debe ser privado** (contiene la estructura de un programa de pago).

---

## 9. Fases de implementación

Cada fase termina con sus criterios de aceptación verificados. Nada de commit/push/PR sin indicación explícita de Erick.

### Fase 0 — Base del proyecto
- [ ] Scaffold Next.js + TS + Tailwind + ESLint, pnpm; shadcn/ui inicializado.
- [ ] `docker-compose.yml` (Postgres 17, puerto 5434, volumen), `.env.example`, Drizzle configurado.
- [ ] Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `db:studio`.
- [ ] `git init` local, `.gitignore`, `CLAUDE.md` del proyecto.
- **Acepta**: `docker compose up -d && pnpm db:migrate && pnpm dev` levanta una página en blanco sin errores.

### Fase 1 — Datos del PDF
- [ ] `scripts/extract/extract_pdf.py` (versión final del parser del análisis) → `program.json`, `weak-points.json`.
- [ ] `overrides.json` con las correcciones de §2.1; `warmup.json`; `techniques.json` (descripción en español).
- [ ] (Opcional, recomendado) `notes_es`: traducción de las notas del PDF al español, conservando el original.
- [ ] Tests de validación del JSON (§2.1).
- **Acepta**: 50 sesiones, 315 prescripciones, 0 notas cruzadas, parsers de §2.2 cubren el 100% de valores.

### Fase 2 — Mapeo con el dataset
- [ ] Clonar dataset en `.cache/`; `candidates.ts` + `review-sheet.ts`.
- [ ] Curar `exercise-map.json` (~150 entradas) partiendo del Apéndice A; Erick valida en `review.html`.
- [ ] `copy-media.ts` copia solo la media mapeada.
- **Acepta**: tests de §2.3 pasan; 100% de ejercicios con `youtubeId` o GIF (idealmente ambos).

### Fase 3 — Esquema y seed
- [ ] Esquema Drizzle §3.2–3.3 + migración inicial.
- [ ] `seed.ts` idempotente.
- **Acepta**: correr el seed 2 veces deja los mismos conteos; consultas de ejemplo (día de la semana 3 con sus prescripciones y GIFs) devuelven lo esperado.

### Fase 4 — Autenticación
- [ ] Better Auth + tablas, páginas `/login` y `/registro`, proxy que protege `(app)` y `/media`.
- [ ] `SIGNUP_CODE`, `requireUser()`, cerrar sesión.
- **Acepta**: registrarse → cerrar navegador → volver → sigue dentro; sin sesión, `/` y `/media/x.gif` redirigen a `/login`; usuario A no puede leer logs de B (test).

### Fase 5 — Onboarding y programa (solo lectura)
- [ ] `/bienvenida`, `/`, `/programa`, vista de día, `/ejercicios/[slug]` (sin historial aún), "Ver video", crédito Gym visual.
- **Acepta**: navegar las 10 semanas en viewport 390×844 sin scroll horizontal; GIF, instrucciones ES y video funcionan.

### Fase 6 — Registro de sesión (núcleo)
- [ ] `/sesion/[id]` completa: series, superseries, esquemas de reps especiales, sustitución, punto débil, calentamiento calculado, "semana pasada", guardado automático + borrador local, terminar sesión.
- **Acepta**: e2e — registrar Full Body #1 semana 1 (35 lb), abrir semana 2 y ver "Semana pasada: 35 lb…"; usar sustituto y que su historial quede separado; recargar a media sesión sin perder datos.

### Fase 7 — Historial y progresión
- [ ] Gráfica y tabla de carga por semana por ejercicio; `/historial`; sugerencia de progresión §4.4.
- **Acepta**: con datos de prueba de 3 semanas, la gráfica muestra 3 puntos correctos en la unidad del usuario.

### Fase 8 — Pulido mobile
- [ ] Manifest + íconos, tema oscuro, estados vacíos/carga/error, accesibilidad básica, temporizador de descanso (opcional).
- **Acepta**: Lighthouse móvil ≥ 90 en accesibilidad y buenas prácticas.

### Fase 9 — Despliegue (Vercel + Neon)
- [ ] Proyecto en Vercel; Neon desde Vercel Marketplace (inyecta `DATABASE_URL`).
- [ ] Variables: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SIGNUP_CODE`.
- [ ] Migraciones: `pnpm db:migrate` contra Neon antes del primer deploy; después, en el build solo cuando `VERCEL_ENV=production`.
- [ ] `pnpm db:seed` contra Neon (una vez).
- **Acepta**: registro, sesión y registro de cargas funcionando en la URL de producción desde el celular.

---

## 10. Pruebas

- **Unitarias (Vitest)**: parsers (reps/RPE/descanso/calentamiento), `warmup`, `progression`, `units`,
  `nextWorkout`, validaciones del JSON y del mapa.
- **Integración**: repositorios contra Postgres de prueba (Docker) — aislamiento por usuario, upserts de series.
- **E2E (Playwright, iPhone 14)**: registro → onboarding → sesión → semana siguiente con referencia → historial.

---

## 11. Riesgos y licencias

| Riesgo | Mitigación |
|---|---|
| Media © Gym visual (no cubierta por MIT del repo) | Uso personal, detrás de login, crédito visible, sin redistribuir; si algún día es público → licencia propia con Gym visual |
| PDF es producto de pago | Repo privado; app con registro protegido por `SIGNUP_CODE` |
| GIF "aproximado" confunde la ejecución | `match_note` visible + notas del PDF + Ver video siempre a mano |
| Conectividad mala en el gym | Guardado por serie + borrador local + reintento |
| Reglas de progresión del *Hypertrophy Handbook* no están en el PDF | Sugerencia marcada como regla propia y desactivable |

---

## 12. Decisiones a confirmar

1. **Stack**: Next.js full-stack (recomendado) vs. backend Python (FastAPI) separado. Este plan asume Next.js.
2. **Usuario vs email** para login (plan: usuario).
3. **Traducir notas del PDF** al español (plan: sí, conservando el original con un toggle).
4. **Unidad por defecto**: lb (plan: lb, cambiable en perfil).

---

## Apéndice A — Propuesta de mapeo de ejercicios principales (a validar en Fase 2)

`=` coincidencia directa · `≈` aproximado (mismo patrón, otra variante) · `✗` no existe (GIF sustituto + video)

**Bloque 1 (semanas 1–5)**

| Día | Ejercicio PDF | Dataset | |
|---|---|---|---|
| FB1 | Cross-Body Lat Pull-Around | 3563 cable one arm pulldown | ≈ |
| FB1 | Low Incline Smith Machine Press | 0757 smith incline bench press | = |
| FB1 | Machine Hip Adduction | 0598 lever seated hip adduction | = |
| FB1 | Leg Press | 0739 sled 45° leg press | = |
| FB1 | Lying Paused Rope Face Pull | 0203 cable rear delt row (with rope) | ✗ |
| FB1 | Cable Crunch | 0175 cable kneeling crunch | = |
| FB2 | Seated DB Shoulder Press | 0405 dumbbell seated shoulder press | = |
| FB2 | Paused Barbell RDL | 0085 barbell romanian deadlift | = |
| FB2 | Chest-Supported Machine Row | 1350 lever seated row | ≈ |
| FB2 | Hammer Preacher Curl | 1663 dumbbell one arm hammer preacher curl | = |
| FB2 | Cuffed Behind-The-Back Lateral Raise | 0192 cable one arm lateral raise | ≈ |
| FB2 | Overhead Cable Triceps Extension (Bar) | 1722 cable high pulley overhead tricep extension | = |
| FB3 | Assisted Pull-Up | 0017 assisted pull-up | = |
| FB3 | Paused Assisted Dip | 0009 assisted chest dip (kneeling) | = |
| FB3 | Seated Leg Curl | 0599 lever seated leg curl | = |
| FB3 | Leg Extension | 0585 lever leg extension | = |
| FB3 | Cable Paused Shrug-In | 0220 cable shrug | ≈ |
| FB3 | Roman Chair Leg Raise | 2963 captains chair straight leg raise | = |
| FB4 | Lying Leg Curl | 0586 lever lying leg curl | = |
| FB4 | Hack Squat | 0743 sled hack squat | = |
| FB4 | Bent-Over Cable Pec Flye | 0227 cable standing fly | ≈ |
| FB4 | Neutral-Grip Lat Pulldown | 0818 twin handle parallel grip lat pulldown | = |
| FB4 | Leg Press Calf Press | 1391 sled calf press on leg press | = |
| FB4 | Cable Reverse Flye (Mechanical Dropset) | 0225 cable standing cross-over high reverse fly | = |
| Arms | Bayesian Cable Curl | 0190 cable one arm curl | ≈ |
| Arms | Triceps Pressdown (Bar) | 0201 cable pushdown | = |
| Arms | Bottom-2/3 Constant Tension Preacher Curl | 0592 lever preacher curl | ≈ |
| Arms | Cable Triceps Kickback | 0860 cable kickback | = |
| Arms | Standing Calf Raise | 0605 lever standing calf raise | = |

**Bloque 2 (semanas 6–10)**

| Día | Ejercicio PDF | Dataset | |
|---|---|---|---|
| FB1 | Lat-Focused Cable Row | 0861 cable seated row | ≈ |
| FB1 | Low Incline DB Press | 0314 dumbbell incline bench press | = |
| FB1 | Lying Leg Curl | 0586 lever lying leg curl | = |
| FB1 | Smith Machine Squat | 0770 smith squat | = |
| FB1 | Reverse Pec Deck (w/ Integrated Partials) | 0602 lever seated reverse fly | = |
| FB1 | Cable Crunch | 0175 cable kneeling crunch | = |
| FB2 | Cuffed Behind-The-Back Lateral Raise | 0192 cable one arm lateral raise | ≈ |
| FB2 | Chest-Supported T-Bar Row + Kelso Shrug | 0606 lever t bar row | ≈ |
| FB2 | Machine Shoulder Press | 0603 lever shoulder press | = |
| FB2 | Standing Calf Raise | 0605 lever standing calf raise | = |
| FB2 | Slow-Eccentric DB RDL | 1459 dumbbell romanian deadlift | = |
| FB2 | A1: Concentration Cable Curl | 1642 cable seated one arm concentration curl | = |
| FB2 | A2: Single-arm Overhead Cable Triceps Extension | 1727 cable standing reverse grip one arm overhead tricep extension | ≈ |
| FB3 | Dual-Handle Lat Pulldown | 2616 cable lateral pulldown with v-bar | ≈ |
| FB3 | Decline Machine Chest Press | 1300 lever decline chest press | = |
| FB3 | A1: Machine Hip Abduction | 0597 lever seated hip abduction | = |
| FB3 | A2: Machine Hip Adduction | 0598 lever seated hip adduction | = |
| FB3 | Leg Extension | 0585 lever leg extension | = |
| FB3 | Super-ROM DB Lateral Raise | 0334 dumbbell lateral raise | ≈ |
| FB3 | Medicine Ball Russian Twists | 0846 weighted russian twist | = |
| FB4 | Seated Leg Curl | 0599 lever seated leg curl | = |
| FB4 | Smith Machine Reverse Lunge | 0078 barbell rear lunge | ≈ |
| FB4 | Pec Deck (w/ Integrated Partials) | 0596 lever seated fly | = |
| FB4 | Super-ROM Overhand Cable Row | 0218 cable seated wide-grip row | ≈ |
| FB4 | DB Calf Jumps | 0417 dumbbell standing calf raise | ✗ |
| FB4 | Rear Delt 45° Cable Flye | 0225 cable standing cross-over high reverse fly | ≈ |
| Arms | Slow-Eccentric EZ-Bar Skull Crusher | 1748 ez bar lying close grip triceps extension behind head | = |
| Arms | Slow-Eccentric Bayesian Curl | 0190 cable one arm curl | ≈ |
| Arms | Triceps Diverging Pressdown | 0200 cable pushdown (with rope attachment) | ≈ |
| Arms | Hammer Curl | 0313 dumbbell hammer curl | = |
