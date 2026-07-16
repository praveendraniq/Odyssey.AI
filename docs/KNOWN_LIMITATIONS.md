# Known limitations

- Preference phone calls are simulated by default. The UI records confirmation for the current flow, but production consent storage, call callbacks, retries, and provider contract verification are not complete.
- Sabre credentials were unavailable during this pass. Live round-trip selection, airport choice, token refresh, hotel availability variations, and live result application are incomplete.
- Google Places falls back safely but lacks a diagnostics endpoint, coordinates, opening hours, photos, and quota-specific UI.
- Booking and PayPal demo capture do not create a real travel reservation. Pre-trip checkout excludes variable expenses; receipt payer/participants and net balances are implemented, but per-traveler payment states and the final settlement transaction are not.
- Current destination weather prefers Google Weather when configured and otherwise uses Open-Meteo. Trip-date forecasts are only possible when the journey enters the selected provider's forecast window.
- Admin/Traveler preview demonstrates privacy presentation but is not authentication and does not constitute a production authorization boundary.
- Current location is simulated. The Google Maps iframe and fallback route do not support rich live markers for every progress state.
- Route metrics are deterministic estimates based on itinerary travel minutes, not a claimed globally optimal route.
- Receipt analysis is a simulated/manual payload in mock mode; camera OCR is not implemented.
