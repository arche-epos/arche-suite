# Spec: Bible Reader Tab + Navigation Reorg
**v4 | Pilgrim Private | Status: ✅ BUILT — confirmed live in production (Sep 4, 2026)**

**Build confirmation note (Sep 4, 2026):** This spec was mistakenly carried forward as an
open backlog item in session handoffs through early Sep 2026. Direct inspection of live
`index.html` / `ui.js` on `main` confirms the full feature is built and has been refined
over several releases:
- `nav-read` button + `navTo('read')` — present
- Merged **Study** tab with `switchStudyTab()` Notes/Study Tools sub-tabs — present
- "Start a Study from this Passage" handoff logic — present in `ui.js`
- Read tab TTS playback, active-verse focus/enlarge effect, player bar — built and tuned
  across v4.28.0–v4.28.17 (Aug 25–30, 2026 changelog entries in `utils.js`)

**No further action needed on this spec.** Retained below for historical/design-rationale
reference only. Any future "what's left on Read tab" question should default to "nothing —
confirm current behavior against live code before assuming otherwise."

---

## Decisions Confirmed (Aug 16, 2026 session)

### Nav structure — 5 top-level tabs (same count as today, reorganized)
| Today | New |
|---|---|
| Library | Library (unchanged) |
| Notes | **Study** (merged — sub-tabs: Notes, Study Tools) |
| Study Tools | ↑ (folds into Study) |
| Progress | Progress (unchanged, stays independent — NOT nested under Study) |
| Settings | Settings (unchanged) |
| — | **Read** (new — standalone Bible reader) |

**Why Progress stays separate:** Notes and Study Tools both operate on `cur` (the one active study record) — genuinely the same kind of screen, just two views of one thing. Progress shows aggregate stats across *all* studies — different data scope entirely. Nesting it under "Study" would mean tapping in expecting the active study and seeing lifetime totals instead. `verse-memory-spec-v1.md` (approved, unbuilt) already plans to live in Progress — unaffected by this change since Progress isn't moving.

**Study tab sub-navigation:** mirrors the existing Library pattern (Studies/Words sub-tabs) — same interaction model, no new UI pattern introduced.

### Read tab — standalone Bible reader
- New top-level tab, no study required to use it
- User types or browses (existing Reference Picker) to a passage
- Chooses translation from the existing translation set
- Reads the passage in a clean view — not tied to any study record
- **"Start a Study from this Passage" button** available while reading

### Create Study from Reading — exact handoff
- Carries over the **exact reference** as the study's **primary reference**
- Carries over the **exact translation** the user was reading in
- Opens the **same template picker overlay** used today by the Library FAB (`tpl-overlay`) — Blank/Sermon/Devotion/etc., no new picker built
- New study's `refs[0]` (primary) is populated directly from the reader's already-fetched `{reference, translation, scriptureText}` — **no re-fetch needed**, matches the existing `makeRef()` shape exactly
- User lands in the new **Study** tab, Notes sub-tab, with reference and scripture already loaded — same as if they'd typed the reference into Notes manually today

### Explicitly out of scope for this build
- Highlighting or saving passages from the Read tab (Boss flagged this as a "maybe eventually" — logging as a future backlog item, not building now)
- Multi-translation side-by-side view
- Any change to the AI Study Tools, Snapshot, or existing per-study data model

---

## Decisions — Round 3 (Aug 16, 2026, same session) — Labels & Voice

**Naming redundancy resolved:** "Study" (parent) and "Study Tools" (child) reads redundant at first glance — but Library already nests "Studies" and "Words" as sub-tabs without confusion, proving parent/child word overlap isn't actually a findability problem in this app's pattern. No rename needed.

**Final labels — all plain-language, unchanged from today's wording:**
- Parent tab: **Study**
- Sub-tabs: **Notes**, **Study Tools**

