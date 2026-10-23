# GymBros UI foundation

Read this before you build a screen. The backend API is in `docs/API.md`, and the screen spec is in `docs/PLAN.md` §5.

## 1. Design tokens (`src/app/globals.css`)

The look is "hierro y gis" (iron and chalk). It is dark-first: graphite surfaces, chalk-white text and a **safety-orange** accent. The light theme is a chalk-paper version of the same palette. A faint grain covers the page, and deload weeks get hazard stripes.

**Theme.** The theme follows `prefers-color-scheme` unless `<html>` has the class `.dark` or `.light`. `<ThemeScript/>` sets that class before the first paint, from `localStorage["gb-theme"]`. In Perfil, use `<ThemeControl/>` (`@/components/theme-control`).

Use the semantic utilities. You should almost never need `dark:` variants.

| Purpose | Utilities |
|---|---|
| Page / cards | `bg-bg`, `bg-surface`, `bg-surface-2` (inset, inputs, chips), `bg-raised` (sheets, toasts) |
| Borders | `border-line`, `border-line-strong` |
| Text | `text-fg`, `text-fg-muted`, `text-fg-subtle` |
| Accent | `bg-accent` / `text-accent-fg` (text on accent), `bg-accent-soft`, `text-accent-text` (accent-colored text, AA contrast), `border-accent` |
| Status | `success`, `warning`, `danger` and `info`, each with a `-soft` background (e.g. `bg-success-soft text-success`) |
| Media tile | `bg-media` (always white: the GIFs have white backgrounds) |
| Shadow | `shadow-card` |
| Radii | `rounded-xs` 6, `sm` 10, `md` 14, `lg` 18, `xl` 24, `2xl` 30 |
| Width | `max-w-app` (30rem): the mobile column, centered on desktop |

**Type.**
- `font-display` is **Big Shoulders**, a condensed signage face. Use it for headings, big numbers and lg buttons, usually with `uppercase font-bold`.
- The body font is **Archivo** (default `font-sans`).
- `eyebrow` gives a small uppercase tracked label ("SEMANA 3").
- `nums` gives tabular digits.

**Other custom utilities.**
- `tap`: minimum 44×44.
- `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`: safe-area insets.
- `pb-tabbar`: space for the tab bar.
- `hazard`: diagonal stripes.
- `scrollbar-none`.

**Animations.** `animate-rise` is a staggered entrance; set `style={{animationDelay}}`. Also available: `animate-fade-in`, `animate-sheet-in`, `animate-toast-in`, `animate-shimmer`. All of them respect reduced motion.

**`cx()`.** `cx()` (`@/components/ui/cx`) joins classes and resolves Tailwind conflicts with tailwind-merge (added as a dependency). Because of that, a `className` passed to any primitive overrides its defaults.

## 2. Layout conventions

**Route groups.**
- `(auth)`: `/login`, `/registro`. Brand header, no tab bar.
- `(onboarding)`: `/bienvenida`. No tab bar.
- `(app)`: everything else. Centered `max-w-app` column plus a fixed bottom tab bar, which is `<TabBar/>` inside `<Suspense>` because `usePathname` can suspend.

**Which tab is active.** The tab bar marks a tab active from the path:
- `/` and `/sesion/*` → Hoy
- `/programa/*` → Programa
- `/ejercicios/*` keeps the tab it was opened from (Programa on a cold load)
- `/historial` → Historial
- `/perfil` → Perfil

**Page anatomy** (`@/components/layout/page`, server-safe):

```tsx
<PageHeader eyebrow="Semana 3" title="Full Body #2" back="/programa" size="md"
            actions={<IconButton label="Más"><Icon.Info/></IconButton>}>
  {/* optional row under the title: tabs, progress */}
</PageHeader>
<PageBody>{/* px-4, gap-4, bottom padding clears the tab bar */}</PageBody>
<SectionTitle action={<Link…/>}>Ejercicios</SectionTitle>
```

`PageHeader` is sticky, blurred and safe-area aware. Its `back` chevron (`BackLink`) acts like browser back when there is an in-app entry to return to (a path stack kept by `NavigationTracker`) and otherwise goes to the `back` href, so it never leaves the app; pass `backHistory={false}` to always go to the href (the session screen does). 404s for bad ids/slugs inside `(app)` render `src/app/(app)/not-found.tsx`, which keeps the tab bar. A sticky bottom action bar inside a page should use `sticky bottom-[calc(4rem+env(safe-area-inset-bottom))]` in `(app)`, so it sits above the tabs. In `(onboarding)` use `bottom-0`.

