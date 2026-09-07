# Zeeb Underwater

A 3D ocean for Zeeb, with Grace’s fish, a lost-treasure hoop course, and a
colossal shipwreck to explore. Search three decks and ten named areas for
142 collectible coins. There is no time limit or damage.

## Run it

From the repository root, run `./start-server.ps1`, then open
<http://localhost:8000/Underwater/> in Firefox. ES modules and GLB models
require HTTP; opening `index.html` as a local file does not work.
`Public/` is the Netlify publish directory. Pushes to `main` deploy the game to
<https://gamesbygrace.com/Underwater/>.

## Play

Choose **Find the treasure** for the hoop course, **Just explore** for free
swimming, or **Explore the wreck** to start beside the ship's open port entrance.

- Rally: Zeeb swims forward automatically. Arrow left/right or A/D steer.
  Depth assistance aims for the current hoop; manual rise/dive overrides it.
  Aim roughly toward the gold hoop, then release steering for a gentle
  alignment assist. Holding a turn takes priority over that assistance.
  Tight bends ease the speed so there is time to turn.
- Free swimming: arrows or WASD swim and turn. Space/E rises; Shift/Q dives.
- Mouse: hold and drag on the water. Horizontal movement turns;
  vertical movement controls depth. A visible joystick shows the drag.
  **Rise**, **Sink**, and **Back** also stay visible on mouse-only devices. Explicit
  keyboard depth input takes priority over a vertical mouse drag.
- Touch: hold the large swim pad (or the water) to swim, and slide left/right
  to turn and up/down to rise/sink. Center your thumb to hold depth. Lift to
  stop in exploration; the hoop course keeps cruising. **Back** reverses.
  Optional **Rise** and **Sink** buttons can be enabled under **Menu → Music &
  settings → Touch depth buttons**. A second finger can use them while steering.
- B or **Boost** gives a 1.6-second burst, with a five-second refill.
  Passing a hoop keeps the same pace; speed bursts happen only when chosen.
- P, Escape, or **Menu** pauses. Switching tabs or losing window focus also
  pauses and clears held inputs. Resume with **Keep swimming**.
- **Back to hoop** is available in the paused race menu. It
  returns him to the approach without taking points away. A lap using this
  help still finishes but does not replace the best time.
- M or **Music** toggles audio. Music, Next song, camera and graphics choices
  are under **Menu → Music & settings**, including on narrow screens.
- Wreck exploration: swim through the broad hull breaches, doorways and deck
  hatches. Space/E rises; Shift/Q dives. On touch, slide up/down to change
  decks. **Back outside** in Menu returns to the entrance without losing coins.
  A compact coin total stays on screen; Menu shows the nearest area and clue,
  plus **Find coins again** after all coins are collected.

The default touch playfield has four buttons: Menu, Swim, Boost and Back.
Mission changes, settings, instructions and replay choices live in the paused
menu. The stopwatch is also in Menu during a lap; the finish still shows the time.
Progress and depth remain compact; touch targets stay at least 44 pixels.
Keep swimming stays pinned while a paused menu scrolls. The paused ocean
renders at most ten times per second to reduce GPU work; menu scrolling remains
native. Resume samples the normal frame clock without catching up paused time.

Zeeb cruises at 11 feet per second, follows his nose with very little sideways
drift, and brakes quickly when you let go in free swimming. Touch turning tops
out at about 36 degrees per second, with an especially soft center and a
critically damped spring for gentle onset and reversals. Mouse and keyboard
retain their full turning range; touch depth response is unchanged. The thumb pad uses
44 pixels of travel in either axis, so all four directions fit inside the pad
and away from the screen edges. Its center stays fixed: return to the center to
straighten and hold depth. Holding an arrow on the pad also gives directional
input. Small central movements remain neutral (about 6 pixels horizontally,
12 vertically). Touch steering on the open water uses a 120-pixel horizontal
drag, a soft center, and a gentler maximum
turn. Small held-finger corrections have a softer response; direction changes
use a damped spring to ease both the turn and how quickly it changes.
Reversing a held finger no longer accelerates the response abruptly.
Lifting clears both axes and the stored turning velocity. Open-water touch depth uses
a 64-pixel drag with an approximately 12-pixel neutral zone for small wobble.
On open water, long swipes carry the steering origin along on both axes, so there is no
excess drag to undo. Mouse steering uses
110 pixels horizontally and 150 vertically, with a soft response near the center
and a small dead zone that ignores hand jitter. Mouse turns ease in, settle
faster when centering or reversing, and clear immediately on release. The visible
joystick follows that smoothed input. The chase camera keeps up with changes
of direction; Zeeb's bank is capped.

