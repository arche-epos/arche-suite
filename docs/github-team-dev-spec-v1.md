# GitHub Team Development Spec
## Jesse Caldwell — Arché Study Tools
### Working with a team as developer and project lead
*June 6, 2026*

---

## Part 1 — The Mental Model

You are simultaneously two things on this project:

**Developer** — you write and deploy code alongside Matt and Ashley.

**Project Lead** — you are the gatekeeper. Nothing hits `main` without your approval. You set the standards, resolve conflicts, and make final calls.

These two roles can conflict. When they do, the lead role wins. Your job is not to write the most code — it is to ship a product that works.

---

## Part 2 — Branch Structure and Ownership

```
main          ← live site. Sacred. Nobody touches directly.
  └── dev     ← staging. Always deployable. PRs merge here first.
        ├── feature-name/jesse
        ├── feature-name/ashley
        └── feature-name/matt
```

**Rules:**
- Nobody commits directly to `main` or `dev` — ever. All work happens on personal branches.
- Branch names follow the pattern: `what-you-are-doing/yourname`
  - Good: `lexicon-save-fix/ashley`, `tag-migration/matt`, `snapshot-rename/jesse`
  - Bad: `fix`, `update`, `new-branch`
- One branch per feature or fix. Don't bundle unrelated changes into one branch.
- Delete your branch after it merges. Keep the repo clean.

---

## Part 3 — The Commit

A commit is a saved checkpoint. Think of it like a save point in a game — it should represent one complete, coherent thought.

### Commit Message Format

```
type: short description (under 60 chars)

Optional: one or two sentences of context if needed.
```

**Types:**
- `fix:` — bug correction
- `feat:` — new feature or capability
- `refactor:` — restructuring without behavior change
- `style:` — visual/CSS only
- `chore:` — version bump, file rename, cleanup

**Examples:**
```
fix: repair tag bg color for custom-added tags
feat: add word study save sheet overlay
fix: correct SK_TAB_HINTS missing declaration
style: update nav labels to Notes/Study Tools/Progress
chore: bump to v4.0.1
```

**Rules:**
- One commit per logical change. Don't commit 10 things at once.
- Never commit broken code. If it doesn't pass syntax check, don't commit it.
- Never commit with a message like "update", "fix stuff", or "changes". Future-you will hate present-you.
- Always include the version number in the commit message when bumping.

---

## Part 4 — Pull Requests

A Pull Request (PR) is a formal request to merge your branch into `dev` (or `dev` into `main`). It is also the primary communication tool for code review.

### Opening a PR

1. Push your branch to GitHub
2. GitHub will prompt you to open a PR — click it
3. Fill out the PR template (see below)
4. Assign Jesse as reviewer
5. Do not merge your own PR

### PR Description Template

```
## What this does
One paragraph. What changed and why.

## How to test
Step-by-step instructions for the reviewer to verify it works.
Example: "Open Settings → add a new tag → confirm the color
renders correctly on the tag chip."

## Files changed
- index.html (or Pilgrim-Private.html)

## Version
v4.0.2

## Related issue or context
Link to any Discord message, spec doc, or prior conversation
that requested this change.
```

### PR Rules
- Keep PRs small. One feature or fix per PR. Easier to review, easier to revert.
- Never open a PR with more than one file unless they are inseparable.
- If your PR is blocked on someone else's work, say so in the description.
- Don't ping for review in the first 30 minutes — give the reviewer time to get to it.
- Address every review comment before re-requesting review.

---

## Part 5 — Code Review (Your Role as Lead)

When Matt or Ashley opens a PR, you are the reviewer. This is one of your most important jobs.

### What to look for

**Correctness** — Does it do what the description says?

**Scope** — Did they change only what they said they would? If the PR touches 15 things when it was supposed to touch 1, send it back.

**Syntax** — For single-file HTML: always run `node --check` on the extracted script before approving. This is non-negotiable.

**Conflicts** — Does this change overlap with something you or another dev are working on? Catch it here before it causes problems.

**Version bump** — Did they update the version constant and the changelog entry?

### How to leave good review comments

Be specific and actionable. Don't just say "this is wrong."

```
❌  Bad:  "This doesn't work"
✅  Good: "renderWordList() is called before libTab is declared on
           line 3341 — move the var declaration above this function
           or it will throw a ReferenceError on first load."
```

**Comment types on GitHub:**
- **Comment** — observation, no action required
- **Request changes** — must be addressed before merge
- **Approve** — ready to merge

