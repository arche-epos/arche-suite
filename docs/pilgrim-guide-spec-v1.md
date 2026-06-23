# Pilgrim Guide — In-App Help Mascot
**Spec v1 | Issue #2 | Status: Approved for Phase 1 build**

---

## Concept
A named in-app guide character — "Pilgrim" — Groq-powered, answers "how do I..." questions about the app in plain language. Strictly scoped to app navigation. Never discusses theology or biblical content.

---

## Trigger & Placement
- Avatar: existing circular icon already placed in sidebar (top-right, visible in v4.13.1)
- Tap avatar → opens modal
- Modal: overlay, centered, dismissible by backdrop tap or close button

---

## Session Memory
- Conversation persists within a session (page reload clears it)
- Cap: 10–12 exchanges; full history sent to Groq each call
- "Start over" button in modal footer clears history

---

## Screen Awareness
- Pilgrim Guide knows the currently active screen (Library, Field Notes, Study Tools, Progress, Settings)
- System prompt includes current screen context on every call
- Allows context-aware answers: "You're in Field Notes — tap the book icon above to look up a reference"

---

## Groq Strategy
- Separate Groq call from all study AI tools
- Separate system prompt containing full plain-language app map
- Model: llama-3.3-70b-versatile (same as other tools, via arche-proxy)
- Instructed never to discuss theology, biblical interpretation, or any study content
- Response length: 3–4 sentences max; conversational tone

---

## Build Phases

### Phase 1 — Chat (Build Now)
- Avatar button → modal opens
- Freeform chat interface (user types, Pilgrim responds)
- Session memory with Start Over button
- Screen awareness in system prompt
- Groq integration via arche-proxy

### Phase 2 — Contextual Highlighting
- While answering, Pilgrim can pulse/glow the relevant UI element
- Requires a simple element-targeting API: `pilotHighlight('#element-id')`
- Non-blocking — chat continues normally

### Phase 3 — Coach Marks (Replaces Tour A & B)
- Full step-by-step walkthroughs with dimmed overlay, arrow callouts, Next button
- Absorbs and replaces existing Tour A and Tour B system
- Tour A step count to be reduced — feedback indicates current Tour A is too long; refine during Phase 3 build
- Tours to build: Getting Started, Deep Study Tools, Word Lookup, Sync Your Studies, Settings Walkthrough
- First-launch onboarding trigger

---

## Scope Constraints (Hard Limits)
- App navigation only — no exceptions
- No access to user's study content
- No biblical commentary, interpretation, or theological positions
- No memory across sessions

---

## Applies To
Pilgrim Private first; port to Public after confirmation.

