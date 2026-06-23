# Scripture Graph — Node-Graph Bible Connection Tool
**Spec v1 | Issue #3 | Status: Approved for future build**

---

## Concept
An Obsidian-style node-graph tool for visualizing connections between Bible verses, passages, and topics. Dual delivery: a lightweight version inside Pilgrim, and a full standalone app in the Arché suite.

---

## Product Strategy
- **Pilgrim version** — DIY only, anchored to existing studies, lives in Progress tab or dedicated mode. Proof of concept. Silent advertisement for the standalone.
- **Standalone app** — Full-featured tool at `archestudytools.com/scripture-graph/`. Curated maps, rich connections, full Cytoscape.js feature set. Its own identity in the Arché suite.
- These are not competing products. Pilgrim version surfaces the concept to users already in study mode. Standalone serves users who want the full mapping experience.

---

## Build Order
1. Build standalone as a single-file HTML app first
2. Slot into Pilgrim as an ES Module to test feel (requires ES Modules migration — see Issue #8)
3. After real-world testing, confirm whether Pilgrim version stays or is cut
4. Ship standalone regardless of Pilgrim decision

---

## Pilgrim Version — Scope
- **Mode:** DIY only (no curated maps)
- **Node types:** verse reference (e.g. "John 3:16") OR topic/theme (e.g. "Redemption")
- **Connections:** labeled line between any two nodes; optional short note on each connection
- **Study link:** nodes can be linked to an existing Pilgrim study (one tap from the node)
- **Data:** localStorage; included in JSON backup; Gist sync added post-ES Modules
- **Placement:** Progress tab (replaces streak mechanic; fits "reflection of study done" positioning)
- **Library:** lightweight custom canvas renderer (no Cytoscape in Pilgrim version)

---

## Standalone Version — Scope
- **Modes:** DIY (user-built maps) + Curated (pre-built thematic maps)
- **Curated maps:** built by Jesse or trusted sources; not AI-generated; examples: Covenant, Messianic Prophecy, The Names of God, The Kingdom of God
- **Node types:** verse reference, topic/theme, person, place
- **Connections:** labeled line + rich note field
- **Data:** localStorage + Gist sync (own Gist key, separate from Pilgrim studies)
- **Library:** Cytoscape.js (lazy-loaded; purpose-built for node/edge graphs, good touch support)
- **URL:** `archestudytools.com/scripture-graph/`
- **Auth:** none (public tool); PIN gate if private data warranted in future

---

## Node Data Model
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

## Edge Data Model
```json
{
  "id": "uuid",
  "from": "node-id",
  "to": "node-id",
  "label": "fulfilled by",
  "note": "Optional longer explanation"
}
```

---

## Key Design Principle
The graph is a **reflection of study already done**, not a gamification layer. Nodes grow richer as studies deepen. This aligns with Pilgrim's intrinsic motivation profile and avoids the extrinsic motivation trap of streak-based mechanics.

---

## Deferred to Phase 3
Full spec for standalone curated map content, collaborative maps, and export features to be written when standalone build begins.