Use "Request changes" freely. It is not personal. It is your job.

### Tone as a leader
- Be direct and technical in review comments, not vague.
- Separate the code from the person. "This function is missing a closing brace" not "you forgot a brace."
- If you reject a PR, explain specifically what needs to change to get it approved.
- Acknowledge good work. If Ashley ships a clean fix, say so.

---

## Part 6 — Not Stepping on Each Other

This is where single-file HTML apps create unique friction. The entire app is one file. If two people edit it simultaneously, one person's work gets overwritten.

### The Assignment System

Before anyone starts work, they claim it:

1. Use GitHub Issues (or Discord) to declare what you're working on
2. Example: "I'm taking the tag color bug — tag-color-fix/ashley"
3. No one else touches that area until the PR is merged

### Areas of the file (for coordination)

When claiming work, be specific about what section:

| Area | Rough location |
|---|---|
| CSS | Top of file, lines 1–400 |
| HTML — Library/Nav | Lines 380–540 |
| HTML — Field/Study Tools | Lines 540–720 |
| HTML — Settings | Lines 713–930 |
| HTML — Overlays/Modals | Lines 930–1225 |
| JS — Core vars/storage | Lines 1225–1400 |
| JS — Study/tag functions | Lines 1400–1800 |
| JS — Render/UI functions | Lines 1800–2500 |
| JS — AI/Groq functions | Lines 2500–3200 |
| JS — Lexicon/word saver | Lines 3200–3600 |
| JS — TTS/Snapshot/Diag | Lines 3600–4200 |

If two PRs touch the same section at the same time, there will be a conflict. Coordinate in advance.

### Merge conflicts — what to do

If GitHub says your PR has a conflict:
1. Don't panic and don't try to resolve it in the GitHub UI
2. Tell Jesse — the lead resolves merge conflicts, not individual devs
3. The lead will manually reconcile both changes into a clean file

---

## Part 7 — The Deployment Flow

```
1. Work on what-you-are-doing/yourname
2. Open PR → dev
3. Jesse reviews and approves
4. Merge to dev
5. Jesse downloads from dev, opens locally, smoke tests
6. If clean: Jesse opens PR → dev into main, approves, merges
7. Live site updates
```

Steps 5–7 are Jesse's responsibility. Matt and Ashley's job ends at step 4.

**Smoke test checklist (Jesse runs this before every main merge):**
- [ ] App loads without console errors
- [ ] Library renders studies
- [ ] Can create and open a study
- [ ] Settings loads with no raw HTML visible
- [ ] AI tools section shows correct names
- [ ] Tag creation renders with correct color
- [ ] Version number updated in footer and changelog

---

## Part 8 — Communication Standards

### In PR descriptions and comments
- Write for someone who hasn't seen the code in two weeks
- Always include the version number
- Always include how to test

### In Discord (#pilgrim-feedback or dev channel)
- Claim your work before starting: "Taking X — will open PR today"
- Flag blockers immediately: "Waiting on Y to merge before I can start Z"
- Don't go silent for more than a day on an open PR

### Version bumping ownership
- Jesse owns the version number
- Matt and Ashley bump the patch version on their PRs (e.g. v4.0.1 → v4.0.2)
- Jesse approves and can override the version number if needed

---

## Part 9 — What Jesse Never Delegates

These decisions always stay with you, Boss:

- What merges to `main`
- Version numbering and naming
- Cornerstone verse assignments
- Any change to the arche-proxy worker
- Storage key naming (`SK_*`)
- Anything touching user data structure (study schema, tag schema)
- Theological content and scripture handling standards

---

## Part 10 — Getting Matt and Ashley Set Up

> ✅ **Status (June 18, 2026):** Matt and Ashley already have collaborator access on
> Pilgrim Public. This section is kept as reference for onboarding any future
> collaborator, or if access needs to be re-granted after the `arche-suite` repo
> migration (worth double-checking their access carries over post-migration).

1. **Invite as collaborators** — Repo → Settings → Collaborators → Add → their GitHub usernames. Give them **Write** access (not Admin).
2. **They cannot merge to `main`** — the branch protection rule handles this automatically.
3. **First PR walkthrough** — have each of them open a small, low-stakes PR first (e.g. a changelog entry or comment update) so they learn the flow before touching real features.
4. **Share this doc with them** — these are the team standards, not just Jesse's preferences.

---

*GitHub Team Dev Spec v1.1 — Arché Study Tools — June 6, 2026*
