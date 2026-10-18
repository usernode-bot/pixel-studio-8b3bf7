# Pixel Studio — notes for Claude Code

This app runs on **Homeroom**. The platform conventions are the single
source of truth for platform-wide behavior (auth model, `USERNODE_ENV`,
public/private tables, "don't `git push`", etc.):

**Platform conventions (authoritative, always current):**
https://app.onhomeroom.com/claude.md

**Inside Homeroom** (its dev chat, and Homeroom bot's builds), do not
fetch that URL: what applies to your change is already in your
instructions, and the `homeroom` MCP server's
`get_platform_conventions` reads any one section of the conventions
when you need it. The two sections below are for working outside
Homeroom; skip them there.

**Anywhere else** (Claude Code run against this repo locally, or another
harness), fetch it at the start of each session. The hosted copy is
updated in place when platform rules change, so fetching it gives you
today's rules, not a stale snapshot.

## Connector permission prompts (outside Homeroom)

This repo ships `.claude/settings.json`, which allows the **read-only**
Homeroom connector calls (`mcp__homeroom__get_*`,
`…__list_*`, `…__whoami`) once you accept the workspace trust dialog.
See `.claude/README.md` for the whole story, including what to do if you
are still being prompted.

## Check that this checkout is current

You may be working in a fork of this app whose `main` is behind the app's
canonical repository, and nothing in the checkout says so: `git fetch origin`
compares the fork with itself. This matters before you **read** code to answer
a question about how the app behaves now, not only before you edit it.

The canonical repository is named in `.claude/homeroom-canonical-repo`. Check against
it, not against `origin`:

```sh
git fetch "$(cat .claude/homeroom-canonical-repo)" main
git merge-base --is-ancestor FETCH_HEAD HEAD && echo current || echo behind
```

`behind` means this checkout does not contain the canonical `main`. To answer
a question, read the canonical code instead (`git show FETCH_HEAD:<path>`,
`git grep <pattern> FETCH_HEAD`). To change code, start from the exact base
commit your Homeroom work order gives, and never merge or rebase onto the
canonical `main` yourself: which commit a change is diffed against decides
what the group votes on. With the Homeroom connector, `get_checkout_status`
answers the same question.

A session-start hook (`.claude/hooks/homeroom-freshness.sh`, see `.claude/README.md`) runs
this check for you and tells you when you are behind. It is silent offline, so
its silence is not proof the checkout is current. Inside Homeroom (its dev
chat, and Homeroom bot's builds) the platform fixes the base commit, and none
of this applies.

## Starter template

The screen this app currently ships — the "Starter template" hero with
the app's thumbnail tile and the plain-English note on how the app gets
built (by asking Homeroom bot) — is placeholder content from the
Homeroom starter template, not product intent.

When the user asks for their first real feature, REPLACE the template
screen rather than building alongside it:

- remove the `usernode-starter-notice@1` block in `public/index.html`
  (both sentinel comments and everything between them),
- rewrite `README.md` to describe the actual app.

Keep the `usernode-dev-console@1` forwarder `<script>` when rewriting the
HTML — that block is platform infrastructure, not template content. So is
the bridge `<script>`. The design kit is not placeholder either: build the
real app with it, and fill in "## Design" below.

The screen has a light and a dark look and follows the viewer's Homeroom
theme, switching live when they change it: the theme `<script>` right after
the bridge tag sets a `dark` class on `<html>`. Keep that script, and give
everything you build both looks (the design kit's colour tokens carry both), unless one
fixed look is the point of this app, like a game's own scene; then say so
under "## Design" below. Unless a request asks for one, add
no theme picker: the viewer's Homeroom setting is the control. "The
platform's light/dark theme inside the app frame" in the platform
conventions has the details.

If a rule below this line conflicts with the hosted conventions, the
hosted conventions win. This file is **app-specific** — write down
things about *this* app that belong in the repo: product intent,
data-model quirks, style preferences, opt-in policies (e.g. which
tables you've marked private), etc.

---

## About Pixel Studio

A free pro-grade photo editor that runs entirely in your browser. Open one
photo at a time from your device, tune it with three sliders (brightness,
contrast, saturation) with a live preview, press and hold the photo to
compare with the original, and download the edited result at full size.
Nothing is uploaded or stored: all editing is client-side, and this app has
no database, no API routes and no account data.

## Design

This app's look. Every later change follows it, and updates it when a request
changes the look on purpose.

- **Palette:** warm neutral greys (stone: ground 245 245 244, surface white,
  raised 238 237 235, text 28 25 23, muted 87 83 78, line 222 220 217) so the
  photo is the colour on screen, with one burnt-orange accent (194 65 12
  light, 251 146 60 dark) for Save photo, the slider fill and the knob ring.
  The photo sits on a near-black `photo` stage (30 27 25 light, 8 8 7 dark),
  as in a darkroom.
- **Signature element:** the press-and-hold before/after comparison — hold
  anywhere on the photo (or Space on the focused stage) to peek at the
  original, with the label in a dark pill at the photo's lower left. Each
  slider has its own small line icon (sun, half-filled circle, drop) and each
  track a faint mark at 0.
- **Type scale:** `text-title`, `text-heading`, `text-body`, `text-small`
  unchanged; the family is the system's rounded face (`ui-rounded`,
  `system-ui` fallback), set once in `tailwind.config.js`.
- **Client-only:** no server state, no uploads; both looks follow the
  viewer's Homeroom theme.

The kit is in `styles/tailwind-input.css`: colour tokens with a light and
a dark value (named in `tailwind.config.js`), and a few components
(`page-column`, `btn-primary`, `btn-secondary`, `field`, `list`, `list-row`,
`card`, `section-label`, `skeleton`, `state-empty`, `state-error`).
Re-theme by changing the token values there, keeping every text pair at
4.5:1 or more in both looks.

- Colour comes only from the tokens (`bg-ground`, `bg-surface`,
  `text-fg`, `text-muted`, `border-line`, `bg-accent` with
  `text-on-accent`, ...): never a raw hex value or a stock palette class.
- Tap targets are at least 44 px; the buttons and fields already are.
- A field's label says what it is; its placeholder, if any, is an example
  that says so ("e.g. 5.0"), never a bare value that could pass for one
  already entered.
- Each screen sits in `page-column`, one centred column on a wide window.
- Every screen that loads data has honest loading, empty and error states.
  Never show the empty state while loading or after a failure; an error says
  what failed, what still works, and offers Retry. Loading has the content's
  own shape (its rows, with `skeleton` bars for their text).
- Seed obviously fake staging demo data so the populated screen can be seen
  ("Staging mock data" in the platform conventions).
- No cards in cards, no uppercase eyebrows, no emoji as icons.
- A header that shows the app's own mark shows the project's icon there
  (the emoji in `dapp.json`'s `icon` block) or no mark at all: never an
  empty tile, and never `brand/icon.png`, which the app does not serve.

## App-specific conventions

### Phased build protocol

Pixel Studio follows the phased build protocol from issue #2 (Section 0 of
the master build prompt). The rules:

- **Shared log:** `worklog.md` at the repo root, append-only. Every agent
  reads it (and the files it is told to extend) before starting, and appends
  one entry when finished, in the Section 0.1 template, quoted verbatim:

      -
      Task ID: <id>
      Agent: <name>
      Task: <one-line task>

      Work Log:
      - <concrete steps taken>

      Stage Summary:
      - <key results, decisions, produced artifacts>

- **Task IDs:** each phase is P0 to P7. Parallel parts inside a phase are
  P3-a, P3-b and so on, and are dispatched in parallel only when they touch
  disjoint files. When in doubt, run them sequentially.
- **Briefs:** every sub-agent brief is self-contained (the agent cannot see
  the master prompt or the conversation) and carries (a) its Task ID, (b) the
  relevant blueprint sections verbatim, (c) the exact files it owns, (d) its
  acceptance tests, (e) the worklog protocol above.
- **Takeover rule:** if a sub-agent times out or dies with its work about 95%
  complete, the orchestrator finishes the remaining wiring itself, runs the
  gates, and records "completed by orchestrator after agent timeout" in
  `worklog.md`. A phase is never re-dispatched from scratch.
- **Commits:** one conventional commit per phase (`feat:`, `fix:`, `chore:`),
  never secrets or tokens, and a `v1.0` tag after Phase 7. Homeroom makes the
  commits and pushes, so no direct `git push` (platform conventions).
- **Gates.** Run G1 to G5 after every phase, all green before the next
  dispatch, and fix forward inside the failing phase. Each gate's command
  now, and after Phase P0 adds the new stack:

  | Gate | Now | After P0 |
  | --- | --- | --- |
  | G1 build | `npm run build` | `bun install && bun run build` |
  | G2 lint | `npm run lint:boundaries` | `bun run lint` (which must include `node scripts/check-boundaries.mjs`), 0 errors and 0 warnings |
  | G3 unit tests | none | `bunx vitest run` |
  | G4 smoke | `npm start` plus a manual smoke of the editor: open a photo, three sliders, hold to compare, Save photo, `?demo=1` | `bun run dev` plus the phase's acceptance tests |
  | G5 worklog | every agent that ran has appended its entry | same |

- **Anti-scope:** build only what the current phase lists. No PSD code before
  Phase 5, no WebGPU before Phase 6. Extra ideas a sub-agent proposes go into
  a "future" note in the worklog, not the tree.
- **Status:** P0 not started: waiting on Sections 1 to 7 of the master prompt
  (issue #2).
- **Precedence:** the hosted Homeroom platform conventions and this file's
  "## Design" section still apply (theme-following light/dark, design-kit
  colour tokens, no direct pushes). Where the protocol conflicts with them,
  they win.

### Architecture rules (Section 2, issue #4)

Adopted as a fixed contract (task S2 in the worklog). Every phase reads
these before it starts, and every phase obeys them. Changing a rule later
needs its own request. Each rule is enforced by the phase that builds the
feature it governs; no phase builds a feature early just to satisfy a rule
(anti-scope above still holds: no PSD before P5, no workers/GPU before P6).
Adopting these rules is not a rebuild: P0 creates the `src/` layout below
together with the Next.js and Bun stack that Section 1 names.

R1 Module map and STRICT dependency direction:

     src/engine/     pure document model + pixel engine (NO React, NO store
                     imports; only it may touch canvas/ImageData primitives)
     src/state/      Zustand store: documents, selection, view, tools, colors,
                     history wiring, UI state, settings
     src/canvas/     viewport stage + pointer/event contract + gpu display
     src/tools/      tool controllers (read options from store, mutate through
                     store actions)
     src/workspace/  editor shell: panels, options bar, dialogs, menus
     src/formats/    raster import/export + PSD writer/reader
     src/documents/  native .pfs serializer
     src/storage/    IndexedDB autosave + crash recovery
     src/workers/    Web Worker entry (filters/adjust/histogram/inpaint)
     src/i18n/       EN/ID dictionaries + provider
     src/shortcuts/  data-driven keyboard shortcut registry

   Dependency arrows may only point: workspace → tools/canvas → state →
   engine. documents/formats/storage sit beside state but may import ONLY
   from engine (+ browser APIs). The engine NEVER imports upward. Enforce
   via lint + review.

R2 Engine purity: engine functions transform document data or pixel buffers
   and never touch the store or DOM beyond canvas primitives. Pixel buffers
   (canvases) are treated as mutable OUTSIDE history; raster edits commit
   diff-region history entries via the store's commitPixelEdit().

R3 Renderer purity: the compositor is a pure function of document state —
   same doc in, same pixels out. It NEVER mutates layer buffers. A
   checkerboard is painted behind transparent areas for preview only, never
   exported.

R4 Privacy by architecture: zero upload endpoints; pixel data never crosses
   the network; autosave/recovery live in the browser's own IndexedDB.

R5 Honesty rule: every partial/limited capability (GIF first frame, SVG
   rasterized on import, diffusion-only inpainting, PSD subset…) states its
   real scope in the UI and docs. Never silently flatten or corrupt.

R6 i18n rule: every user-facing string is a dictionary key (TranslationKey
   type), EN and ID both complete, enforced by scripts/i18n-parity.ts.

R7 History rule: UI state (dialogs, panels) lives in the store but NEVER in
   history. All user-visible mutations flow through store actions that push
   history entries.

R8 Memory rule: buffers sent to workers are cloned-then-TRANSFERRED
   (zero-copy, no second main-thread copy, source never detached); history
   enforces byte budgets; thumbnail caches are bounded and cleared on
   document switch; GPU resources are destroyed on every path.

**Allowed imports (the rule table `scripts/check-boundaries.mjs` enforces):**

| Module under `src/` | May import from `src/` | Banned packages |
| --- | --- | --- |
| engine | engine | `react`, `react-dom`, `zustand`, `next` |
| state | state, engine, documents, formats, storage | `react-dom`, `next` |
| canvas | canvas, state, engine, i18n, shortcuts | none |
| tools | tools, canvas, state, engine, i18n, shortcuts | none |
| workspace | everything except workers (workers are spawned by URL, never imported) | none |
| documents, formats, storage | itself, engine | `react`, `react-dom`, `zustand`, `next` |
| workers | workers, engine | `react`, `react-dom`, `zustand`, `next` |
| i18n | i18n | `zustand` |
| shortcuts | shortcuts, i18n | `react-dom` |

A file directly under `src/`, or in a folder not listed, is reported as
"unknown module" — new modules are added to this table on purpose. Tools may
import the canvas's pointer-event contract (tools may import canvas); canvas
may never import tools. Code outside `src/` is not constrained by the
checker.

**Enforced by the checker now (vacuous until P0 creates `src/`):** R1's
import direction, including the package bans above (the engine bans are the
checker's part of R2). **Review-only:** the canvas/ImageData exclusivity in
R2 (a simple import scan cannot see it), the compositor purity and
preview-only checkerboard in R3, the honesty scope statements in R5, the
history wiring in R7, and the buffer budgets in R8 — a violating import
fails G2, but these stay review rules and reviewers check them in every
phase's diff.

| Rule | Enforced from | How |
| --- | --- | --- |
| R1 module map | Now (vacuous); P0 creates `src/` | Checker, part of G2 |
| R2 engine purity, `commitPixelEdit()` | Phase that lands the store and history | Checker bans React, Zustand and Next in the engine; diff-region history and canvas exclusivity checked in review |
| R3 renderer purity, preview-only checkerboard | Phase that lands the compositor | Unit test in that phase: same document gives same pixels, and layer buffers are unchanged after compositing |
| R4 privacy | Now | Holds today (no upload routes in `server.js`); review on every phase |
| R5 honesty | Each phase that ships a limited capability (P5 for the PSD subset) | That phase's acceptance tests check the UI text |
| R6 i18n | i18n phase | `scripts/i18n-parity.ts` written then, not now |
| R7 history | Phase that lands the store and history | Store tests: UI-state actions push no history entries |
| R8 memory | History phase (byte budgets), P6 (workers, GPU) | Tests in those phases |
