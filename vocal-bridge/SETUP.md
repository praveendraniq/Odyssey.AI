# Vocal Bridge setup for the JourneyOS live negotiator

Local prompt files do not automatically update the hosted Vocal Bridge agent. Synchronize these settings in the Vocal Bridge dashboard before the demo.

## Files to copy

- Use `agent-prompt.md` as the agent's main instructions/system prompt.
- Use the description in `ai-agent.json` for the connected AI agent.
- Keep `client-actions.json` for the browser voice controls. The outbound negotiation uses secured server tools instead of a browser client action.

## Secured outbound tools

Configure the same private `X-JourneyOS-Context-Key` header for both tools. Store the value in the server as `VOCAL_BRIDGE_OUTBOUND_CONTEXT_SECRET`; never place it in client code or commit it.

### 1. Load active trip context

- Method: `GET`
- URL: `<public-server-url>/api/voice/outbound-context`
- Header: `X-JourneyOS-Context-Key: <secret>`

The response contains the active trip, full traveler profiles, two earlier completed preference summaries, and the identity of the live third traveler. It deliberately contains no predetermined conflict.

### 2. Submit the discovered negotiation

- Method: `POST`
- URL: `<public-server-url>/api/negotiation-calls/complete`
- Header: `X-JourneyOS-Context-Key: <secret>`
- Content type: `application/json`

Send this shape using values produced by the actual conversation:

```json
{
  "travelerId": "traveler id from negotiationSession",
  "statedPreference": "the live traveler's own words",
  "counterpartId": "id of the saved traveler whose need conflicts",
  "conflict": "the two concrete needs that compete",
  "rationale": "why the current plan cannot fully protect both",
  "proposal": "the specific compromise generated during the call",
  "accepted": true,
  "travelerResponse": "the traveler's explicit yes or no",
  "affectedDay": 2,
  "agreedChanges": ["only changes explicitly accepted"],
  "itineraryChanges": [
    {
      "time": "18:15",
      "title": "title generated from the accepted compromise",
      "subtitle": "destination and purpose from active context",
      "category": "food"
    }
  ],
  "dialogue": [
    { "speaker": "agent", "text": "verbatim agent turn" },
    { "speaker": "traveler", "text": "verbatim traveler turn" }
  ]
}
```

The example values illustrate the schema only. Do not paste them as fixed tool values. `affectedDay`, times, titles, conflict, proposal, counterpart, and plan changes must come from the live answer and active trip.

## Required conversational sequence

1. Load the context and greet the live third traveler by name.
2. Ask for one priority or constraint without suggesting an answer.
3. Compare the answer with the two saved profiles.
4. If no real conflict exists, say that honestly and do not fabricate one.
5. If a conflict exists, name it, explain why it matters, and generate a feasible trade.
6. Ask for explicit agreement. If declined, try one alternative.
7. Submit the actual transcript and structured outcome.
8. Tell the traveler that the admin must approve the change; never claim it is already applied.