**Mobile rules.**
- Tap targets must be at least 44px.
- Text must be at least 16px in inputs, or iOS zooms.
- There must be no horizontal scroll at 360–430px. Use `min-w-0` and `truncate` on flexible text.
- Thumbs and badges use `shrink-0`.

**Other files.**
- `(app)/loading.tsx` shows `PageSkeleton`.
- `(app)/error.tsx` shows a retry state.
- `app/not-found.tsx` is the 404 page.
- Icons are `app/icon.svg` and `app/apple-icon.tsx`. The manifest PNGs live at `/icons/*.png` (route handlers in `app/icons/`, using `src/lib/app-icon.tsx`).
- `app/manifest.ts` is the web manifest.
- Root `viewport` sets `viewportFit: "cover"` and a `themeColor` for each scheme.

## 3. Pages: the Suspense and `requireUser` pattern (Cache Components)

Any request data (`requireUser`, `cookies`, `headers`, `params`, `searchParams`, `new Date()` before dynamic data) must be read **inside a component wrapped in `<Suspense>`**. If it isn't, `pnpm build` fails. Never read the session in a layout, and never inside `"use cache"`.

```tsx
// src/app/(app)/historial/page.tsx
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { getHistory } from "@/server/services/history.service";

export const metadata = { title: "Historial" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireUser();          // redirects to /login if signed out
  const items = await getHistory(user.id);   // pass plain view objects to client components
  return <HistoryList items={items} />;
}
```

**Dynamic params.** Pages like `sesion/[id]` and `programa/semana/[week]/dia/[position]` should take `params: Promise<…>` (`PageProps<"/sesion/[id]">`) and `await params` **inside** the Suspense child. Example: `<Suspense><Content params={params}/></Suspense>`, and `const { id } = await params` inside `Content`.

**Errors.**
- Map service `NOT_FOUND` to `notFound()` from `next/navigation`.
- `NO_ACTIVE_RUN` / `needsOnboarding` → `redirect("/bienvenida")`.

`/` already does this redirect (in the placeholder). Keep it when you replace that page.

**Links.** Use `next/link`. For links to param routes you want instant (e.g. the "Empezar" button to a session), add `prefetch`.

**Server vs client imports.**
- Client components may import pure modules: `@/server/domain/*`, `@/server/auth/public-paths` (`safeNextPath`), and **types only** (`import type`) from `@/server/services/*`.
- They may import server **actions** from `@/server/actions/*`.
- Never import services, repositories or `db` into a client file.

**Media.** Media paths (`/media/...`) are auth-protected. Use plain `<img>` (already done inside `ExerciseMedia`), never `next/image`.

## 4. Calling actions and showing toasts

Actions return `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`. Call them from client components in a transition:

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeWorkoutAction } from "@/server/actions/workout.actions";
import { Button, useToast } from "@/components/ui";

