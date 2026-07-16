# JourneyOS implementation audit

Audit date: 2026-07-15. Baseline: `codex/group-preferences` at `e2297c9`. Working branch: `codex/journeyos-demo-ready`.

## Verified working

- React/Vite client and Express/TypeScript API build and type-check successfully.
- Active-trip hydration sends browser state to the server and preserves a non-Japan destination.
- Curated destination itineraries, destination-aware demo flights/hotels, Decision Studio, booking gating, custom split calculation, map embed/fallback, weather panels, disruptions, and simulated preference capture are connected to active trip state.
- Sabre, Google Places, PayPal, Vocal Bridge, and Landing AI adapters exist behind server-only configuration.

## Completed in this pass

- Added version-2 trip-state migration for legacy persisted trips.
- Added traveler create, edit, and remove operations with unique-name validation, a two-person minimum, group-score recalculation, approval invalidation, traveler-count synchronization, and flight-total recalculation.
- Restored activity controls that were unreachable because the selected stop was hardcoded to `null`.
- Added start, complete, skip, and running-late mutations; actual duration; schedule variance; recalculated completion percentage; remaining-stop retiming; activity-feed entries; and persistence through the active trip.
- Added Travel DNA evidence with before/after values, confidence, reason, and timestamp.
- Added deterministic demo reset in the API and dashboard.
- Added four integration-style store tests covering migration, travelers, late completion, Travel DNA, skip, and reset.
- Replaced prompt-based traveler editing with inline phone, pace, constraint and interest controls.
- Added deterministic plan-fit scoring (interest 65%, pace 15%, constraints 10%, compromise 10%) plus fairness-adjusted group happiness.
- Promoted Vocal Bridge mediation into a consented, visible workflow and made Decision Studio materially reprioritize flexible itinerary stops.
- Replaced Operations as a top-level destination with a unified Live trip page, and added a dedicated Travel DNA evidence/history page.
- Replaced the static date summary with editable origin/destination/departure/return values and arrival-aware hotel-night totals.
- Changed Vite to its runner config loader to avoid an esbuild parent-directory traversal failure in restricted Windows workspaces.

## Partial or deferred

- Sabre flight search is one-way, uses fixed adult count in the adapter, and is not wired to an explicit live-search UI. Hotel response normalization targets only one legacy response shape. No credentials were available for verification.
- Places supports server-side text search and curated fallback, but has no diagnostics endpoint, coordinates, hours, ratings, photos, or explicit timeout.
- Payment supports a single PayPal order plus deterministic demo capture; per-traveler payment lifecycle and server-side role filtering remain incomplete.
- Vocal Bridge has direct HTTP adapter calls, UI consent confirmation and simulated mediation, but no durable production consent record, callback lifecycle, retry state, or verified provider contract.
- The role switch is a demo preview, not authentication or a production authorization boundary.
- Route metrics remain heuristic and the iframe map cannot render rich per-status markers.

## Regression risks and next order

1. Define a shared inventory contract with airport/date/passenger inputs and explicit `sabre_live`, `sabre_sandbox`, or `demo_inventory` source metadata.
2. Add server-owned payment participants/statuses and role-shaped responses.
3. Add Places diagnostics and normalized coordinates, then use those coordinates for calculated route metrics.

Primary files changed: `server/src/types.ts`, `server/src/store/demo-store.ts`, `server/src/app.ts`, `client/src/types.ts`, `client/src/api.ts`, `client/src/App.tsx`, package scripts, tests, and documentation.
