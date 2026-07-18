# Odyssey.AI — implementation handoff

## Product in one sentence

Odyssey.AI is an AI group-travel operating system that turns a natural-language trip request into a shared itinerary, privately calls travelers to collect and mediate preferences, adapts the trip during travel, and keeps booking payments separate from final shared-expense settlement.

## Current branch and state

- Branch: `codex/journeyos-demo-ready`
- Base: `codex/group-preferences`
- Local changes are validated but not yet committed or pushed because GitHub CLI is not installed on the current machine.
- Validation: TypeScript checks pass, 14 tests pass, production build passes, and the major flows were exercised in the in-app browser with no console errors.

## Navigation and product decisions

The current top-level navigation is intentionally limited to six items for a three-minute demo:

1. Trip dashboard
2. Group planning
3. Booking & payment
4. Live trip
5. Expenses & settlement
6. Travel DNA

There is no separate Operations Center. Live trip contains the route plus a compact **Demo disruptions** drawer. Known booking costs live inside **Booking & payment**. Receipt scanning, payer/share totals, and after-trip settlement use the separate **Expenses & settlement** tab.

## What is implemented

### Natural-language and voice brief

- Typed or browser-speech trip request.
- Structured destination, duration, group size, budget, interests, and food constraints.
- Fixed a reset bug: clicking **Create my trip brief** now preserves the user's exact wording instead of replacing it with a generated template.
- The exact brief is stored on the trip as `briefTranscript`, so it survives app-state persistence.
- Curated destination fallback remains available when live place sourcing is unavailable.

### Preference collection and AI mediation

- Editable traveler roster with phone, pace, food constraints, and interest scores.
- Call consent gate and phone validation.
- One private call per non-admin traveler; this is not a conference call.
- Calls are designed to run in a controlled queue, followed by one negotiation over the completed summaries.
- Added a visible **Preference Mediation Agent** demo moment with an AI/traveler exchange.
- The agent offers an explicit trade, records agreement, and sends it to the admin. It must never pressure a traveler or hide competing priorities.
- Individual plan-fit scores, deterministic happiness explanations, group average, fairness gap, and fairness penalty.
- Decision Studio lets the admin edit priorities, approve the compromise, and materially reprioritize flexible itinerary stops.

### Itinerary, routing, and live operations

- Multi-day itinerary with start, complete, skip, and running-late actions.
- Completion percentage, actual duration, schedule variance, and remaining-stop retiming.
- Optimized sequence is presented first, followed by the route map and Google Maps directions/embed fallback.
- Compact side drawer for lateness, heavy rain, flight delay, closure, and traveler fatigue.
- After an event is selected, the drawer becomes an AI decision explanation. **View updated trip plan** closes the drawer and reveals reordered/retimed stops marked **Updated**.
- Travel DNA updates from real in-app choices and completed/skipped activities.

### Weather

- Only one compact weather card remains.
- Weather follows the active itinerary day's primary city rather than a hardcoded country value.
- Google Weather is the preferred provider when `GOOGLE_WEATHER_API_KEY` or `GOOGLE_PLACES_API_KEY` is configured.
- Open-Meteo is the no-key live fallback.
- A deterministic fallback is explicitly labeled as demo data and never presented as live weather.

### Booking and payment

- Editable origin, destination, departure date, and return date.
- Arrival-aware calendar-day and hotel-night calculations.
- Destination-aware demo flight/hotel choices with explicit non-live labeling.
- Pre-trip checkout includes only flight and hotel costs.
- Admin can assign custom traveler percentages; each traveler preview sees only their own amount.
- PayPal-shaped demo/sandbox order and capture flow.
- Variable receipts are never included in the booking payment.

### Live receipt ledger and final settlement

- Receipt entry/scanning UI in the separate **Expenses & settlement** workspace.
- Captures description, amount, payer, and which travelers shared the expense.
- Stores receipts in `trip.expenses`.
- Recalculates net balances after every receipt.
- Incorrect receipts can be deleted; budget, paid/share, and final net balances recalculate immediately.
- Final panel shows who receives money, who owes money, or who is settled.
- Booking costs are excluded from this tally, preventing double charging.

### Travel DNA

- Dedicated Travel DNA page.
- Traveler-specific strong likes, low-priority/avoid signals, pace, constraints, and accepted negotiation memories replace the old unexplained 1–5 rating cards.
- Learning confidence, group insight, and evidence/change history remain visible without exposing internal score transitions.
- Activity completion, skipping, preference decisions, and receipt behavior feed learning signals.

## Main server endpoints

- `GET /api/trips/demo`
- `POST /api/trips/hydrate`
- `POST /api/trips/details`
- `POST /api/travelers`
- `POST /api/planner/extract`
- `POST /api/planner/collect-preferences`
- `POST /api/planner/approve-preferences`
- `GET /api/weather`
- `POST /api/bookings/flight`
- `POST /api/bookings/hotel`
- `POST /api/itinerary/progress`
- `POST /api/operations/replan`
- `POST /api/payments/create-order`
- `POST /api/payments/:orderId/capture`
- `POST /api/receipts/analyze`

