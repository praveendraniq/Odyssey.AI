# JourneyOS

JourneyOS is a mock-first hackathon MVP for planning, booking, managing, and dynamically re-optimizing a group trip in one conversational flow.

## What is included

- Vocal Bridge voice planner with structured preference extraction and an offline demo fallback
- Four-person traveler profile and combined group preference model
- Sabre-shaped flight and hotel search endpoints with sandbox-ready adapters
- PayPal-shaped order and split-payment flow with a demo fallback
- Route optimization using opening hours, geography, travel time, and weather constraints
- Animated Japan journey map, itinerary timeline, Operations Center, and Travel DNA learning
- Seven-agent orchestration with observable delegation and run traces
- Optional Landing AI receipt analysis endpoint with a demo OCR fallback

## Run locally

Use Node 20+ and pnpm 9+.

```bash
cp .env.example server/.env
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The API is at `http://localhost:8787`.

```bash
pnpm build
pnpm lint
```

## Demo sequence

1. Open the Voice Planner and submit: “Plan a 5-day Japan trip for four people under $6,000.”
2. Open **Agent Network** to inspect the Voice, Travel DNA, Inventory, and Route handoffs.
3. Review the group preference rationale and choose a flight and hotel.
4. Open Checkout and create a split order.
5. In Operations Center, trigger **Running late +90m** and then **Heavy rain**.
6. Return to **Agent Network** to inspect the Operations → Route → Travel DNA delegation trace.

### Test voice

Open the app in Chrome or Edge, select **Voice planner**, click **Start voice session**, and allow microphone access when prompted. Speak the request naturally and review the live transcript. The browser receives only a short-lived session token from JourneyOS; the Vocal Bridge API key never leaves the server. If the Vocal Bridge packages or credentials are unavailable, the UI clearly switches to its offline demo adapter so the full flow remains testable.

## Vocal Bridge setup

Put credentials in `server/.env` (already ignored by Git). Never place the API key in `client/`, a `VITE_` variable, or browser storage.

```dotenv
VOCAL_BRIDGE_API_KEY=your_server_side_key
VOCAL_BRIDGE_AGENT_ID=
VOCAL_BRIDGE_API_URL=https://vocalbridgeai.com
```

Leave `VOCAL_BRIDGE_AGENT_ID` blank for an agent-scoped key. An account-level key needs the deployed agent UUID. `GET` and `POST /api/voice-token` call Vocal Bridge's `/api/v1/token` endpoint from the server and return only the short-lived token response to the browser.

The official React and SDK packages are declared in `client/package.json`. Run `pnpm install` while online to download them and update `pnpm-lock.yaml`; until then Vite uses the included build-safe offline adapter.

### Create and configure the voice agent

Vocal Bridge agent creation is currently a Pilot CLI/dashboard workflow. After Pilot access and phone verification are enabled:

```bash
pip install vocal-bridge
vb auth login
vb agent create
vb prompt set --file vocal-bridge/agent-prompt.md
vb config set --ai-agent-file vocal-bridge/ai-agent.json
vb config set --client-actions-file vocal-bridge/client-actions.json
```

The checked-in configuration enables Vocal Bridge **AI agent integration mode**. Spoken queries are sent over the web session data channel to `POST /api/agents/query`, where the Journey Orchestrator delegates them to the appropriate specialist agents. Outbound PSTN calling is not enabled in the app because the browser voice experience does not require it and the supplied guide documents outbound calls only through the Pilot-only `vb call <phone>` CLI, not a server REST API.

## API integration modes

`MOCK_MODE=true` is the default: no account, key, or internet access is needed for the polished demo. Set it to `false` and configure credentials to activate the service adapters.

- `SabreService` requests Sabre OAuth and normalizes flight and hotel results.
- Sabre hackathon test requests use `https://api-crt.cert.havail.sabre.com` and PCC `S5OM` (uppercase letter `O`) through `SABRE_PCC`; Sabre APIs with a `POS.Source` payload must send it as `PseudoCityCode`.
- The sandbox adapter uses OAuth v2: it exchanges `SABRE_CLIENT_ID` and `SABRE_CLIENT_SECRET` server-side, caches the bearer token with expiry metadata, and renews it one minute before expiry. Do not save a temporary `access_token` in `.env`.
- `PayPalService` uses PayPal Orders APIs when credentials are present; otherwise it creates a mock order that can be captured by the demo UI.
- `POST /api/voice-token` securely exchanges the server-side Vocal Bridge key for a short-lived browser session token.
- `POST /api/agents/query` lets Vocal Bridge's AI agent integration mode call the Journey Orchestrator over the web-session data channel.
- `LandingAiService` accepts receipt metadata and returns normalized receipt data in mock mode.

## Architecture

```
client/             React + TypeScript + Tailwind dashboard
server/             Express + TypeScript REST API
server/src/services provider adapters and trip intelligence
server/src/agents   coordinator, specialist registry, and delegation traces
server/src/store    seeded JSON-backed MVP repository
server/src/db       portable SQL schema for SQLite/PostgreSQL deployment
```

The demo repository is intentionally JSON-backed so it runs without native database dependencies. `server/src/db/schema.sql` contains the normalized SQLite/PostgreSQL-ready schema and `DemoStore` is the narrow persistence seam to replace for a production database.

### Multi-agent runtime

JourneyOS uses seven logical agents in the MVP:

1. **Journey Orchestrator** — decomposes the request, delegates work, and merges results.
2. **Voice & Preference Agent** — extracts the structured trip brief from Vocal Bridge or mock speech input.
3. **Travel Inventory Agent** — searches and normalizes Sabre flight and hotel offers.
4. **Itinerary & Route Agent** — optimizes geography, opening windows, and transit buffers.
5. **Live Operations Agent** — assesses delays, rain, closures, and traveler fatigue.
6. **Commerce Agent** — owns budget updates, PayPal order drafts/capture, and receipt OCR.
7. **Travel DNA Agent** — updates group preference signals and explains personalization.

The mock runtime is deterministic, but the delegation is real server-side execution: each specialist is a separate tool-backed agent object, the coordinator records task timing and output summaries, and `GET /api/agents` exposes recent runs to the Agent Network UI. Provider-backed or model-backed implementations can replace any specialist without changing the orchestration contract.
