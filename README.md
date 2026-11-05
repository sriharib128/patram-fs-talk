# Patram-FS: serving training data from local disks

A 38-slide animated HTML deck (1920×1080), about 39 minutes.

Present from **`dist/patram-fs-talk.html`**. It is one self-contained file, so it works offline. Script: `SPEAKER_NOTES.md`.

| Key | Does |
|---|---|
| → / Space / click right | next step, then next slide |
| ← / click left | back |
| P | presenter window: notes, next slide, clock and pace |
| O | overview grid · F fullscreen · T clock · B blackout · R reset clock |

## Structure

An introduction (what we do, the agenda) comes first. Then five parts: The problem, Pack the files, Keep them local, Read them fast, Run it. Part 1 explains the problem from zero, with one running analogy (an office, a shelf, a warehouse). Each later part fixes one problem and uncovers the next, and each divider shows the list of problems so far.

## Editing

One file per slide in `src/slides/`, in filename order. Rebuild with `python3 tools/build.py`. Screenshots: `tools/shot.py`, `tools/allshots.py`.
