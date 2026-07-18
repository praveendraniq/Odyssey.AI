# Odyssey.AI architecture

Odyssey.AI uses one active `Trip` object across the client and API. The browser persists it under `journeyos-active-trip`; startup hydrates the API store, which migrates older objects to schema version 2 without changing their destination. Mutations accept the current trip before applying an operation, preventing stale server state after restart.

The trip contains the roster, aggregate preferences and approval, inventory selections, itinerary, budget, Travel DNA, event feed, and progress state. Traveler changes recalculate aggregate interest scores, passenger-dependent flight cost, and invalidate a prior preference approval.

Preference capture flows through `VocalBridgeService`. Mock mode deterministically derives traveler summaries; configured mode calls the provider endpoint. Decision Studio applies explicit 1–5 interest weights and records approval in the event feed.

Plan fit is deterministic: 65% interest-to-itinerary match, 15% pace match, 10% food/constraint coverage, and 10% protection of the traveler’s top two priorities. Group happiness is the average individual fit minus half of any fairness spread above 12 points. Decision approval reorders only flexible, unfinished itinerary items; flights, hotels, transport and completed activities remain protected.

Inventory adapters isolate Sabre normalization, while the current connected UI uses clearly labeled destination-aware demo inventory. Google Places searches server-side; fewer than two usable results or a provider failure selects a curated itinerary and returns the fallback diagnostic.

Activity progress is a server mutation state machine:

`upcoming/current/moved -> in-progress -> completed`, or `-> skipped`.

Completion records actual duration and variance. A delay of at least 20 minutes retimes later flexible stops on that day, preserves completed/stay/transport items, updates completion and schedule variance, writes an event, and creates a Travel DNA change record with before/after scores and confidence.

Disruptions mutate the same itinerary and event feed. Current route metrics are deterministic heuristics based on stop travel minutes; they are not claimed as mathematical optimality.

Payments use a PayPal-shaped order. Mock mode creates and captures deterministic demo orders; configured mode calls PayPal. Admin/traveler switching is currently a presentation boundary, not production authentication.