export function FinishButton({ workoutLogId }: { workoutLogId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button size="lg" block loading={pending} onClick={() => start(async () => {
      const r = await completeWorkoutAction({ workoutLogId });
      if (!toast.result(r, "¡Sesión terminada!")) return;   // shows error.message on failure
      router.push("/");
    })}>Terminar sesión</Button>
  );
}
```

**Revalidation.** Status-changing actions revalidate `"/"` with `"layout"`, so server data refreshes on its own. `saveSetAction` and `chooseExerciseAction` don't revalidate. For those, use the returned data in local state.

**Toast API.** `useToast()` returns:
- `show({title, description?, tone?, duration?, action?, id?})`
- `success(title, opts?)`, `error(title, opts?)`, `warning(title, opts?)`
- `result(r, successTitle?)`
- `dismiss(id)`

Pass `id` to replace a toast in place (e.g. `"save-status"`). Toasts render at the top, in the top layer, so they stay visible above an open BottomSheet. `<ToastProvider>` is already in the root layout.

**Field errors.** For validation failures, read `r.error.fieldErrors?.<field>?.[0]` and pass it to the input's `error` prop.

## 5. Component inventory

Import from the barrels `@/components/ui`, `@/components/exercise` and `@/components/workout`, or import the files directly.

- **(S)** means server-safe: no hooks, usable in Server Components.
- **(C)** means a client component. It can still be rendered from a Server Component with serializable props.

### `ui/`

| Component | Props (main) | Notes |
|---|---|---|
| `Button` (S) | `variant` primary/secondary/outline/ghost/danger · `size` sm 44/md 48/lg 56 · `block` · `loading` · `icon` · `iconRight` + button attrs | `lg` is the display-font CTA |
| `ButtonLink` (S) | same + `Link` props (`href`, `prefetch`) | |
| `buttonStyles(opts)` (S) | → className | Use it to style an `<a>` |
| `IconButton` (S) | `label` (required, aria) · `variant` ghost/secondary/primary · `size` md 44/lg 52 | |
| `Card`, `CardHeader` (S) | `tone` default/raised/accent/inset · `padding` none/sm/md/lg · `as` · CardHeader `eyebrow`, `title`, `action` | `accent` = orange edge bar (current item) |
| `Badge` (S) | `tone` neutral/accent/success/warning/danger/info · `size` sm/md · `icon` | static label |
| `Chip` (S) | `tone` · `icon` · `selected` · `toggle` (aria-pressed) + button attrs | tappable pill, 44px hit area |
| `Input`, `PasswordInput` (C) | `label` · `hint` · `error` · `hideLabel` · `aside` ("Opcional") · `trailing` · `inputClassName` + input attrs | ids and `aria-describedby` are wired for you |
| `NumberInput` (C) | `label` · `value: string` · `onValueChange` · `mode` decimal/numeric · `suffix` · `steppers` + `step`/`min`/`max` · `size` md/lg · `hideLabel` · `placeholder` | `type=text` + `inputMode`; selects all text on focus; filters non-numeric input |
| `parseDecimal(text)` (S) | → `number \| null` | accepts `"35,5"` |
| `Select` (C) | `label` · `options[{value,label}]` + select attrs | native picker |
| `SegmentedControl<T>` (C) | `label` · `hideLabel` · `options[{value,label}]` · `value` · `onChange` · `name` (hidden input) · `size` md/lg | radiogroup, arrow keys |
| `Tabs` (C) | `label` · `items[{value,label,content}]` · `value`/`defaultValue`/`onValueChange` · `variant` underline/pill · `stickyClassName` | ARIA tabs, arrow/Home/End keys |
| `BottomSheet` (C) | `open` · `onOpenChange` · `title` · `eyebrow` · `description` · `footer` · `size` auto/full · `hideTitle` · `bodyClassName` | native `<dialog>`: focus trap, Esc/overlay/drag-handle close, scroll lock, focus returns to the opener |
| `useDisclosure()` (C) | → `{open, setOpen, onOpen, onClose, toggle}` | |
| `Skeleton`, `SkeletonText`, `PageSkeleton` (S) | `className` / `lines` / `label` | |
| `EmptyState` (S) | `icon` · `title` · `description` · `action` · `tone` neutral/danger | |
| `ProgressBar` (S) | `value` 0..1 · `label` · `valueText` · `segments` (e.g. 10 weeks) · `markedSegments` (deload, striped) · `showLabel` · `trailing` · `tone` | role=progressbar |
| `ToastProvider`, `useToast` (C) | see §4 | |
| `Spinner` (S), `Icon.*` (S) | `className` (`size-5` default) · `title` | Icons: Today, Program, History, User, Play, Close, Check, Chevron{Left,Right,Down}, Plus, Minus, Info, Alert, Video, External, Swap, Timer, Flame, Gauge, Dumbbell, Expand, Logout, Eye, EyeOff, Note, Construction |

### `exercise/`

| Component | Props | Notes |
|---|---|---|
| `ExerciseMedia` (C) | `exercise` (`ExerciseSummary` subset: name, gifPath, thumbPath, match, matchNote) · `size` thumb 64/card 96/hero · `enlargeable` · `credit` · `sheetFooter` | Thumb/card show the JPG on a white tile, with a "≈" dot when approximate. Tap opens a sheet with the GIF at up to 2× (360px), the approximation note and the credit. Hero shows the GIF with an "Aproximado" badge, the `matchNote` and the credit. With no media, it shows a placeholder. |
| `GifHero`, `ApproxNote` (C) | `exercise` / `note` | building blocks |
| `MediaCredit` (S), `MEDIA_CREDIT` | `className` | **Any screen that shows thumbs must render `<MediaCredit/>` once** (hero and sheet already include it) |
| `VideoButton` (C) | `youtubeId` (null → renders nothing) · `title` · `label` ("Ver video") · `variant` button/chip · `buttonVariant` · `size` · `block` | Opens `VideoSheet` |
| `VideoSheet` (C) | `youtubeId` · `title` · `open` · `onOpenChange` | youtube-nocookie iframe (mounted only while open) plus "Abrir en YouTube" (`https://youtu.be/<id>`) |
| `TechniqueChip` (C) | `technique: TechniqueView` | Opens a sheet with `nameEs`, `descriptionEs` and the scope |
| `TECHNIQUE_SCOPE_ES`, `youtubeEmbedUrl`, `youtubeWatchUrl` (S) | | in `exercise/shared.ts` |

