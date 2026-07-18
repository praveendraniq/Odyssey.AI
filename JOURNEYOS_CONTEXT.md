# JourneyOS — Project Context and Handoff

Last updated: July 18, 2026

## Context maintenance policy

This file is the canonical JourneyOS project handoff and decision log. Repository instructions require it to be updated in the same task whenever application behavior, architecture, integrations, configuration requirements, run commands, voice-agent rules, UX decisions, test status, deployment, or Git/PR state changes.

Obsolete guidance should be replaced rather than retained as conflicting history. Secrets, credentials, API keys, access tokens, and personal phone numbers must never be added.

## Product direction

JourneyOS is a voice-first group travel planner for friends. One continuous Travel Mediator helps the admin move from an initial spoken brief through friend preference collection, negotiated itinerary planning, live travel inventory, booking review, the live trip, and shared-expense settlement.

The central demo story is:

1. The admin describes one shared trip by voice.
2. JourneyOS creates a structured trip brief.
3. The admin adds friends and records call consent.
4. Vocal Bridge calls friends sequentially for short preference interviews.
5. JourneyOS saves each outcome and positively negotiates group priorities.
6. The itinerary, maps, booking options, and checkout use the confirmed trip context.

## Current repository

Working directory:

```text
/Users/praveendran/Documents/Codex/2026-07-15/files-mentioned-by-the-user-you/merge-correct
```

Main application structure:

- `client/` — React, TypeScript, Vite, Tailwind, Vocal Bridge React SDK
- `server/` — Express, TypeScript, Sabre integration, Vocal Bridge proxy/callbacks, Google services, trip store
- Root npm scripts coordinate setup, development, build, linting, and tests.

Current Git publication:

- Working branch: `agent/live-trip-planning`
- User fork: `praveendraniq/journeyOS`
- The partner branch `hemalekamohanram/journeyOS:codex/journeyos-demo-ready` was inspected and selectively reconciled on July 18, 2026. The current tree includes its dynamic negotiation concept, page-aware Live Trip voice commands, and Maps JavaScript route rendering while preserving the newer structured voice brief, explicit `server/.env` loading, friend validation/callbacks, selected-hotel map anchoring, and Sabre authentication behavior.

## Local development

Open three Terminal windows.

### Terminal 1 — backend

```bash
cd /Users/praveendran/Documents/Codex/2026-07-15/files-mentioned-by-the-user-you/merge-correct
npm --prefix server run dev
```

The backend normally listens on port `8787`.

### Terminal 2 — frontend

```bash
cd /Users/praveendran/Documents/Codex/2026-07-15/files-mentioned-by-the-user-you/merge-correct
npm --prefix client run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

### Terminal 3 — Vocal Bridge public tunnel

```bash
ngrok http --url=chant-barbed-heroism.ngrok-free.dev 8787
```

Keep all three processes running during voice-call testing. Use `Ctrl+C` to stop one.

The root command can also start the backend and frontend together:

```bash
npm run dev
```

## Environment and secrets

Secrets belong only in environment files and must never be committed or exposed in the browser.

Relevant server-side variable names include:

- `VOCAL_BRIDGE_API_KEY`
- `VOCAL_BRIDGE_AGENT_ID`
- `VOCAL_BRIDGE_MAYA_API_KEY`
- `VOCAL_BRIDGE_MAYA_AGENT_ID`
- `VOCAL_BRIDGE_MAYA_PHONE`
- `VOCAL_BRIDGE_CONTEXT_SECRET`
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_WEATHER_API_KEY`
- Sabre OAuth/MCP variables defined in `server/src/config.ts`

Relevant client-side variable:

- `VITE_GOOGLE_MAPS_API_KEY`

No secret values or personal phone numbers are recorded in this document.

## Vocal Bridge architecture

The browser uses `@vocalbridgeai/react` with a server-token route:

```text
POST /api/voice-token
```

The Vocal Bridge key and agent ID stay on the backend. The browser receives only a temporary session token.