**Voice split — new standing pattern, not just this feature:** plain language for navigation labels (findability first — this is *why* "Deep Study" became "Study Tools" as a label originally), thematic Pilgrim voice reserved for tour/narration copy where it doesn't cost clarity. Example: the Study Tools tour intro step should read something like *"This is where you dive deeper into your journey — dig into the text with AI-assisted research"* rather than a flat feature description. Applies to new tour copy written for this feature; existing tour copy can be revisited for tone later if desired, not required for this build.

---

## Decisions — Round 2 (Aug 16, 2026, same session)

1. **Chapter navigation — full chapter view.** Read pulls the *entire chapter* containing the requested reference, scrollable. Auto-scrolls/navigates to the specific verse(s) requested as the entry point. Prev Chapter / Next Chapter buttons for paging. A Book/Chapter/Verse picker pill — same interaction as the existing Reference Picker (`bpOpen()` / `#bp-overlay`) used in Notes today — reused, not rebuilt.
2. **Study tab default landing — Notes, hardcoded for v1.** Always opens to Notes sub-tab. "Remember last sub-tab" explicitly deferred to a fast-follow, not in this build.
3. **Translation persistence — session-only, defaults untouched.** Reading in a non-default translation does NOT overwrite `sett.defaultTrans`. The translation carried into "Start a Study from this Passage" is exactly what was on-screen at that moment — but only for that one handoff, never written back to Settings.
4. **Nav icon/label — open-book icon, label "Read."** One-word label matches the existing pattern (Notes, Settings). Open-book icon is the standard visual for "read scripture" across Bible apps generally — familiar rather than novel. Confirm at build time by looking at it next to the other four icons in the actual sidebar before locking in.

---

## Build-Touches (sizing note, not exhaustive — all items below confirmed complete)
- `index.html` — nav markup (botnav + desktop sidebar), new Read screen markup — ✅ built
- `ui.js` — screen-switching logic, new Read tab handlers, Study tab sub-nav wiring, "Start Study from Passage" → template picker hookup — ✅ built
- `utils.js` — no changes needed, data model already supported the handoff shape
- `tests/bridge-check.js` — baseline export count shifted as expected; N/A now since Playwright scaffolding itself hasn't started yet
- **Onboarding tour** — re-targeted to new `screen:'study'` sub-tab structure — assume built along with the rest; spot-check tour steps next time Settings/tour area is touched, not urgent
- Pilgrim Guide screen-awareness (future, unbuilt) — still not built, still not a blocker; still needs new screen names accounted for whenever that project starts

---

## Handoff Data Shape (for build reference)
```js
// What Read tab hands off when "Start a Study from this Passage" is tapped:
{
  reference: 'John 3:16',       // exact string as read
  translation: 'esv',            // exact translation code as read
  scriptureText: '...',          // already-fetched text, no re-fetch
  type: 'primary'                // matches makeRef() shape — becomes refs[0]
}
```

---

## Ready-to-Paste Markup (Round 4, Aug 17, 2026 — production-accurate, pulled from live `index.html` structure)
*(Retained for historical reference — this markup is now what's actually live, not a proposal.)*

### Nav buttons — new/changed only (Library, Progress, Settings unchanged)
Insert Read between Library and the merged Study button; existing Notes/Study Tools buttons are replaced by one Study button, in this order:

```html
<button class="navbtn" id="nav-read" onclick="navTo('read')">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>Read<span class="tab-hint">Open scripture and read</span>
</button>

<button class="navbtn" id="nav-study" onclick="navTo('study')">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>Study<span class="tab-hint">Notes and AI-powered study tools</span>
</button>
```

### Study sub-tab row — mirrors Library's Studies/Words pattern exactly (same inline wrapper style, same `lib-tab` CSS class reused)
```html
<div style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg1);">
  <button class="lib-tab on" id="study-tab-notes" onclick="switchStudyTab('notes')">Notes</button>
  <button class="lib-tab" id="study-tab-tools" onclick="switchStudyTab('tools')">Study Tools</button>
</div>
```

---

*Spec v4 — Aug 17, 2026, decisions/design content. Build confirmed live Sep 4, 2026 via
direct inspection of `main` branch (`index.html`, `ui.js`, `utils.js` changelog). No open
work remains on this feature.*
