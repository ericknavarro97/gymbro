# Reporte E2E — GymBros

Fecha: 2026-10-23 · App: `next dev` en http://localhost:3000 · Navegador: agent-browser (Chrome del sistema) en viewport móvil 390x844 y 360x780, temas claro y oscuro.

## 1. Alcance probado (escenarios)

Cada ronda tuvo 5 testers en paralelo, cada uno con su sesión de navegador aislada y usuarios propios `e2e_*`. Nunca se usó ni se modificó al usuario `erick`.

| Tester | Escenarios |
|---|---|
| t1-auth | Registro, login, logout, redirecciones `?next=`, rutas protegidas, onboarding (`/bienvenida`), revocación de sesión, nombres largos |
| t2-browse | Hoy, `/programa` (semanas/días), detalle de día, `/ejercicios/<slug>` (GIF, "Ver video"), Perfil (unidades, redondeo, tema, punto débil) |
| t3-tracking | Sesión en vivo: registrar series (peso/reps/RPE), autosave, placeholders de "Semana pasada", conversión lb/kg, terminar sesión |
| t4-special | Técnicas especiales (dropsets, compuestas), espacios de punto débil (Elegir/sustituir), calentamiento, saltar día |
| t5-history-ui | `/historial`, detalle de sesión, gráfica y tabla "Carga por semana", Reiniciar programa, contraste/a11y, layout a 360 px |

Los datos mostrados se compararon contra `data/source/*.json` y `data/mapping/exercise-map.json`.

## 2. Rondas

- **Ronda 1:** 11 bugs confirmados (cada uno reproducido al menos 2 veces), 0 rechazados. Los 11 se corrigieron y se **verificaron en la app real** (verify-0 … verify-6).
- **Ronda 2:** 5 bugs confirmados, 0 rechazados. Los 5 se corrigieron en código y tienen tests. Durante la verificación el dev server de :3000 (next-server PID 2926) dejó de responder: escucha en `*:3000`, pero resetea todas las conexiones (`curl` exit 7, `ERR_SOCKET_NOT_CONNECTED`). No se reinició, por regla. Por eso solo R2-3 se verificó en navegador, y fue en una copia aislada en otro puerto. R2-1, R2-2, R2-4 y R2-5 quedan **pendientes de verificar en la app real**.
- Al cerrar este reporte (03:40), :3000 sigue respondiendo `HTTP 000`.

## 3. Bugs encontrados

### Ronda 1

| ID | Severidad | Título | Estado |
|---|---|---|---|
| R1-1 | Alta | Open redirect: un tab, CR o LF en `?next=` pasa `safeNextPath` y manda al usuario a otro sitio tras login/registro | Corregido y verificado |
| R1-2 | Media | El BottomSheet de tamaño completo (selector de punto débil en Perfil) abre con el `<dialog>` desplazado: encabezado y Cerrar fuera de pantalla | Corregido y verificado |
| R1-3 | Baja (a11y) | Ninguna página autenticada tiene landmark `<main>` | Corregido y verificado |
| R1-4 | Media | Las series registradas en un espacio de punto débil se ocultan al cambiar a un punto débil sin opciones | Corregido y verificado |
| R1-5 | Baja | Un RPE fuera de pasos de 0.5 se guarda redondeado, pero el input sigue mostrando el valor tecleado hasta recargar | Corregido y verificado |
| R1-6 | Baja | Las fases vacías de dropset/compuesta se guardan como 0 reps y reaparecen como "0" | Corregido y verificado |
| R1-7 | Baja | Los placeholders de peso muestran conversiones sin redondear (90.72, 203.93) frente a 90.7 / 203.9 en "Semana pasada" | Corregido y verificado |
| R1-8 | Media | Después de "Reiniciar programa", "Carga por semana" dice "Aún no hay historial" aunque hay sesiones listadas | Corregido y verificado |
| R1-9 | Baja | La tabla semanal muestra 81.7 kg para 180 lb y el resto de la app 81.6 kg (doble redondeo) | Corregido y verificado |
| R1-10 | Baja (a11y) | Las filas atenuadas del historial y las tarjetas vacías tienen contraste de 2.2–3.9:1 | Corregido y verificado |
| R1-11 | Baja (copy) | Nota del punto débil en inglés dentro de la UI en español (Pecho, Punto débil 2) | Corregido y verificado |