Turns ease in and settle faster on release or reversal. Yaw integrates the
easing curve exactly, avoiding an extra turn on a slow frame. Rise/Sink also
settles faster on release, while retaining the same full-depth speed.
Body lean anticipates steering intent; pitch and camera zoom use exponential
smoothing. These visual accents do not change the collision shape.

Successive hoops are 63–80 feet apart, about 40% farther than the prior
layout and roughly 6–7 seconds apart at cruising speed. This gives more room
to steer through bends and recover before the next opening. The third hoop keeps a long,
nearly straight approach at the same depth as hoop two. The moon arch,
reef outcrops, fish, jellyfish grove, and treasure cove follow the wider route.
The ocean boundary leaves additional room outside the course for corrections.

The golden hoops have thick gold rims and clear openings about 11.6 feet across.
The rim grew outward, preserving both the opening and the scoring tolerance.
The stone exploration rings are fuller too, with their openings preserved.
Only the current golden hoop scores.
A movement segment must cross its
opening, in either direction. Merely sitting inside does not count, and a
boost cannot skip detection. A pass earns 100 points; a pass within 2.4 feet
of center earns another 50, plus a perfect-streak bonus capped at 50 per hoop.
The twelfth hoop unlocks a wooden chest in the separate treasure cove. Its curved lid opens
to reveal gold coins, colored gems, and a golden compass. A short coin burst
celebrates the discovery when reduced motion is off. **Hunt again** closes
the chest and starts a fresh course;
best unassisted time for this course is stored locally when browser storage
is available. The calmer handling uses its own record (`zeeb-reef-best-v5-calm`), preserving
records from earlier handling versions.

## The sky whirlpool

Choose **Menu → Find the sky whirlpool**, then hold the swim pad to swim straight
into the swirling water. It is also discoverable while freely exploring at
x=-55, z=50, with entry depths between 6 and 48 feet. It never interrupts a hoop lap.

The 43-second guided ride lifts Zeeb out of the water, launches him about 1,000
feet into a dark star field while Zeeb himself spins through six full turns.
Grace's 3D asteroid-game rocket passes behind him as a separate sky visitor.
Zeeb starts falling before his pastel parachute pops open, then glides through
clouds to splashdown. The camera holds a steady bearing during the spin.
The rocket follows `../astroid-dodger/img/Rocket1.png`: gray body, red fins,
purple antenna and two portholes. Zeeb remains outside it throughout the ride.
His face stays visible during the glide. A soft ripple and droplets mark the
return to free swimming at (-27, -22, 28), clear of the whirlpool entrance.

The ride steers itself. Menu/P/Escape and loss of window focus pause it;
**Return to the ocean** in Menu exits early. Switching to another activity also
ends the ride cleanly. Reduced motion uses one slow character turn instead of
six, and removes the spiral path, canopy sway and rocket flame pulse. The whirlpool still turns gently
with reduced motion; otherwise it rotates at 1.1 radians per second, with foam
rising through the spiral. A cooldown prevents accidental repeat rides; choosing the
Menu shortcut explicitly makes another ride available immediately.

The funnel uses shared geometry and one small procedural shader. Stars and
cloud banks are batched; all sky scenery is hidden outside the ride. The rocket
and parachute total 2,414 triangles. Swimming controls and the normal underwater
camera range return after landing or cancellation.

## Grace’s art and the reef

Zeeb swims on his own, with no boat or added feet. `zeeb-swimmer.glb` is a
new Blender model guided by the actual toy photographs `IMG_7711.jpg`
through `IMG_7714.jpg` in the repository's `img/` folder. It has a round
head, broad orange bill and lower lobe, tiny close-set eyes, broad black
ears, a scalloped mane, a rounded scoop tail, and curved tapered stripes.
The editable master, packed reference photos and reproducible build script
are in `../../blender/swimmer-20260906/`. The prior `zeeb.glb` is preserved;
`fish.glb` is unchanged. The seven instanced fish schools use Grace’s
grey fish model. Two schools follow paths close to the rally.

Touch devices default to the steady chase camera. After swimming in Explore,
letting Zeeb settle and rest briefly earns a 2.4-second hello: his visual body
turns toward the player while the chase camera stays behind his swim heading.
Moving again cancels it. Another swim and a cooldown are required before it
can repeat; merely entering Explore leaves time to read the help.

