# Pilgrim Private — Guided Tour Spec v1
**Status:** Planning — not yet built
**Scope:** Standalone feature, built independently of full FBI-1 (Avatar chat + contextual highlighting). Uses the same coach-marks visual pattern (dimmed overlay, arrow callout, Next/Back/Skip, progress dots) but no Groq-powered chat assistant.
**Priority:** Ahead of ES Modules migration, per Boss's direction (testers are actively onboarding now)

---

## Trigger Points

| Tour | Trigger | Re-launchable? |
|---|---|---|
| **Tour A — First Study** | Button offered at the end of the existing 3-step onboarding (`ob-overlay`) | Yes — replay link, placement TBD |
| **Tour B — Settings** | First time the user opens the Settings tab | Yes — replay link, placement TBD |

Each tour's "seen" state stored as a namespaced flag (e.g. `SK_TOUR_STUDY_SEEN`, `SK_TOUR_SETTINGS_SEEN`) so it only auto-offers once per user, consistent with the existing PIN namespacing pattern.

---

## Tour A — "Create Your First Study"

Walks the user through building a real study end-to-end using a Blank template and John 3:16 as the reference. Confirmed pre-fill values:

| Field | Value |
|---|---|
| Teacher / Preacher | Jesse's name (example) |
| Series | "How to Use Archē" |
| Title | "First-Time Study" |
| Reference | John 3:16 |

### Stage 1 — Library → New Study
1. Highlight the **Studies / Words** tab toggle → "Words tab holds every word you've looked up and saved, across all studies"
2. Highlight the sort dropdown (Date, Modified, Reference, Teacher, Series) → explain choosing Reference/Teacher/Series reveals a sub-filter bar to narrow further
3. Highlight the `+` FAB (Library tab only) → "Tap here to start a new study"
4. Template picker modal opens → highlight **Blank** → "Start with a blank study"
5. Land on the Notes/new-study form

### Stage 2 — Study Info
6. Point out Date (auto-filled)
7. Teacher/Preacher field → pre-fill with Jesse's name
8. Series field → pre-fill "How to Use Archē"
9. Title field → pre-fill "First-Time Study"
10. Tags → highlight tag row → tap one (e.g. "Study") to demonstrate selection

### Stage 3 — Scripture Reference (two methods)
11. Reference field → show typing "John 3:16" manually
12. Then show the alternate path: tap the book icon → Reference Picker → Old/New Testament → Book → Chapter → Verse(s) → Load Scripture
13. Highlight **+ Add Passage** → add a second passage and keep it on the demo study (no need to remove it — the whole study gets wiped at tour completion regardless)

### Stage 4 — Notes
14. Highlight the loaded scripture display → "This is where you read the passage"
15. Highlight the rich-text Observations & Notes editor → point out Bold/Italic/Underline/Strikethrough, lists, indent, blockquote, clear-format — instant-fill brief demo text (no typing animation)
16. Box-highlight the **Listen** button → "This reads your notes aloud"
17. Highlight **Look Up Word** → demo searching "Archē" → show result → explain the two save options: save to this study, or save to the Words tab in Library

### Stage 5 — Study Tools
18. Navigate to Study Tools tab → point out the same John 3:16 passage and notes are already there
19. Walk through each of the 6 tools one at a time: Word Study, Language & Structure, Historical Context, Cultural Context, Cross-References, Places & Geography
20. Highlight the **This Passage / Whole Book** scope toggle → explain what changes
21. Highlight **Study Snapshot** → explain it runs all 6 tools at once
22. Highlight **Passage/Book Outline** → explain writing a book outline here
23. Highlight **My Conclusions** → explain this is the AI-free personal space
24. Highlight **Export Study to PDF** → end of main walkthrough
25. *(Optional extension)* briefly mention **Share Study Link**

### Stage 6 — Progress (brief touch)
26. Navigate to Progress tab → showcase with **rich seeded demo data** (multiple temp demo studies, a multi-day streak, varied AI tool runs, several books represented) rather than just the one real demo study, so testers see the tab's full potential, not a sparse one-study view

### Cleanup
27. **Auto-delete all tour-created data** the moment the tour ends or is skipped at any point — the demo study (with its added second passage), the demo saved word, and the extra seeded studies used for the Progress preview. All built as real data (not mockups), tagged internally so cleanup can find everything reliably even if the tour is abandoned mid-way or the browser closes unexpectedly (safety-net check on next app launch).

---

## Tour B — "Settings Walkthrough"

Triggered the first time Settings is opened.

1. **Study Sync** — manual Backup/Restore buttons
2. **Text-to-Speech** — voice picker + Test Voice
3. **Available Translations** grid — tap to set default
4. **About Translations** spectrum — tap any translation for full detail (history, philosophy, producers, audience)
5. **Tags** — add/remove/manage
6. **Share App** — *with disclaimer:* sharing sends the **Public** version link, not this Private tester build. Tester access is PIN-gated and limited to the approved list only.
7. **Manual JSON Backup** — *with disclaimer:* data already syncs automatically to browser storage and an offsite cloud backup; this is an additional local export.
8. **Changelog** — what it is
9. **Diagnostics** — connection test buttons + *disclaimer:* the feedback button isn't wired up yet — reach out to Jesse directly with feedback instead.

---

## Decisions (previously Open Questions — all resolved)

1. **Re-launchable tours** — **Yes.** Both tours need a permanent way to replay later (e.g. a "Replay Tour" link in Settings). Exact placement TBD at build time.
2. **Add Passage demo** — **Add and keep** the second passage; no need to remove it mid-tour since the entire demo study is wiped at completion anyway.
3. **Typing animation vs instant fill** — **Instant fill.** Fields and demo notes populate immediately, then get highlighted.
4. **Progress tab demo data** — **Rich seeded fake data**, not just the one real demo study — multiple temp studies, a multi-day streak, varied tool runs, several books — to actually show what the tab looks like populated. All wiped alongside the rest of the tour data at cleanup.

---

## Feature: Update Available Banner (standalone, independent of Tours A/B)

**Decided mechanism:** Re-fetch `index.html` (cache-busted with `?t=`+timestamp) on app load and on tab-focus-regain, extract `CHANGELOG[0].version`, compare to the currently running version. Chosen over a separate `version.json` because it reuses the version bump already done on every delivery — no new file to remember on deploy.

**Behavior:**
- Newer version detected → show a small dismissible banner (not a forced reload): *"A new version is available" — Refresh Now / Skip*
- **Refresh Now** → reload the page
- **Skip** → dismiss for that specific version only (stored in localStorage), so the user isn't nagged again for the same release but *will* be prompted the moment a genuinely newer version ships. Lets a tester finish or back up their current study before updating.
- Retires the existing separate `APP_VER` constant (Section 29) in favor of `CHANGELOG[0].version` as the single source of truth — currently two disconnected version numbers exist, this consolidates to one.
- Default check frequency: page load + tab visibility regain. No interval polling unless requested later.

---

## Build Order (proposed)

1. Update Available Banner — smallest, most contained, no demo-data complexity
2. Tour A — First Study walkthrough
3. Tour B — Settings walkthrough

---

## Build Notes

- Coach-mark engine: dimmed overlay + arrow pointing at the real DOM element + message bubble + Next/Back/Skip + progress dots — same visual language across both tours
- Tour script must drive real `navTo()` calls between tabs as steps progress, not just overlay different messages
- Demo study/word need an internal marker (e.g. `_tourDemo: true`) for reliable cleanup
- Both tours are independent of FBI-1 Phases 1–2 (Avatar chat, contextual highlighting) — no Groq calls required for either tour
