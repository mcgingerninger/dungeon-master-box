# Monster token art

Two renderers feed `monsterArtSvg(monster, px, framed)` in `monster-art.js`:

* **Original sprites** (`monster-art.js`): 32x32 flat-shaded drawings, one per creature kind, recoloured per palette.
* **High-detail portraits** (`monster-art-hd.js`): 64x64 *lit* head-and-shoulders portraits. Used for every kind listed in
  `MonsterArtHD.kinds` (currently `dragon`); any other kind falls back to the original sprite, so the two sets can mix.

## How an HD portrait is made

Each part (skull, snout, jaw, horn, spines, teeth, eye...) is a polygon or ellipse drawn into a **height field** with a rounded
profile, so overlapping parts sit on top of each other. The finished field is then lit per pixel:

* key light from the upper left, a faint ambient floor, a cold rim light on the lower-right edges;
* contact shadows where a taller part sits just up-left of a pixel;
* per-material colour ramps (scale, dark scale, belly plates, horn, mouth, teeth, eye glow), a surface texture (worley
  "reptile hide" cells, plate bands, horn ridges) and a specular term for glossy materials;
* the result is quantised to each ramp's steps with a light ordered dither, then given a 1px dark outline;
* `halo()` tints pixels around a light source (the eye, the lit mouth).

The whole drawing is pulled in slightly (`FIT`) so it sits inside the round token, and the framed token gets a darker,
vignetted backdrop. Palettes come from `monster-art.js` (`PAL`), so a red/blue/gold... dragon is the same drawing recoloured;
metallic palettes get a stronger specular term.

## Adding a kind

Add `DRAW.<kind> = (S, materials, palette) => { ... }` in `monster-art-hd.js` using `S.poly`, `S.ellipse`, `stroke()` and
`spline()` on the 64x64 plan (creature facing right), and it is picked up automatically. `monster-art-hd.test.js` checks the
grid size, darkness and the SVG choice.
