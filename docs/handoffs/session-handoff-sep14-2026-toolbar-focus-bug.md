# Session Handoff — Notes/Conclusions/Outline Toolbar Follow-On + Focus Bug — September 14, 2026

**First thing next session:** Debug the focus-stuck bug described below (v4.34.27, still broken).
Guessing further from code alone has diminishing returns — strongly recommend getting real remote
DevTools access this time (`chrome://inspect` over USB, or Safari's Web Inspector if this ever
needs testing on iOS) so the next fix is based on watching `document.activeElement` and Quill's
actual state live, not more speculative patches.

---

## Open Bug — Focus gets stuck on Notes, Outline/Conclusions untappable (NOT fixed as of v4.34.27)

**Boss's exact description (Sep 14):**
> I can't tap out from the notes box, the side toolbar disappears and I can scroll through the
> rest of the application but the notes stays fixed and the keyboard up and then sometimes the
> keyboard will drop down. But the notes still flashes with the cursor like it's ready for typing
> and when I change tabs and try to go outlines or conclusions, I'm not able to tap in and modify
> those fields.

**Reading of the symptom:**
- Tapping outside the Notes editor does NOT reliably blur it.
- The floating rail **does** disappear on some interaction — meaning `selection-change` (or the
  new explicit `blur()` calls from v4.34.27) fires and hides it — but the Notes editor's cursor
  keeps blinking as if still focused, and scrolling elsewhere doesn't dismiss it.
- Keyboard behavior is inconsistent ("sometimes drops down") — smells like a race between Quill
  reclaiming focus and the browser's own blur/keyboard-dismiss timing.
- Switching to Study Tools (Outline/Conclusions) afterward: those fields **cannot be tapped into
  at all** — consistent with Notes still silently holding real DOM focus underneath everything.

**What v4.34.27 already tried (shipped, confirmed live, did NOT fully fix it):**
- Added `document.activeElement.blur()` at the top of `navTo()`, `switchStudyTab()`, and
  `toggleOutline()` (all three: CSS show/hide, not real navigation, so nothing was blurring the
  active field before switching).
- Added `hideAllRails()` as a belt-and-suspenders fallback alongside each blur() call.
- Confirmed via a headless jsdom + real-Quill-1.3.7 test that `initEditors()` itself runs clean
  and all three editors do become genuinely interactive `.ql-container.ql-snow` elements at
  load — so this is NOT an initialization failure, it's a focus-management issue that surfaces
  during use.

**Why the fix likely only partially worked — best guesses for next session to check first:**
1. **Quill may be reclaiming focus after blur().** Quill's core sometimes restores
   selection/focus internally (e.g. on certain internal events or if something calls
   `quill.focus()` afterward). If anything downstream of `navTo()`/`switchStudyTab()` —
   `populateField()`, `populateDeep()`, or a Quill `text-change`/`editor-change` handler —
   ends up calling `.focus()` on the Notes instance after our `blur()` runs, that would exactly
   explain "rail disappears, but cursor keeps blinking and typing still doesn't land elsewhere."
   Worth grep'ing all three editors' event handlers and `populateField()`/`populateDeep()` for
   any stray `.focus()` call, and worth adding a temporary `console.trace()` inside `_qFN`'s
   focus event to catch what's re-focusing it.
2. **`blur()` on a contenteditable region doesn't always dismiss the on-screen keyboard
   synchronously on Android** — this may explain "sometimes the keyboard drops, sometimes not"
   as a genuine timing race rather than a focus bug per se, but doesn't explain why
   Outline/Conclusions can't be tapped into afterward.
3. **Check for another un-patched show/hide path.** `toggleFnotes()` (a *different* accordion,
   `fnotes-body`/`fnotes-chev` — NOT the same as Outline's `outline-body`/`outline-chev`/
   `toggleOutline()`, which was patched) still has no blur() call. Unclear yet whether this
   flyout ever wraps a focused Quill instance, but worth checking before assuming it's
   unrelated — it uses the same class-toggle pattern as everything else that needed patching.
4. **Consider whether `blur()` is even reaching the right element.** `document.activeElement`
   inside a contenteditable region is usually the contenteditable root itself (Quill's
   `.ql-editor`), but confirm this assumption live rather than trusting it blind — if Quill nests
   focus differently than expected, `document.activeElement.blur()` might be blurring the wrong
   node entirely.

**Do not** keep iterating on this blind from the assistant side across another 3-4 speculative
pushes — the last several rounds (v4.34.25 → .26 → .27) each fixed the specific symptom reported
but missed the underlying pattern once, twice, so far. This one needs eyes on the actual live
DOM/focus state.

---

## What Shipped This Session (v4.34.23 → v4.34.27)