The persistent voice assistant is available across the application. It sends current page and confirmed-trip context to the mediator without treating demo inventory as an admin-confirmed brief.

Outbound friend calls use:

```text
GET /api/voice/outbound-context
POST /api/preference-calls/complete
```

Both routes authenticate with `X-JourneyOS-Context-Key` using the server-side `VOCAL_BRIDGE_CONTEXT_SECRET` value.

The saved Vocal Bridge HTTP Custom API tools are:

- `get_trip_context`
- `save_friend_preferences`

The optional live negotiator additionally posts its explicit yes/no result to:

```text
POST /api/negotiation-calls/complete
```

The callback uses the same `X-JourneyOS-Context-Key` secret. The itinerary remains unchanged until the admin applies an accepted agreement in the planner.

`save_friend_preferences` must be called as a saved HTTP Custom API tool through Background AI. It must not be sent through `trigger_client_action`.

## Voice-agent behavior

The same main Travel Mediator supports both admin planning sessions and outbound friend calls.

### Admin planning session

The mediator must collect only missing essentials:

- Origin city spoken by the admin
- Destination city spoken by the admin
- Exact departure and return dates; duration is calculated from them
- Total number of travelers, including the admin
- Total group budget and currency
- Preferred places or activities, pace, dietary needs, accessibility needs, and important lodging preferences

Origin and destination must come from the current voice conversation. The agent must not infer a city from a country, airport code, sample trip, application default, or old transcript. If the user gives a country or airport code, the agent asks for the city.

All of the following are required before the brief can be created: both exact dates, at least one place/interest/activity preference, an explicit pace, and an explicit food preference or a statement that there are no dietary restrictions. Duration alone is not a substitute for dates.

Before ending, the agent confirms the brief once and calls:

```text
trip_brief_ready
```

Its payload contains a `conversation` field with one polished paragraph plus structured `origin`, `destination`, ISO `departureDate`, ISO `returnDate`, `travelers`, `budget`, `interests`, `foodPreferences`, and `travelStyle` fields. Structured fields are authoritative; the bounded current-session transcript remains a fallback. The action must succeed before the agent gives a short goodbye and calls `end_call`.

### Friend preference call

The mediator calls `get_trip_context` immediately and treats the returned trip basics as established. It does not ask the friend for origin, destination, dates, duration, group size, or budget.

It asks exactly three short questions:

1. One must-do experience
2. Food requirement or anything to avoid
3. Easy, balanced, or active pace

After the third answer, it states one short positive negotiation, calls `save_friend_preferences` with the exact traveler ID, gives a short goodbye, and calls `end_call`.

Never say “conflicting preference.” Use language about balancing or negotiating priorities while protecting must-dos, dietary constraints, accessibility needs, and pace limitations.

### Call timing and confirmation

- Admin and friend calls target 40–45 seconds.
- At 45 seconds, the browser sends a wrap-up instruction; it does not disconnect or cut off the traveler.
- The mediator finishes the current exchange, confirms once, saves what is complete, and ends gracefully. A timer must never stop the call mid-sentence.
- The mediator acknowledges individual answers briefly without repeating or reconfirming them. The complete brief or friend preference set is confirmed exactly once at the end.
- Vocal Bridge Max Call Duration should allow enough grace for a natural goodbye; the prompt targets a sub-minute call rather than relying on an abrupt platform cutoff.
- Explicit phrases such as “hang up,” “end the call,” and “goodbye” trigger immediate browser disconnection if the remote agent fails to close the session.
- After a call ends, a short reconnect lock rejects realtime transport reconnects that would replay the greeting. Only an explicit new mic click may start another session.

## Trip-brief and transcript behavior