Detalle de cada corrección y de su verificación:

- **R1-1.** `src/server/auth/public-paths.ts` ahora rechaza caracteres de control y backslashes, resuelve contra un origen centinela, exige el mismo origen y vuelve a revisar `//` después de normalizar.
  - Se probaron 8 payloads en login y uno en registro: `%09`, `%0A`, `%0D`, `..//`, `/\`, `//`, `https://`. Todos se quedaron en localhost.
  - `?next=/programa?x=1` sigue funcionando.
  - `tests/unit/public-paths.test.ts`: 46/46.
- **R1-2.** El dialog del BottomSheet usa `overflow: clip` y `scrollTop` se resetea.
  - Con `size='full'` y `size='auto'`, a 390 y 360, se midió `scrollTop=0` y el panel queda arriba al 8% del alto de la pantalla.
  - Isquiotibiales se puede seleccionar, GUARDAR persiste y Escape o tocar el fondo cierran el sheet.
- **R1-3.** El wrapper de `src/app/(app)/layout.tsx` ahora es `<main>`.
  - Hay exactamente un `main` por página, también en los not-found dentro del layout, y ninguno anidado.
  - `tests/unit/app-landmarks.test.ts` pasa.
- **R1-4.** Si el espacio ya tiene ejercicio o series registradas, la tarjeta muestra las filas (editables) y una nota; el contador se mantiene.
  - Verificado en semana 1 con Abdominales y en semana 2 con Bíceps.
- **R1-5.** El RPE normalizado se escribe de vuelta en el input: 8.3→8.5, 7.2→7, 9.2→9, 6.8→7. La UI coincide con la BD.
- **R1-6.** Solo se guarda el prefijo de fases llenas: `{5,3}` y `{6}`.
  - Una fase vacía en medio muestra "Completa la fase 2" y no se guarda nada.
  - El historial ya no muestra `+0`.
  - Tests: 10/10.
- **R1-7.** Los placeholders usan el mismo redondeo a 1 decimal que el resto de la app: 15.9 / 13.6 kg y 203.9 lb.
- **R1-8.** Si el ciclo actual no tiene datos, se usa el ciclo anterior: aparece el badge "Ciclo anterior" y la API devuelve `weeklyFromPreviousRun=true`.
  - Al registrar en el ciclo nuevo, la vista vuelve a ese ciclo.
  - `?runId=` explícito sigue funcionando.
- **R1-9.** Se quitó el pre-redondeo `toFixed(2)` en `weekly-load.ts`; la tabla muestra 81.6 kg y 90.7 kg. `weekly-load.test.ts`: 9/9.
- **R1-10.** Se quitó la opacidad del texto.
  - Fila saltada: 7.53:1 en claro y 9.09:1 en oscuro.
  - "Sin series registradas.": 8.22:1 en claro y 8.47:1 en oscuro.
  - `history-contrast.test.ts`: 5/5.
- **R1-11.** Se agregó `translateWeakPointNote` en `profile.service.ts`, `workout.service.ts` y `seed.ts`.
  - El texto "inclinado si el pecho superior está rezagado, plano si es todo el pecho" aparece en los 4 lugares donde se muestra la nota.
  - No se tocó `data/source` ni se resembró la BD.
  - Tests: 4/4.

### Ronda 2

