# Arché Mentor — App Spec v1.0
**Status:** Approved for build (Phase I placeholder content)  
**Repo:** arche-epos/arche-suite  
**Path:** `mentor/index.html`  
**URL:** archestudytools.com/mentor/  
**Stack:** Vanilla JS, single-file HTML  
**Cornerstone Verse:** 1 Corinthians 11:1 (NASB)  
**Motto:** "Disciples Making Disciples"

---

## Philosophy

Every believer needs three relationships:
1. **A Paul** — mentor pouring into them
2. **A Barnabas** — peer walking alongside
3. **A Timothy** — someone they pour into

Arché Mentor serves the Paul → Timothy chain. The Teacher (Paul) disciples one or more Students (Timothy). The chain multiplies forward.

---

## Roles

### Admin
- Management only — no curriculum access
- Multiple Admins allowed
- Can create Teachers and Students
- Can assign a Student to a Teacher
- Can reassign Students at any time
- Sees two pools: **Active Pairs** and **Waiting Pool**
  - Waiting Pool: unassigned Teachers (on deck) + unassigned Students (pending assignment)
- Teachers are never removed from roster on assignment — permanent records, reusable
- A Teacher can have multiple Students (different days, different pairings)

### Teacher (Paul)
- Assigned one or more Students
- Navigates between all assigned Students from a dashboard
- Sees each Student's lesson progress, notes, and memory verse status
- Cannot mark progress on behalf of a Student
- Can exist unassigned (on deck in waiting pool)

### Student (Timothy)
- Assigned to one Teacher only
- Sees only their own content
- Marks their own lesson progress (responsibility-based)
- Can exist unassigned (waiting for a Teacher)
- Works through lessons sequentially

---

## Auth

- Cloudflare KV — same pattern as Pilgrim Private
- PIN-based login, role determined by account record
- Teacher creates Students and assigns their PINs (or Admin does)
- Single entry point — role determined after PIN entry

### KV Data Model

```
mentor:admin:{id}        → { id, name, pin, role: "admin" }
mentor:teacher:{id}      → { id, name, pin, role: "teacher", studentIds: [] }
mentor:student:{id}      → { id, name, pin, role: "student", teacherId: null|id, progress: {}, notes: {} }
```

**Progress record per student:**
```json
{
  "lesson_1": { "complete": false, "completedAt": null },
  "lesson_1b": { "complete": false, "completedAt": null },
  ...
}
```

**Notes record per student per lesson:**
```json
{
  "lesson_1": "Student's notes here...",
  ...
}
```

---

## Curriculum Structure — Phase I

10 lessons, 12 lesson sections (2 lessons have extended sections).  
All scripture references tappable — inline verse display, live translation.  
Default translation: NKJV.

| Lesson | Section | Title |
|--------|---------|-------|
| 1 | — | The Word of God |
| 2 | 2a | Salvation |
| 2 | 2b | Works of Faith |
| 3 | — | Eternal Security |
| 4 | 4a | Baptism and The Lord's Supper |
| 4 | 4b | The Local Church |
| 5 | — | The Holy Spirit |
| 6 | — | Prayer |
| 7 | — | The Will of God |
| 8 | — | Other Christians |
| 9 | — | Giving |
| 10 | — | Dealing with Sin |

### Per-Lesson Content Blocks
1. **Title + subtitle question** (e.g. "Is the Bible Reliable and Relevant in My Life?")
2. **Intro paragraph**
3. **Outline** (Roman numerals → letters → numbers, tappable scripture references)
4. **Key Point** (callout box)
5. **Basic Questions** (Q&A section)
6. **Review and Discussion** (discussion questions)
7. **Memory Verses** (3 per lesson, highlighted; future Verse Memory Mode hook)

### Phase II
Data structure placeholder only — no content this session. Will be specced when PDFs are uploaded.

---

## Features

### Student View
- Sequential lesson list — lessons unlock as previous marked complete
- Lesson reader with full outline
- Tappable scripture references → inline verse display
- Translation chooser (NKJV default)
- TTS (browser Web Speech API)
- Per-lesson notes (auto-saved)
- Memory verse display with KJV (locked — memory verse translation stays KJV)
- "Mark Complete" button per lesson (student-controlled)

### Teacher View
- Dashboard: list of all assigned Students
- Navigate between Students
- Per-Student view: all lessons with completion status, notes read-only, memory verse status
- Cannot mark progress on behalf of Student

### Admin View
- Active Pairs list (Teacher → Student(s))
- Waiting Pool: unassigned Teachers + unassigned Students (separate lists)
- Create Teacher / Create Student / Assign / Reassign
- PIN management

---

## Placeholder Content (Build Phase)

10 stub lessons using fictional "Lorem Ipsum" style discipleship content.  
Structure mirrors real lessons exactly — same blocks, same fields.  
Real content swapped in after copyright confirmation from pastor.

---

## Translation API

Same pattern as Pilgrim:
- NKJV, NET, AMP, CSB, NLT, MSG, NASB, NIV → bolls.life (no key)
- KJV, ASV, WEB → bible-api.com (no key)
- ESV → arche-proxy Worker
- Memory verses locked to KJV

---

## Infrastructure

- Auth + data: Cloudflare KV (new namespace: `MENTOR_USERS`)
- No new Workers needed for Phase I
- Single-file HTML — no build step
- Hosted via GitHub Pages under arche-suite

---

## Out of Scope (v1)

- Real-time sync between Teacher and Student
- Messaging / communication between roles
- Phase II content
- Verse Memory Mode integration (hook only)
- Mobile app

---

## Open Items

- Copyright confirmation from pastor (required before real content deploy)
- Phase II PDFs (future session)
- App icon / branding for Arché suite nav

---

*Arché Mentor Spec v1.0 — June 23, 2026*