- Only the current voice session is used to create a new brief.
- Old transcript entries are not reused.
- The Plan textarea does not concatenate all historic user messages.
- On disconnect, the latest session is processed if `trip_brief_ready` was not emitted.
- The transcript panel displays an updating state while the server creates the polished summary.
- Incomplete transcripts are rejected with a list of missing fields. In particular, both exact dates and explicit activity/place, pace, and food answers are required.
- Rejection details are displayed directly in the transcript summary so the admin sees the exact fields to provide on the next short call.
- Incomplete briefs are cumulative across short calls: JourneyOS retains the admin's partial transcript, asks only for the remaining fields, merges the new answers, and clears the partial draft after successful brief creation. It never fills the draft from demo defaults.
- Brief extraction merges the mediator's final action summary with the current session dialogue. Short answers such as “Two” or “Four thousand dollars” are interpreted only in the context of the mediator's traveler-count or budget question, preventing valid spoken answers from being discarded.
- The browser no longer rejects a `trip_brief_ready` action using a second regex-based validation gate. The backend merges structured action fields over transcript extraction and performs the single authoritative completeness check.
- Planner requests carry the browser's current saved trip so a backend restart cannot replace an accepted brief with seeded Tokyo state during the next update.
- A successful brief update regenerates trip request data, group roster, destination-aware itinerary, booking choices, and live-map stops together from one response.
- The planner endpoint accepts up to 20,000 characters for the bounded current/partial voice transcript; the former 1,000-character limit was too small once summary and dialogue were merged.
- Incomplete transcripts never silently inherit Japan, dates, traveler count, budget, or preferences from demo data.
- The structured origin and destination are extracted generically from the agent’s polished `from [city] to [city]` summary. There is no hard-coded US or global city lookup table.
- The generic route parser also accepts the mediator’s destination-first form: `to [destination], departing from [origin]`.
- Regression coverage includes Indian city names such as Bengaluru and Jaipur.

## Friends and preference collection

- Traveler count includes the admin.
- The first traveler is always the admin.
- Other friend slots equal total travelers minus one.
- Friend names and phone numbers can be entered manually or supplied by voice.
- Phone numbers are required in E.164 format before saving or calling.
- Validation should remain field-level rather than toast-only.
- A friend must explicitly consent before JourneyOS can call them.
- Friends can be added or removed.
- Calls are placed sequentially, not simultaneously.
- Each card displays calling state, outcome, structured preferences, summary, and negotiated plan fit when available.
- The admin can end an active friend call from the UI when supported by the call workflow.

## Sabre integration

Sabre is used for live or CERT flight and hotel search, with booking workflows intended for the hackathon demonstration.

Important context:

- PCC for hackathon CERT testing: `S5OM` (uppercase letter O)
- OAuth/access tokens remain server-side.
- The Sabre skills-based MCP endpoint is configured through server environment variables.
- Live results must be clearly distinguished from demo inventory.
- Sabre MCP flight search sends the requested adult count, and the hackathon international flow searches hotel inventory from the destination-arrival day rather than the home-departure day.
- Booking must preserve selected offer identifiers and require explicit admin confirmation.
- No booking or payment is represented as complete without a successful backend response.

## Google integrations

- The browser map uses `VITE_GOOGLE_MAPS_API_KEY`.
- Google Places and route planning use server-side keys.
- Billing and the required APIs must be enabled in the same Google Cloud project.
- The July 18 browser validation showed that the current client key can load Maps JavaScript and Embed, but its Geocoding service is not enabled. The app falls back to the embedded day route; enable Geocoding API for numbered JavaScript markers and the rendered polyline.
- Live itineraries should use group preferences to select stops.
- Each day should start and end at the hotel chosen on the booking page.
- Routes should include breakfast, lunch, and dinner where appropriate and optimize the complete return-to-hotel route.
- Google map routes use complete Places postal addresses directly, use the selected hotel location as the daily route anchor, and remount the embed when the selected day changes. This prevents unresolved demo hotel names from falling back to a world map.
- When the Maps JavaScript API is available, Live Trip geocodes the active day, shows numbered markers, draws the day route, and falls back to a Google Embed route if JavaScript map loading or geocoding fails.

## UX decisions