## External integration status

### Implemented adapter or fallback, not production-verified

- Vocal Bridge: server adapter, agent ID configuration, consented UI, simulated call/mediation fallback. The exact provider contract, callbacks, recordings/transcripts, retries, and real-number test still require verification.
- Sabre: authentication/search adapter and demo inventory fallback. Live round-trip air offers, hotel availability, IATA mapping, repricing, booking, and error cases remain.
- Google Places/Maps: attraction adapter plus map/directions fallback. Production route computation, travel modes, place IDs, and quota/error handling remain.
- PayPal: mock/sandbox order and capture shape. Per-traveler payment-request lifecycle and production webhooks remain.
- Landing AI: receipt-analysis adapter shape. Real image upload, OCR verification, duplicate detection, and editing remain.
- Google Weather: preferred provider path is implemented but requires an enabled API and server key. Open-Meteo remains the live fallback.

## Three-minute demo script

### 0:00–0:30 — Create the trip

Type or speak one natural sentence. Click **Create my trip brief**. Point out that the original words stay visible while the structured destination, days, group, budget, and constraints appear below.

### 0:30–1:15 — Show the differentiator

Open **Group planning**, confirm consent, and click **Call travelers & negotiate preferences**. Explain that each traveler gets a private call. Show one Preference Mediation Agent exchange: it protects the admin's non-negotiable while offering the traveler a concrete trade. Show the resulting happiness/fairness result.

### 1:15–1:40 — Update the plan

Change one priority in Decision Studio and apply it. Show that the itinerary order changes rather than merely displaying new scores.

### 1:40–2:05 — Booking clarity

Open **Booking & payment**. Show arrival-aware hotel nights and confirm that only flights and hotel are collected before travel.

### 2:05–2:45 — Operate the live trip

Open **Live trip**, point out the optimized sequence before the map, open **Demo disruptions**, and trigger rain or a closure. Show the AI decision drawer, click **View updated trip plan**, and point out the changed stops. Then open **Expenses & settlement**, add a receipt with payer and participants, and show paid/share/net totals.

### 2:45–3:00 — Close

Open **Travel DNA** and say: JourneyOS plans with the group, negotiates conflicts, adapts while they travel, settles shared costs fairly, and learns for the next trip.

## Recommended next work

### P0 — required for the external-integration demo

1. Verify Vocal Bridge's real outbound-call contract with consenting test numbers.
2. Persist call IDs and implement queued, dialing, connected, completed, no-answer, and failed callbacks.
3. Feed real call transcripts into a mediation model and require admin approval before changing the trip.
4. Replace Sabre demo inventory with live sandbox round-trip flight and hotel searches.
5. Replace map embed heuristics with Google Routes/Places data.
6. Enable Google Weather and confirm the key restrictions and billing project.

### P1 — production hardening

1. Authentication, admin/traveler roles, and server-owned persistence.
2. SMS invitations/updates through a provider abstraction; Twilio is a reasonable first provider. Include opt-in, STOP handling, secure links, and delivery callbacks.
3. Real PayPal per-traveler requests, webhooks, retries, refunds, and reconciliation.
4. Real receipt image upload/OCR, editable extraction, duplicate protection, currency/tax/tip handling, and receipt participants.
5. Audit logs, encryption, PII retention controls, and call-recording disclosure.
6. Accessibility, responsive QA, observability, rate limits, and end-to-end tests.

### P2 — later product expansion

1. Replace the single active-trip demo state with authenticated accounts and durable `trips`, `trip_members`, and `traveler_memory` records.
2. Add a trip switcher with **Create trip**, **Duplicate trip**, **Archive completed trip**, and independent trip lifecycle/status.
3. Carry traveler-owned preference memory forward only with consent; keep trip-specific constraints and negotiations attached to their original trip.
4. Traveler mobile experience and push notifications.
5. Offline itinerary, wallet passes, location-aware day view, and camera receipt capture.

## Mobile recommendation

Do not build a separate native app before the three-minute demo. Keep the responsive web app as the admin/planning surface and make it installable as a PWA first. After the demo, a mobile traveler companion is valuable for call consent, itinerary notifications, live progress, map handoff, and receipt capture. If native capabilities become necessary, use Expo/React Native against the same API and shared TypeScript domain types rather than duplicating the whole product.

## Gemini recommendation

Gemini is useful, but it should not trigger a rewrite. Put it behind an `AIPlanner`/`MediationModel` interface and use it selectively for:

- structured trip-brief extraction;
- conflict and compromise generation;
- tool/function calling into Sabre, Google Places/Routes, Weather, and payment/ledger services;
- concise explanations of why the itinerary changed.

Use structured outputs for UI-ready schemas and function calling for real actions. Vocal Bridge should remain the telephony layer; Gemini can be the reasoning/mediation layer behind it. Keep deterministic fallbacks so the demo still works if the model or network fails.

## Validation commands

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Current result: all pass; 14 tests pass. Vite emits only the existing large-chunk warning.
