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
- **Signature element:** comparing the edit with the original, two ways. Hold
  anywhere on the photo (or Space on the focused stage) to peek at the
  original, with the label in a dark pill at the photo's lower left. Beside
  it, a burnt-orange split line with a white, orange-ringed round handle cuts
  the photo in two: the original on the left, the edit on the right, with
  "Original" and "Edited" pills at the photo's top corners. Drag the handle,
  or focus it and press an arrow key (5% per press), to move the line; it
  starts in the middle of every new photo and stays where it is left. Holding
  to see the original hides the line and its labels. Each slider has its own
  small line icon (sun, half-filled circle, drop) and each track a faint mark
  at 0.
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
- **Status:** Phase plan P0 to P6 adopted (task S6, issue #6); P0 is ready to
  dispatch. P1 (document model and renderer) is the first editing slice after
  it. Still missing: Section 1, sections 3.1 to 3.12, Phase 7 and Sections 5
  to 7 (see "Master build spec").
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

### Master build spec (Sections 3.13 to 3.17 and 4, issue #6)

Adopted as task S6 in the worklog, the same way issue #2 (protocol) and issue
#4 (architecture rules) were adopted. The text below is quoted as given in
issue #6. Every phase reads the sections and the phase entry it points to
before it starts; the **Precedence** bullet above still applies (the hosted
Homeroom conventions and this file's "## Design" section win over anything
quoted here). "Notes on this text" below the quote records where the quoted
plan is incomplete or conflicts with those rules.

**Sections 3.13 to 3.17:**

    3.13 PWA — public/manifest.json (name, icons 192/512 + maskable, theme),
      public/sw.js (precache app shell; runtime cache; skip localhost), client
      PwaRegister component. Icons generated from ONE SVG source via
      scripts/gen-icons.mjs (sharp): icon-192.png, icon-512.png,
      icon-maskable-512.png, favicon. Offline editing must work end-to-end.

    3.14 WebGPU display path (src/canvas/gpu.ts) — PRESENT-ONLY
      Canvas2D remains the ONLY compose backend. gpu.ts sits in front and merely
      presents the cached composite: checkerboard as a shader-computed quad (same
      CSS-pixel parity as paintChecker), composite uploaded ONCE per content
      revision via copyExternalImageToTexture (premultiplied), re-presented under
      the doc→screen mat3 on pan/zoom/resize — NO texture re-upload per frame.
      Sampling: bilinear below 3× zoom, nearest at/above (mirrors Canvas2D
      imageSmoothingEnabled). Gating: settings.renderer 'auto' | 'canvas2d'.
      Fallback chain: auto + navigator.gpu + adapter/device/context all succeed →
      WebGPU; ANY failure (API missing, init error, 8 s init timeout, device loss)
      → PERMANENT Canvas2D for that stage mount. Documents exceeding
      device.limits.maxTextureDimension2D fall back instead of failing per-frame.
      Memory safety: destroy the previous texture before creating the next;
      destroy() releases texture + uniform buffers, unconfigures context,
      destroys device; a late-resolving init after fallback self-destroys via an
      isDestroyed() guard. getGpuDiagnostics() → { attempted, active,
      destroyedResources, lastError } shown in the About dialog; status bar shows
      the renderer actually in use.

    3.15 AI segmentation + content-aware fill
      engine/segmentation.ts: on-device subject/background segmentation (no
      network, no external model downloads at runtime — deterministic algorithmic
      approach: edge/label propagation seeded from borders, tolerance+feather
      params) powering filter 'remove-background' and a Select-Subject command.
      engine/inpaint.ts: content-aware fill v1 = diffusion inpainting — onion-peel
      seeding from the selection boundary then fixed-iteration Laplace smoothing,
      RGBA including alpha (transparency propagates inward), run as worker op,
      deterministic. HONEST SCOPE: great on smooth regions (sky, skin, walls,
      gradients); NOT texture synthesis — structured textures blur. Feathered
      selections threshold at 128/255. Both get unit suites + docs entries.

    3.16 i18n (src/i18n/) — dictionaries.ts with TranslationKey union type, en +
      id objects (~460 keys by release), provider + t(); language persisted in
      editor settings. scripts/i18n-parity.ts CI-checks key parity; filter/param/
      tool/history/menu/dialog keys are all namespaced (filter.*, tool.*,
      history.*, menu.*, dialog.*, etc.). No hardcoded user-facing strings.

    3.17 Responsive + performance requirements
      Responsive tiers via useViewportTier(): desktop ≥1024 (full panels + right
      dock), tablet 640–1023 (side drawer), phone <640 (bottom tool dock, options
      strip, panel tabs, ⋯ overflow menu, double-tap-to-zoom, 44px touch targets).
      Viewport meta: interactive-widget=resizes-content, colorScheme dark;
      100dvh fallback for old iOS; safe-area insets for notches; touch-action
      none on the canvas; prefers-reduced-motion disables ants animation.
      Performance budget & techniques (all verifiable):
        - Slider coalescing: no history spam (beginLayerEdit/endLayerEdit).
        - Per-layer thumbnail cache keyed by layer id; clearThumbnailCaches() on
          active document change (prevents cross-document pixel leaks).
        - Idle-stop rAF render loop: when nothing changed, stop scheduling frames.
        - Cached checker pattern canvas (never repaint the checker per frame).
        - Transferables everywhere in worker IO (§3.4).
        - History bounded (§3.3) — memory-bounds test proves ≤ budget + 1 entry.
        - GPU textures destroyed before re-upload (§3.14).

**SECTION 4 — BUILD PHASES**

    SECTION 4 — BUILD PHASES

     PHASE 0 — SCAFFOLD & SHARED FOUNDATIONS (Task P0)
    Mission: a building that compiles, lints clean, tests, and CI-runs — plus the
    shared i18n/shortcut skeletons everything else codes against.
    Deliverables:
      - Next.js 16 (App Router) + React 19 + TS strict scaffold; Tailwind 4;
        shadcn/ui init (components.json + ui primitives used later); Zustand 5;
        Vitest configured (node env, tests/unit/); ESLint flat config.
      - package.json scripts: dev (port 3000), build (standalone output),
        start, lint, test via bunx vitest run.
      - Folder skeleton per R1 (engine/ state/ canvas/ tools/ workspace/ formats/
        documents/ storage/ workers/ i18n/ shortcuts/ lib/ components/).
      - src/i18n/dictionaries.ts seeded with the key NAMESPACES (menu.*, dialog.*,
        tool.*, panel.*, history.*, filter.*, filter.param.*, settings.*, import.*,
        export.*, doc.*) with EN + ID values for Phase-0 strings only; provider +
        t() + TranslationKey type; scripts/i18n-parity.ts (exits 1 on drift).
      - src/shortcuts/index.ts: data-driven registry (id, combo, labelKey,
        exact-modifier matching flag) — empty actions wired later.
      - src/lib/utils.ts (cn), app/layout.tsx + globals.css (dark theme tokens),
        placeholder page.tsx that renders "PixelForge Studio" + version.
      - GitHub Actions ci.yml: Bun checkout → install → lint → vitest → build.
      - worklog.md initialized with the protocol from §0.1.
    Acceptance tests:
      A0.1 bun run build succeeds (production, standalone).
      A0.2 bun run lint → 0 errors 0 warnings.
      A0.3 bunx vitest run passes (≥1 smoke test: i18n parity script as a test).
      A0.4 CI workflow green on push.
    Handoff note: every later phase adds its dictionary keys to BOTH locales in
    the same commit as the feature (checked by parity script in CI).

     PHASE 1 — ENGINE CORE, PURE (Task P1)
    Mission: the complete non-React engine — document model, raster helpers,
    blend, color, adjustments, selections, history, compositor — with unit tests.
    Deliverables (all pure TS; no store/React imports):
      - src/engine/types.ts: FULL model from §3.1 (exact shapes, ranges, comments).
      - src/engine/document.ts: factories + tree ops from §3.1 (immutable trees).
      - src/engine/raster.ts: makeCanvas (HTML|Offscreen), ctx2d, cloneCanvas,
        imageDataFromCanvas, paintChecker, AnyCanvas/AnyContext2D types.
      - src/engine/blend.ts: BlendMode union (16 modes) + blendToComposite map.
      - src/engine/color.ts: hex↔rgb parse/format, rgb↔hsl, Rec.601 luma,
        luminance, contrast helpers.
      - src/engine/adjustments.ts: applyAdjustments for all 12 specs (§3.8).
      - src/engine/selections/index.ts: mask rasterizers (rect/ellipse/lasso
        polygon/wand flood), boolean combiners (add/subtract/intersect), feather,
        grow, contract, border, invert, outline extraction for ants, bounds calc.
      - src/engine/transforms/index.ts: resize (smooth + nearest), crop reposition,
        flip, rotate 90/180/270, per-layer affine application.
      - src/engine/paint.ts: fontString, layoutText (wrapping, lineHeight,
        letterSpacing), drawTextLayout, buildShapePath, resolvePaint (solid +
        gradients), applyStroke.
      - src/engine/brushes/stamp.ts: circular soft/hard brush stamping into
        ImageData (spacing, opacity accumulation, flow) — engine-level, UI-agnostic.
      - src/engine/render.ts: composeDocument per §3.2 (blend, opacity, masks,
        clipping, adjustment layers, groups, selection clipping, checker).
      - src/history/index.ts: pushEntry/trim/undo/redo/jumpTo/historyBytes per
        §3.3 constants and cursor rule.
      - tests/unit/: history.test.ts (incl. trim-cursor regression: push(300MB),
        push(50MB), push(350MB) → ≤384MB + newest kept), selections.test.ts,
        color.test.ts, project-shape tests for document tree ops, render golden
        smoke (compose 2 layers → expected pixel probe).
    Acceptance tests:
      A1.1 vitest: history (incl. the trim regression), selections, color suites pass.
      A1.2 Static check: no file under src/engine/ imports from state/ workspace/
           tools/ react/ next (lint rule or CI grep).
      A1.3 composeDocument(white doc + red raster layer + multiply layer) probe
           pixel equals expected value.
    Handoff note: engine API stability matters — later phases code against these
    exact signatures.

     PHASE 2 — FILTERS, WORKER, INPAINT (Task P2) =
    Mission: the heavy-compute layer: 25-filter registry, worker pipeline with
    transferables, histogram, direct adjustments, diffusion inpainting.
    Deliverables:
      - src/engine/filters/registry.ts: all 25 ops (§3.7) with param defs +
        i18n labelKeys; pure in-place Uint8ClampedArray functions.
      - src/workers/filters.worker.ts: message loop per §3.4 (filter/adjust/
        histogram/inpaint/ping → responses; per-job try/catch → error response).
      - src/lib/filterRunner.ts: typed client — runFilter/runAdjust/runHistogram/
        runInpaint; clone→transfer on send, transfer back on receive; jobId
        correlation; stale-job cancellation for live previews; in-thread fallback
        when Worker unavailable (same registry code).
      - src/engine/inpaint.ts: diffusion algorithm per §3.15 (onion-peel seed +
        Laplace iterations, alpha-aware), pure + deterministic.
      - tests/unit/: filters.test.ts (determinism, alpha preservation, clamping,
        worker↔sync parity via the same registry), inpaint.test.ts (fills hole
        from boundary, deterministic, alpha propagates), histogram sanity.
    Acceptance tests:
      A2.1 vitest filters + inpaint suites pass.
      A2.2 runFilter on a 512×512 buffer completes < 300 ms per filter (median
           across the 25 ops on CI hardware; correctness over speed).
      A2.3 filterRunner: buffer identity/ownership contract respected (no
           detached-buffer errors when source ImageData reused after send).
    Handoff note: FilterDialog UI arrives in Phase 4; nothing here touches React.

     PHASE 3 — STORE, TOOLS, CANVAS STAGE (Tasks P3-a, P3-b)
    Mission: make the engine interactive — the Zustand store, all 25 tools, and
    the viewport stage with pointer contract.
    P3-a State store (src/state/editorStore.ts + types.ts):
      - Single store: documents Map + activeDocId, per-doc DocumentState, global
        selection, view state, tool id + per-tool ToolOptions, fg/bg colors +
        swatches + recent colors, history stack per doc, UI state (dialog ids,
        right panel id, mobile panel, filter dialog, job progress, before/after,
        split view, saved fingerprint), settings (renderer pref, autosave, theme,
        language, max undo entries).
      - Actions per the action surface: newDocument/openDocument/closeDocument/
        setActiveDoc/updateDocMeta; addLayer/addRasterLayer/addTextLayer/
        addAdjustmentLayer/addFillLayer/addGroupFromSelection/deleteLayers/
        duplicateLayers/selectLayer/moveLayerTo/reorderSelected/updateLayer/
        updateLayerLive/beginLayerEdit/endLayerEdit/mergeDown/mergeVisible/
        flattenImage/rasterizeLayer; addMask/updateMask/applyMask/deleteMask;
        commitPixelEdit (diff-region entry per §3.3); setSelection/selectAll/
        deselect/invert/feather/grow/contract/border/rect/ellipse actions;
        setView/zoomBy/setZoom/fitToScreen; colors; undo/redo/jumpHistory/
        commitEntry; guides; resizeImage/resizeCanvas/cropTo/flipDocument;
        setTool/setDialog/setRightPanel/togglePanels/mobile UI actions;
        updateSettings/markSaved.
      - Every mutation wrapped in a history entry (kinds per §3.3); UI state
        never enters history (R7).
      - tests/unit/: store-live-edit.test.ts (slider coalescing = 1 entry per
        gesture), memory-bounds.test.ts (history budget respected).
    P3-b Tools + stage:
      - src/canvas/pointerContract.ts: full contract from §3.6 (types + pure
        docToScreen/screenToDoc transforms — unit-testable).
      - src/canvas/CanvasStage.tsx (~1000+ lines allowed): layered canvases
        (composite canvas + overlay canvas), rAF loop with IDLE STOP, zoom/pan/
        rotate/flip presentation, checkerboard (cached pattern), document border,
        guides overlay, animated marching ants (reduced-motion aware), tool
        overlay dispatch (drawOverlay), cursor management, wheel zoom (ctrl) /
        scroll, pinch zoom + two-finger pan, pressure passthrough, DPR handling.
      - src/tools/*: all 25 controllers (§3.6) registered in registry.ts; shared
        stroke plumbing (spacing, interpolation, pressure); every raster tool
        commits via commitPixelEdit; selection tools honor modes; crop writes
        rect + Apply/Cancel lifecycle; text tool editing session; pen anchors in
        overlay.
      - src/workspace/toolMeta.ts: TOOL_ORDER, MOBILE_TOOL_ORDER, icons,
        toolLabelKey mapping.
      - tests/unit/: tools-math.test.ts (transforms, hit tests, stamp spacing).
    Acceptance tests:
      A3.1 vitest: store-live-edit + memory-bounds + tools-math pass.
      A3.2 Dev-run script: for EVERY tool id, programmatically synthesize pointer
           events on a test doc — no exceptions thrown, canvas bytes change where
           expected (brush draws, eraser clears, fill floods, wand selects).
      A3.3 Brush stroke + Ctrl+Z restores previous pixels exactly (diff-region).
      A3.4 Zoom to 800% — pixels stay crisp (nearest ≥3×), pan smooth (rAF stops
           when idle — verify via frame counter in dev overlay or test hook).
    Handoff note: stage and tools are the largest surface; keep both briefs
    self-contained with §3.2/§3.3/§3.6 pasted.

     PHASE 4 — WORKSPACE UI (Task P4) =
    Mission: the full Photo editor shell around the stage, desktop + mobile.
    Deliverables:
      - src/workspace/EditorRoot.tsx (client-only root; mounts i18n provider,
        store hydration, GlobalKeys, DialogHost, tier switch), DesktopWorkspace.tsx
        (resizable panels via react-resizable-panels: left ToolRail, top MenuBar +
        OptionsBar, center stage, right panel stack, bottom StatusBar).
      - Panels (src/workspace/panels/): MenuBar (File/Edit/Image/Layer/Select/
        Filter/View/Help — full command wiring via commands.ts), OptionsBar
        (per-tool controls bound to ToolOptions), LayersPanel (dnd-kit reorder,
        drag into/out of groups, blend/opacity/lock/visible/clip controls, mask
        badges, thumbnail cache), HistoryPanel (entries + jump-to-state),
        AdjustmentsPanel (12 specs + presets), ColorPanel (HsvPicker + swatches +
        recent colors + hex copy), NavigatorPanel (shared composite, viewport
        rect), HistogramPanel (worker histograms, channel toggle), PropertiesPanel
        (doc meta + text/shape re-editing), StatusBar (zoom, doc size, renderer
        badge, history bytes, storage info), ToolRail.
      - Dialogs (src/workspace/dialogs/): NewDocumentDialog (presets + custom),
        ExportDialog (format/quality/scale presets/transparent toggle), FilterDialog
        (categories, params, worker live preview with before/after split + progress,
        applies via commitPixelEdit honoring selection), ImageSizeDialog,
        CanvasSizeDialog (anchor), ShortcutsDialog (registry-driven), SettingsDialog
        (language, renderer, autosave interval, history limit), StorageDialog,
        NumericPromptDialog, AboutDialog (version, GPU diagnostics, licenses).
      - src/workspace/GlobalKeys.tsx: exact-modifier matching (a plain 'z' must
        NEVER hijack Ctrl+Z — regression-test this), tool single-key switching,
        Enter/Escape forwarded to the ACTIVE TOOL first (crop/pen commit), then
        dialogs; commands.ts central command registry used by menus + shortcuts.
      - src/workspace/MobileWorkspace.tsx: bottom tool dock, options strip,
        panel tabs, ⋯ overflow menu, double-tap zoom (phone tier; full hardening
        lands in Phase 7).
      - i18n: every new string keyed in en + id (parity script green).
    Acceptance tests:
      A4.1 Full menu walk: every command executable from the menu; no dead items.
      A4.2 Keyboard: Ctrl+Z/Y, Ctrl+D deselect, Ctrl+A all, Ctrl+Shift+S export,
           [ ] brush size, X swap colors — exact-modifier regression suite green.
      A4.3 FilterDialog live preview: move a slider → worker preview updates,
           stale previews canceled, Apply commits ONE history entry.
      A4.4 LayersPanel: reorder via dnd-kit, group drag, opacity slider (1 entry),
           mask add/paint/invert/apply/delete all correct + undoable.
      A4.5 Text layer re-edit preserves typed content; shape stays vector after
           Properties edits.
    Handoff note: This is the largest UI phase; panels may be split P4-a/P4-b
    (panels+dialogs | menu+keys+mobile) if dispatched separately — file
    ownership must be disjoint.

     PHASE 5 — IO FORMATS, PERSISTENCE, PWA (Tasks P5-a, P5-b)
    Mission: everything that reads/writes the outside world + survives crashes.
    P5-a Formats:
      - src/formats/api.ts per §3.11 (import PNG/JPEG/WebP/GIF-first/BMP/SVG-
        rasterized with honest messaging; export PNG/JPEG/WebP/AVIF + scale
        presets, checker never exported).
      - src/documents/project.ts per §3.9 (.pfs save/load/validate; 1..16384
        dimension guard; placeholder-on-corrupt-PNG; 512 MB cap).
      - src/formats/psd.ts (writer per §3.10: header, layer records with blend/
        opacity/visibility, 'luni' Unicode names, 'lsct' nested section dividers,
        8-bit RLE/raw channels) + src/formats/psdImport.ts (reader per §3.10 with
        group reconstruction + graceful rejects).
      - tests/unit/: psd.test.ts (writer golden bytes + re-read roundtrip),
        psd-import.test.ts (fixture corpus incl. groups, luni, RLE, reject
        cases), project.test.ts (.pfs roundtrip for all 6 layer kinds + masks +
        guides + validation rejects).
    P5-b Persistence + PWA:
      - src/storage/idb.ts / autosave.ts / recovery.ts per §3.12 (+ tests with
        fake-indexedDB), src/workspace/autosaveClient.ts wiring, recovery offer
        dialog on crash flag.
      - PWA: manifest.json, sw.js (shell cache + offline runtime), PwaRegister
        (skip localhost), scripts/gen-icons.mjs (sharp → icon-192/512/maskable +
        favicon from one SVG), icons committed.
    Acceptance tests:
      A5.1 vitest: psd, psd-import, project, storage suites pass.
      A5.2 .pfs roundtrip: build doc with raster+text+shape+fill+adjustment+group
           + mask + guides → save → load → pixel-identical composite.
      A5.3 PSD: exported file re-imports with same layer count/order/blends/
           names; GIMP/Photopea open check documented in worklog (manual once).
      A5.4 Autosave: edit → wait interval → kill tab → reopen → recovery offer
           restores last safe state. Save-on-hide fires on visibilitychange.
      A5.5 Production build offline: load app, go offline, reload — editor boots
           and edits work (PWA).
    Handoff note: P5-a and P5-b are parallelizable (disjoint files) — same Task
    ID prefix, separate sub-agents, one merge + gate.

     PHASE 6 — ADVANCED: WEBGPU, AI, CAF, PERF (Tasks P6-a, P6-b) =
    Mission: the differentiators + the performance pass.
    P6-a WebGPU display path:
      - src/canvas/gpu.ts per §3.14 — present-only, full fallback chain, texture
        lifecycle, diagnostics; SettingsDialog renderer pref; StatusBar badge.
      - tests/unit/gpu-math.test.ts (mat3 presentation math, sampling switch
        thresholds, fallback decision table) — GPU itself tested manually/E2E.
    P6-b AI + content-aware fill + perf:
      - src/engine/segmentation.ts per §3.15 + FilterDialog 'ai' category wiring
        (remove-background) + Select-Subject command.
      - Content-aware fill: Edit-menu command using worker 'inpaint' op honoring
        the selection; progress UI; honest hint text; commitPixelEdit undo.
      - Performance pass per §3.17: verify slider coalescing, thumbnail cache +
        clearThumbnailCaches on doc switch, idle-stop rAF, cached checker,
        transferables — plus a perf checklist run recorded in worklog.
      - WebGPU/WASM memory-safety audit: destroy-before-create, isDestroyed guard,
        texture-limit fallback (tests where math is involved).
    Acceptance tests:
      A6.1 gpu-math suite passes; fallback table exhaustive.
      A6.2 remove-background on a test portrait keeps subject, clears border
           region (probe pixels), feather smooths edge alpha.
      A6.3 Content-aware fill on smooth gradient + hard 64px hole → boundary-
           continuous fill, deterministic across runs; structured texture stays
           honest-blurred (documented, not fixed).
      A6.4 Perf checklist: 4000×3000 doc, 6 layers — pan/zoom 60 fps target on
           dev hardware; frame counter idle-stops; history stays ≤ budget.
    Handoff note: P6-a and P6-b touch disjoint files — parallel dispatch OK.

**Notes on this text** (outside the quote, and these notes win over it):

- **Missing and not invented:** Section 1; sections 3.1 to 3.12 (the phases
  cite §3.1, §3.2, §3.3, §3.4, §3.6, §3.7, §3.8, §3.9, §3.10, §3.11 and
  §3.12); Phase 7 (named in the protocol's `v1.0` tag rule); Sections 5 to 7.
  A phase whose deliverable cites a missing section waits for that text, or
  gets its own request, rather than building from a guess.
- **Theme conflict:** "dark theme tokens" (P0 `globals.css`), "colorScheme
  dark" (3.17) and the manifest "theme" (3.13) yield to "## Design": both
  looks, following the viewer's Homeroom theme; the manifest theme colour
  comes from the design tokens.
- **Name:** the P0 placeholder renders "Pixel Studio", not "PixelForge
  Studio".
- **Gates:** P0's `bun run lint` must still include
  `node scripts/check-boundaries.mjs`, as the gates table says. P0 creates
  `src/lib/` and `src/components/`, and P1 names `src/history/`; these are not
  in the allowed-imports table, so the checker reports them as "unknown
  module". The phase that creates each one adds it to the table on purpose,
  as the Architecture rules require.
- **CI:** A0.4 asks for GitHub Actions; Homeroom's own checks gate merges and
  there is no direct push, so CI runs on whatever Homeroom pushes.
- **First slice:** P0, then P1 (document model and renderer) as the first
  editing slice, per @makredo on 2026-10-22.
