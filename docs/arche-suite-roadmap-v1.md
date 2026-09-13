# Arché Suite — Product Roadmap (Vision Doc)

**Captured:** Sep 13, 2026, from a structuring/naming conversation with Boss.
**Status:** Early vision — names, scope boundaries, and app count are still settling. This doc exists so the thinking doesn't live only in one chat. Update it as decisions land; don't treat anything below as locked until Boss confirms it.

---

## Open question — app count

Boss described this as "six applications" but listed seven below (including Worship). Not yet resolved whether Worship is in scope or a placeholder idea parked for later. **Confirm before treating the roster as final.**

---

## The roster, as described

### 1. Pilgrim
Existing, live, most mature app in the suite. Personal Bible study tool (Private + Public variants, PIN-based accounts, AI study tools, sync).

### 2. Warrior *(new name, new app)*
**Concept:** How to pray through Scripture, plus a prayer log.
**Status:** Not yet built. No further detail captured yet — next conversation should scope this properly (what does "praying through Scripture" mean functionally — guided prompts? verse-anchored prayers? a log entry tied to a passage?).

### 3. (Currently "Scribe" — rename pending)
**Concept:** Seminary-level study of Scripture — deeper/more academic tier than Pilgrim.
**Status:** Existing app (`archestudytools.com/scribe/`, vanilla JS), being rebranded. No replacement name chosen yet. **Note:** the current live "Scribe" app's actual current feature set should be re-audited against this "seminary-level" positioning before renaming — confirm the app already matches this description, or whether the rename comes with a scope change too.

### 4. (No name yet) — Teacher/class curriculum builder + student companion
**Concept:** Core of Pilgrim's study tools, repurposed for teachers preparing class material. Teacher builds the study ahead of time; at class time, hits a button to push/share it live; students follow along on their own phones with everything the teacher created.
**Status:** Not yet built. **Open question raised Sep 13:** this overlaps significantly with **Codex** (already live, v3.6.4 — homeschool curriculum app with per-student PIN accounts in progress, mastery gating, progress tracking). Need to resolve: is this (a) Codex evolving to add a live/synchronous "push to class" mode, (b) a new app that happens to share Pilgrim's study-tools core but serves a different context (church class vs. homeschool course), or (c) a rename/repositioning of Codex itself? **Not yet decided — flag before any build work starts here.**

### 5. (No name yet) — Scripture mapping / node-graph tool
**Concept:** Node-graph visualization of connections between Bible verses, passages, and topics — Obsidian-style. Screenshots shared Sep 13 show a working rough build: "My map" (DIY mode — add verse + short note, drag/connect) and "Curated" mode (pre-built thematic maps, e.g. the Covenant map shown: Abrahamic → Mosaic → Davidic → New Covenant Promised → New Covenant Fulfilled, with labeled connections like "confirmed," "fulfilled by," "explained by," and direct links back to a Pilgrim study).
**Status:** This is **not actually a blank slate** — it's GitHub Issue #3 ("Scripture Graph tool"), closed Sep 13, 2026 as part of narrowing the Issues tab to bugs-only, full spec preserved in `docs/future-feature-backlog.md` and originating from `scripture-graph-spec-v1.md`. That spec already covers: dual delivery (lightweight Pilgrim-embedded DIY version + full standalone app at `archestudytools.com/scripture-graph/`), Cytoscape.js for the standalone, custom lightweight canvas for the Pilgrim version, curated maps built by Boss (not AI-generated), node/edge data models, and a "reflection of study done, not gamification" design principle. **The rough build in the screenshots appears to already be a working prototype of this spec** — worth confirming whether that prototype IS the standalone app referenced in the spec, or a separate earlier experiment. Just needs a real product name.

### 6. Mentor
Existing, partially built. Discipleship / one-on-one study tool. Blocked on written copyright confirmation before public launch (per project overview).

### 7. Worship *(uncertain if in final roster — see open question above)*
**Concept:** Undefined. Something to do with worship — how to worship, what that looks like — but no concrete app concept yet.
**Status:** Idea only. Needs a dedicated scoping conversation before it's buildable.

---

## Cross-cutting notes

- **Not mentioned in this roster, but part of the wider Gizmo5332/Arché ecosystem already:** Joseph (personal finance manager) and Waypoint (personal life management) — these appear to sit outside the "Arché suite" (Bible study/ministry) framing Boss is using here, consistent with how they're already tracked separately in the project overview.
- **pilgrim-admin** (admin dashboard) isn't a numbered app in this roster either — it's infrastructure/tooling for Pilgrim, not a user-facing suite member, and presumably stays that way regardless of how the roster above shakes out.

---

## Next steps (not yet started)

1. Resolve the six-vs-seven count / confirm Worship's status.
2. Resolve Codex vs. #4 overlap — this determines whether #4 is new-app work or Codex-extension work.
3. Scope Warrior properly (currently just a one-line concept).
4. Confirm whether the Scripture-mapping screenshots are the standalone app from `scripture-graph-spec-v1.md`, and pick a real name for it.
5. Decide the new name for current "Scribe," and re-confirm its feature set matches the "seminary-level" positioning.
6. Scope Worship from scratch whenever it's picked up.

*End of doc — update in place as these get resolved, don't create a v2 unless the structure itself changes.*
