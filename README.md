# Intelligent Travel Companion Copilot (HackKU Lockton Track)

Business-travel copilot focused on the full journey:

- `Planning` -> requirements, checklist, options, tradeoffs
- `Approval` -> guided status, reasons, and fast fixes
- `Travel` -> disruption triage and escalation
- `Return` -> follow-ups, summary, and closure

This repo is intentionally aligned to the HackKU 2026 brief and demo flow.

## Stack

- Frontend: Next.js App Router + TypeScript (`frontend/`)
- Backend: Flask API (`backend/`)
- Data: MongoDB (`items`, `profiles`, `teams`, `team_messages`, `tickets`)
- Auth: Auth0 / session-backed token flow
- AI: OpenRouter + tool calling (web/weather/event search)

## Product Surface

Primary routes:

- `/` product intro + entry points
- `/home` stage journey (Plan, Approve, Travel, Return)
- `/assistant` stage-aware travel copilot
- `/team` team collaboration and approvals context
- `/profile` settings + support escalation

Legacy non-travel and explorer routes redirect to `/home`.

## Key Features Mapped to Brief

### Before Trip

- Auto-generated pre-trip checklist (`/api/travel/checklist/generate`)
- Risk flags + booking tradeoff guidance
- Context-aware copilot grounded in saved trip/team data

### Approval

- Guided approval preparation (`/api/travel/approvals/prepare`)
- Clear status language (`required`, `submitted`, `pending`, `approved`, `needs_changes`)
- Fix suggestions when blocked

### During Travel / Issues

- Incident triage (`/api/travel/incidents/triage`) for delay/cancellation/missed connection/hotel/policy exceptions
- Ranked next actions + escalation thresholds
- Escalation handoff (`/api/travel/escalate`) to open a support case

### Return

- Follow-up generation (`/api/travel/followups/generate`) for expenses, feedback, compliance
- Persisted task states on trip metadata

### Privacy by Design

- Context minimization in backend prompt context builder
- Explicit privacy metadata returned with workflow APIs
- Sensitive fields excluded from model context payloads

## Quick Start

### 1) Configure env files

Use existing examples:

- root `.env`
- `frontend/.env.local`
- `backend/.env`

Required minimum for local dev:

- Auth0 settings
- MongoDB URI + DB name
- `OPENROUTER_API_KEY`

### 2) Run with Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

### 3) Or run locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

## API Highlights

### Existing

- `POST /api/chat/copilot` stage-aware travel assistant
- `POST /api/explorer/opportunities` event/opportunity discovery
- `POST /api/travel/pricing-preview` flight/hotel matrix preview
- Team collaboration + messages under `/api/teams/*`
- CRUD for travel cards under `/api/items`

### New workflow APIs

- `POST /api/travel/checklist/generate`
- `POST /api/travel/approvals/prepare`
- `POST /api/travel/incidents/triage`
- `POST /api/travel/followups/generate`
- `POST /api/travel/escalate`

## Validation Commands

Frontend production build:

```bash
cd frontend
npm run build
```

Backend syntax check:

```bash
python -m compileall backend/app
```

## HackKU Deliverables in Repo

See `docs/` for submission assets:

- `Traveler_Journey_Map.md`
- `Prompt_Set.md`
- `Architecture_Privacy_Summary.md`
- `Demo_Script_5_Minutes.md`
- `Requirements_Traceability.md`
