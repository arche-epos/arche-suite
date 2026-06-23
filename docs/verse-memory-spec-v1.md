# Verse Memory Mode — Spaced Repetition
**Spec v1 | Issue #1 | Status: Approved for future build**

---

## Concept
A spaced repetition system for memorizing Bible verses. Integrated into Pilgrim — lives in the Progress tab. Replaces the streak mechanic (research confirms streaks are extrinsic motivation and counterproductive for intrinsically motivated Bible study users).

---

## Adding Verses to Memory Bank
Two entry points:
1. **From a study** — "Add to Memory" button appears on any verse in the scripture panel. One tap adds reference + text to the memory bank.
2. **Manual entry** — In the Memory section of the Progress tab, user can type any reference and verse text directly.

---

## What Gets Memorized
Both the **reference** (e.g. "John 3:16") and the **full verse text**.

---

## Review UI
1. Show the **reference** (e.g. "John 3:16 — ESV")
2. User recalls the verse text:
   - **Type it** — free-text input field
   - **Speak it** — microphone button (Web Speech API); transcribes and fills input; critical for mobile users
3. User self-rates recall on 4 buttons: **Hard / Okay / Good / Easy**
4. Next interval calculated and verse scheduled

---

## Algorithm — Lightweight SM-2
Based on SM-2 (the algorithm behind Anki). Simplified for non-technical users — they only see the 4 rating buttons, never interval numbers.

| Rating | Interval behavior |
|---|---|
| Hard | Reset to 1 day |
| Okay | 1 day |
| Good | Previous interval × 1.5 |
| Easy | Previous interval × 2.5 |

Starting intervals: 1d → 3d → 7d → 14d → growing from there.
An ease factor per verse adjusts over time based on rating history.

---

## Progress Tracking (Progress Tab)
- **Due today** — count of verses due for review; badge on Progress tab nav item
- **Verses mastered** — count of verses with interval > 30 days
- **Review history** — calendar heatmap of review activity (replaces AI Tools Run — confirmed useless metric)
- **Streak** — removed entirely (see above)
- **Banner on app open** when verses are due: "You have 3 verses due for review"

---

## Progress Tab Redesign Notes
Current "AI Tools Run" stat removed. Progress tab now covers:
- Verse Memory section (primary)
- Study count, word count totals (retained)
- Scripture Graph lightweight view (see scripture-graph-spec-v1.md)

---

## Data Model
Each memory verse stored as:
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

---

## Speech-to-Text Notes
- Web Speech API (no cost, no API key, native browser)
- iOS Safari and Android Chrome both support it
- Graceful fallback: mic button hidden if `SpeechRecognition` unavailable
- Transcription fills the input field; user can edit before rating

---

## Applies To
Pilgrim Private first; port to Public after confirmation.

