# Changelog

All notable changes to MIRL Rephoto are recorded here. Versions follow
[semantic versioning](https://semver.org); project files from any earlier
version open cleanly in any later one.

## 1.1.0 (2026-11-06)

Rephoto takes the lab's own identity, and gathers the fixes and additions made
since the first release. Project files from 1.0.0 open as before.

- **The MIRL identity.** Familjen Grotesk for names, headings, and readings and
  Epilogue for everything you read and operate, the same faces as the
  Material / Image Research Lab's site, on the lab's paper white. Rephoto's
  key is the yellow of the MIRL Risograph mark, paired with coral in the bloom
  beside its name; wherever it is text it darkens to ochre to keep its
  contrast. Then is blue and now is red, as in MIRL Aftermath, and a measured
  distance is drawn as a red-line dimension. Both typefaces are vendored in
  `fonts/` under the SIL Open Font License, with their licence texts; Spectral
  is retired.
- **One bar, plain words.** The mark, the three sheets, and Export sit on one
  line, with the controls for the current sheet on a second. The sheet codes
  (R-01 to R-03) and the stamped capitals are gone; the title block keeps the
  drawing-sheet form in sentence case. Every text colour meets WCAG AA.
- **Rectify shows the image again.** The squaring panel had collapsed to no
  height and left the stage blank; it now fills the stage.
- **Corners in any order.** Rectify sorts the four corners itself, so the order
  you click them in no longer garbles the elevation.
- **A scale bar** is burned into the squared-elevation export when a known width
  is set.
- **Autosave.** The working state is kept in the browser, and a refresh restores
  your points.
- **Fixes.** Swapping then and now keeps the next point on the right side, and
  Compare waits until both images have loaded.
- **Keyboard and assistive technology.** A visible focus ring, and sheets and
  toggles that announce their state.
- **Phones.** The panel sits beneath the photographs.

## 1.0.0 (2026-06-10)

First public release, archived on Zenodo
([10.5281/zenodo.20651089](https://doi.org/10.5281/zenodo.20651089)).
