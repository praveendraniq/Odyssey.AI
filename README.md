# Odyssey.AI

Odyssey.AI is a mock-first hackathon MVP for planning, booking, managing, and dynamically re-optimizing a group trip in one conversational flow.

## Code repository

Source code: [github.com/praveendraniq/journeyOS](https://github.com/praveendraniq/journeyOS)

### How Codex and GPT-5.6 were used

OpenAI Codex, powered by GPT-5.6, was used as the engineering copilot throughout the project. It helped design the multi-agent travel architecture, implement and debug the React/TypeScript client and Express/TypeScript API, integrate Vocal Bridge, Sabre, Google Maps/Weather, PayPal Sandbox, and route optimization, resolve merge conflicts, add regression coverage, and verify production/demo build flows. GPT-5.6 also helped refine the voice-agent prompts, negotiation rules, safety boundaries, and fallback behavior used by Odyssey.AI.

## What is included

- Voice-style trip planner with structured preference extraction
- Editable traveler profiles with phone, pace, constraints and 1–5 interests
- Vocal Bridge-shaped group calls, mediated compromise, deterministic individual plan fit and fairness-adjusted group happiness
- Sabre-shaped flight and hotel search endpoints with sandbox-ready adapters
- Two-stage money flow: split known flight/hotel costs before travel, then net receipt-based shared expenses after travel
- Destination-derived current weather via Google Weather when configured, Open-Meteo as the live fallback, and an explicitly labeled demo fallback
- Route optimization using opening hours, geography, travel time, and weather constraints
- Unified Live trip page with map, progress, disruptions and route intelligence
- Evidence-backed Travel DNA history with before/after values, confidence and reasons
- Editable departure/return dates with destination-arrival and hotel-night calculation
- Optional Landing AI receipt analysis endpoint with a demo OCR fallback

## Run locally

Use Node 20+ and pnpm 9+.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The API is at `http://localhost:8787`.

```bash
pnpm build
pnpm lint
```

## Fastest public demo deploy

JourneyOS now supports a single Render web service that serves both the built React frontend and the Express API from one public URL.

1. Push the repo to GitHub.
2. Create a new Render Web Service from the repo or import `render.yaml`.
3. Keep the defaults, or use:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. Add any live integration secrets in Render's Environment settings.
5. Open the Render URL and share that with judges.

The frontend is served by Express from `client/dist` after the client build completes, so there is no separate frontend host to configure for the demo.

## Demo sequence

1. Open the Voice Planner and submit: “Plan a 5-day Japan trip for four people under $6,000.”
2. In **Group planning**, edit traveler profiles, confirm call consent, and run the simulated Vocal Bridge negotiation.
3. Review plan-fit percentages and compromises in Decision Studio, adjust priorities, and click **Approve & update trip**.
4. In **Booking & payment**, edit dates, verify calendar days versus hotel nights, choose inventory, and split only the known flight/hotel booking total. Variable receipts are settled after the trip.
5. In **Live trip**, complete an activity late and trigger **Heavy rain**.
6. Open **Travel DNA** to inspect the evidence-backed learning history.

## Stretch goals

- **Local mobility booking:** recommend a rental car for trip duration when flights do not reach the destination directly, and offer per-day rideshare deep links for selected itinerary stops.
- **Voice guide at every stop:** add a play button beside each itinerary item that speaks a concise, source-backed fact and practical visiting tip for that attraction.

### Test with real voice

Open the app in Chrome or Edge, select **Voice planner**, click the microphone, and allow microphone access when prompted. Speak the request naturally, review the live transcript, then click **Create my trip brief**. Browsers without the Web Speech API can still use the editable transcript field.

## API integration modes

`MOCK_MODE=true` is the default: no account, key, or internet access is needed for the polished demo. Set it to `false` and configure credentials to activate the service adapters.

- `SabreService` requests Sabre OAuth and normalizes flight and hotel results.
- `PayPalService` uses PayPal Orders APIs when credentials are present; otherwise it creates a mock order. The order covers known flight and hotel costs, never later receipt spend.
- `WeatherService` geocodes the active-day city, prefers Google Weather when a server key is configured, and falls back to Open-Meteo. Network failures return a clearly labeled demo value instead of pretending it is live.
- `VocalBridgeService` forwards an audio/transcript payload to a configured Vocal Bridge endpoint; the UI safely uses text-to-plan in mock mode.
- `LandingAiService` accepts receipt metadata and returns normalized receipt data in mock mode.

## Architecture

```
client/             React + TypeScript + Tailwind dashboard
server/             Express + TypeScript REST API
server/src/services provider adapters and trip intelligence
server/src/store    seeded JSON-backed MVP repository
server/src/db       portable SQL schema for SQLite/PostgreSQL deployment
```

The demo repository is intentionally JSON-backed so it runs without native database dependencies. `server/src/db/schema.sql` contains the normalized SQLite/PostgreSQL-ready schema and `DemoStore` is the narrow persistence seam to replace for a production database.