| ID | Severidad | Título | Estado |
|---|---|---|---|
| R2-1 | Media (seguridad) | Una sesión cerrada se sigue aceptando hasta 5 min mediante la cookie firmada `session_data` (páginas, API y /media) | Corregido en código y tests. **Falta verificar en la app real** |
| R2-2 | Baja | "Código de invitación" siempre aparece y dice "Opcional", aunque el servidor lo exige cuando `SIGNUP_CODE` está definido | Corregido en código y tests. **Falta verificar en la app real** |
| R2-3 | Baja (visual) | El h1 de `/bienvenida` se desborda con un nombre largo sin espacios (scrollWidth 2149 px) | Corregido y verificado en una copia aislada (puerto 3217). Falta revisarlo en :3000 |
| R2-4 | Baja (a11y) | Tema claro: el texto de los CTA primarios (3.76:1) y las etiquetas `fg-subtle` (3.82–4.15:1) no llegan a 4.5:1; en tema oscuro, `fg-subtle` sobre surface-2 da 4.26:1 | Corregido en código y tests. **Falta verificar en la app real** |
| R2-5 | Baja (visual) | A 360 px el nombre del día se trunca a "Full B…" cuando aparecen los badges "Siguiente" y "En curso" | Corregido en código y harness. **Falta verificar en la app real** |

Detalle de cada corrección y de su verificación:

- **R2-1.** `auth.ts`: `cookieCache: { enabled: false }`. `proxy.ts` y `session.ts` pasan `disableCookieCache: true`.
  - `tests/integration/session-revocation.test.ts`: 2/2. Cerrar sesión y luego reenviar las cookies viejas da 307/401/null.
  - Pendiente: repetir el curl con las cookies viejas contra `/perfil`, `/api/exercises/.../history` y `/media/exercises/0009.gif` en :3000.
- **R2-2.** `registro/page.tsx` (componente de servidor) calcula `requireCode` y se lo pasa a `RegisterForm`.
  - El campo solo se muestra si hay código; entonces es obligatorio, no dice "Opcional" y valida con "Escribe tu código de invitación."
  - Un test temporal de render pasó y luego se borró.
  - Pendiente: abrir `/registro` en :3000, a 390 y 360.
- **R2-3.** Se agregó `break-words [overflow-wrap:anywhere]` al h1. En la copia aislada, scrollWidth es 390 y 360, y el onboarding completo sigue funcionando. `onboarding-heading-wrap.test.ts`: 2/2.
- **R2-4.** Nuevos tokens en `globals.css`:
  - Claro: `--gb-accent #cc4709` (4.70:1 con texto blanco), `--gb-accent-strong #a93905` y `--gb-fg-subtle #66625a` (≥4.91:1).
  - Oscuro: `--gb-fg-subtle #948f82` (≥4.80:1), igual en los dos bloques dark.
  - Se quitó `opacity-80` del badge de RPE (queda en 4.89:1).
  - `theme-contrast.test.ts`: 26/26.
  - Pendiente: medir los estilos computados en la app servida.
- **R2-5.** El nombre ya no tiene `truncate` y los badges van en una línea propia con `flex-wrap`.
  - En el harness (BlockPanel real con el CSS compilado), a 360 y 390 y en los dos temas, el nombre se ve completo y no hay overflow.
  - Pendiente: revisar `/programa` en :3000 con una sesión en curso.

## 4. Reportes rechazados

- Ronda 1: ninguno. Los 11 reportes se contrastaron con el código; son defectos reales con causas distintas. En R1-7, que los inputs de series ya guardadas conserven 2 decimales es intencional (precisión); el defecto era solo la diferencia entre placeholder y "Semana pasada".
- Ronda 2: ninguno.

## 5. Problemas conocidos pendientes

