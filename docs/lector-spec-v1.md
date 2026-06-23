# Lector — Audio Reading App Spec
**Version:** 1.0 | **Date:** June 22, 2026
**Suite:** Arché Study Tools
**Status:** Specced — build pending

---

## Purpose

A single-file HTML app that converts pasted text into a navigable, track-based audio experience. Built for use while driving, working, or doing anything that prevents reading. No subscriptions, no API keys, no backend. Powered entirely by the browser's native Web Speech API.

---

## Cornerstone Verse

Romans 10:17 (NASB) — *"So faith comes from hearing, and hearing by the word of Christ."*

---

## Core Features

### 1. Document Input
- Large paste area on the home screen
- Optional title field for the document
- "Load" button converts pasted text into a playable document
- Supports plain text and basic Markdown (headings become section titles)

### 2. Auto-Chunking Engine
- Splits text into navigable chunks automatically
- Priority order for split points:
  1. Markdown headings (##, ###) → become named tracks
  2. Double line breaks (paragraph breaks)
  3. Fallback: every 4–6 sentences if no breaks exist
- Each chunk gets a number and a title (first 6 words of the chunk if no heading)

### 3. Player
- Fixed bottom bar — always visible
- Controls: Play/Pause, Previous Chunk, Next Chunk, Speed (0.75x, 1x, 1.25x, 1.5x, 2x)
- Progress indicator showing current chunk / total chunks
- Currently playing chunk highlighted in the track list

### 4. Track List (Sidebar / Scrollable Panel)
- All chunks listed like a music track list
- Tap any track to jump directly to it
- Active track highlighted
- Chunk title and estimated time shown per track

### 5. Document Library
- Saved documents stored in localStorage
- Persists across sessions
- Each document shows: title, chunk count, estimated listen time, date added
- Tap to load and play
- Delete option per document

### 6. Playback Settings
- Voice selector (lists all voices available on the device)
- Speed control (persistent preference)
- Pitch control (optional, nice-to-have)
- Auto-advance: automatically plays next chunk without pause

---

## UI Layout

```
┌─────────────────────────────────────────┐
│  LECTOR           [Library] [+ New]     │  ← Header
├─────────────────────────────────────────┤
│  Track List          │  Active Chunk    │
│  ──────────────      │  ─────────────  │
│  1. Introduction     │                  │
│  2. Section One  ◄── │  Text of the    │
│  3. Section Two      │  current chunk  │
│  4. Conclusion       │  displayed here │
│                      │                  │
├─────────────────────────────────────────┤
│  ◄◄   ▶ PLAY   ►► │ 2/12 │ 1.0x │ ⚙  │  ← Player bar
└─────────────────────────────────────────┘
```

---

## Tech Stack

- **Single-file HTML** — Vanilla JS, no frameworks, no build process
- **Web Speech API** — `window.speechSynthesis` — fully native, no cost
- **localStorage** — document persistence
- **No external dependencies** — fully offline capable after first load
- **Hosting** — GitHub Pages via arche-epos/arche-suite at archestudytools.com/lector/

---

## Data Model

```javascript
// Stored in localStorage as 'lector-docs'
{
  id: "unique-id",
  title: "Document Title",
  dateAdded: "2026-06-22",
  chunks: [
    {
      index: 0,
      title: "Introduction",       // heading text or first 6 words
      text: "Full text of chunk"
    }
    // ...
  ]
}
```

---

## Voice Quality Note

Browser-native voices are adequate for most use. If voice quality becomes a priority after using the app, an optional upgrade path exists:

- Route through `arche-proxy` to a TTS API (ElevenLabs, OpenAI TTS, or Groq)
- User provides API key in settings (same model as Pilgrim Public)
- Build this only if native voices prove insufficient in real use

**Decision: Build v1 with native voices. Revisit after real usage.**

---

## Out of Scope (v1)

- Audio file export (MP3 generation)
- Cloud sync (localStorage only)
- Image or PDF input
- Multiple simultaneous voices
- Annotation or highlighting

---

## Estimated Build Time

One focused session — approximately 2–3 hours.

---

## Suite Naming Convention

Follows Arché naming pattern (single meaningful word):
- **Lector** — Latin/liturgical for "one who reads aloud"
- Fits the biblical and academic tone of the suite
- Lectors historically read Scripture and text to congregations — exactly this app's purpose

---

*Lector Spec v1 — June 22, 2026*
*Approved concept — build pending*