- Keep the partner’s planner UI and the newer editable trip timeline.
- Keep Vocal Bridge and Sabre integrations.
- Keep the microphone lifecycle fixes.
- Keep the dynamic travel-brief fixes.
- Keep the agent network concept, but do not expose a redundant standalone agent screen.
- Voice should feel continuous across pages while maintaining confirmed context.
- The checked-in Vocal Bridge prompt consolidates the proven Travel Mediator rules with the partner's page-aware Concierge and AI Travel Negotiator flow. It supports four explicit modes: admin planning, short friend preference calls, friend negotiation calls, and page assistance. It preserves strict city/date/brief validation, partial-brief recovery, silent HTTP callback saving, graceful hang-up behavior, authoritative `journeyos_context`, and `show_day` requests such as “show Day 3.”
- Negotiation demo sequence: the admin's live brief and Sarah's seeded profile are preloaded, then the Negotiator calls Friend 2 (when a third traveler exists). It detects a conflict only from Friend 2's spoken priority, proposes a specific trade, requires explicit acceptance, and leaves the itinerary unchanged until the admin applies the agreement.
- Trip Dashboard now makes the collection state explicit: the admin and Sarah show `Brief captured` from the outset, while Friend 2 remains `Awaiting Friend 2 call` (or in-progress) until the live negotiation callback supplies their actual call result.
- Sarah's Planning card also has an unconditional seeded profile fallback for older locally persisted trips: early dinner, moderate walking, pescetarian food, and the corresponding early-dinner/easy-transit compromise.
- The Group Vibe view (`Does this plan feel good for everyone?`) follows the same state model: Admin and Sarah are marked `Brief captured`; Sarah visibly displays early dinner, moderate walking, pescetarian food, and keeps late dinner light. Friend 2 alone remains pending until their call result is received.
- Sarah's preferences are now defined as one canonical client profile and normalized server-side on hydration, preventing old locally persisted values from producing inconsistent Sarah cards across Planning, Dashboard, Group Vibe, and Negotiation context.
- Sabre CERT search confirmation is now an in-app panel in Booking rather than a browser `window.confirm` dialog. It names the exact route, confirms that CERT inventory is reference-only, and provides explicit Search / Not now actions.
- After the admin’s sandbox advance is captured, Booking now offers `Prepare payment requests`: it creates each non-admin friend’s separate PayPal sandbox link and message preview, then enables `Copy payment messages`. No SMS, email, or payment request is automatically sent. The verbose Supplier fulfillment panel was replaced by one concise sandbox/supplier-booking note.
- The same batch action is also placed immediately below `Reset to equal shares` in Step 2 as `Collect payment from friends`, making the next admin action visible alongside the individual split amounts.
- Equal-split rounding now assigns the tiny remainder to the final traveler (for example 33.33%, 33.33%, 33.34%), and the UI accepts a legacy 99.99% one-cent rounding total so `Collect payment from friends` is not incorrectly disabled.
- A successful Sabre CERT search now derives up to three live reference bundles directly from returned flight and hotel rates: lowest live total, best live schedule, and a flexible alternative. These are intentionally review-only until the app preserves and revalidates the opaque Sabre offer/rate keys for supplier booking.
- The local spoken-brief extractor now prioritizes generic “from [origin] to [destination]” phrasing before defaults or the short recognized-destination list. This prevents a valid new route such as San Francisco → Hawaii from falling back to the original San Francisco → Tokyo trip, and lets Booking regenerate its flight/hotel demo inventory for the extracted destination.
- Booking resolves extracted city names to IATA airport codes on the server for the supported global and Indian city set (for example San Francisco → SFO, Hawaii/Honolulu → HNL, Chennai → MAA). If a city is not in the resolver, live Sabre search remains deliberately blocked until the admin enters an explicit three-letter airport code rather than guessing.
- The parser also recognizes direct city-pair shorthand without “from,” for example `Dallas to San Diego`, which maps to DFW → SAN and refreshes booking inventory.
- The parser additionally supports the polished brief form `for [N] travelers to [destination], departing from [origin] between [dates]`, so a submitted brief for Dallas → San Diego no longer falls back to the original San Francisco → Tokyo defaults.
- Sabre CERT flight cards now use a tolerant nested-offer parser for marketing, operating, validating, and direct carrier fields, including JSON responses with whitespace and nested carrier objects. Known IATA carrier codes render as airline names and include the flight number when supplied; absent carrier data is labeled `Sabre CERT airline` rather than the misleading `Carrier not exposed` placeholder.
- The flight parser now scans every MCP content block (not just the first) for structured offers and recognizes direct/nested carrier-name fields plus two- or three-character carrier codes. It labels genuinely absent carrier data `Carrier name unavailable` instead of fabricating an airline.
- On July 18, 2026, the user confirmed that the consolidated prompt and updated client-action definitions were applied manually to the Vocal Bridge agent dashboard.
- On Live Trip, `itinerary_command` applies start, complete, undo, restore, skip, cancel, remove, or delay requests only to the active day; `show_day`, `navigate`, and `replan_trip` preserve the same voice session and confirmed trip context.
- The Plan screen contains the voice brief and the single AI Travel Negotiator flow: known group context, one consented friend call, live/scripted transcript, admin preview, and Decision Studio. The older redundant Friends & preference calls block is intentionally removed.
- Decision Studio always shows Admin priority adjustment and Projected plan. Friend-call result cards appear when results exist; applying the adjusted plan remains disabled until friend input has been collected.
- Live itinerary and dashboard timelines show Mark as done for experience/food stops and Undo done after completion; completion is persisted through the existing itinerary progress API.
- Live voice commands are page-aware and constrained to the selected day. The app handles Vocal Bridge itinerary/replan actions and also applies a user transcript command directly when the agent fails to emit the action. Skipped stops expose Restore stop, and completed stops expose Undo done.
- Negotiation outbound calls automatically switch to the labeled scripted flow when Vocal Bridge credentials, CLI execution, or outbound quota are unavailable; disruption controls remain connected to the active-day replan API.
- Live itinerary layout order is: journey map and timeline, Live activity progress, disruption controls, then the Why this order works before/optimised comparison at the bottom.
- Booking and payment should remain minimal and voice-driven.
- New trips start with two populated defaults: admin Prabhu Siddharth (`+14156290471`) and friend Sarah (`+14152220000`). Sarah is the visible example profile: early dinner, moderate walking, and pescetarian food. A four-traveler request therefore creates the two defaults plus editable Friend 2 and Friend 3 slots.
- Live Trip should show real preference-aware daily stops and mapped directions.
- Day 1 is selected whenever a newly accepted trip brief creates an itinerary.
- Avoid redundant cards and repeated trip information.
- Branding near the voice control should say “Powered by Vocal Bridge.”
- The partner Dashboard and package-style Booking screen are preserved. The sidebar order and labels are: Trip dashboard, Plan together, Live itinerary, Book & split, Shared expenses, and Travel memory.
- The Dashboard uses the partner’s full Group Vibe panel: overall mood and group fit, fairness gap, per-traveler would-love/keep-light priorities, call status or plan-fit explanation, and the current fair-trade summary. It remains driven by live traveler and preference-call state.
- Trip Dashboard and Live Itinerary have deliberately different jobs. Dashboard is the trip-level readiness and group-health view: next decision, readiness checklist, progress, budget, weather, Group Vibe, and a compact current/next stop preview. Full maps, day selectors, timelines, completion controls, disruptions, and route intelligence live only on Live Itinerary. Receipt capture lives only in Shared Expenses.
- Package cards use the spoken destination name when the demo store does not know an IATA code; they never display a fabricated `DST` airport code. Sabre CERT search still requires a real three-letter code or a supported city-to-airport resolution.

