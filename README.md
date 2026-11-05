# Patram-FS: serving training data from local disks

A 32-slide animated HTML deck (1920×1080), about 31 minutes.

Present from **`dist/patram-fs-talk.html`**. It is one self-contained file, so it works offline. Script: `SPEAKER_NOTES.md`.

| Key | Does |
|---|---|
| → / Space / click right | next step, then next slide |
| ← / click left | back |
| P | presenter window: notes, next slide, clock and pace |
| O | overview grid · F fullscreen · T clock · B blackout · R reset clock |

## Structure

An introduction (what we do, the agenda) comes first. Then five parts: The problem, Shards, The daemon, Reads and memory, In production.

## Editing

One file per slide in `src/slides/`, in filename order. Rebuild with `python3 tools/build.py`. Screenshots: `tools/shot.py`, `tools/allshots.py`.
