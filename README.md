# Arché Suite

Bible study, prayer, worship, and discipleship tools for the church.

---

## Apps

| App | Folder | Status |
|---|---|---|
| Pilgrim Public | `pilgrim-public/` | Active |
| Pilgrim Private | `pilgrim-private/` | Active — ES Modules migration complete |
| Pilgrim Admin | `pilgrim-admin/` | Active (Boss-only analytics dashboard) |
| Scribe | `scribe/` | Active |
| Codex Arête | `codex/` | Active |
| Mentor | `mentor/` | Active — POC |
| Prayer | `prayer/` | Planned |
| Worship | `worship/` | Planned |
| Teacher | `teacher/` | Planned |

---

## Branch Strategy

```
main          ← live (protected — no direct commits)
dev           ← staging + ES Modules work
jesse/feature ← Jesse feature branches
ashley/feature← Ashley feature branches
matt/feature  ← Matt feature branches
```

## Rules
- No direct commits to `main` or `dev`
- All work on personal branches → PR to `dev` → Jesse reviews → merge to `main`
- Single file per PR unless inseparable
- `node --check` required before every delivery
- Version bump on every commit

---

*Arché Suite — arche-epos/arche-suite*