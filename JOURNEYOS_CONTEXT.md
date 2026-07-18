# JourneyOS durable project context

Read this file before changing JourneyOS after a long conversation, context compaction, handoff, or merge. It records the intended product, demo story, architecture, current behavior, integration boundaries, commands, risks, and unfinished work. Update it whenever a major decision changes.

## Product and hackathon goal

JourneyOS is a **voice-first operating system for group travel**. Its memorable feature is the **AI Travel Negotiator**: it already knows the group's saved preferences, calls one consenting traveler, names a specific conflict, proposes a fair trade, seeks explicit agreement, and sends the result to the trip admin before changing the itinerary.

Do not describe the primary experience as a chatbot, survey, passive mediator, or generic concierge. The winning sentence is: **“JourneyOS negotiates one fair group plan, books the known travel through Sabre, and adapts the active day by voice.”**

Hackathon qualification requires both Sabre APIs and Vocal Bridge. Prize targets also include:

- American Airlines Blue Sky Thinking Award: make AA flight evidence clear when Sabre CERT actually returns AA inventory; never relabel another carrier as AA.
- PayPal Best Dev Tools Award: complete a real PayPal sandbox approval/capture demonstration.
- Audience Award: keep the story understandable in three minutes and make the negotiation outcome visually obvious.

## Canonical three-minute demo

1. Start from the seeded Tokyo trip for Hema, Prabhu, Deepu, and Sanjay.
2. Show two earlier preference profiles as already collected; these are the comparison context, not a prewritten conflict.
3. In **Plan together**, call only the third friend's real, consenting phone number through Vocal Bridge.
4. JourneyOS first asks for one live priority or constraint. Only after the traveler answers does it compare that answer with the two known profiles, identify any real conflict, explain why it matters, and generate a specific trade.
5. The traveler explicitly accepts or rejects the generated trade. The live transcript appears. The UI shows the discovered conflict, computed before → after plan fit, accepted changes, and an admin preview.
6. Hema clicks **Apply agreement to Day 2**. Only then does Day 2 gain the early dinner and optional nightlife.
7. Show Sabre CERT package/flight/hotel evidence. Select a package and open PayPal sandbox for the known pre-trip amount.
8. On **Live itinerary**, select a day and say a contextual command such as “mark place 2 complete” or “cancel the evening activity.” The selected day updates; the voice agent must not restart trip planning.
9. If time permits, show a shared receipt, custom split, net settlement, and PayPal collection.

If live outbound calling is unavailable, use the clearly labeled scripted fallback. It runs the same server state transitions and admin approval rule; never imply that it placed a real call.

## Seeded people and default demo story

- Hema: trip admin; culture, history, sushi/regional food; full pace.
- Prabhu: live-call target; street food, photography, nightlife; balanced pace.
- Deepu: vegetarian friendly, culture/photography; demo constraint is early vegetarian dinner.
- Sanjay: no shellfish, easy pace, nature/culture.
- The default seed provides a useful set of different preferences, but the conflict must be discovered from what the third traveler actually says during the live call.
- Fallback schedule times are calculated from the active day's existing stops and meal windows. Vocal Bridge may return different accepted times from the real conversation.
- Negotiation names, counterpart, conflict, destination, affected day, itinerary labels, transcript, and plan-fit values are derived from the active trip. Plan fit is deterministic and evidence-based, not probabilistic model confidence.

Do not hardcode negotiation outcomes to Hema, Prabhu, Deepu, Tokyo, Day 2, or fixed fit percentages. The named Tokyo roster is only the ready-to-run seed; edited traveler profiles and newly created trips must produce their own negotiation context.

Do not replace the named roster with “Friend 1,” “Friend 2,” etc. A new trip brief updates Hema's organizer preferences and reconciles the requested group size while preserving existing named friends and their phone numbers whenever possible.

## Current pages and intended order

