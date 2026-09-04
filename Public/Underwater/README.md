# Zeeb Underwater

A free-swim ocean for Zeeb built on three.js. Version 0.1 (2026-09-02) has no
goal yet: the point is that steering Zeeb feels good and the ocean is worth
swimming around in.

## Run it

The page uses ES modules and loads a GLB, so it needs a web server rather than
a `file://` open. From the repo root:

    .\start-server.ps1

then open <http://localhost:8000/Underwater/> in Firefox. It deploys with the
rest of `Public/` on a push to `main`, so it is also reachable on
gamesbygrace.com under `/Underwater/` once pushed.

## Controls

- Arrow keys or WASD swim and turn. Space rises, Shift (or Q/E) dives and rises.
- Touch or mouse: drag anywhere to steer; holding at all swims forward.
- The depth readout is minus Zeeb's y, in feet. World units are feet.
- M toggles music; the two buttons top right do the same and skip songs.

## The fish

`fish.glb` is Grace's grey Zeeb Islands fish, modelled in Blender by
`../../blender/fish_build.py` and exported decimated (under 100 KB, a few
thousand triangles, since a school is hundreds of copies) as
`Fish_low.glb`, then copied here. The page merges its parts into one
vertex-colored geometry and instances it for all seven schools. Rebuilding the
fish means re-running that script and copying `Fish_low.glb` over this file. If
the model fails to load, grey cone stand-ins swim instead.

## Music

Five of Grace's Zeeb Islands tracks play in a loop, referenced in place from
`../Islands/Audio/` so nothing is duplicated. They run through a Web Audio
lowpass filter whose cutoff follows depth: about 16 kHz (fully open) at the
surface down to 600 Hz at the sea floor, so songs sound muffled in the deep
and open up as Zeeb rises. Browsers block sound before a user gesture, and a
finger pressing down does not count as one (only the lift does), so playback
begins on the first key press, mouse press, or finger lift. Every start is
verified: `music.started` only becomes true once `play()` went through and the
AudioContext reports `running`; a refused start leaves it false and the label
asks for a tap, so the next gesture retries. Until music is really going, the
Music button and the M key mean "start", not "off". Returning from another tab
or the lock screen resumes it, or asks for a tap if the browser refuses. If a
browser will not run the Web Audio graph after two real gestures, the song
continues on a plain `<audio>` element with no depth filter. The fps readout
top right also shows the music state (`idle`, `paused`, `suspended`,
`playing`) so a phone can be diagnosed without a console.

## What is in the water

Everything except Zeeb is generated in code at startup from a fixed seed, so the
ocean is laid out the same on every visit. Kelp beds sway in a vertex shader,
coral gardens and boulders are merged into single draw calls, seven fish schools
loop on their own paths and part around Zeeb, jellyfish pulse and glow, light
shafts hang from a rippling surface, caustics play on the sand, a treasure chest
sits against the tall dune, and five stone rings pulse when Zeeb swims through
them. Water color and fog darken with depth.

## Files

- `index.html` is the whole game.
- `zeeb.glb` is the 633 KB meshopt-compressed Zeeb, copied from
  `1_Code\Times Tables\lab\waterfall3d\`. The source model is
  `blender\Zeeb.glb` in this repo (5.7 MB). Zeeb faces +z at rest, feet at
  y 0.09 in model space.
- `vendor\` holds three.js (module build plus `three.core.min.js`), the
  GLTFLoader and utils addons, and the meshopt decoder, also copied from the
  waterfall lab.

## Render checks without a person watching

Headless Firefox `--screenshot` captures before module scripts run, so it only
ever shows the loading overlay. Use Playwright's Chromium instead (see the
memory note on headless render checks).
