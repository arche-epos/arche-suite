# Spec: Arché Cornerstone Verses
**Status:** Locked — ready to build

> ⚠️ **Needs verification (added June 18, 2026):** Phase 1 (Pilgrim Private onboarding)
> was targeted for v4.9.23. Current live version is v4.9.73, well past that target, so
> it's likely shipped — but this wasn't explicitly confirmed in the most recent session
> handoffs. Worth a quick visual check of the onboarding step 0 screen next time Pilgrim
> Private is open. Phases 2–5 (Public, Scribe, Codex, Arché-wide) status unconfirmed.

**Created:** May 31, 2026

---

## Framework

| App | Verse | Translation | Full Text |
|---|---|---|---|
| **Arché** (suite) | John 1:1 | NASB | "In the beginning was the Word, and the Word was with God, and the Word was God." |
| **Pilgrim** | 2 Timothy 2:15 | NASB | "Be diligent to present yourself approved to God as a workman who does not need to be ashamed, accurately handling the word of truth." |
| **Scribe** | Ezra 7:10 | NASB | "For Ezra had set his heart to study the Law of the LORD and to practice it, and to teach His statutes and ordinances in Israel." |
| **Codex** | James 1:22 | NASB | "But prove yourselves doers of the word, and not merely hearers who delude themselves." |

---

## Display Rules

| Location | Display |
|---|---|
| Onboarding splash (step 0) | Full verse text + reference |
| About screen | Full verse text + reference |
| Anywhere space is limited | Reference only (e.g. "2 Timothy 2:15 NASB") |
| Global Arché branding | John 1:1 reference only unless space allows full verse |

---

## Build Order

### Phase 1 — Pilgrim Private (next session)
**Target:** Onboarding step 0
**Current step 0 text:** References John 1:1 — "In the beginning was the Word."
**Change:** Replace body text with 2 Timothy 2:15 NASB as the featured verse

**Proposed step 0 layout:**
```
✦
Welcome to Arché · Pilgrim

[verse text in italic, slightly smaller]
"Be diligent to present yourself approved to God as a workman 
who does not need to be ashamed, accurately handling the word of truth."
— 2 Timothy 2:15 (NASB)

[existing body text below, slightly condensed]
Your mobile study companion. All your notes stay on your device, always private.
```

**Version bump:** v4.9.23 (alongside Darby flag flip)

---

### Phase 2 — Pilgrim Public (during port pass)
- Same step 0 change
- Same verse, same translation

---

### Phase 3 — Scribe (own session)
- Add Ezra 7:10 NASB to Scribe's splash/about
- Scope TBD when Scribe session opens

---

### Phase 4 — Codex (own session)
- Add James 1:22 NASB to Codex's dashboard or onboarding
- Scope TBD when Codex session opens

---

### Phase 5 — Arché-wide (future)
- John 1:1 NASB as suite-level branding
- Applied to any future Arché splash, landing page, or shared about screen
- Not Waypoint — Arché apps only (Pilgrim, Scribe, Codex)

---

## Notes
- NASB is the canonical translation for all four verses — do not substitute
- Luke 24:32 NASB was considered for Pilgrim — reserved, no current assignment
- 2 Timothy 2:15 KJV ("Study to shew thyself approved") was also considered — NASB chosen for precision
- Waypoint is explicitly excluded from this system
