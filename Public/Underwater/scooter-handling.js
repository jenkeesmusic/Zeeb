// Feet and seconds. Shared by the game and deterministic driving checks.
export const CRUISE_SPEED = 15;
export const BOOST_SPEED = 22;
export const TURN_RATE = 2.65;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
function smoothstep(lo, hi, value) {
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

// Separate travel distances keep mouse corrections precise and touch comfortable.
export const MOUSE_DRAG_X = 110;
export const MOUSE_DRAG_Y = 150;
export const TOUCH_DRAG_X = 86;
function mouseAxis(value, deadZone) {
  const amount = clamp((Math.abs(value) - deadZone) / (1 - deadZone), 0, 1);
  return Math.sign(value) * Math.pow(amount, 1.4);
}
export function stepPointer(pointer, dt) {
  if (!pointer.active) { pointer.turn = pointer.rise = 0; return pointer; }
  if (pointer.pointerType !== 'mouse') {
    // Depth has its own buttons. Vertical finger wobble cannot start a dive.
    const target = mouseAxis(pointer.dx, .11) * .8;
    const current = pointer.turn || 0;
    const settling = current * target <= 0 || Math.abs(target) < Math.abs(current);
    pointer.turn = current + (target - current) * ease(settling ? 20 : 12, Math.max(0, dt));
    pointer.rise = 0;
    return pointer;
  }
  const targets = { turn: mouseAxis(pointer.dx, .07), rise: mouseAxis(pointer.dy, .09) };
  for (const axis of ['turn', 'rise']) {
    const current = pointer[axis] || 0, target = targets[axis];
    // Settle faster on centering/reversal; smoothing should not leave a lingering turn.
    const settling = current * target <= 0 || Math.abs(target) < Math.abs(current);
    pointer[axis] = current + (target - current) * ease(settling ? 14 : 10, Math.max(0, dt));
  }
  return pointer;
}

export function rallyInput(input, position, swim, target) {
  const dx = target.x - position.x, dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz) - swim.yaw;
  const error = Math.atan2(Math.sin(angle), Math.cos(angle));
  // Releasing the steering gently finishes an approach. Deliberate steering
  // takes priority, and a hoop behind or well off to the side cannot grab Zeeb.
  const proximity = 1 - smoothstep(18, 30, distance);
  const alignment = 1 - smoothstep(.18, .62, Math.abs(error));
  const released = 1 - smoothstep(.02, .2, Math.abs(input.turn));
  const nudge = input.thrust < 0 ? 0 : clamp(error * 1.7, -.6, .6) * proximity * alignment * released;
  return { ...input,
    thrust: input.thrust < 0 ? input.thrust : 1,
    turn: clamp(input.turn + nudge, -1, 1),
    // Ease off for a tight bend, so a boost doesn't launch Zeeb past the turn.
    pace: 1 - .32 * smoothstep(.35, 1.35, Math.abs(error)),
    rise: Math.abs(input.rise) > .12 ? input.rise
      : clamp((target.y - position.y) * .42 - swim.vel.y * .24, -1, 1)
  };
}

export function stepScooter(swim, input, boosting, dt) {
  if (dt <= 0) return;
  swim.yawRate += (input.turn * TURN_RATE - swim.yawRate) * ease(20, dt);
  swim.yaw += swim.yawRate * dt;
  const sin = Math.sin(swim.yaw), cos = Math.cos(swim.yaw);
  let forward = swim.vel.x * sin + swim.vel.z * cos;
  // High lateral grip lets the scooter follow its nose instead of sliding
  // past the opening. Keep a trace of glide so it still feels like water.
  const sideways = (swim.vel.x * cos - swim.vel.z * sin) * Math.exp(-18 * dt);
  const cornerSpeed = 1 - .18 * Math.abs(input.turn);
  const topSpeed = input.thrust < 0 ? 11 : boosting ? BOOST_SPEED : CRUISE_SPEED;
  const target = input.thrust * topSpeed * (input.pace ?? 1) * cornerSpeed;
  const braking = forward * target < 0 || Math.abs(target) < Math.abs(forward);
  forward += (target - forward) * ease(braking ? 9 : 6, dt);
  swim.vel.x = sin * forward + cos * sideways;
  swim.vel.z = cos * forward - sin * sideways;
  swim.vel.y += (input.rise * 7.5 - swim.vel.y) * ease(7, dt);
}
