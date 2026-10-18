# Session Handoff — Oct 2, 2026 — v4.46.3 (Look Up Word: AI Explanation retired)

**Read order next chat:** SESSION-BOOT.md → this file → claude/session-handoff-oct01-2026-ot-verse-map-wordstudy-v4-46-2.md → ways-of-working.md → spec for the active item.

## State
- Pushed: **pilgrim-private v4.46.3** (`92d7d43` on arche-epos/arche-suite main; base v4.46.2 = `f73f19c`). **Live deploy and UI NOT verified**: the built-in browser was disconnected this turn (remote-devices tools gone), so no live poll and no live test. First thing next chat: poll live utils.js for 4.46.3, then test Look Up Word.
- Changelog label "Latest — untested" (phone untested). Still pending on Boss's phone: v4.42.2 hot patch, Interlinear, Settings > About > Check for updates, Word Study / Snapshot, Word Study on OT passages (Psalm 51:1-3, Joel 2:28-32), and now Look Up Word.

## What shipped (v4.46.3) — open item 4 resolved: GROUND
- `_lexFullLookup` (studyTools.js) no longer calls `/groq`. The AI "Explanation" paragraph is gone; results are fixed Strong's data (word, translit, definition, derivation, KJV renderings, occurrences with KJV text). `scholarlyEntry` is set to '' for new lookups.
- `renderLexiconEntry`: the "Explanation" section already skipped when empty; the footer now mentions AI-written text only if a saved Explanation exists.
- Already-saved words keep their Explanation exactly as saved (nothing rewritten). No saved-word format, setting, sync, or backup change, so no Data Safety Warning was issued.
- Tour text (two steps in ui.js) no longer promises "scholarly notes"; help reference updated; ?v= cache-busters 4.46.3.
- Checks: node --check all modules OK; versemap 24 pass, morph 27 pass. The search itself (gloss index -> sense picker -> full lookup) was not modified beyond removing the AI call.

## Remaining open items
5. Pilgrim Guide data lookups (bible_lookup envelope): talk first; amend spec-pilgrim-guide-conversational-v1.md after. Note: it can reuse the Look Up Word data path (gloss index, dictionary, occurrences).
6. Background audio (claude/spec-background-audio-v1.md).
7. NT versification audit.
8. /groq lockdown: remaining AI surfaces are now Historical, Cultural, Places & Geography only (Word Study search box grounded). Lockdown can lift once those are retired or grounded.
9. Doc cleanups: data/README.md "credit line still needs to be added"; claude/spec-bible-tools-v1.md §6 stale.
