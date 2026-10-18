# PixelForge Studio

A layered, pro-style image editor that runs entirely in your browser.

- Open one or more images (PNG, JPEG, WebP, GIF, BMP, SVG) or native `.pfs` projects as tabs.
- Edit with layers (raster, text, shape, fill, adjustment, group), layer masks and clipping masks.
- 16 blend modes, 12 adjustments (as adjustment layers or applied to pixels), 25 deterministic filters with live previews and non-destructive smart filters.
- Selections: rectangular and elliptical marquee, lasso, polygonal lasso, magic wand, with add/subtract/intersect, feather/grow/contract/border/invert and marching ants.
- 25 tools including brush, eraser, gradient, clone stamp, spot healing, text, shapes and pen.
- Multi-document tabs, memory-aware undo/redo with a history panel, navigator, histogram and colour panel.
- Export PNG, JPEG, WebP or AVIF at 0.5x to 4x; save and reopen projects as `.pfs`.
- Per-device IndexedDB autosave with restore after a crash.

Everything runs on your device. Nothing is uploaded; the app has no database
and no account data.

Open `/?demo=1` for a staging demo: a layered harbour-sunrise sample document.

## Development

```sh
npm install
npm start        # serves public/ on :3000
```

There is no build step; edit the files in `public/` directly.
