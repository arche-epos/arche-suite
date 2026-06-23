# Codex Arête — Full Pathway Curriculum Spec
**Version:** 1.0 | **Date:** June 13, 2026
**Status:** Approved concept — curriculum build pending

---

## Core Philosophy

Students learn a concept best when they feel the problem before they learn the solution.
Every stage transition in this curriculum is built around a "why" moment — a real limitation
the student hits that makes the next stage feel necessary, not arbitrary.

Code is written for humans, not computers. This is introduced at Foundation and reinforced at every stage.

---

## The Three Stages

| Stage | Name | Paradigm | Real-World App | Scale |
|---|---|---|---|---|
| 1 | Foundation | Single-file Vanilla JS | Pilgrim | Personal tool |
| 2 | Architecture | Single-file React CDN | DPS — one department | 30 users, one team |
| 3 | Professional | Multi-file ES Modules | DPS — whole company | 300 users, 8 departments |

**The through-line:** The student watches two real apps grow up. Pilgrim goes from a personal Bible study tool toward a multi-user platform. DPS goes from a single-department workforce tool to a company-wide system. These aren't hypothetical examples — they're production apps the student can use.

---

## STAGE 1 — Foundation
**Paradigm:** Single-file Vanilla JS
**Reference app:** Pilgrim (personal Bible study tool)
**Tagline:** *Learn to write code that works.*

### Lessons

**1. Introduction to Code**
What code is and what it isn't. How a computer reads instructions. Why web development starts with HTML, CSS, and JavaScript. What a single-file HTML app is and why it's the right starting point.

**2. Terms & Concepts**
The vocabulary of development. Variables, functions, objects, arrays, events, the DOM. What a browser actually does when it loads a file. How JavaScript makes a page interactive.

**3. Build the Foundation**
Writing your first real functions. Reading and writing to the DOM. Handling user input. Storing data in localStorage. Building a minimal working app from scratch.

**4. Basic Functions**
Functions that do one thing well. Parameters and return values. How functions call each other. The difference between a function that works and a function that's reusable.

**5. Organization, Layout & Commenting**
*This is the pivot lesson — the most important in Foundation.*
Code is written for humans, not computers. What a developer expects when they open a file for the first time. Section banners. JSDoc function comments. Why a 500-line file organized well beats a 200-line file organized poorly. Introduction to the standard section order for a Vanilla JS app.

**6. Apply It — Build Something Real**
Capstone project: build a small but complete single-file app from scratch applying every concept from Foundation. Organized from the start. Commented from the start. Deployed to GitHub Pages.

### The "Why" Moment (Bridge to Architecture)
*"Your app works and it's organized. Now imagine two other people need to work on it at the same time. Your file is 1,500 lines. What breaks?"*

---

## STAGE 2 — Architecture
**Paradigm:** Single-file React CDN
**Reference app:** DPS Daily Planner — one department (contact center workforce)
**Tagline:** *Learn to write code that's organized.*

### Lessons

**1. Why Frameworks Exist**
The problem Vanilla JS can't solve cleanly at scale: shared state, repeated UI patterns, and multiple developers in one file. What a framework is and what problem it's solving. Introduction to React — not how to use it, but why it exists.

**2. Thinking in Components**
Breaking a UI into reusable pieces. A button isn't a button — it's a component with props. How DPS is built from components. Building your first component from scratch.

**3. State Management**
How data flows through an app. Why you can't just read from the DOM like Vanilla JS. useState and how it works. The concept of "single source of truth."

**4. API Integration**
Talking to external services. What an API call is and what comes back. Handling loading states, errors, and empty states gracefully. Using the Groq API and Bible APIs as real examples.

**5. Data Persistence**
Where data lives. localStorage for quick storage. Why external storage (a server, a database) is required for multi-user apps. Introduction to the concept of a backend — what it does and why it's separate.

**6. Modules — The Concept**
*Key new concept for this stage.*
What a module is. Why professional apps are not a single file. How `import` and `export` work conceptually. The difference between a library (React, Lodash) and your own modules. Why the browser can cache a separate file and what that means for performance. How this applies to the DPS codebase.

**7. Team Development**
Version control with Git. Branching strategy. Pull requests and code review. Why organized, commented code matters even more on a team. The cost of a merge conflict caused by disorganized code.

**8. Apply It — Build a DPS Feature**
Capstone: add a complete feature to a DPS-style app. Organized. Commented. Submitted as a pull request against a main branch.

### The "Why" Moment (Bridge to Professional)
*"You built DPS for 30 people in one department. The VP just asked you to roll it out to 300 people across 8 departments. What breaks, what stays, and what has to be rebuilt?"*

---

## STAGE 3 — Professional
**Paradigm:** Multi-file ES Modules
**Reference app:** DPS — scaled to whole company (all departments, all roles)
**Tagline:** *Learn to write code that scales.*

### Lessons

**1. Architecture Decisions**
Choosing the right tool for the right job. When to use Vanilla JS vs. React vs. a full framework. When a single-file app is the right answer and when it isn't. How to evaluate a technical decision before writing a line of code.

**2. Going Multi-File — ES Modules in Practice**
Taking a single-file React app and splitting it into proper modules. File structure conventions. How imports and exports work in a real project. Setting up a basic build pipeline (Vite). The difference between development and production builds.

**3. Scaling a Product**
What breaks when you go from 30 users to 300. Database design basics. Authentication and authorization. Multi-tenant architecture (different departments see different data). Role-based access control.

**4. Changing Platforms**
Web vs. mobile vs. desktop. What changes and what doesn't. React Native as a path from web to mobile. Electron as a path from web to desktop. Why the logic layer (JS) often transfers but the UI layer doesn't.

**5. Performance**
Why fast matters. How to measure performance. Lazy loading, code splitting, caching strategies. The difference between perceived performance and actual performance. Real-world profiling with browser dev tools.

**6. Security Basics**
What you are responsible for protecting. Input validation. API key management. What goes on the client vs. what stays on the server. Common vulnerabilities a junior developer introduces without knowing it.

**7. Deploying and Maintaining a Live Product**
CI/CD pipelines. Environment variables. Monitoring and error logging. What happens after you ship. How to update a live product without breaking it for users currently using it.

**8. Capstone — Scale DPS to the Whole Company**
Final project: take a working single-department DPS feature and extend it to support multiple departments, roles, and data scopes. Multi-file. Modular. Deployed. Documented.

**Bonus — The Pilgrim Arc**
Optional advanced module: Pilgrim started as a personal single-file tool. Ashley is building a database and auth system. What does it look like to move Pilgrim from localStorage + Gist to a real backend with user accounts? This is the real-world version of everything taught in Stage 3.

---

## Cross-Stage Principles (Taught at Every Level)

These aren't standalone lessons — they're reinforced throughout all three stages:

- **Code is written for humans, not computers** — introduced Stage 1, deepened at every stage
- **Organize before you comment, comment before you ship** — Foundation habit, Architecture practice, Professional standard
- **The simplest solution that solves the problem** — anti-over-engineering principle
- **Deploy early and often** — every capstone goes live
- **Read error messages** — demystified at Foundation, respected at Professional

---

## What Codex Is Not Teaching

To keep the curriculum focused, these are explicitly out of scope (at least for v1):

- TypeScript (mentioned as "what comes next" at Professional, not taught)
- Testing frameworks (referenced but not a full module)
- Backend development / server-side code (database concept introduced, not built)
- Native mobile development (React Native mentioned as a path, not a course)

---

*Codex Arête Pathway Spec v1 — June 13, 2026*
*Approved by Jesse Caldwell — build pending*
