# Session Handoff — May 31, 2026 (Session 1)

> **Archive note:** Reconstructed from conversation summary.

## Session Summary
Bible translation expansion spec + cornerstone verse framework established for entire Arché suite.
Codex bug fix. CSBC discussion.

## What Was Done

### Bible Translation Spec
- Current: 5 fetchable translations (YLT, ASV, KJV, WEB, ESV via bible-api.com)
- Added: Darby via existing bible-api.com route (flag flip only)
- Added: 6 via new api.bible Worker endpoint: NKJV, NET, AMP, CSB, NLT, MSG
- NASB, NIV, RSV, HCSB confirmed unobtainable for free
- Public app path: users supply own api.bible key directly

### Cornerstone Verses (LOCKED — NASB, no substitutions)
| App | Verse |
|---|---|
| Arché suite | John 1:1 |
| Pilgrim | 2 Timothy 2:15 |
| Scribe | Ezra 7:10 |
| Codex | James 1:22 |
| Waypoint | Excluded |

Luke 24:32 NASB reserved/unassigned.

### Codex v2.0.5
- AI FAB button overlap with media player fixed on desktop/tablet
- Bottom offset: 24px → 88px in ≥900px media query

## Pending Carried Forward
- Pilgrim v4.9.23: Darby flag flip + 2 Tim 2:15 NASB splash swap
- Pilgrim v4.9.24: api.bible endpoint (blocked — needs api.bible key)
- Codex: curriculum patches (M3L4, M4L3, M5L2) + DEV_UNLOCK → false
- Pilgrim Task 5: Live Discord end-to-end test

---
*Archived to docs/handoffs/ — June 26, 2026*
