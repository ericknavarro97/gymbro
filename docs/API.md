## Final API reference for UI work

**Conventions**
- Services take `userId` first and import nothing from Next.
- In Server Components: call `requireUser()` inside `<Suspense>` (never inside `"use cache"`), then the service.
- Services throw `ServiceError{code,message,fieldErrors?}`. Codes: `VALIDATION | NOT_FOUND | NO_ACTIVE_RUN | NOT_ONBOARDED | WEAK_POINT_NOT_SET | EXERCISE_NOT_ALLOWED | EXERCISE_REQUIRED | CONFLICT`.
- Actions return `{ok:true,data} | {ok:false,error:{code,message,fieldErrors?}}`; `code` can also be `INTERNAL`.
- All dates are ISO strings. Another user's ids come back as NOT_FOUND.

**Auth**
- Client (`src/lib/auth-client.ts`): `signUpWithUsername({name,username,password,signupCode?})`, `signInWithUsername(u,p)`, `signOut()`, `useSession`.
- Server (`src/server/auth/session.ts`): `getSession()`, `requireUser()` (redirects to `/login`), `getUserOrNull()`.
- Error codes the auth endpoints return:

| Code | Status |
|---|---|
| `INVALID_SIGNUP_CODE` | 403 |
| `USERNAME_REQUIRED` | 400 |
| `PASSWORD_TOO_SHORT` | 400 |
| `INVALID_USERNAME` | 400 |
| `USERNAME_IS_ALREADY_TAKEN` | 400 |
| `INVALID_USERNAME_OR_PASSWORD` | 401 |

- Username is 3–30 characters and stored lowercased; `displayUsername` keeps the original casing. Password is 8–128 characters.
- The login page must pass `?next=` through `safeNextPath()` from `@/server/auth/public-paths`.

**Proxy**
- Public: `/login`, `/registro`, `/api/auth/*`, `/_next/*`, `/icons/*`, favicon, manifest, icon routes and root static files.
- Protected: `/media/*` (also case-insensitive and percent-encoded forms) and every other route.
- Signed out: pages redirect to `/login?next=...` (no `next` for `/` and `/media`), and `/api/*` returns 401 JSON.
- Signed in: a GET to `/login` or `/registro` redirects to `/`.

**`workout.service.ts`**
- `getTodayOverview(userId,{now?,timeZone?})` returns:
  - `needsOnboarding`, `settings{unit,roundingLb,roundingKg,weakPoint|null}`, `run|null`
  - `next{day,week{id,number,isDeload,banner,bannerEs},block{id,number,name,nameEs,description},workoutLog{id,status}|null}|null`
  - `inProgress{workoutLogId,dayId,dayName,weekNumber}|null`, `progress{done,total,ratio}`
  - `programFinished`, `restDay`, `lastCompleted{workoutLogId,completedAt,dayName,weekNumber}|null`
  - The time zone defaults to `APP_TIME_ZONE`, or `America/Mexico_City` when unset.
- `getProgramOverview(userId)` returns:
  - `program{id,slug,name,author,description,notesEs[]}`, `run`, `progress`, `nextDayId`
  - `blocks[{...block, weeks[{...week, days[{id,position,name,kind,restAfter,status:"pending"|"in_progress"|"completed"|"skipped",workoutLogId,isNext}]}]}]`
- `getWorkoutDayDetail(userId, dayId)` and `getWorkoutDayDetailByPosition(userId, week, pos)` return `{day, week, block, settings, needsWeakPoint, prescriptions: PrescriptionView[], workoutLog|null}`.
- **`PrescriptionView`** has:
  - `id, position, slot, isOptional, supersetGroup, supersetOrder, supersetLabel ("A1"|null)`
  - `exercise/sub1/sub2: ExerciseSummary|null`
  - `choices[{kind:"main"|"sub1"|"sub2"|"weak_point_option", exercise, note}]`
  - `technique{key,name,nameEs,scope,descriptionEs}|null`, `workingSets`
  - `warmup{text,min,max}`, `reps{text,scheme,segmented,targets[{setNumber,segmented,segments[{min,max|null,label?}],label}]}`
  - `earlyRpe/lastRpe{text,min,max}`, `rest{text,minSec,maxSec}`, `notesEn`, `notesEs`
- **`ExerciseSummary`** has `{id,slug,name,youtubeId,datasetId,match,matchNote,gifPath,thumbPath,target,equipment}`. `gifPath`/`thumbPath` look like `/media/exercises/{id}.gif|.jpg`, or are null when the exercise isn't mapped.
- `startWorkout(userId,{workoutDayId})` returns `{workoutLogId,status,created}`.
  - Idempotent, including concurrent calls.
  - A skipped day is reopened as `in_progress`; a completed one stays completed and editable.
  - Throws `NO_ACTIVE_RUN` before onboarding.