## Current validation status

At the time this handoff was written:

```text
npm run build  — passed
npm test       — 22 tests passed
```

The test suite includes regression coverage for:

- No default-Japan fallback from incomplete transcripts
- Generic international city extraction without a city lookup table
- Short-answer extraction using mediator-question context, with concrete spoken dates taking precedence over question wording
- Structured Vocal Bridge action fields overriding transcript extraction without a hard-coded city table
- Trip date and traveler reconciliation
- Deterministic itinerary and group-happiness behavior
- Expense settlement and receipt reversal
- Negotiation preview remaining unchanged until explicit admin approval
- Page-aware itinerary voice commands targeting only the selected day

## Important testing flow

For a clean admin test, start a new voice conversation and say something similar to:

> Plan a six-day trip from Bengaluru to Jaipur for two travelers with a total budget of five thousand dollars. We prefer food and history, a balanced pace, and vegetarian-friendly meals. Create the brief and hang up.

Verify that:

1. The mediator targets a sub-minute call and, if it runs longer, wraps up without cutting off audio.
2. The transcript uses only the current conversation.
3. The polished travel brief appears after disconnect.
4. Origin is Bengaluru and destination is Jaipur.
5. No Japan demo values appear.
6. Booking, dashboard, and live-trip screens receive the same trip context.

