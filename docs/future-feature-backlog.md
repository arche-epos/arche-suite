# Future Feature Backlog — Arché Suite

**Purpose:** Preserves the full scope of GitHub Issues closed on Sep 13, 2026 as part of narrowing the Issues tab to bugs/problems only. These are feature ideas and separate-app-build concepts — not lost, just relocated. Re-open as a new Issue (bug-tracking) or a dedicated spec doc when actively picked up for build.

**Also tracked:** Issues #12 (Progress tab redesign) and #13 (Lector app build) were closed the same day for the same reason but had no substantial body text beyond their titles — no scope to preserve beyond what's already in the project registry (`overview.md` — Lector is listed as a future/on-hold app already).

---

## #19 — Codex: Automated progress reports (Evaluate My Learning trigger + email delivery)
**Labels:** feature, codex | **Created:** Aug 9, 2026 | **Closed:** Sep 13, 2026

### Summary
Automate the existing "Evaluate My Learning" feature (Insights tab) so Jesse gets progress reports without manually tapping the button.

### Scope
1. Change trigger from manual tap to automatic — on module completion or scheduled digest (cadence TBD)
2. Scope report to the logged-in PIN'd student (requires PIN system from #18)
3. Pick a transactional email service (not yet chosen — Resend, Mailgun, etc.)
4. Wire a Cloudflare Worker cron job to send the Groq-generated analysis to Jesse automatically

### Dependencies
- Blocked by Priority 1 (Groq model fix — Evaluate My Learning uses the deprecated model too)
- Blocked by #18 (PIN system — reports must be scoped per student)

### Open decisions
- Transactional email service not yet chosen
- Trigger cadence (per-module-completion vs. scheduled digest) not yet decided

---

## #18 — Codex: Multi-student PIN accounts, mastery gating, idle-aware time tracking
**Labels:** feature, codex | **Created:** Aug 9, 2026 | **Closed:** Sep 13, 2026

### Summary
Core infrastructure build for Codex Arché to support homeschool course use (multi-student, gated progression, accurate hour logging).

### Scope
1. **PIN account system** — mirror Pilgrim/Mentor Cloudflare KV pattern, multi-student from day one (not single-child-only)
2. **Mastery gating** — block progression to next lesson/module below a set quiz score threshold
3. **Idle-aware automatic time tracking** — auto-pause after inactivity, auto-resume on interaction, feeds homeschool hours log directly (manual start/stop not reliable for a kid)