- `getWorkoutSession(userId, workoutLogId)` returns `{workoutLog{id,runId,status,startedAt,completedAt}, day, week, block, settings, needsWeakPoint, warmupProtocol, generalWarmup[{position,item,itemEs,dose,doseEs}], items: SessionItem[]}`.
- **`SessionItem`** is a `PrescriptionView` plus:
  - `exerciseLogId|null`, `performedExercise`, `performedIsDefault`
  - `sets[{setNumber,weight,unit,reps,rpe,segmentReps,updatedAt}]`
  - `lastPerformance{workoutLogId,runId,date,weekNumber,dayPosition,dayName,prescriptionId,sets}|null`
  - `suggestion:"increase"|"hold"|null`
  - `warmupPlan{sets[{setNumber,pctOfWorking,repsText,weight,unit}],extraSetSuggested}|null`
- `saveSet(userId,{workoutLogId,prescriptionId,performedExerciseId?,setNumber,weight|null,unit,reps|null,rpe?,segmentReps?})` returns `{exerciseLogId,performedExerciseId,set|null}`.
  - Sending weight, reps and segments all empty deletes the set.
  - `setNumber` can be at most `workingSets+2`.
  - `segmentReps` holds the logged phases in order: 1..N entries (N = the scheme's segment count; trailing phases not done are omitted). `reps` defaults to the first segment.
  - RPE goes in steps of 0.5.
  - **New:** saving into a skipped session reopens it as `in_progress`.
- `chooseExercise(userId,{workoutLogId,prescriptionId,exerciseId})` returns the refreshed `SessionItem`. It throws `EXERCISE_NOT_ALLOWED`, or `WEAK_POINT_NOT_SET` for a weak-point slot when the user has none.
- `completeWorkout(userId,{workoutLogId})` and `skipWorkout(...)` return `{workoutLogId,status,completedAt,nextDayId|null}`.
  - **New:** completing again keeps the original `completedAt`.
  - **New:** skipping a completed session throws `CONFLICT`.

**`onboarding.service.ts`**
- `getOnboardingState(userId)` returns `{onboarded, settings, run, weakPoints[{id,key,nameEn,nameEs,guidanceEn,guidanceEs,optionCount{slot1,slot2}}]}`.
  - Weak point keys: shoulders, lats, quads, glutes, chest, neck, hamstrings, calves, mid_back, upper_traps, abs, biceps, triceps.
- `completeOnboarding(userId,{unit, weakPointKey?|null, startedOn?:"YYYY-MM-DD"})` returns `{settings, run, createdRun}`.
  - It keeps an existing active run.
  - **New:** leaving out `weakPointKey` keeps the current weak point; `null` clears it.
- `updateSettings(userId,{unit?, weakPointKey?|null, roundingLb?, roundingKg?})` returns `SettingsView`. At least one field is required.
- `restartProgram(userId,{startedOn?})` returns `{previousRun{...,closedAs:"finished"|"abandoned"}|null, run}`. Throws `NOT_ONBOARDED` before onboarding.

**`history.service.ts`**
- `getExerciseDetail(slug)` returns `ExerciseSummary` plus `{bodyPart, secondaryMuscles[], instructionsEs[], instructionsEn[]}`.
- `getExerciseHistory(userId, slug, {runId?, displayUnit?})` returns `{exercise{id,slug,name}, unit, runId|null, weeklyFromPreviousRun, weekly[{week,weight,unit,reps}], sessions[{workoutLogId,runId,status,startedAt,completedAt,weekNumber,dayPosition,dayName,prescriptionId,sets}]}`.
  - `weekly` covers the requested run, else the active run, else the latest one. Without `runId`, if that run has no data for the exercise (e.g. right after restarting the program), `weekly`/`runId` fall back to the most recent earlier run with data and `weeklyFromPreviousRun` is `true`. `weekly` weights are converted to `unit` at full precision (round once for display). `sessions` covers all runs.
- `getHistory(userId,{limit?,runId?})` returns completed workouts, newest first: `[{workoutLogId,runId,workoutDayId,startedAt,completedAt,weekNumber,isDeload,dayPosition,dayName,dayKind,exerciseCount,setCount}]`. For the detail screen, use `getWorkoutSession`.

**Server actions (`src/server/actions`)**
- Workout: `startWorkoutAction`, `saveSetAction`, `chooseExerciseAction`, `completeWorkoutAction`, `skipWorkoutAction`.
- Settings: `completeOnboardingAction`, `updateSettingsAction`, `restartProgramAction`.
- Inputs are the same as the services, without `userId`.
- Revalidation: actions that change status call `revalidatePath("/", "layout")`. `saveSet` and `chooseExercise` don't revalidate (autosave); use the returned data.

**Route handler**
- `GET /api/exercises/[slug]/history?unit=lb|kg&runId=` returns the `getExerciseHistory` JSON with `Cache-Control: private, no-store`. Errors: 401, 400, 404.

**Behaviours the UI should know**
- `lastPerformance` is the most recent earlier session of the same exercise actually performed, across days, prescriptions and runs. Skipped sessions and the current one are excluded.
- Substitutions keep their own history.
- Deload weeks never get "increase".
- Weak-point slots default to the first option for that slot.
- Media needs a session cookie, and the "© Gym visual — gymvisual.com" credit must be shown wherever a GIF appears.