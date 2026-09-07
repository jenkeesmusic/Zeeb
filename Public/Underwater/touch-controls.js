import { stepPointer, MOUSE_DRAG_X, MOUSE_DRAG_Y, TOUCH_DRAG_X, TOUCH_DRAG_Y } from './scooter-handling.js';

// One pointer steers; other fingers can hold depth/reverse independently.
export function createSwimControls({ canvas, mode, musicStart, dismissHint }) {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="touchControls" hidden>
      <button id="swimPad" type="button" aria-label="Hold to swim; slide left or right to turn, up to rise, down to sink">
        <span class="turn-left" aria-hidden="true">‹</span><span class="turn-right" aria-hidden="true">›</span>
        <span class="turn-up" aria-hidden="true">↑</span><span class="turn-down" aria-hidden="true">↓</span>
        <span id="swimKnob" aria-hidden="true"></span><span class="swim-label">Swim</span>
      </button>
      <div id="depthButtons" aria-label="Swimming controls">
        <button id="swimUp" type="button" aria-label="Hold to rise; E or Space">↑ Rise<small>E / Space</small></button>
        <button id="swimDown" type="button" aria-label="Hold to sink; Q or Shift">↓ Sink<small>Q / Shift</small></button>
        <button id="swimBack" type="button" aria-label="Hold to swim backward">Back</button>
      </div>
      <div id="touchHint">Slide up to rise, down to sink</div>
    </div>`);
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, document.getElementById(id));
    return elements.get(id);
  };
  const pointer = { active: false, pointerId: null, pointerType: 'touch', x0: 0, y0: 0, dx: 0, dy: 0, turn: 0, turnVelocity: 0, rise: 0 };
  const holds = new Map();
  let surface = null, touchMode = navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;
  const playing = () => ['racing', 'explore', 'countdown'].includes(mode());
  const buttons = { swimUp: 1, swimDown: -1, swimBack: 'back' };
  let heldRise = 0, heldDepth = false, heldBack = false, wasPlaying = null, shownMode = null;
  let lastSteer = '', lastSwim = '';
  function showTouch() { touchMode = true; document.body.classList.add('touch-mode'); }
  if (touchMode) showTouch();
  function resetSteering() {
    const oldSurface = surface, id = pointer.pointerId;
    Object.assign(pointer, { active: false, pointerId: null, dx: 0, dy: 0, turn: 0, turnVelocity: 0, rise: 0 });
    surface = null;
    $('steerPad').hidden = true;
    $('swimKnob').style.transform = 'translate(0, 0)';
    $('swimPad').classList.remove('held');
    if (oldSurface?.hasPointerCapture(id)) oldSurface.releasePointerCapture(id);
  }
  function start(e) {
    if (!playing() || pointer.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const isPad = e.currentTarget === $('swimPad');
    const type = isPad ? 'touch' : e.pointerType || 'mouse';
    if (type !== 'mouse') showTouch();
    Object.assign(pointer, { active: true, pointerId: e.pointerId, pointerType: type, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, turn: 0, turnVelocity: 0, rise: 0 });
    surface = e.currentTarget; surface.setPointerCapture(e.pointerId);
    dismissHint();
    if (e.pointerType === 'mouse') musicStart();
    $('swimPad').classList.add('held');
    const pad = $('steerPad'); pad.hidden = isPad || type !== 'mouse';
    pad.style.left = e.clientX + 'px'; pad.style.top = e.clientY + 'px';
    $('steerKnob').style.transform = 'translate(0, 0)';
  }
  function move(e) {
    if (!pointer.active || e.pointerId !== pointer.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { resetSteering(); return; }
    const mouse = pointer.pointerType === 'mouse', radius = mouse ? MOUSE_DRAG_X : TOUCH_DRAG_X;
    // A long swipe carries the touch origin along, so a small move back always
    // starts easing the turn. There is no invisible excess drag to unwind.
    if (!mouse && Math.abs(e.clientX-pointer.x0) > radius) pointer.x0 = e.clientX-Math.sign(e.clientX-pointer.x0)*radius;
    pointer.dx = (e.clientX-pointer.x0)/radius;
    const depthRadius = mouse ? MOUSE_DRAG_Y : TOUCH_DRAG_Y;
    if (!mouse && Math.abs(e.clientY-pointer.y0) > depthRadius) pointer.y0 = e.clientY-Math.sign(e.clientY-pointer.y0)*depthRadius;
    pointer.dy = (e.clientY-pointer.y0)/depthRadius;
    $('steerPad').style.left = pointer.x0 + 'px';
    $('steerPad').style.top = pointer.y0 + 'px';
  }
  function end(e) {
    if (e.pointerId !== pointer.pointerId) return;
    resetSteering();
    if (e.type === 'pointerup') musicStart();
  }
  for (const el of [canvas, $('swimPad')]) {
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, end);
  }
  function paintHolds() {
    const down = new Set(holds.values());
    heldRise = (down.has('swimUp') ? 1 : 0) - (down.has('swimDown') ? 1 : 0);
    heldDepth = down.has('swimUp') || down.has('swimDown');
    heldBack = down.has('swimBack');
    for (const id of Object.keys(buttons)) {
      const active = down.has(id);
      $(id).classList.toggle('held', active); $(id).setAttribute('aria-pressed', String(active));
    }
  }
  for (const id of Object.keys(buttons)) {
    const el = $(id);
    el.addEventListener('pointerdown', e => {
      if (!playing() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.pointerType !== 'mouse') showTouch();
      dismissHint();
      e.preventDefault(); holds.set(e.pointerId, id); el.setPointerCapture(e.pointerId); paintHolds();
      if (e.pointerType === 'mouse') musicStart();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, e => {
      holds.delete(e.pointerId); paintHolds();
      if (e.type === 'pointerup') musicStart();
    });
    el.addEventListener('keydown', e => {
      if (playing() && ['Space','Enter'].includes(e.code)) { e.preventDefault(); holds.set('key-'+id,id); paintHolds(); }
    });
    el.addEventListener('keyup', e => { holds.delete('key-'+id); paintHolds(); });
    el.addEventListener('blur', () => { holds.delete('key-'+id); paintHolds(); });
  }
  function clear() {
    resetSteering();
    const captured = [...holds]; holds.clear();
    for (const [id, button] of captured) {
      if (typeof id === 'number' && $(button).hasPointerCapture(id)) $(button).releasePointerCapture(id);
    }
    paintHolds();
  }
  window.addEventListener('blur', clear);
  window.addEventListener('resize', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  canvas.addEventListener('touchend', () => musicStart(), { passive: true });
  return {
    pointer, clear,
    updateUI() {
      const active = playing();
      if (active !== wasPlaying || touchMode !== shownMode) {
        $('touchControls').hidden = !active;
        document.body.classList.toggle('touch-playing', touchMode && active);
        document.body.classList.toggle('depth-playing', active);
        document.body.classList.toggle('playing', active);
        if (!active) clear();
        wasPlaying = active; shownMode = touchMode;
      }
      const steer = `translate(${(pointer.turn*32).toFixed(1)}px, ${(pointer.rise*32).toFixed(1)}px)`;
      const swim = `translate(${(pointer.turn*35).toFixed(1)}px, ${(pointer.rise*23).toFixed(1)}px)`;
      if (steer !== lastSteer) { $('steerKnob').style.transform = steer; lastSteer = steer; }
      if (swim !== lastSwim) { $('swimKnob').style.transform = swim; lastSwim = swim; }
    },
    read(dt) {
      if (!playing()) return { thrust: 0, turn: 0, rise: 0 };
      stepPointer(pointer, dt);
      return { thrust: heldBack ? -.6 : pointer.active ? 1 : 0, turn: -pointer.turn,
        // A deliberate depth button wins over vertical mouse drag.
        rise: heldDepth ? heldRise : -pointer.rise };
    },
    get touchMode() { return touchMode; }
  };
}