### v4.34.23 — Three-tier toolbar icon count (built, per Sep 13 handoff's scoped plan)
Added the large/tall-phone tier scoped in the prior session: `≤900px` width **and** `≥750px`
height now gets all 14 icons in one column, no pop-outs, instead of falling back to the compact
7-icon rail. Reused the existing trigger+flyout markup — a new `.full` class (`index.html`) hides
the 4 pop-out triggers and forces their flyouts to render inline instead of as absolute pop-outs;
pure CSS, no JS changes needed since Quill already binds to every `ql-*` button in the rail
regardless of visibility. `initEditors()` (`ui.js`) checks `window.innerHeight` alongside the
existing width check to pick the tier once at load — same one-time-at-construction pattern as the
desktop/mobile split. **Height cutoff:** settled on 750px (not the ~700px candidate from the prior
handoff) after recalculating the real button math — the tier needed for "full" turned out to be
14 buttons (Header expands to 4 direct buttons: H1/H2/H3/¶, Boss's explicit call), not 11, which
changes the required column height from ~404px to ~515px.

**Note on this push:** the empty-`sha`-from-a-shell-`source`-bug incident happened here (see MKB
worthy of a permanent lesson) — a first attempt briefly deleted all 8 pilgrim-private files from
live `main` when a shell-variable handoff between `bash_tool` calls silently failed (this
container's shell doesn't support `source`). Caught and corrected in the same turn via a second
commit before it was reported as fixed; byte-verified after. **Lesson applied for the rest of the
session:** every subsequent push used a single self-contained Python script for the full
blob→tree→commit→ref flow — no cross-call shell variable handoff.

### v4.34.25 — Two device-tested bugs fixed from v4.34.23
1. **Rail buttons not wired.** Every button was `class="ql-rail-btn ql-bold"` — Quill's
   `toolbar.js` reads the *first* class starting with `ql-` as the format, so it read
   `"rail-btn"` (not a real format) and silently never attached a click listener, on either
   tier, since the original v4.34.21 redesign. Confirmed via the actual Quill 1.3.7 source, not
   guesswork. Fixed by reordering all 42 buttons across the 3 editors (`ql-bold ql-rail-btn`,
   etc.).
2. **Rail scrolled away with the page** instead of staying visible while typing with the
   keyboard open. Relocated all 3 rails out of their editors' scrolling/`overflow:hidden`
   ancestor tree entirely (moved to the end of the document, near `.fab-wrap`) and made them
   `position:fixed`, shown only on that specific editor's own focus via Quill's
   `selection-change` event — exactly one rail floats at a time. `position:sticky` was ruled
   out: Outline's collapsible wrapper (`.fnotes-body`) has `overflow:hidden` permanently, which
   breaks sticky outright, and the MKB already documents `position:fixed`-inside-
   `overflow:hidden` losing touch events on iOS Safari as the reason `#scracts` needed the same
   kind of restructuring in the prior session. Text gets left-padding only while its own rail is
   showing (Boss's explicit call, not full-time margin).

**Also caught and fixed in this push:** a cascading changelog bug — the blanket `sed` version
bumps used for the `?v=` cache-bust strings were also silently rewriting the version *number
inside the `CHANGELOG` array itself* (sed matches any literal occurrence of the old string, not
just the query strings), which had already corrupted the v4.34.23 push's changelog with a
duplicate version number. Corrected the full historical sequence in this same push.

### v4.34.26 — Rail repositioned bottom-anchored
v4.34.25's rail was anchored just below the topbar (`top:`); on-device testing found it landed
too high with the keyboard open — part of the column sat behind/above the visible typing area.
Re-anchored to `bottom:calc(12px + var(--safe-b))` instead (Android Chrome shrinks
`window.innerHeight` when the keyboard opens, so `bottom:0` naturally lands right above it).
Added `max-height` + `overflow-y:auto` on the rail itself as a safety net for the rare case
where the full 14-icon column is taller than the space available above the keyboard on a given
device — becomes a controlled internal scroll instead of silently rendering off-screen.

### v4.34.27 — Focus-stuck-on-tab-switch fix (partial — see Open Bug above)
Diagnosed and patched the `navTo()`/`switchStudyTab()`/`toggleOutline()` missing-blur gap
described above. Confirmed via headless jsdom+Quill test that this wasn't an initialization
failure. Shipped, byte-verified, but **Boss's live retest found the underlying symptom persists**
— see Open Bug section for next steps.

---

## Files Touched Every Version This Session
Same 8 files, same lockstep `?v=` convention as always: `index.html`, `app.js`, `ui.js`, `tts.js`,
`sync.js`, `studyTools.js`, `storage.js`, `utils.js`. Functional changes this session landed in
`index.html`, `ui.js`, `studyTools.js`, and `utils.js` (changelog); the other 4 only had version
bumps.

## Commits pushed to `arche-epos/arche-suite` main this session
1. `830f561c` — v4.34.23: `feature: three-tier Notes/Conclusions/Outline toolbar...` (+ the
   emergency delete/restore pair before this, `1d33ba1e` broken → `cd3da8ef` fix, both superseded)
2. `9b2803d0` — v4.34.25: `fix: rail buttons not wired (Quill class-order bug) + rail now floats
   fixed on focus instead of scrolling away; corrected cascading changelog version-number bug`
3. `360ca3ad` — v4.34.27: `fix: navTo()/switchStudyTab()/toggleOutline() never blurred the active
   field before hiding its tab...` (v4.34.26's bottom-anchor fix was folded into this same
   sequence — see commit `9b2803d0`'s parent chain for the intermediate `.26` state)

All pushed via Git Data API, fresh-HEAD-checked immediately before each tree creation, and
byte-verified live via the Contents API after every push — every push this session verified clean
against live `main` (aside from the caught-and-corrected v4.34.23 incident above).

## Outstanding from this session
- **The focus-stuck bug is the priority** — see "Open Bug" above. Not safe to build anything
  else on top of the toolbar/rail system until this is resolved; it currently makes
  Outline/Conclusions unusable on mobile after any Notes interaction.
- **Live device testing of the format buttons themselves** (Bold/Italic/Lists/etc. actually
  applying, `.ql-active` lighting up gold) was implicitly re-covered by the class-order fix in
  v4.34.25 but hasn't had an explicit isolated confirmation independent of the focus bug — worth
  a clean checklist pass once focus is fixed.
- Nothing else new opened this session; this was a self-contained continuation of the Sep 13
  toolbar-redesign thread.