**Camera: Playful / Steady** remembers the choice locally. Playful also earns
a 1.8-second glance after steering settles on a straightaway, with a small
camera swing (smaller in portrait). Steady keeps the stationary hello.
Optional greetings/glances are suppressed during active touch steering,
depth input, boosts, near the wreck, or within 18 feet of the target hoop.
Reduced motion suppresses both optional poses and camera swings, including
when Playful is selected. The welcome view shows Zeeb from the front; at the
finish a separate view frames him beside the open treasure chest. Reduced
motion cuts to that finish view and skips the flying coins.
Hoop badges respect scene depth, so they cannot draw through his face.

The environment follows generated storybook reef concepts. Lavender
stone terraces carry mint and lilac shelf coral, rounded peach and pink
branching coral, and recessed yellow and lilac sponges. Blender-built coral
prototypes and a joined stone arch replace the angular forms. Broad curling
kelp, small shells, rounded starfish, and turquoise coral clusters fill the
edges of a clear sandy lane. Grace's character, fish, and hidden shark art
are preserved.

The reef uses 39 unevenly spaced pockets with rounded coral crowns, broad
shelf ledges, tall stone outcrops, low sponge shoals, bare rocks, and kelp.
Each stretch has its own planting mix, with open gaps between denser gardens.
Broad rocks meet the sloping sand with smooth, grounded undersides.
Two lacy sea fans serve as course landmarks, with another growing on the wreck.
Three cream conch shells and a small
anemone colony mark the shell garden; other anemones grow in occasional
uneven patches. A lone terracotta jar near the moon arch foreshadows the
colossal wreck inside the course loop. The earlier small cargo cluster has
been incorporated into the ship. Planting and old stone rings give its hull
space, while the sandy hoop corridor stays open.
Scenery geometry is generated once from reusable forms, then merged by material
within spatial cells. Course fans share the coral material. Ship materials are
also split into cells so an off-screen section can be skipped independently.

The ship's main hull is 190 feet long and 64 feet wide, centered at x=97,
z=60, with its keel around 64 feet deep. Its bowsprit extends beyond the hull.
Bent ribs, staggered broken timber courses, a raised arched captain's cabin,
two broken masts, ragged canvas, slack rigging, lanterns and reef growth follow
the generated galleon concept. Three decks have broad aligned hatches and
multiple side entrances. The cargo hold contains crates and barrels; the galley
has pots and a bench; chart tables and a wheel furnish the stern rooms.

Coins use Grace's original `../Islands/img/coin.png` as their shape reference:
a tall asymmetric gold oval, a beveled edge, and her orange stroke raised on
both faces. The shape is geometry, with no runtime image download. Wreck coins
keep their instancing and distance-based detail culling; the chest and celebration
use a simpler merged version. They retain a generous 3.6-foot pickup radius,
soft chimes and bubbles. A swept pickup catches coins between frames and checks
walls before awarding them. The ten named areas include the broken bow, cargo
hold, lantern gallery, galley, hidden cargo, map room, open deck, captain's cabin,
crow's nest and stern balcony. Finds persist in `zeeb-wreck-coins-v1` when browser
storage is available; hoop replays do not reset them. After all 142 are found,
**Find coins again** explicitly starts a fresh coin hunt.

Only the ship has solid deck/wall collision. Small substeps stop boosted movement
passing through thin boards and let Zeeb slide along walls. The camera shortens
its chase distance to 6.8 feet near the wreck, widens to 68 degrees, suppresses new
turn glances and clips against solid timber. Decorative ropes and small fittings
do not block swimming. The seafloor blends down under the hold; the hoop lane's
original height is preserved.

A shallow sand shelf follows the course, about 11 feet below the hoop
centers, then blends into the deeper ocean. It brings small plants and the
animated light patterns into view. Surface light patterns, a baked reflection
dome, and (in Detailed graphics) soft local shadows give the forms depth.
When enabled, the shadow map updates after six feet of movement and while the
treasure opens. Scenery is merged by material within cells; the sea floor is
tiled without changing its triangles, heights, or normals. Jellyfish, three
exploration stone hoops, and bubble vents remain.
The treasure cove has weathered boat ribs, broken planks, a low stone shelf,
coral, and kelp. The older decorative chest and clam finale have been replaced
by this single chest with an opening lid. Reef placement uses fixed seeds
and authored coordinates.
Custom shaders apply output color conversion before fog, matching the built-in
materials and avoiding a horizontal color seam in the water.