1. Trip dashboard: current trip brief, day plan summary, weather for the trip destination.
2. Plan together: voice brief plus the focused one-call AI Travel Negotiator. The older partner-built `GroupPlanningPanel.tsx` remains preserved in source; the focused experience is `NegotiationExperience.tsx`.
3. Live itinerary: selected day's ordered activities first, contextual voice control/progress, then the day map and selected-place details. Voice commands must use the current page and active day.
4. Booking & trip payments: Sabre flight/hotel/package selection and PayPal payment for known pre-trip costs.
5. Shared expenses: scan/add/delete receipts, equal or custom percentage splits, traveler paid/share/net totals, and final collection.
6. Travel DNA: evidence-backed likes, dislikes, constraints, and negotiation-useful learning. Avoid unexplained 5/5 scores or fake confidence.

## Architecture

- `client/`: React, TypeScript, Vite, Tailwind-style utility CSS.
- `server/`: Express, TypeScript, Zod validation.
- `server/src/store/demo-store.ts`: in-memory demo persistence seam and deterministic domain transitions.
- Browser state is also hydrated from the current trip object; the server polls active Vocal Bridge call state through `/api/trips/demo`.
- `server/src/db/schema.sql`: future normalized persistence starting point. The current app is not a production multi-user/multi-trip backend.
- `vocal-bridge/`: agent prompt and action configuration source. Dashboard/hosted agent configuration must be manually synchronized after changes.

Key negotiation endpoints:

- `POST /api/planner/negotiation/start`: starts one live call when configured, otherwise returns scripted mode.
- `POST /api/planner/negotiation/simulate`: reliable scripted completion using the same state model.
- `POST /api/negotiation-calls/complete`: secured live callback for explicit accept/decline.
- `POST /api/planner/negotiation/apply`: admin-only demo action that changes the agreement's derived day after acceptance.
- `GET /api/voice/outbound-context`: secured trip and conflict context for the outbound agent.

## Integration truth and configuration

Never commit `.env`, API keys, access tokens, phone secrets, PayPal credentials, or Sabre credentials. Use `.env.example` only for variable names.

### Vocal Bridge

Server variables: `VOCAL_BRIDGE_API_KEY`, `VOCAL_BRIDGE_API_URL`, `VOCAL_BRIDGE_AGENT_ID`, and `VOCAL_BRIDGE_CONTEXT_SECRET`. Real outbound calls also require the `vb` CLI to be installed, authenticated, and allowed to place calls. Phone numbers must be E.164 and belong to a consenting demo participant.

The hosted agent must be able to reach the local callback through a public HTTPS tunnel. Configure its context fetch and completion callback with `X-JourneyOS-Context-Key` equal to `VOCAL_BRIDGE_CONTEXT_SECRET`. The global in-browser mic uses page context and is separate from the outbound telephone call.

### Sabre

The app supports Sabre CERT adapters/MCP and mock fallback. CERT is sandbox evidence, not production booking availability. Search uses trip origin, destination airport mapping, dates, return date, and traveler count. AA should appear only when the returned carrier is actually American Airlines/AA. CERT inventory and prices can be unrealistic; label source and recheck requirements visibly.

Variables are documented in `.env.example`, including OAuth v2 hackathon values and CERT endpoints. Do not expose any Sabre credential to the client.

### Google

Server key: `GOOGLE_PLACES_API_KEY`; optional `GOOGLE_WEATHER_API_KEY`. Client map key is normally in `client/.env.local` using the client variable expected by the map component. Enable the exact APIs used (Maps JavaScript, Places, Routes, Weather where applicable), allow billing if Google requires it, and set separate server/client key restrictions. Blank maps commonly mean API restriction, billing, referrer, quota, or invalid-place data problems—not a CSS problem.

### PayPal

Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, and `MOCK_MODE=false` for real sandbox Orders API behavior. A real approval URL should open PayPal sandbox; a mock order must be labeled mock and will not show in a sandbox account. Known flight/hotel costs use an admin-first model: the trip admin advances the full booking total once, then JourneyOS calculates each traveler's reimbursement share. This PayPal merchant collection does not itself pay or ticket Sabre flight/hotel suppliers; supplier booking and settlement remain separate integrations. Variable receipts are tracked during travel and net-settled afterward so booking costs are never charged twice. Each end-of-trip PayPal checkout targets one selected debtor's exact net reimbursement rather than pretending one checkout collected from every traveler. Shipping is disabled for these non-physical orders.

