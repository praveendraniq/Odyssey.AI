# Five-minute JourneyOS demo

1. Start with `corepack pnpm install --frozen-lockfile` and `corepack pnpm dev`, then open `http://localhost:5173`.
2. On Trip dashboard, click **Reset demo** so every run begins from the same Japan state.
3. Open Voice planner. Submit: “Plan a 5-day Tokyo trip for four travelers under $6,000 with culture, food and photography.” Point out whether the itinerary says Google Places or curated fallback.
4. In **Group planning**, edit a traveler inline: phone, pace, food constraint and one interest. Show that prior approval is invalidated.
5. Confirm call consent and click **Call travelers & negotiate preferences**. Explain that each non-admin traveler receives a private call and negotiation runs after summaries return; the demo simulates Vocal Bridge unless verified real credentials and consenting test numbers are configured.
6. Show each traveler’s deterministic plan-fit breakdown, the negotiated compromise, group happiness and fairness gap. Adjust one priority, then click **Approve & update trip**.
7. Open **Booking & payment**. Change the return date and show calendar days and arrival-aware hotel nights recalculate. Confirm the flight/hotel-only pre-trip split, then point out that shared receipts are net-settled after travel.
8. Set the split to total 100%, switch to Traveler preview to show private-share presentation, and create demo checkout.
9. Open **Live trip**. Show the map, before/optimized order and heuristic distance, time and backtracking savings. Disruption controls now live here rather than in a separate Operations tab.
10. In Live activity progress, start the next activity. Enter an actual duration 30 minutes over plan and complete it. Show completion percentage, schedule variance, retimed stops, and the Travel DNA before/after explanation.
11. Trigger Heavy rain on the same Live trip page. Show the changed itinerary, route marker/status, explanation, and activity feed.
12. In **Live trip**, open the compact **Demo disruptions** drawer and apply one event. Show the AI decision explanation in the same drawer while the plan changes behind it.
13. Open **Expenses & settlement**, scan a receipt, choose the payer and participants, and show paid, personal share, and net owes/receives totals.
14. Open **Travel DNA** and show the before/after score, confidence, timestamp and evidence explaining what the system learned.
13. Return to the dashboard and close with: “Most travel apps optimize bookings. JourneyOS optimizes the traveler.”
