# Pilgrim Private — Code Organization & Commenting Plan
**Prepared for:** Jesse Caldwell
**Date:** June 13, 2026
**Version targeting:** Pilgrim Private v4.9.33 and forward

---

## The Problem — In Plain English

Pilgrim has been built incrementally across many development sessions over several months. The app works well, but the code behind it is organized the way a garage looks after a busy year — everything has a place, but it's the place it landed, not the place it belongs.

This was fine when it was one developer (you + AI). It becomes a real problem the moment a second or third developer opens the file. A developer reading code for the first time forms their mental map of the app from top to bottom. If what they find doesn't match what they expect, they slow down, make assumptions, and sometimes make mistakes.

**Three concrete examples from Pilgrim right now:**

**1. The light switch is at the end of the hallway.**
The two most-used functions in the entire app — the pop-up notification system and the "close any window" function — are currently defined near the very end of a 4,900-line file. They're used hundreds of times before they're ever defined. It works (JavaScript allows this), but every developer who reads it will stop and wonder why.

**2. The front door opens into a storage closet.**
The very first functions a developer reads are the Tag management system — the colored labels you put on studies. Tags are a useful but minor feature. A developer coming in cold expects to see the core of the app first: how studies are loaded, opened, saved, and deleted. Instead they get Tags. It's disorienting.

**3. The utility drawer has no drawer.**
Every app has a set of small helper tools used everywhere — things like "format this date," "clean up this text," "show a brief notification." In a well-organized codebase these live together in one place near the top, labeled clearly. In Pilgrim right now, they're scattered across four different locations throughout the file. A developer looking for the date formatter has to search for it instead of knowing where to look.

---

## What the Fix Looks Like

The goal is a file that reads like a well-organized manual: foundational pieces first, core features in the middle, secondary features toward the end.

**The proposed order (plain English):**

| Order | Section | What lives here |
|---|---|---|
| 1 | Configuration | App settings, storage key names, tool labels |
| 2 | App State | The app's live data: current study, settings, flags |
| 3 | Utilities | Small helpers used everywhere: date formatting, notifications, text cleaning |
| 4 | Storage | Read/write to device storage; save and load |
| 5 | Editor Setup | Quill rich-text editor initialization |
| 6 | Navigation | Moving between tabs and panels |
| 7 | Study Data Model | What a study looks like; migration; reference handling |
| 8 | Study Core (CRUD) | Create, open, save, delete, duplicate studies |
| 9 | Library | The study list view; Stats tab; Word List tab |
| 10 | Field Notes Panel | The note-taking panel; header, scripture toggle |
| 11 | Bible API | Fetching scripture from external APIs |
| 12 | Study Tools Panel | AI tools panel; scope; tool buttons; AI result display |
| 13 | Study Snapshot | Running all 6 tools at once |
| 14 | Text-to-Speech | All listen/pause/resume/restart logic |
| 15 | Lexicon & Word List | Word lookup, save, and display |
| 16 | Resources & OCR | Photo capture, document upload, text extraction |
| 17 | Tags | Tag CRUD, color management, tombstone sync |
| 18 | Export / PDF | PDF generation and export options |
| 19 | Backup & Import | Full data export and import |
| 20 | Share & Deep Links | Share app, share study link |
| 21 | Settings | All settings read/write |
| 22 | Sync | Gist-based cloud backup and restore |
| 23 | Book Picker | Reference entry picker UI |
| 24 | Onboarding | First-run walkthrough and tab hints |
| 25 | Diagnostics & Feedback | Test panel, feedback submission |
| 26 | App Startup | Initialization and event listeners |
| 27 | Changelog | Version history data |
| 28 | Service Worker | Cache management |

No features change. No user-facing behavior changes. Only where the code lives in the file.

---

## The Commenting Standard

Once each section is in its final home, every section gets two levels of documentation:

**Level 1 — Section Banner**
A clearly visible divider at the top of each section that names it and describes its purpose in 1–2 sentences.

```
// ════════════════════════════════════════════════════════
// SECTION 08 — STUDY CRUD
// Create, open, save, delete, and duplicate studies.
// All functions that read or write the core study object
// live here. Entry point: openStudy(). Save path: saveStudy().
// ════════════════════════════════════════════════════════
```

**Level 2 — Function Comment**
Immediately above each function, a short description of what it does, what it expects, and any important warnings.

```javascript
/**
 * Opens a study by ID and navigates to the Field Notes tab.
 * Sets the global `cur` variable to the selected study.
 * @param {string} id - The unique study ID from the studies array.
 */
function openStudy(id) { ... }
```

---

## The Plan — Phased Approach

Rather than reorganize everything at once (risky), we work through it in stages, session by session. Each phase is self-contained and safe to ship independently.

| Phase | Work | Risk Level |
|---|---|---|
| 1 | Move `toast()`, `toastSuccess()`, `closeOverlay()` to top | 🟢 Very Low |
| 2 | Create Utilities section; gather all scattered helpers | 🟢 Very Low |
| 3 | Consolidate Study CRUD (move delete + duplicate next to open/save) | 🟡 Low |
| 4 | Separate Bible API into its own section | 🟡 Low |
| 5 | Consolidate Lexicon (two zones → one) | 🟡 Low |
| 6 | Move Tags from first position to correct position | 🟡 Low |
| 7 | Move SK_OB and SK_TAB_HINTS constants to top; add all banners | 🟢 Very Low |

After all phases: comment each section with banners + function JSDoc.

Each phase gets a version bump. Each version gets deployed before the next phase starts.

---

## Roles

| Role | Responsibility |
|---|---|
| Jesse (you) | Approve this plan; approve each phase before it ships; make final calls on any structural questions |
| Claude | Execute each phase; syntax-check every change; deliver the file |
| Matt & Ashley | Informed, not consulted — hold open branches until each phase is complete; flag if a reorganized section breaks something they depend on |

---

## What This Is Not

- This is **not** a rewrite. Zero logic changes.
- This is **not** optional once collaborators are writing code regularly. The longer we wait, the worse the merge conflicts get.
- This is **not** a one-session job. Estimated 4–6 sessions to complete all phases and commenting.

---

## Decision Needed From You

1. **Approve the section order** — does the 28-section structure above make sense to you at a high level?
2. **Approve the phase plan** — start with Phase 1 today?
3. **Approve the commenting standard** — the two-level approach above (banner + JSDoc per function)?

*Once you approve, Phase 1 can start in the same session.*

---

*Pilgrim Private Code Organization Plan v1 — June 13, 2026*
