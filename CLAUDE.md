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

## About PixelForge Studio

A layered, pro-style image editor that runs entirely in your browser.
Open images (PNG/JPEG/WebP/GIF/BMP/SVG) or native `.pfs` projects, edit with
layers (raster/text/shape/fill/adjustment/group), masks, 16 blend modes,
12 adjustments and 25 filters, selections with marching ants, 25 tools,
multi-document tabs, undo/redo with a history panel, and export PNG/JPEG/
WebP/AVIF (flattened PSD pixels-only too). Nothing is uploaded or stored on a
server: all editing is client-side; the only persistence is a per-device
IndexedDB autosave. No database, no API routes, no account data.

## Design

This app's look. Every later change follows it, and updates it when a request
changes the look on purpose.

- **Palette:** warm neutral greys (stone: ground 245 245 244, surface white,
  raised 238 237 235, text 28 25 23, muted 87 83 78, line 222 220 217) so the
  photo is the colour on screen, with one burnt-orange accent (194 65 12
  light, 251 146 60 dark) for Save photo, the slider fill and the knob ring.
  The photo sits on a near-black `photo` stage (30 27 25 light, 8 8 7 dark),
  as in a darkroom.
- **Signature element:** Hold to compare — hold
  anywhere on the photo (Hold-to-compare button or backslash key) to peek
  at the flattened original, with the label in a dark pill at the photo's
  lower left. Tools are single-stroke line icons in a 48 px column; the
  marching-ants selection is drawn double-dashed in both looks.
- **Type scale:** `text-title`, `text-heading`, `text-body`, `text-small`
  unchanged; the family is the system's rounded face (`ui-rounded`,
  `system-ui` fallback), set once in `tailwind.config.js`.
- **Client-only:** no server state, no uploads; both looks follow the
  viewer's Homeroom theme.

The kit is in `public/styles.css` (plain CSS custom properties, no build step): colour tokens with a light and
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

- Client-only: no server state, no uploads, no analytics; the only network
  paths are the platform's own bridge/dev-console assets and the app's static files.
- Hand-written Canvas2D engine (`public/engine.js`): layers composite bottom
  to top via `globalCompositeOperation`; no WebGL/WebGPU yet (View menu says
  so honestly).
- Every user-facing string lives in BOTH dictionaries in `public/i18n.js`
  (en and id, parity-checked at load); never hardcode UI copy.
- Pixel data lives on HTMLCanvasElement, never raw arrays, so history
  entries share canvases; pixel history stores dirty-rect ImageData only.
- The build script is a fast existence check — there is no build step.