### Receipt OCR

Landing AI is optional (`LANDING_AI_API_KEY`, `LANDING_AI_ENDPOINT`). The app has a labeled demo receipt fallback. Receipts record description, amount, payer, participants, and optional custom percentages; incorrect receipts can be deleted and totals reverse.

## Local setup and commands (Windows PowerShell)

Use Node 20 LTS if possible. This repository already contains pnpm-style dependencies; avoid repeatedly mixing package managers. Normal commands from the repository root:

```powershell
npm.cmd install
npm.cmd --prefix server install
npm.cmd --prefix client install
npm.cmd run dev
```

App default: `http://localhost:5173`; API: `http://localhost:8787`. If ports are occupied:

```powershell
Get-NetTCPConnection -LocalPort 8787,5173,5174,5175 -ErrorAction SilentlyContinue |
  Where-Object OwningProcess -gt 0 |
  Select-Object LocalPort,OwningProcess -Unique

# Inspect each PID before stopping it; do not kill PID 0.
Get-Process -Id <PID>
Stop-Process -Id <PID>
```

Then run `npm.cmd run dev` once and use the exact Vite URL printed. `EADDRINUSE` on 8787 means an older API is already running. Vite moving to 5174/5175 means an older client is still running, and `CLIENT_ORIGIN` may need to match that URL for CORS.

Verification:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

There is no root `typecheck` script; root `lint` invokes both workspace typechecks. Production build also runs TypeScript compilation.

## Git safety and collaboration

- Current working branch at the time of this file: `codex/journeyos-demo-ready`.
- Public project origin: `https://github.com/hemalekamohanram/journeyOS.git`.
- Partner upstream: `https://github.com/praveendraniq/journeyOS.git`.
- The same machine/user profile is used for private office work. Before every push run `git remote -v`, `git branch --show-current`, and `git status --short`.
- Never use `git add .` without reviewing files. Prefer explicit project file paths. Never push `.env`, logs, screenshots containing tokens, or unrelated repositories.
- Partner voice work came from upstream/main. Preserve it during merges; inspect conflicts rather than overwriting the partner's page wholesale.
- Pulling `main` into a feature branch means fetching and merging/rebasing the latest main changes into that branch. It does not automatically publish the branch.

## Completed behavior worth preserving

