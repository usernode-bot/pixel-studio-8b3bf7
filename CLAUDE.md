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
  | G2 lint | none | `bun run lint`, 0 errors and 0 warnings |
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
