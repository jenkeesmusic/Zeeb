import { stepPointer, MOUSE_DRAG_X, MOUSE_DRAG_Y, TOUCH_DRAG_X } from './scooter-handling.js';

// One pointer steers; other fingers can hold depth/reverse independently.
export function createSwimControls({ canvas, mode, musicStart, dismissHint }) {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="touchControls" hidden>
      <button id="swimPad" type="button" aria-label="Hold to swim, slide left or right to turn">
        <span class="turn-left" aria-hidden="true">‹</span><span class="turn-right" aria-hidden="true">›</span>
        <span id="swimKnob" aria-hidden="true"></span><span class="swim-label">Hold to swim</span>
      </button>
      <div id="depthButtons" aria-label="Swimming controls">
        <button id="swimUp" type="button" aria-label="Hold to swim up">↑ Up</button>
        <button id="swimDown" type="button" aria-label="Hold to swim down">↓ Down</button>
        <button id="swimBack" type="button" aria-label="Hold to swim backward">Back</button>
      </div>
      <div id="touchHint">Slide left or right to turn</div>
    </div>`);
  const $ = id => document.getElementById(id);
  const pointer = { active: false, pointerId: null, pointerType: 'touch', x0: 0, y0: 0, dx: 0, dy: 0, turn: 0, rise: 0 };
  const holds = new Map();
  let surface = null, touchMode = navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;
  const playing = () => ['racing', 'explore', 'countdown'].includes(mode());
  const buttons = { swimUp: 1, swimDown: -1, swimBack: 'back' };
  function showTouch() { touchMode = true; document.body.classList.add('touch-mode'); }
  if (touchMode) showTouch();
  function resetSteering() {
    const oldSurface = surface, id = pointer.pointerId;
    Object.assign(pointer, { active: false, pointerId: null, dx: 0, dy: 0, turn: 0, rise: 0 });
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
    Object.assign(pointer, { active: true, pointerId: e.pointerId, pointerType: type, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, turn: 0, rise: 0 });
    surface = e.currentTarget; surface.setPointerCapture(e.pointerId);
    dismissHint();
    if (e.pointerType === 'mouse') musicStart();
    $('swimPad').classList.add('held');
    const pad = $('steerPad'); pad.hidden = isPad;
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
    pointer.dy = mouse ? (e.clientY-pointer.y0)/MOUSE_DRAG_Y : 0;
    $('steerPad').style.left = pointer.x0 + 'px';
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
    for (const id of Object.keys(buttons)) {
      const active = [...holds.values()].includes(id);
      $(id).classList.toggle('held', active); $(id).setAttribute('aria-pressed', String(active));
    }
  }
  for (const id of Object.keys(buttons)) {
    const el = $(id);
    el.addEventListener('pointerdown', e => {
      if (!playing() || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
    read(dt) {
      const active = playing();
      $('touchControls').hidden = !touchMode || !active;
      document.body.classList.toggle('touch-playing', touchMode && active);
      if (!active) clear();
      stepPointer(pointer, dt);
      const down = new Set(holds.values());
      const rise = (down.has('swimUp') ? 1 : 0) - (down.has('swimDown') ? 1 : 0);
      $('steerKnob').style.transform = `translate(${pointer.turn*32}px, ${pointer.rise*32}px)`;
      $('swimKnob').style.transform = `translate(${pointer.turn*43}px, 0)`;
      return { thrust: down.has('swimBack') ? -.6 : pointer.active ? 1 : 0, turn: -pointer.turn, rise: rise*.85-pointer.rise };
    },
    get touchMode() { return touchMode; }
  };
}
