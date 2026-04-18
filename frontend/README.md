# Frontend (Travel Companion)

Next.js app for the HackKU Travel Companion Copilot.

## Primary Routes

- `/` product intro
- `/home` journey stages (Plan/Approve/Travel/Return)
- `/explorer` event discovery and trip options
- `/assistant` stage-aware AI copilot
- `/team` collaboration and approvals context
- `/profile` traveler settings and escalation entry

## Required Env

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

If using Auth0 locally, include your normal auth env values from the root setup docs.

## Commands

```bash
npm install
npm run dev
npm run build
```

## Notes

- The frontend consumes workflow APIs under `/api/travel/*` for checklist, approvals, incident triage, follow-ups, and escalation.
- AI assistant uses `/api/chat/copilot` with stage-aware context and privacy metadata indicators.
