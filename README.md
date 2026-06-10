# MIRL Rephoto

**Lay an old photograph over a new one of the same building, and see what
changed.**

MIRL Rephoto is a free, friendly tool for two closely related tasks in the study
of buildings and places:

- **Align** a historical photograph to a current one of the same subject, even
  when the two were taken from different spots, so you can swipe and blink
  between them.
- **Square up** a photograph taken at an angle into a flat, head-on elevation,
  and then **measure** real distances off it.

It was built for **architectural and art historians, conservators, archivists,
and students**. **You do not need to know how to code to use it.** It opens with
a sample already loaded: a sepia photograph of a building, taken at an angle, and
a straight-on view of the same building today.

---

## What you might use it for

- **Rephotography.** Hold a 1920s street photograph against the same corner now,
  matched and aligned, to show a century of change in one swipe.
- **Documenting loss and repair.** Line up a facade before and after an
  earthquake, a war, a demolition, or a restoration.
- **Squaring a facade.** Turn an oblique snapshot of an elevation into a flat,
  measured drawing, the kind you can trace or annotate.
- **Measuring from a photograph.** Once a facade is squared and you know one real
  dimension, read off the others: a window height, a doorway width, the spacing
  of a colonnade.

---

## Aligning two photographs

1. Load the **historical** photo on the left (**Then**) and the **current** one on
   the right (**Now**). Drag a file onto a frame, or use the **Load** button.
2. Click a feature on the Then image, then the **same feature** on the Now image.
   The corners of windows, doors, and stonework make good, sharp targets.
3. Place **four or more** pairs. The more you place, and the more spread out they
   are, the better the fit. A running **pixel fit error** tells you how well the
   points agree.
4. Open **Compare**. The Then image is warped onto the viewpoint of the Now image,
   and you read the difference three ways:
   - **Curtain**, a divider you drag across the frame.
   - **Onion skin**, fading one into the other.
   - **Blink**, flipping between them so changes jump out.

You can drag any point to refine it, or delete a pair from the panel, and the
alignment updates as you go.

---

## Squaring a facade, and measuring

Switch to **Rectify and measure**.

1. Choose whether to square the **Then** or the **Now** image.
2. Click the **four corners** of something you know is truly rectangular and flat:
   a window opening, a door, a signboard, a stone panel. Go clockwise from the
   top-left.
3. Enter the rectangle's **true proportion** (its real width-to-height ratio). The
   image is warped so that rectangle becomes square to the camera, and the whole
   facade is squared with it.
4. To measure: type the **real width** of that rectangle and its unit, turn on
   **Measure**, and click two points. Rephoto reads the distance between them in
   real units. (Without a known width, it reports the distance in pixels.)

Measurement is only as honest as its assumptions: the surface must be flat and
the proportion you entered must be right. Treat the numbers as careful estimates,
not survey data.

---

## Saving your work

From the **Export** menu:

- **Save the current view as a PNG.** In Compare this is the aligned overlay; in
  Rectify it is the squared elevation, rendered at full resolution.
- **Save points and homography** as `.json`: every control point, the computed
  transform, and the fit error, for your records or for use in other software.
- **Save the project** and open it again later. Web-loaded images return on their
  own; for images from your computer, your points are kept and you re-load the
  files.

---

## Running it

MIRL Rephoto is a plain web page with no build step and nothing to install.

- **Double-click `index.html`** to open it in your browser, or
- serve the folder (`python3 -m http.server 8000`, then visit
  `http://localhost:8000`). It also runs as-is on **GitHub Pages**.

To regenerate the sample images, run `python3 samples/make-samples.py` (needs
[Pillow](https://python-pillow.org)).

---

## A note on what the math assumes

Aligning two photographs with a single homography is exact when the subject is
**flat** (a facade, a painting, a map) or when the two photographs were taken from
the **same spot** and only rotated. For a deep building photographed from two very
different positions, parts at different depths cannot all line up at once; align
the plane you care about and expect foreground and far-back elements to drift.
This is a property of perspective, not a fault in the tool.

---

## Technical reference

- **The homography** (a projective transform) is fitted from the point pairs by
  the normalized Direct Linear Transform, in `js/homography.js`, with least
  squares when more than four pairs are given. No libraries.
- **Warping on screen** is done with a CSS `matrix3d` transform, so it is
  resolution-independent and uses the GPU.
- **Warping for export** is done by subdividing the image into a fine triangle
  mesh and drawing each cell with an affine texture map onto a canvas, which
  reproduces the projective warp at full quality.
- **Measurement** assumes the marked quadrilateral is rectangular and coplanar,
  and that the proportion entered is correct; scale is then uniform across the
  squared image.
- **No data leaves your machine.** Everything runs in the browser. Images can be
  exported to PNG only if loaded from your computer or from a server that allows
  cross-origin reading (CORS).

### Layout

```
mirl-rephoto/
├── index.html
├── css/style.css
├── js/
│   ├── homography.js   # fit and apply the projective transform
│   ├── align.js        # control points + the compare overlay
│   ├── rectify.js      # square a facade + measure
│   └── app.js          # loading, modes, panel, export, samples
└── samples/            # the then / now demonstration pair + its generator
```

---

Built at the [Material / Image Research Lab](https://mirl.arthistory.ucsb.edu),
Department of History of Art & Architecture, UC Santa Barbara.
Released under the MIT License.
