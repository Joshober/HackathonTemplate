# HackKU Requirements Traceability

## 1) Planning / Before Trip

Requirement:
- summarize requirements
- approvals needed and why
- booking options + tradeoffs
- auto checklist

Implemented:
- `POST /api/travel/checklist/generate` (checklist + risk flags + tradeoff guidance)
- Plan-stage `PreTripChecklistPanel` persists checklist to `items.travel.checklist`
- Assistant stage-aware PLAN prompting via `/api/chat/copilot`

## 2) Approvals Guided Experience

Requirement:
- guided approvals
- plain language status
- rejection/change guidance

Implemented:
- `POST /api/travel/approvals/prepare` (status, requiredBy, reasons, fixes, timeline)
- Approve-stage `ApprovalGuidancePanel` persists to `items.travel.approval`
- Home/Approve status cards + team review interactions

## 3) During Trip Real-time Assistant

Requirement:
- clear next steps for in-trip questions
- escalation paths

Implemented:
- `/api/chat/copilot` now stage-aware (`journeyStage`)
- travel-stage `IssueEscalationPanel` for triage/escalation workflows
- assistant response metadata includes `incidentDetected`, `escalationRecommended`

## 4) Issues & Exceptions

Requirement:
- detect/accept delays/cancellations/missed connections
- provide choices, reduce stress, know when to escalate

Implemented:
- `POST /api/travel/incidents/triage` (summary, options, escalation level/action)
- `POST /api/travel/escalate` (opens `tickets` case)
- incidents persisted in `items.travel.incidents`

## 5) After Trip Closure

Requirement:
- reminders for follow-ups
- trip closure tasks

Implemented:
- `POST /api/travel/followups/generate`
- Return-stage `PostTripFollowUpsPanel`
- follow-ups persisted in `items.travel.followUps`

## 6) Privacy & Safety

Requirement:
- explain data usage and minimization

Implemented:
- workflow endpoints return explicit `privacy` metadata
- `build_travel_chat_context` includes minimization + excluded field declarations
- copilot response includes `privacyApplied` signal

## 7) Demo Story (under 5 minutes)

Supported by:
- `docs/Demo_Script_5_Minutes.md`
- journey-stage UI (`Plan -> Approve -> Travel -> Return`)
- assistant + workflow panels for high-signal interactions
