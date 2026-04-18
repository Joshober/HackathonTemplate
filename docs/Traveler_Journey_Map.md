# Traveler Journey Map (Kelli)

## Before Trip (Plan)

Traveler intent:
- "What do I need for this trip?"
- "What options do I have?"

Copilot behavior:
- generate checklist from trip metadata
- flag risk/policy concerns
- explain tradeoffs in plain language

Escalation point:
- missing critical info (destination/dates/cost) blocks approval-readiness

## Approval

Traveler intent:
- "Do I need approval?"
- "Why is this blocked?"

Copilot behavior:
- prepare approval packet
- show current status and approvers
- provide "fix this first" guidance

Escalation point:
- policy exception or high spend requires manager/travel desk routing

## During Trip

Traveler intent:
- "My flight is delayed/canceled - what now?"

Copilot behavior:
- triage incident quickly
- offer ranked next actions
- clarify when to self-serve vs escalate

Escalation point:
- cancellation/missed connection/stranded/safety concern -> immediate escalation

## Return

Traveler intent:
- "What do I still need to do?"

Copilot behavior:
- generate follow-up tasks (expenses, feedback, compliance closure)
- track done/open statuses

Escalation point:
- unresolved compliance/finance tasks can be handed to manager/travel ops

## Cross-cutting Privacy

- minimal context fields sent to model
- explicit excluded sensitive fields
- privacy state surfaced in API metadata and assistant state
