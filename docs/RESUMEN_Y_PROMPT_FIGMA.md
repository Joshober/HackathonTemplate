# Summary + Figma Prompt (≤5000 chars)

## 1. Product

**Claude Home™** — "Your AI Assistant for Everything, Everywhere"

As AI systems increasingly automate our homes and infrastructure, users are losing transparency and control. Decisions are made automatically, confidence levels are overstated, and optimization often prioritizes efficiency over human comfort. **Claude Home explores what happens when automation goes just a little too far.** Full-stack webapp: one AI for work (calendar, emails), learning (tutor + image uploads), smart home (devices), automation, and voice (wake word, TTS). **Hackathon vibe: ironic/satirical** — automation that decides for you, optimizes without asking, high "confidence" in its actions; tone witty and slightly unsettling, not corporate. Stack: Next.js 16, Tailwind, Motion, Flask, MongoDB, Auth0/email, Cloudinary, OpenRouter. Design implementable with CSS variables and components.

## 2. Screens

- **Landing (/):** Hero, capabilities, use cases, CTA, footer. Dark nav (Capabilities, Features, Use Cases, Launch Console / Sign in). Floating chatbot. Login modal (email/password + Google).
- **Dashboard (/dashboard):** Sidebar (Overview, AI Tutor, Profile, Chat Pipeline) + card grid (Profile, welcome, Chat, Support, Tutor).
- **Chat (/chat), Support (/support), Tutor (/tutor):** Same shell. Messages (user right, assistant left). Input: mic, attach image/video, TTS voice selector, "speak response" toggle, text, send. VAD voice, images/video (Chat has roast mode for media).
- **Voice Assistant (/voice-assistant):** No sidebar. Navbar. "Start listening", configurable wake/sleep phrase. States: idle, listening (asleep/awake), processing, speaking. Conversation bubbles.
- **Profile (/profile, /profile/edit):** View (photo, name, email, About, dates, Edit) and create/edit form (displayName, bio, image).

Global: floating chatbot, login modal, floating "Sign in" when logged out.

## 3. What to fix

Light navbar on some routes vs dark theme (#0E1117, #4F8CFF, glass) — breaks unity. Missing clear hierarchy, spacing scale, and typography. Components lack states (hover, focus, disabled, loading). Chat UIs are dense; need visual grouping. Contrast and type scale not defined (WCAG).

---

## 4. FIGMA PROMPT — Claude Home™ Redesign (automation goes too far)

**Role:** Lead product designer, 26+ years. Goal: a full design system and visual direction for **Claude Home™** so the UI feels **credible, modern, usable, consistent — and subtly unsettling**. Theme: **when automation goes just a little too far** — loss of transparency and control, decisions made for you, overstated confidence, efficiency over comfort. Tone: ironic/satirical, witty, human but with an edge.

**Context:** (1) Landing (hero, capabilities, use cases, CTA); (2) Dashboard with sidebar and cards; (3) Chat views (Pipeline, Support, Tutor) — messages, voice, attachments, TTS; (4) Voice Assistant (wake/sleep, voice conversation); (5) Profile (view/edit). Dark theme, blue accent, glassmorphism. Next.js + Tailwind + Motion; design must translate to CSS variables.

**Problem:** Mixed styles (light navbar vs dark app), weak hierarchy, generic components. Goal: make it **actually look good** — professional with personality and ironic/satirical microcopy where it fits (e.g. "We're always confident", "Decisions made for you").

**Deliverables:**

1. **Design system (variables + styles)**  
   Color: base/surface/elevated/overlay; primary #4F8CFF + hover/active/disabled; text primary/secondary/tertiary/links; semantic (success, warning, error); borders. Typography: family (avoid "AI slop"), scale display/h1–h4/body/caption; weight and line-height. Spacing: 4/8/12/16/24/32/48/64 and usage. Radii (buttons, cards, inputs, modals). Shadows and depth; optional glow on CTAs. Motion: document duration/easing for hover, modals, states (listening/speaking).

2. **Components:** Buttons (primary, secondary, ghost, danger; default/hover/active/disabled/loading). Inputs (label, placeholder, error, helper). Dashboard cards (icon, title, description, link) and message bubbles (user/assistant). Selects, toggles (TTS voice, "Speak response"). Badges (listening, processing, speaking, error). Unified dark navbar. Sidebar (nav, active state, account, Sign out).

3. **High-fidelity screens:** Landing (hero, stats, capabilities, use cases, CTA, footer, fixed nav — tone: inviting but with ironic edge; e.g. "99.2% Confidence*" with footnote). Dashboard (shell + card grid). One Chat view (header, messages, full input; states: attached image, error, "Thinking…"). Voice Assistant (Start listening, wake/sleep, state indicators, voice selector, conversation). Profile (view + edit). Room for satirical microcopy (empty states, footnotes).

4. **Consistency & personality:** Single direction (dark + blue + glass). No generic "AI slop"; typography with character and legibility. WCAG AA contrast. Empty and loading states — can be light-hearted or subtly ironic where appropriate.

5. **Figma docs:** Clear naming; notes (tokens, motion); summary page (palette, typography, spacing, components).

**Success:** A dev can implement in Next.js + Tailwind with CSS variables; experience feels **unified, professional, modern, and on-theme: when automation goes just a little too far**.