1. **El dev server en :3000 no responde.** Resetea todas las conexiones desde la ronda 2 y seguía así al cerrar este reporte. El dueño tiene que reiniciarlo (`pnpm dev`). Después hay que re-verificar R2-1, R2-2, R2-4 y R2-5, y R2-3 en :3000.
2. **Vaciar los inputs de una serie no la borra.** Al borrar peso y reps de una fila, el registro se queda en `set_logs`. Pasa en ejercicios normales (p. ej. Bayesian Cable Curl), no solo en puntos débiles. Se observó durante verify-3; no se clasificó como bug independiente.
3. **El toggle LB/KG por tarjeta cambia la unidad sin convertir el número.** Por ejemplo, 92.5 kg pasa a 92.5 lb y se vuelve a guardar. Según `setItemUnit` es el comportamiento intencional; conviene confirmarlo con el dueño.
4. **Contraste de las etiquetas de stats del detalle de historial.** EJERCICIOS, SERIES y DURACIÓN (10 px) medían 3.82:1 en claro y 4.26:1 en oscuro. Los tokens de R2-4 deberían corregirlo, pero no se ha medido en la app.
5. **Contraste de la etiqueta "Sem".** En `program-weeks.tsx` (≈línea 60) la etiqueta "Sem" de 10 px usa `opacity-80` y no se ha medido.

## 6. Qué no se probó

- Build de producción (`pnpm build` / `next start`): prohibido para no afectar el dev server.
- Navegadores distintos de Chrome (Safari iOS, Firefox) y dispositivos físicos.
- Tablet o escritorio: solo se usaron viewports móviles.
- Las 10 semanas completas de punta a punta: solo se recorrieron las semanas 1–4 y algunos días sueltos.
- Rendimiento, carga, uso offline y red lenta.
- Lectores de pantalla reales: la a11y se revisó con landmarks, foco/teclado y mediciones de contraste.
- Registro con `SIGNUP_CODE` definido en :3000 (en este entorno está vacío).
- Todo lo de la ronda 2 marcado como pendiente en la sección 3.

## 7. Calidad de código (ejecutado al cerrar)

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | OK (exit 0, sin errores) |
| `pnpm lint` | OK (exit 0, sin advertencias) |
| `pnpm test` | OK: 20 archivos, **377/377 tests** pasan (vitest 5.0.5, 19.7 s) |

Limpieza: `select username from "user" where username like 'e2e\_%'` devuelve **0 filas**. No quedan usuarios de prueba y no se tocó al usuario `erick`.

## 8. Cómo repetir las pruebas

1. Levanta la app (`pnpm dev`) y Postgres (contenedor `gymbros-db`). Confirma que `curl -I http://localhost:3000/login` responde.
2. Checks estáticos: `pnpm typecheck && pnpm lint && pnpm test`. Solo integración: `pnpm test:integration`, p. ej. `pnpm vitest run tests/integration/session-revocation.test.ts`.
3. Navegador (agent-browser), siempre con el Chrome del sistema y una sesión propia:
   ```sh
   export AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   agent-browser --session e2e-rerun open http://localhost:3000/registro
   agent-browser --session e2e-rerun set viewport 390 844   # repetir con 360 780
   agent-browser --session e2e-rerun screenshot e2e-artifacts/rerun/01.png
   agent-browser --session e2e-rerun close
   ```
4. Crea usuarios en `/registro` como `e2e_<sufijo>` con contraseña `e2e-password-123`. Sigue los pasos de reproducción de la sección 3; los pendientes de la ronda 2 tienen prioridad.
5. Para R2-1: inicia sesión, copia las cookies `better-auth.session_token` y `better-auth.session_data`, pulsa "Cerrar sesión" y ejecuta `curl -b '<cookies>'` contra `/perfil`, `/api/exercises/cross-body-lat-pull-around/history` y `/media/exercises/0009.gif`. Se espera 307 en páginas y media, y 401 en la API.
6. Limpieza, filtrando solo tus usuarios:
   ```sh
   docker exec gymbros-db psql -U gymbros -d gymbros -c "delete from \"user\" where username in ('e2e_xxx');"
   ```
7. Evidencia previa: `e2e-artifacts/round-1/{t1..t5,verify-0..6}` y `e2e-artifacts/round-2/{t1..t5,verify-1,verify-2,verify-4}`.