Grace’s original `../Islands/level2/Shark_Grace.png` is tucked inside a rocky
alcove off the course, around x=175, z=24 near the floor. It is a stationary
drawing, with no chase or attack behavior. Approaching it reveals a discovery
message. Its texture is referenced in place, without a duplicate asset.

## Graphics and frame timing

**Graphics: Auto** is the default. Touch devices start at Smooth and other
devices at Balanced. The controller measures actual frame intervals, reduces
quality after sustained slow frames, and only tries an upgrade after sustained
headroom. A tier that proved too expensive is not retried until Auto is selected
again or the page reloads. Pause and background gaps do not lower quality.

The graphics button cycles through Auto, Smooth, and Detailed and saves that
choice locally. The internal Light fallback is available to Auto. Profiles cap
both pixel ratio and total drawing-buffer pixels, reduce decorative light counts,
fish density and ambient bubbles, and reserve soft shadows and the original
caustic shader for Detailed. Smooth/Balanced use simpler moving light patterns;
Light disables those patterns. Zeeb, the course, terrain, ship collision, and
collectibles stay the same. Off-screen fish schools keep their paths but skip
per-fish matrix updates until visible.

Swim physics and hoop checks subdivide each frame into steps no larger than
1/60 second, covering up to 0.25 seconds of elapsed time per frame. This avoids
the former slow motion below 20 FPS while bounding catch-up after a long stall.
The debug FPS counter uses uncapped elapsed time, separately from simulation.

## Music

Five of Grace’s Zeeb Islands tracks play from `../Islands/Audio/`. The existing
mobile-friendly playback flow is retained: playback begins after an accepted
user gesture, verifies that audio is running, retries refused starts, and falls
back to plain audio if the Web Audio graph repeatedly fails. The depth filter
ranges from about 16 kHz at the surface to 600 Hz at the floor. Rally chimes
use a separate audio context unlocked by interaction and follow the music toggle.

## Files

- `index.html`: original ocean, models, audio, input, swim physics, camera,
  and integration with the rally and reef.
- `reef-rally.js`: hoops, scoring, boost, countdown, pause, finish, and game UI.
- `reef-course.js`: course coordinates, zone names, and swept crossing function.
  `COURSE_SCALE` stretches horizontal spacing; reef landmarks use the same scale.
  Keep the `.js` suffix: this Windows Python server serves `.mjs` as text/plain.
- `reef-world.js`: reef landmarks, treasure integration, and the hidden drawing.
- `colossal-wreck.js`: ship geometry, colliders, room UI, instanced coin rendering,
  pickups, and the exploration entrance/return controls.
- `wreck-layout.js`: hull dimensions, terrain footprint, room positions and stable
  coin IDs; shared by the ship, seafloor, planting and checks.
- `wreck-physics.js`: substepped collision, camera clipping, swept pickups and
  persistent coin progress, independent of the renderer.
- `sky-flight.js`: deterministic lift, launch, float, parachute and landing path.
- `sky-ride.js`: whirlpool entry, ride lifecycle, sky scenery, camera and menu access.
- `grace-rocket.js`: Grace's 3D rocket and pastel parachute.
- `grace-coin.js`: traced original coin silhouette, double-sided raised stroke,
  satin material and a lighter treasure-pile mesh.
- `treasure-cove.js`: chest and wreck geometry, hinged lid, coins, gems,
  compass, completion/replay animation, and finish camera framing.
- `reef-garden.js`: sculpted terraces, plants, sand discoveries, arch placement,
  materials, kelp geometry, and shared animated caustics.
- `scenery-forms.js`: reusable sea fans, anemones, conch shells, jars, barrels,
  anchors, wheels, rope coils, and broken hull ribs.
- `reef-scenery.js`: route-aware scenery placement, sand contact, material
  batches, wood grain, and metal patina.
- `coral-forms.js`: three Blender coral meshes and the joined stone arch.
  Rebuild locally with `../../docs/reef-art-style/build_coral.py` using Blender.
- `zeeb-scooter.js`: the camera glance controller; the earlier procedural
  scooter builder is retained but is no longer instantiated.
- `touch-controls.js`: captured mouse/touch pointers, visible swim pad,
  two-axis touch steering, optional depth/reverse holds, and release/pause clearing.
- `quiet-hud.js`: paused menu organization, optional touch depth-button preference,
  and menu keyboard focus handling.
- `scooter-handling.js`: responsive steering, acceleration, lateral grip,
  depth movement, and approach assistance shared with driving checks.