## Git and collaboration notes

The repository previously integrated a partner PR containing Google Maps, disruption-demo, Decision Studio, and related planner UI work. Subsequent work preserved and adapted Sabre, Vocal Bridge, one-way/date boundaries, agent coordination, booking/checkout, microphone fixes, and dynamic trip-brief behavior.

On July 18, 2026, branch `origin/codex/journeyos-demo-ready` was merged into `agent/live-trip-planning` as commit `f359c72`. Local Vocal Bridge prompt, client-action, and project-context updates were reapplied afterward. The local Dashboard was then restored deliberately: it is a readiness/next-decision view with a compact current/next stop preview, while the partner Live Itinerary workflow remains intact. The pre-merge stash remains as a recovery copy until the user confirms it can be dropped.

The Vocal Bridge prompt also carries the partner's explicit booking, payment, Sabre IATA confirmation, traveler-addition, and shared-expense action rules. It retains the stricter existing trip-brief validation, friend-call saving, negotiation callback, and graceful end-call behavior.

Before publishing additional work:

1. Review `git status` and `git diff`.
2. Preserve unrelated partner changes.
3. Run `npm run build` and `npm test`.
4. Resolve PR conflicts without dropping either the partner UI or the JourneyOS integration fixes.

## Sabre MCP carrier resolution

The skills-based Sabre MCP response stores airline identity in a separate `flights` array. A priced offer links to a `journeys` record through `journeyRefs`, and that journey links to the actual flight through `flightRefs`. The Booking UI resolves the first requested journey's `marketingAirlineCode` / `marketingFlightNumber` (with operating and validating-carrier fallbacks) before displaying a live CERT offer. This prevents the generic “Sabre CERT airline” label when the MCP payload contains an actual carrier such as Japan Airlines (`JL`), United (`UA`), or Air Canada (`AC`).

## Required Sabre confirmation checkpoint

The Plan page now has an explicit **Confirm trip & load live Sabre options** action after a brief is created. It opens Booking & Checkout and triggers the required CERT search for the confirmed route, dates, and traveler count. The Booking page presents three live flight-and-stay combinations from that response; the admin must select one before the payment step can open. **Refresh live Sabre options** repeats the CERT check. Curated demo bundles are shown only as a fallback when the live CERT check fails.

The live CERT options use the same full bundle-card treatment as the prior recommended-package UI: each card shows its label, rationale, flight identity/details, hotel identity/details, group total, revalidation note, and selected state. No carrier or hotel value is fabricated; every displayed item comes from the current Sabre response.

Booking now starts the required Sabre CERT request automatically on page entry, including direct navigation to Booking & Checkout. The section is labelled **Sabre live inventory** and its manual refresh control is **Refresh Sabre bundle price**.

When a returned American Airlines CERT offer is genuinely lower than the comparable curated AA demo-flight component, Booking retains a prominent sticky in-section alert with the calculated group saving. The alert clears when the route/dates/group changes or a fresh search begins; it is never shown for a fabricated saving.

## Brand asset

`client/public/odyssey-logo.png` is the generated Odyssey.AI compass/O mark with a transparent background. It replaces the sidebar’s textual `O` and is configured as the browser favicon in `client/index.html`.