Example session card header:

```tsx
<div className="flex gap-3">
  <ExerciseMedia exercise={item.performedExercise!} sheetFooter={<VideoButton youtubeId={ex.youtubeId} title={ex.name} block />} />
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2"><SupersetTag label={item.supersetLabel} /><h3 className="truncate font-semibold">{ex.name}</h3></div>
    <p className="nums text-sm text-fg-muted">{item.workingSets} × {item.reps.text}</p>
    <div className="mt-1 flex flex-wrap gap-1.5"><RpePair earlyRpe={item.earlyRpe} lastRpe={item.lastRpe} /><RestBadge rest={item.rest} />{item.technique && <TechniqueChip technique={item.technique} />}</div>
  </div>
</div>
```

### `workout/` (all server-safe)

| Component | Props |
|---|---|
| `RestBadge` | `rest: {text}`. Hidden when null or N/A |
| `RpeBadge` | `rpe: {text}` · `label?` · `tone` neutral/accent |
| `RpePair` | `earlyRpe`, `lastRpe`. Collapses to one badge when they are equal |
| `SupersetTag` | `label` ("A1" or null) |
| `SuggestionBadge` | `suggestion: "increase" \| "hold" \| null`. Labeled as the app's own progression rule |
| `WeekBanner` | `isDeload` · `text` (`week.bannerEs ?? week.banner`). Deload weeks get hazard stripes |

### Other

| Component | Notes |
|---|---|
| `layout/brand` `BrandMark`, `Wordmark` (S) | |
| `layout/tab-bar` `TabBar`, `TabBarView`, `tabForPath` | |
| `layout/under-construction` `UnderConstruction` (S) | Placeholder screens |
| `theme-control` `ThemeControl`, `useThemePreference`, `setThemePreference` (C) | For Perfil |
| `auth/*` | Login and registration forms, plus `authErrorMessage` (Better Auth code → Spanish) |
| `onboarding/onboarding-form` | `/bienvenida` |

**Domain display helpers.** From `@/server/domain` (pure, and safe in client components): `formatWeight(v, unit, {displayUnit, step})`, `formatSetTarget`, `formatRepsScheme`, `formatRest`, `formatDuration` (for a rest timer), `formatRpe`, `computeWarmupSets`, `convertWeight`.

## 6. Status of routes

| Route | State |
|---|---|
| `/login`, `/registro` | Done. Honors `?next=` via `safeNextPath`. After registration it goes to `/bienvenida`, or to `next` when one was given. |
| `/bienvenida` | Done. Redirects to `/` if you're already onboarded. |
| `/` (Hoy) | **Placeholder**, which also does the needsOnboarding → `/bienvenida` redirect. |
| `/programa`, `/programa/semana/[week]/dia/[position]`, `/sesion/[id]`, `/ejercicios/[slug]`, `/historial`, `/perfil` | **Placeholders** (`UnderConstruction`). Replace the `page.tsx`. |

## Activity (route state is preserved)

Next.js 16 keeps up to 3 visited routes alive inside React `<Activity>` (hidden, effects cleaned up). Consequences already handled:
- `BottomSheet` closes its native `<dialog>` and reports `onOpenChange(false)` when its route is hidden, so a sheet left open (e.g. Android back) can't make the next page inert.
- The session screen's client store is built once from its props; `/sesion/[id]` keys `<SessionScreen>` by log id + unit + weak point so a Perfil change rebuilds it (unsaved edits survive via the localStorage drafts, which record the unit they were typed in).
