# Pixel Studio

A free, professional-grade photo editor that runs entirely in your browser.
Open one photo from your device, adjust its brightness, contrast and
saturation with live preview, press and hold the photo to compare it with the
original, and download the edited result at full size.

Everything happens client-side: nothing is uploaded, nothing is stored, and
the original file is never changed. The saved photo keeps the original's
format where the browser can write it (JPEG stays JPEG, PNG stays PNG,
anything else saves as PNG) and is named after it with `-edited` added.

## How it works

- A static single page (`public/`) served by `server.js` (Express). No
  database, no API routes, no accounts.
- `public/app.js` is the editor: a small `empty → loading → ready` state
  machine plus error states, decoding with `createImageBitmap` (which keeps
  EXIF orientation), a preview canvas driven by a CSS `filter`, hold-to-compare
  on pointer or Space, and a full-size save through `toBlob`.
- `public/adjust.js` holds the pure `applyAdjust` maths that matches the
  preview's CSS filter chain, so the downloaded file looks like the preview.
- `?demo=1` loads a bundled drawn photo (`public/demo/harbour-sunrise.svg`,
  rasterised at 4032 × 3024 as "harbour-sunrise.jpg") with adjustments already
  applied, labelled "Staging demo" at the top of the screen.
- Styling is the app's design kit: tokens in `styles/tailwind-input.css`,
  compiled by `npm run build` to `public/tailwind.css`. Warm neutral greys and
  one burnt-orange accent, light and dark, following the viewer's Homeroom
  theme.

## Develop

```sh
npm install
npm run build   # compile the stylesheet
node server.js  # serve on :3000
```