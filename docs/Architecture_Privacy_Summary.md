# Architecture + Privacy Summary

## High-Level Flow

1. Frontend captures traveler intent by journey stage (`Plan`, `Approve`, `Travel`, `Return`).
2. Backend loads minimized app context from MongoDB (`items`, `profiles`, `teams`).
3. Copilot endpoint (`/api/chat/copilot`) uses:
   - stage-aware prompt instructions
   - tool calling (web search/weather/event search)
   - context quality + suggested actions
4. Workflow APIs provide deterministic task structures:
   - checklist generation
   - approval preparation
   - incident triage + escalation
   - follow-up generation
5. Frontend persists generated artifacts into `items.travel.*`.

## Key Endpoints

- `POST /api/chat/copilot`
- `POST /api/travel/checklist/generate`
- `POST /api/travel/approvals/prepare`
- `POST /api/travel/incidents/triage`
- `POST /api/travel/followups/generate`
- `POST /api/travel/escalate`

## Data Model Extensions (`items.travel`)

- `checklist[]`
- `approval{}`
- `incidents[]`
- `followUps[]`
- `privacy{}`

## Privacy by Design

Data used:
- destination, dates, rough cost estimate, trip status, team city presets, lightweight profile context

Data excluded/minimized:
- passwords
- payment card numbers
- passport numbers
- auth tokens
- unbounded freeform private notes

Protection approach:
- sanitization + clipping before LLM prompt injection
- explicit privacy metadata returned in workflow responses
- assistant response includes `privacyApplied` flag

## Assumptions

- policy engine is guidance-first (not legal policy source of truth)
- external fare/search data is indicative unless explicit API-backed quote is present
- escalation endpoint currently opens internal support case (`tickets`)