### Dependencies
- None blocking start, but should land after Priority 1 (Groq model fix) and Priority 2 (known-issue fixes) are shipped
- Priority 4 (#19, automated Evaluate My Learning + email reports) depends on the PIN system from this issue

### Progress note (as of close)
The Pilgrim-side PIN/identity architecture fix shipped Sep 11–12, 2026 (frozen `userId`, separate `displayName`, admin rename tooling) is directly reusable groundwork for the "mirror Pilgrim/Mentor KV pattern" scope item above — worth starting from that pattern rather than from scratch when this is picked up.

---

## #14 — Offline Bible download
**Labels:** feature, pilgrim | **Created:** Jun 23, 2026 | **Closed:** Sep 13, 2026

### Status at close
Concept approved. Not yet specced.

### Concept
Intentional per-translation Bible download in Pilgrim. User explicitly downloads a translation for offline use — not automatic caching.

### Constraints
- Public domain translations only (KJV, ASV, WEB, YLT, Darby)
- ESV and api.bible translations excluded (licensing prohibits offline storage)
- Download must be intentional user action — not silent background fetch

### Next step (when picked up)
Write spec: storage format (localStorage vs IndexedDB — see also #10, still open, same storage-architecture question), download UX, verse lookup against local store, fallback to API when online.

### Notes
- localStorage has ~5MB limit — may need IndexedDB for full translation storage
- Public version first; private version inherits same approach

---

## #3 — Scripture Graph tool
**Labels:** feature, arche-suite | **Created:** Jun 22, 2026 | **Closed:** Sep 13, 2026
**Status at close:** Approved for future build. Full spec below was already written (Spec v1) — this is a ready-to-build backlog item, not just an idea.

### Concept
An Obsidian-style node-graph tool for visualizing connections between Bible verses, passages, and topics. Dual delivery: a lightweight version inside Pilgrim, and a full standalone app in the Arché suite.

### Product Strategy
- **Pilgrim version** — DIY only, anchored to existing studies, lives in Progress tab or dedicated mode. Proof of concept. Silent advertisement for the standalone.
- **Standalone app** — Full-featured tool at `archestudytools.com/scripture-graph/`. Curated maps, rich connections, full Cytoscape.js feature set. Its own identity in the Arché suite.
- These are not competing products. Pilgrim version surfaces the concept to users already in study mode. Standalone serves users who want the full mapping experience.

### Build Order
1. Build standalone as a single-file HTML app first
2. Slot into Pilgrim as an ES Module to test feel (ES Modules migration already complete — see closed #8)
3. After real-world testing, confirm whether Pilgrim version stays or is cut
4. Ship standalone regardless of Pilgrim decision

### Pilgrim Version — Scope
- **Mode:** DIY only (no curated maps)
- **Node types:** verse reference (e.g. "John 3:16") OR topic/theme (e.g. "Redemption")
- **Connections:** labeled line between any two nodes; optional short note on each connection
- **Study link:** nodes can be linked to an existing Pilgrim study (one tap from the node)
- **Data:** localStorage; included in JSON backup; Gist sync added post-ES Modules (now available)
- **Placement:** Progress tab (replaces streak mechanic; fits "reflection of study done" positioning)
- **Library:** lightweight custom canvas renderer (no Cytoscape in Pilgrim version)

### Standalone Version — Scope
- **Modes:** DIY (user-built maps) + Curated (pre-built thematic maps)
- **Curated maps:** built by Jesse or trusted sources; not AI-generated; examples: Covenant, Messianic Prophecy, The Names of God, The Kingdom of God
- **Node types:** verse reference, topic/theme, person, place
- **Connections:** labeled line + rich note field
- **Data:** localStorage + Gist sync (own Gist key, separate from Pilgrim studies)
- **Library:** Cytoscape.js (lazy-loaded; purpose-built for node/edge graphs, good touch support)
- **URL:** `archestudytools.com/scripture-graph/`
- **Auth:** none (public tool); PIN gate if private data warranted in future

### Node Data Model
```json
{
  "id": "uuid",
  "type": "verse | topic | person | place",
  "label": "John 3:16",
  "note": "Optional description or commentary",
  "linkedStudyId": "pilgrim-study-id-or-null",
  "x": 0.45,
  "y": 0.30
}
```

### Edge Data Model
```json
{
  "id": "uuid",
  "from": "node-id",
  "to": "node-id",
  "label": "fulfilled by",
  "note": "Optional longer explanation"
}
```

### Key Design Principle
The graph is a **reflection of study already done**, not a gamification layer. Nodes grow richer as studies deepen. Aligns with Pilgrim's intrinsic motivation profile; avoids the extrinsic motivation trap of streak-based mechanics.

### Deferred to Phase 3
Full spec for standalone curated map content, collaborative maps, and export features to be written when standalone build begins.

**See also:** `scripture-graph-spec-v1.md` in Project Knowledge — this issue's spec content originated there; treat that file as the canonical copy going forward.

---

## #1 — Verse Memory Mode (spaced repetition)
**Labels:** feature, pilgrim-private | **Created:** Jun 22, 2026 | **Closed:** Sep 13, 2026
**Status at close:** Approved for future build. Full spec below was already written (Spec v1) — ready-to-build backlog item.

### Concept
A spaced repetition system for memorizing Bible verses. Integrated into Pilgrim — lives in the Progress tab. Replaces the streak mechanic (research confirms streaks are extrinsic motivation and counterproductive for intrinsically motivated Bible study users).

### Adding Verses to Memory Bank
Two entry points:
1. **From a study** — "Add to Memory" button appears on any verse in the scripture panel. One tap adds reference + text to the memory bank.
2. **Manual entry** — In the Memory section of the Progress tab, user can type any reference and verse text directly.

### What Gets Memorized
Both the **reference** (e.g. "John 3:16") and the **full verse text**.

### Review UI
1. Show the **reference** (e.g. "John 3:16 — ESV")
2. User recalls the verse text:
   - **Type it** — free-text input field
   - **Speak it** — microphone button (Web Speech API); transcribes and fills input; critical for mobile users
3. User self-rates recall on 4 buttons: **Hard / Okay / Good / Easy**
4. Next interval calculated and verse scheduled

### Algorithm — Lightweight SM-2
Based on SM-2 (the algorithm behind Anki). Simplified for non-technical users — they only see the 4 rating buttons, never interval numbers.

| Rating | Interval behavior |
|---|---|
| Hard | Reset to 1 day |
| Okay | 1 day |
| Good | Previous interval × 1.5 |
| Easy | Previous interval × 2.5 |

Starting intervals: 1d → 3d → 7d → 14d → growing from there. An ease factor per verse adjusts over time based on rating history.

### Progress Tracking (Progress Tab)
- **Due today** — count of verses due for review; badge on Progress tab nav item
- **Verses mastered** — count of verses with interval > 30 days
- **Review history** — calendar heatmap of review activity (replaces AI Tools Run — confirmed useless metric)
- **Streak** — removed entirely (see above)
- **Banner on app open** when verses are due: "You have 3 verses due for review"

### Progress Tab Redesign Notes
Current "AI Tools Run" stat removed. Progress tab now covers:
- Verse Memory section (primary)
- Study count, word count totals (retained)
- Scripture Graph lightweight view (see #3 above / `scripture-graph-spec-v1.md`)

### Data Model
```json
{
  "id": "uuid",
  "reference": "John 3:16",
  "translation": "ESV",
  "text": "For God so loved...",
  "interval": 3,
  "easeFactor": 2.5,
  "nextReviewDate": "2026-06-25",
  "reviewHistory": []
}
```
Stored in localStorage under `_pilgrim_memory_verses`. Included in JSON backup export.

### Speech-to-Text Notes
- Web Speech API (no cost, no API key, native browser)
- iOS Safari and Android Chrome both support it
- Graceful fallback: mic button hidden if `SpeechRecognition` unavailable
- Transcription fills the input field; user can edit before rating

### Applies To
Pilgrim Private first; port to Public after confirmation.

**See also:** `verse-memory-spec-v1.md` in Project Knowledge — this issue's spec content originated there; treat that file as the canonical copy going forward.

---

*End of backlog doc. Re-open on GitHub Issues (or promote to an active spec/build session) when any of these gets picked up.*