- Destination parsing no longer always resets to Japan; China and Chennai extraction are tested.
- First brief preserves named friends/phones; group size reconciles safely.
- Contextual voice mic receives current page, destination, selected day, and trip state.
- Selected-day commands support start, complete, undo/restore, skip/cancel/remove, and delay.
- Meal times are repaired into breakfast/lunch/dinner windows.
- Live progress supports restore after accidental completion.
- Receipt delete reverses budget totals; split percentages and net settlement exist.
- Weather follows active destination with labeled live/fallback source.
- Maps/Places/Routes, Sabre, PayPal, Vocal Bridge, and Landing AI have adapters with explicit fallback modes.
- The AI Travel Negotiator now models call → explicit agreement → admin preview → apply, rather than changing the itinerary from a survey response.
- PayPal checkout uses `NO_SHIPPING`; approval/cancel return windows notify the opener and close automatically.
- Booking is admin-first. After capture, JourneyOS can create one exact private PayPal reimbursement order and copyable message per non-admin friend.
- The neighborhood-hop bundle updates each day’s check-in, breakfast, dinner, and return hotel anchors instead of showing one hotel across the whole trip.
- Live disruption controls are compact icons. Applying one updates the selected day and reveals the optimized before/after route directly below.
- Group vibe uses CSS-drawn animated faces instead of platform-dependent emoji.
- Sabre CERT shopping was verified against the live sandbox: it returned fresh flight offers for SFO → Tokyo. Carrier detail and hotel results are only displayed when Sabre exposes them; curated bundles remain explicitly separate demo choices.
- Sabre credentials now accept either `SABRE_EPR_USERNAME` / `SABRE_EPR_PASSWORD` or the legacy `SABRE_V2_USER_ID` / `SABRE_V2_PASSWORD`, and the MCP adapter can obtain/cached OAuth tokens through the Sabre service rather than requiring a long-lived browser token.
- Sabre CERT now refuses to guess a city-to-airport mapping. If the brief contains a city name, the live-search button asks for the official three-letter IATA origin and destination before it sends the request; this keeps the search real without adding a fragile hard-coded city list.
- Live Sabre search proposes the selected package's displayed airport codes, asks the user for one explicit origin/destination confirmation, and supports the same confirmed pair through Vocal Bridge action `search_live_sabre`. A same-code route such as `BKK → BKK` reopens the edit prompt.
- Curated bundle cards remain a separate demo decision surface. A live AA alert is shown only when a fresh Sabre response explicitly contains carrier code `AA` and its flight-only group fare is lower than the curated AA flight component; it must never compare a flight-only live price to a flight-plus-hotel bundle total.
- Dashboard weather always queries the saved trip destination, not a human-readable itinerary subtitle such as “Central Tokyo,” which Open-Meteo cannot reliably geocode. The UI keeps the provider/fallback label visible.
- Browser voice actions now cover navigation, selecting a bundle, explicit booking confirmation, collection, and adding a shared expense. The global assistant sends fresh current-page, trip, and active-day context whenever the route changes.
- Voice can now add a named friend with an optional phone through `add_traveler`, but only after it repeats the details and receives explicit confirmation. The same server mutation backs voice and click entry, so the roster is immediately saved and visible on Planning.
- Traveler-count changes recalculate curated flight totals, package totals, reimbursement shares, and payment participants. They also clear any displayed live Sabre CERT result, because supplier offers are passenger-count-specific and must be searched again for the new group.
- Voice sessions are intentionally persistent across page navigation. The page microphone mutes/unmutes the existing session; only the explicit `End call` control disconnects it. The hosted Vocal Bridge prompt must be synchronized from `vocal-bridge/agent-prompt.md` for this behavior to be used in a real call.
- Final local verification: TypeScript checks, 21 server tests, production build, desktop/mobile layouts, and browser console errors were checked on 2026-07-18. Google Maps currently reports a non-blocking direct-loader/legacy Marker and Directions API deprecation warning; migrate those APIs after the demo rather than masking the warning.

## Known limitations and next work

Highest priority before judging:

1. Deploy/synchronize the updated Vocal Bridge prompt and configure the secured negotiation callback through a public HTTPS URL.
2. Run one real consented call end-to-end and verify transcript/callback/polling on the actual hackathon network.
3. Verify Google day maps show all selected-day markers, route lines, distances, and selected-place details using valid restricted keys.
4. Run Sabre CERT search with event credentials and capture truthful AA evidence only if returned. Real booking still requires preserving a freshly selected opaque offer/rate payload plus complete traveler identity; curated demo bundles must never be submitted or labeled ticketed.
5. Complete one PayPal sandbox approval and capture, then verify it in merchant and buyer sandbox dashboards.
6. Perform browser E2E at desktop and narrow/mobile widths. Keep floating voice controls from covering settlement/actions.

Production/future work:

- Real authentication, authorization, persistent database, multiple trips per account, concurrency control, audit logs, and durable webhook idempotency.
- Provider-grade booking confirmation/recheck, cancellation, refunds, and failure recovery.
- SMS itinerary/settlement messages through a consented messaging provider; do not add Twilio merely for the three-minute demo unless it is already stable.
- Native/mobile app later. The responsive web app is the correct hackathon surface; do not split tonight's effort into a second codebase.
- Replace deterministic demo plan-fit policy with a documented, evidence-based scoring model only when enough real traveler signals exist.

## Non-negotiable product rules

- Voice and click must operate on the same state and actions.
- The voice agent must respect current page and active day; never restart the generic planning greeting on Live itinerary.
- Never hardcode a user-entered destination back to Japan.
- Never present demo inventory, weather, calls, payments, OCR, or confidence as live.
- No itinerary mutation until explicit traveler agreement and admin approval.
- One memorable negotiation is better than several shallow preference interviews.
