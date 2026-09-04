# Spec: Training Days Feedback + Copy Report — v1

**Status:** ✅ Built — live since v32.18.0 (confirmed via Sep 1, 2026 audit; live is now
v32.28.2 as of Sep 4, 2026). Retained below as the design record, not a pending-work
tracker.
**Target file:** DPS.html (current version at time of spec: v32.17.4)
**Author:** Claude, spec session Aug 31 2026 — for handoff to a fresh implementation session

---

## 1. Problem

The Mentor/Training profile has a consistent "Feedback" pattern used in three places today: Mock Calls, Buddy, and Eval tabs. Each aggregates raw logged notes into a clipboard-copied **AI-refinement prompt** — the trainer pastes it into an AI tool (Perplexity/ChatGPT) and gets back polished prose to send along.

The **Days tab** (the 15-day curriculum checklist) has no equivalent. Each day already has a freeform notes field (📝 icon), quiz score inputs, and a topics list — but nothing aggregates that into a feedback prompt. This spec adds that missing function.

### Naming collision to be aware of
A function called `copyDaysFeedback` **already exists** in DPS.html (~line 7431), attached to a "Feedback" button in the profile header (visible above the Department Info card, not shown in the reference screenshots for this spec). Despite the name, it operates on the **top-level** `hire.doingWell` / `hire.areasOfImprovement` narrative fields — it has nothing to do with the per-day notes this spec covers.

**The new function must use a different name.** Suggested: `copyTrainingProgressFeedback`.

---

## 2. What data feeds the prompt (per day, for every day included)

For each day included in a given call:
1. **Topics covered** — from `TRAINING_DAYS[day].topics` (via `outlineDays`, which already merges in any customized outline)
2. **Quiz score** — from `hire.days[day].quizCorrect` / `quizTotal`, converted to a percentage via the existing `dayQuizPct(d)` helper. If the day has `hasQuiz===false` or no score entered, show as "no quiz" rather than 0%.
3. **Freeform notes** — from `hire.days[day].notes`. If empty, show as "No notes entered" rather than omitting the day.

Day 15's **final quiz** (`hire.finalQuizCorrect` / `finalQuizTotal`) should be appended only when day 15 is included in the range being summarized.

All 15 days (or the requested sub-range) are included regardless of completion status or whether notes exist — per Boss's direction, the goal is a complete picture, not a filtered one.

---

## 3. Two entry points, one function

### 3a. Per-day button (cumulative through that day)
- **Location:** next to the existing 📝 notes icon in each day's title row (~line 8107 area, in the day header's icon cluster alongside the HW/QZ toggle buttons and the 📝 icon).
- **Behavior:** clicking the button on Day *N* generates the prompt using **days 1 through N** (inclusive) — not just day N alone. This lets Jesse click Day 5's button mid-training and get a full-to-date update suitable for sending a supervisor that day.
- Call signature: `copyTrainingProgressFeedback(throughDay)` where `throughDay = td.day`.

### 3b. Top-level button (full 15-day picture)
- **Location:** near the existing days-complete progress bar at the top of the Days tab (~line 8095, same area as the `daysComp/daysPct` progress display). Should be **visible at all times**, not gated behind `hire.trainingDaysComplete` like the existing Final Email buttons — this needs to work mid-training for daily updates, same as the per-day buttons.
- **Behavior:** always summarizes **all 15 days**, regardless of how many are actually complete.
- Call signature: `copyTrainingProgressFeedback(15)` — i.e., the same function, just called with the max day.

Both buttons share one function; the only difference is the day-range argument.

---

## 4. Output format (assumption — confirm before/during build)

Follows the same AI-refinement-prompt pattern as `copyMockFeedback` / `copyBuddyFeedback` / `copyEvalFeedback` / `copyDaysFeedback`:
- Plain text, `navigator.clipboard.writeText(...)`, no direct polish performed by DPS itself
- Reuse the existing DISC tone-mapping logic (the `discToneMap` object already defined inside `copyDaysFeedback`, keyed by supervisor's DISC profile D/I/S/C) so the AI is told to write in a tone matching the supervisor's DISC type — same as the existing profile-level Feedback function. Worth hoisting `discToneMap` to a shared scope if it's going to be used by two functions now, to avoid duplicating the object.
- Include agent name, day range covered (e.g., "Days 1–5" or "Days 1–15, Final Quiz"), and per-day breakdown (topics / quiz % / notes) as the raw material, followed by the same kind of formatting instructions the other Feedback functions use.
- Same "copied" button-state pattern (`copiedX` state, 2.5s auto-reset) for UI consistency.

**Open question carried into build:** confirm this AI-prompt approach is correct and not a direct-send report — see conversation context. Default to AI-prompt pattern unless told otherwise at build time.

---

## 5. Days Tab — Copy Report (snapshot for email)

In addition to the Feedback function above, add a **Copy Report** button to the Days tab, matching the existing pattern on Mock Calls and Buddy Calls tabs — a direct, clipboard-ready HTML snapshot for pasting into an email. This is **not** an AI-refinement prompt (unlike Section 3's Feedback function) — it's a finished, formatted report, same category as `copyReport`, `copyMockReport`, `copyBuddyReport`.

### Reuse, don't rebuild
A `daysSectionHtml()` helper (~line 6955) already exists and is already reused inside `copyMockReport` and `copyBuddyReport`. It builds a structured HTML block: per-day topics, quiz score + badge, homework completion count. The new Days tab button is mostly assembly of existing pieces, not new logic.

**Suggested implementation:**
```
const copyDaysReport = () => doCopy(generateReportHtml(false) + daysSectionHtml(true), setCopiedDays);
```
(placed alongside the other `copyXReport` functions, using the existing `doCopy` helper pattern already used by `copyMockReport`/`copyBuddyReport`)

### Required change: notes text must be added to the report
Per Boss's direction, the report should include each day's raw freeform notes text — which `daysSectionHtml()` does **not** currently render (it only shows topics/quiz/HW).

Since `daysSectionHtml()` is shared by three existing callers (`copyReport`, `copyMockReport`, `copyBuddyReport`), **do not change its default output** — that would silently add notes text to three other reports that don't currently show it and haven't been asked to. Instead:
- Add an optional parameter: `daysSectionHtml(includeNotes = false)`
- Inside the per-day row-building loop, when `includeNotes` is true and `d.notes` is non-empty, append a notes line to that day's block (same visual pattern as the existing `fqHtml`/`csHtml` conditional lines already in that function)
- Only the new Days-tab button calls it as `daysSectionHtml(true)` — all three existing callers keep calling `daysSectionHtml()` with no argument, so their output is byte-for-byte unchanged

### Button placement
Same location as the other Days tab buttons — next to wherever the new top-level Feedback button lands (Section 3b), following the same `flash(e)` + `copiedX` state + 2.5s reset pattern used by every other Copy Report button in the file.

---

## 6. Explicitly out of scope for this pass
- No changes to the existing `copyDaysFeedback` (profile-header) function or button
- No changes to Mock Calls / Buddy / Eval Feedback functions, or their Copy Report functions' existing output
- No new storage keys, no data model changes — this reads existing `hire.days[n]` data only
- No changes to how per-day notes are entered/stored

---

## 7. Suggested version bump
Feature addition (two new user-facing functions: Feedback + Copy Report on the Days tab) → **minor** bump (e.g. v32.17.4 → v32.18.0), not a patch, since this is new functionality rather than a bug fix.