- `rally.css`: desktop and small-screen game UI, focus styling, and reduced
  motion adjustments. Reduced motion removes camera banking/FOV boosts and
  decorative hoop rotation; normal game movement remains.
- `zeeb-swimmer.glb`: photo-guided swimming Zeeb; `zeeb.glb`: preserved prior
  model; `fish.glb`: the decimated fish from
  `../../blender/fish_build.py` / `Fish_low.glb`.
- `vendor/`: local three.js, GLTFLoader, geometry utilities, and meshopt decoder.
- `reef-performance.js`: quality budgets, automatic quality decisions, shared
  shader detail uniform, and bounded frame timing; its policy is testable in Node.
- `reef-chunks.js`: spatial scenery batches and sea-floor tiles that preserve the
  original geometry and allow independent frustum culling.

## Check it

Use Firefox DevTools against the local server. `?debug` exposes FPS, draw
calls, active graphics profile, and music state. `?preview` hides the game UI and starts in free swim
for footage. `window.__ocean` exposes the scene, renderer, character, controls,
rally, and reef for inspection.
`__ocean.reviewView(...)` pauses at a fixed camera, character position, and
animation time for art comparisons. Reload to return to the normal game.
The local `../../docs/reef-art-style/` folder contains both generated concepts,
their exact prompts, comparison screenshots, the Blender build script, and
an interactive before/concept/in-game comparison.
`../../docs/lost-treasure/` contains the treasure target concept, exact prompt,
final screenshots, and the archived pre-treasure README and scene files.
`../../docs/reef-scenery/` contains the shell-garden and wreck-trail concepts,
exact prompts, before/after screenshots, and an interactive comparison.
`../../docs/reef-variety/` records the later layout pass that reduces
repetition while keeping those materials and assets.
`../../docs/colossal-wreck/` contains the galleon concept and exact prompt,
archived scene files, exterior/interior proofs and exploration checks.
Add `?wrecktest` during automated exploration to keep test pickups out of the
player's saved progress. `__ocean.reef.wreck` exposes the actual colliders, room
layout and coin progress for inspection.

The iteration was checked with a full course driven through steering inputs,
swept-crossing edge cases, miss/retry and duplicate-score checks, pause/input
clearing, and desktop/small-screen rendering. Handling checks also complete
the course with coarse quarter-second steering corrections at 20, 30, 60,
and 144 updates per second, with and without manual boosts. Run them with
`node docs/reef-rally-checks/handling-check.mjs` from the repository root.
`node docs/steering-polish/checks.mjs` checks mouse jitter rejection, response,
countersteering, release, frame-rate consistency, independent touch steering and
complete mouse/touch laps at 20, 60 and 144 updates per second.
`../../docs/swimmer-touch/` records the photo-guided swimmer and touch revision,
including a complete Firefox course driven by native WebDriver touch pointers,
simultaneous steering/depth, reverse, release, pause and narrow-layout checks.
`../../docs/fluid-touch-20260906/` checks continuous held-finger reversals,
turning acceleration against the previous handling, centering without bounce,
release, and consistent smoothing at 20–144 updates per second. Its Firefox
touch run also completes all twelve hoops without lifting the steering finger.
`node docs/colossal-wreck/checks.mjs` covers deck/wall collision, boosted sweeps,
open hatches, pause, duplicate pickups, storage failure and saved progress.
`node docs/colossal-wreck/reachability.mjs` checks the exported final geometry:
all 142 coins must be collectible from connected swimming space, accounting for
the swimmer's collision radius, solid decks, terrain and line of sight.
The opening checks also deliberately steer left and right before hoop three,
wait 0.6 seconds after release, and recover without missing the opening.
Physical iPhone/iPad audio and
touch performance still need a device check. The prior README is archived in
`../../docs/archive-underwater-2026-09-04/README-v0.1.md` outside the deploy tree.

The performance pass is checked in `../../docs/performance-20260906/`:
`node docs/performance-20260906/checks.mjs` covers quality decisions, pixel
budgets, preserved terrain geometry, and travel distance at 10–120 FPS.
`browser-check.py` records fixed-view geometry counts and screenshots in local
Firefox. `runtime-check.py` exercises shader compilation, quality changes,
saved preferences, and real gameplay with deliberately delayed animation frames.
`touch-check.py` repeats the complete native-touch lap and control checks.
These scripts use the existing localhost server on port 8000; Python browser
checks use the Studio Firefox binary and `%TEMP%/geckodriver.exe`.
Results here are local desktop checks, not measured FPS on the iPhone SE or Fox PC.
