import * as THREE from 'three';
import { COURSE, START, ZONES, HOOP_RADIUS, HOOP_TUBE_RADIUS, PASS_RADIUS, PERFECT_RADIUS, COURSE_SCALE, hoopCrossing } from './reef-course.js';
import { rallyInput } from './scooter-handling.js';

// Each course layout keeps its own times, preserving earlier records.
const bestTimeKey = 'zeeb-reef-best-v4';

export function createRally({ scene, camera, duck, swim, camPos, camLook, spawnBubble, musicStart, music, clearInput }) {
  const $ = (id) => document.getElementById(id);
  $('hint').classList.add('gone');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const preview = new URLSearchParams(location.search).has('preview');
  document.body.insertAdjacentHTML('beforeend', `
    <div id="rallyHud"><div class="brand">Zeeb Underwater</div>
      <div id="raceStats" hidden><div id="zone">Coral gardens</div>
        <div class="score-line"><div id="hoopCount">0 <small>/ 12 hoops</small></div><div id="raceTime">0:00</div></div>
        <div id="progress" aria-label="Hoops completed">${COURSE.map(() => '<i></i>').join('')}</div>
        <div id="score">Follow the golden hoop</div>
      </div>
    </div>
    <section id="menu" aria-labelledby="menuTitle">
      <div class="signature">A little ocean by Grace</div>
      <h1 id="menuTitle">The lost treasure</h1>
      <p id="menuText">Follow 12 golden hoops to the lost treasure. Or explore a colossal shipwreck, with hidden rooms and coins on every deck.</p>
      <div class="menu-actions"><button class="primary" id="startBtn" type="button">Find the treasure</button><button id="exploreBtn" type="button">Just explore</button></div>
      <div id="menuHelp">Steer with ← → or A / D. On a touch screen, drag.<br>Aim for gold, then release to glide into line. B gives a boost.</div>
    </section>
    <div id="rallyControls"><button id="boostBtn" type="button" hidden><span id="boostFill"></span><span id="boostLabel">Boost · B</span></button><button id="rescueBtn" type="button" hidden>Back to hoop</button><button id="playBtn" type="button" hidden>Find the treasure</button></div>
    <div id="toast" role="status" aria-live="polite"></div>
    <div id="countdown" aria-live="polite" hidden></div>
    <div id="target" hidden><span id="targetArrow">↑</span><span id="targetText"></span></div>
    <div id="steerPad" hidden><div id="steerKnob"></div></div>
  `);
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button'; pauseBtn.id = 'pauseBtn'; pauseBtn.textContent = 'Pause'; pauseBtn.hidden = true;
  $('right').querySelector('.row').append(pauseBtn);
  const state = { mode: preview ? 'explore' : 'welcome', next: 0, time: 0, score: 0, perfect: 0,
    streak: 0, boost: 0, energy: 1, countdown: 3, best: null, pausedMode: null, assisted: false };
  try { const n = Number(localStorage.getItem(bestTimeKey)); if (Number.isFinite(n) && n > 0) state.best = n; } catch {}
  const previous = new THREE.Vector3(), v = new THREE.Vector3(), normalAxis = new THREE.Vector3(0, 0, 1);
  let toastTime = 0, uiTime = 0, lastCountdown = 0, soundContext;
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const rings = COURSE.map((p, i) => {
    const position = new THREE.Vector3(...p);
    const incoming = new THREE.Vector3(...(COURSE[i - 1] || START));
    const outgoing = new THREE.Vector3(...(COURSE[i + 1] || [p[0] - 20, p[1], p[2] - 8]));
    const normal = outgoing.sub(incoming).normalize();
    const group = new THREE.Group(); group.position.copy(position);
    group.quaternion.setFromUnitVectors(normalAxis, normal);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd273, emissive: 0xe9a53a, emissiveIntensity: .7, roughness: .32, metalness: .18 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(HOOP_RADIUS, HOOP_TUBE_RADIUS, 18, 80), mat);
    group.add(rim);
    const inside = new THREE.Mesh(new THREE.TorusGeometry(HOOP_RADIUS - HOOP_TUBE_RADIUS - .11, .07, 8, 80), new THREE.MeshBasicMaterial({ color: 0xfff3c5 }));
    group.add(inside);
    const beads = new THREE.Group();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), mat);
      bead.position.set(Math.cos(a) * (HOOP_RADIUS + HOOP_TUBE_RADIUS + .18), Math.sin(a) * (HOOP_RADIUS + HOOP_TUBE_RADIUS + .18), 0); beads.add(bead);
    }
    group.add(beads);
    const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = badgeCanvas.height = 128;
    const g = badgeCanvas.getContext('2d');
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#154653'; g.font = 'bold 64px Trebuchet MS'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, 64, 68);
    const texture = new THREE.CanvasTexture(badgeCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    // The active number stays readable against coral and the moon arch.
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false }));
    badge.renderOrder = 20;
    badge.position.set(0, HOOP_RADIUS + HOOP_TUBE_RADIUS + 1.3, 0); badge.scale.setScalar(1.7); group.add(badge);
    scene.add(group);
    return { group, rim, mat, inside, beads, badge, position, normal, passed: false, pulse: 0 };
  });
  // The bubble trail only connects to the current hoop; it never turns the reef into a grid.
  const breadcrumb = new THREE.InstancedMesh(new THREE.SphereGeometry(.105, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xbcffed, transparent: true, opacity: .55 }), 22);
  breadcrumb.frustumCulled = false; scene.add(breadcrumb);
  const dummy = new THREE.Object3D();
  function refreshRings() {
    rings.forEach((r, i) => {
      const active = i === state.next, passed = i < state.next;
      r.passed = passed;
      r.mat.color.setHex(passed ? 0x72d5b3 : active ? 0xffd273 : 0x588c8d);
      r.mat.emissive.setHex(passed ? 0x319578 : active ? 0xe9a53a : 0x1a514e);
      r.mat.emissiveIntensity = active ? .8 : .25;
      r.inside.visible = active; r.badge.visible = active; r.beads.visible = active;
    });
    $('progress').querySelectorAll('i').forEach((el, i) => { el.className = i < state.next ? 'done' : i === state.next ? 'current' : ''; });
    $('progress').setAttribute('aria-label', `${state.next} of ${rings.length} hoops completed`);
    $('hoopCount').innerHTML = `${state.next} <small>/ ${rings.length} hoops</small>`;
    $('zone').textContent = ZONES[Math.min(state.next, ZONES.length - 1)];
  }
  function announce(message, duration = 1.8) { $('toast').textContent = message; $('toast').classList.add('show'); toastTime = duration; }
  function unlockSound() {
    musicStart();
    try { soundContext ||= new (window.AudioContext || window.webkitAudioContext)(); soundContext.resume().catch(() => {}); } catch {}
  }
  function chime(notes) {
    if (!soundContext || soundContext.state !== 'running' || music.on === false) return;
    notes.forEach((frequency, i) => {
      const at = soundContext.currentTime + i * .09, osc = soundContext.createOscillator(), gain = soundContext.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.045, at + .012); gain.gain.exponentialRampToValueAtTime(.001, at + .35);
      osc.connect(gain); gain.connect(soundContext.destination); osc.start(at); osc.stop(at + .4);
    });
  }
  function resetPosition(position, direction) {
    duck.position.copy(position); swim.vel.set(0, 0, 0); swim.yaw = Math.atan2(direction.x, direction.z);
    swim.yawRate = swim.pitch = swim.bank = 0; duck.rotation.y = swim.yaw;
    camPos.copy(position).addScaledVector(direction, -11); camPos.y += 3.5;
    camLook.copy(position).addScaledVector(direction, 3); previous.copy(position);
  }
  function setPlayUI() {
    $('menu').hidden = true; $('hint').classList.add('gone');
    $('boostBtn').hidden = false; pauseBtn.hidden = false;
    $('raceStats').hidden = state.mode === 'explore'; $('playBtn').hidden = state.mode !== 'explore';
    $('rescueBtn').hidden = true;
  }
  function start() {
    clearInput();
    unlockSound();
    Object.assign(state, { mode: 'countdown', next: 0, time: 0, score: 0, perfect: 0, streak: 0, boost: 0, energy: 1, countdown: 3, assisted: false });
    lastCountdown = 0; resetPosition(new THREE.Vector3(...START), new THREE.Vector3(0, 0, 1));
    scene.dispatchEvent({ type: 'rallystart' });
    refreshRings(); setPlayUI(); $('raceTime').textContent = '0:00'; $('score').textContent = 'Follow the golden hoop';
    $('countdown').hidden = false; $('menuHelp').hidden = false;
  }
  function explore(options = {}) {
    clearInput();
    unlockSound(); state.mode = 'explore'; state.boost = 0; $('countdown').hidden = true; $('target').hidden = true;
    if(options.position)resetPosition(options.position,options.direction);
    setPlayUI(); announce(options.message || 'The whole ocean is yours');
    $('hint').innerHTML = '<b>WASD / arrows</b> swim · <b>Space</b> up · <b>Shift</b> down · <b>B</b> boost';
    $('hint').classList.remove('gone'); setTimeout(() => $('hint').classList.add('gone'), 8000);
  }
  function pause() {
    clearInput();
    if (state.mode === 'paused') {
      state.mode = state.pausedMode; state.pausedMode = null; setPlayUI();
      $('countdown').hidden = state.mode !== 'countdown'; return;
    }
    if (!['racing', 'countdown', 'explore'].includes(state.mode)) return;
    state.pausedMode = state.mode; state.mode = 'paused';
    $('countdown').hidden = true; $('menu').hidden = false; $('menuTitle').textContent = 'Taking a breather';
    $('menuText').textContent = 'Your swim is right here when you’re ready.';
    $('startBtn').textContent = 'Keep swimming'; $('exploreBtn').textContent = 'Just explore'; $('menuHelp').hidden = true;
    $('rescueBtn').hidden = true;
  }
  function boost() {
    if (!['racing', 'explore'].includes(state.mode) || state.energy < .98) return;
    unlockSound(); state.energy = 0; state.boost = 1.6; chime([330, 495, 660]);
  }
  function rescue() {
    if (state.mode !== 'racing') return;
    clearInput();
    const r = rings[state.next]; resetPosition(r.position.clone().addScaledVector(r.normal, -14), r.normal);
    state.boost = 0; state.streak = 0; state.assisted = true; announce('Try that hoop again!');
  }
  function finish() {
    clearInput();
    state.mode = 'finished'; state.boost = 0; swim.vel.multiplyScalar(.25);
    const newBest = !state.assisted && (!state.best || state.time < state.best);
    if (newBest) { state.best = state.time; try { localStorage.setItem(bestTimeKey, String(state.time)); } catch {} }
    $('menu').hidden = false; $('menuTitle').textContent = 'Treasure found!';
    $('menuText').textContent = `Gold, gems, and a golden compass! ${formatTime(state.time)} · ${state.score.toLocaleString()} points · ${state.perfect} perfect passes. ${newBest ? 'Your best swim yet!' : state.assisted ? 'A lovely practice swim.' : 'Follow the trail again whenever you like.'}`;
    $('startBtn').textContent = 'Hunt again'; $('exploreBtn').textContent = 'Explore the reef'; $('menuHelp').hidden = true;
    $('rescueBtn').hidden = true; $('boostBtn').hidden = true; $('target').hidden = true; pauseBtn.hidden = true;
    announce('You found the lost treasure!', 3.5); chime([523, 659, 784, 1047]);
    for (let i = 0; i < 60; i++) spawnBubble(v.copy(duck.position).add(new THREE.Vector3((Math.random() - .5) * 9, (Math.random() - .5) * 7, (Math.random() - .5) * 9)), .18 + Math.random() * .25);
    scene.dispatchEvent({ type: 'rallycomplete' });
  }
  $('startBtn').addEventListener('click', () => state.mode === 'paused' ? pause() : start());
  $('exploreBtn').addEventListener('click', explore); $('playBtn').addEventListener('click', start);
  $('boostBtn').addEventListener('click', boost); $('rescueBtn').addEventListener('click', rescue); pauseBtn.addEventListener('click', pause);
  window.addEventListener('keydown', (e) => {
    if (e.repeat || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyB') boost();
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode !== 'paused') pause(); });
  window.addEventListener('blur', () => { if (state.mode !== 'paused') pause(); });
  if (state.best) $('menuHelp').insertAdjacentText('beforeend', ` Best swim: ${formatTime(state.best)}.`);
  refreshRings();

  function beforeStep(input, dt) {
    previous.copy(duck.position);
    if (state.mode === 'paused') return { thrust: 0, turn: 0, rise: 0 };
    state.boost = Math.max(0, state.boost - dt); state.energy = Math.min(1, state.energy + dt / 5);
    if (state.mode === 'countdown') {
      state.countdown -= dt;
      const n = Math.max(1, Math.ceil(state.countdown));
      if (n !== lastCountdown) { $('countdown').textContent = n; lastCountdown = n; chime([330]); }
      if (state.countdown <= 0) { state.mode = 'racing'; $('countdown').hidden = true; announce('Follow the treasure trail!', 1.6); chime([660, 880]); }
      return { thrust: 0, turn: 0, rise: 0 };
    }
    if (!['racing', 'explore'].includes(state.mode)) return { thrust: 0, turn: 0, rise: 0 };
    if (state.mode === 'explore') return input;
    return rallyInput(input, duck.position, swim, rings[state.next].position);
  }
  function afterStep(dt, t) {
    if (toastTime > 0) { toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('show'); }
    rings.forEach((r, i) => {
      r.pulse = Math.max(0, r.pulse - dt * 1.8);
      r.group.visible = !(state.next === rings.length && i === rings.length - 1);
      r.group.scale.setScalar(1 + r.pulse * .13);
      r.beads.rotation.z = reducedMotion ? 0 : t * .22;
      if (i === state.next) r.mat.emissiveIntensity = .85 + Math.sin(t * 2.5) * .18;
    });
    const playing = state.mode === 'racing';
    if (playing) {
      state.time += dt;
      const r = rings[state.next];
      const hit = hoopCrossing(previous.toArray(), duck.position.toArray(), r.position.toArray(), r.normal.toArray(), PASS_RADIUS);
      if (hit) {
        const perfect = hit.offset < PERFECT_RADIUS;
        state.streak = perfect ? state.streak + 1 : 0; if (perfect) state.perfect++;
        const points = 100 + (perfect ? 50 : 0) + Math.min(state.streak, 5) * 10;
        state.score += points; state.next++; r.pulse = 1;
        // Let players find the steering through the first three hoops before
        // adding automatic speed bursts. A manually chosen boost still works.
        if (state.next >= 3) state.boost = Math.max(state.boost, .65);
        for (let i = 0; i < 25; i++) spawnBubble(v.copy(r.position).add(new THREE.Vector3((Math.random() - .5) * 7, (Math.random() - .5) * 7, 0)), .12 + Math.random() * .18);
        chime(perfect ? [660, 880, 1100] : [587, 784]);
        announce(perfect ? `Perfect! +${points}` : `Whoosh! +${points}`, 1.3);
        refreshRings(); $('score').textContent = `${state.score.toLocaleString()} points${state.streak > 1 ? ` · ${state.streak} perfect in a row!` : ''}`;
        if (state.next === rings.length) finish();
      }
    }
    const r = rings[state.next];
    breadcrumb.visible = !!r && ['welcome', 'countdown', 'racing'].includes(state.mode);
    if (breadcrumb.visible) {
      const from = state.mode === 'racing' ? duck.position : new THREE.Vector3(...(COURSE[state.next - 1] || START));
      for (let i = 0; i < 22; i++) {
        const f = (i + (reducedMotion ? 0 : t * .5 % 1)) / 22;
        dummy.position.lerpVectors(from, r.position, f); dummy.position.y -= .9;
        dummy.scale.setScalar(.6 + Math.sin(f * Math.PI) * .7); dummy.updateMatrix(); breadcrumb.setMatrixAt(i, dummy.matrix);
      }
      breadcrumb.instanceMatrix.needsUpdate = true;
    }
    if (state.boost > 0) {
      for (let k = 0; k < (reducedMotion ? 1 : 3); k++) spawnBubble(v.copy(duck.position).add(new THREE.Vector3((Math.random() - .5) * 1.2, .3, 0)), .12 + Math.random() * .15);
    }
    uiTime += dt;
    if (uiTime > .1) {
      uiTime = 0; $('raceTime').textContent = formatTime(state.time);
      $('boostFill').style.transform = `scaleX(${state.energy})`;
      $('boostBtn').disabled = state.energy < .98 || !['racing', 'explore'].includes(state.mode);
      $('boostLabel').textContent = state.energy >= .98 ? 'Boost · B' : `Refilling ${Math.ceil((1 - state.energy) * 5)}s`;
      if (state.mode === 'racing' && r) {
        const distance = duck.position.distanceTo(r.position), passedPlane = v.subVectors(duck.position, r.position).dot(r.normal) > 3;
        $('rescueBtn').hidden = !(passedPlane || distance > 65 * COURSE_SCALE);
      }
    }
  }
  function updateGuide() {
    const r = rings[state.next];
    if (state.mode !== 'racing' || !r) { $('target').hidden = true; return; }
    v.copy(r.position).project(camera);
    const behind = new THREE.Vector3().subVectors(r.position, camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) < 0;
    const onScreen = !behind && Math.abs(v.x) < .76 && Math.abs(v.y) < .65;
    $('target').hidden = onScreen;
    if (onScreen) return;
    let x = v.x, y = -v.y;
    if (behind) { x = -x; y = .1; }
    const angle = Math.atan2(y, x);
    const w = innerWidth, h = innerHeight;
    const px = THREE.MathUtils.clamp(w / 2 + Math.cos(angle) * w * .36, 15, w - 155);
    const py = THREE.MathUtils.clamp(h / 2 + Math.sin(angle) * h * .32, 160, h - 115);
    $('target').style.left = `${px}px`; $('target').style.top = `${py}px`;
    $('targetArrow').style.transform = `rotate(${angle + Math.PI / 2}rad)`;
    $('targetText').textContent = `Hoop ${state.next + 1} · ${Math.round(duck.position.distanceTo(r.position))} ft`;
  }
  return { state, rings, beforeStep, afterStep, updateGuide, start, explore, pause, rescue, announce, chime, reducedMotion, refreshRings };
}
