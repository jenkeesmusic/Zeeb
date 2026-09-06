import * as THREE from 'three';

// An open toy sub: the rim stays below Zeeb's chest and the propeller sits aft.
// Built from shared, low-poly geometry so it adds no downloaded model or texture.
export function createScooter(parent) {
  const craft = new THREE.Group(); craft.name = 'Zeeb sea scooter'; parent.add(craft);
  const teal = new THREE.MeshStandardMaterial({ color: 0x28b8ad, roughness: .35, metalness: .1 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xffedbe, roughness: .5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x134d60, roughness: .5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc64c, roughness: .38, metalness: .16 });
  const coral = new THREE.MeshStandardMaterial({ color: 0xff8d78, roughness: .42 });
  const sphere = new THREE.SphereGeometry(1, 20, 12);
  function oval(name, material, position, scale, group = craft) {
    const mesh = new THREE.Mesh(sphere, material); mesh.name = name;
    mesh.position.set(...position); mesh.scale.set(...scale); group.add(mesh); return mesh;
  }
  const shellGeo = new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const shellMat = teal.clone(); shellMat.side = THREE.DoubleSide;
  const shell = new THREE.Mesh(shellGeo, shellMat); shell.name = 'Open cockpit hull';
  shell.scale.set(1, .68, 1.48); shell.position.y = .05; craft.add(shell);
  oval('Cockpit cushion', dark, [0, -.16, -.05], [.79, .16, 1.05]);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, .085, 8, 48), cream);
  rim.name = 'Cream cockpit rim'; rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.48, 1); rim.position.y = .055; craft.add(rim);
  oval('Rounded bow', teal, [0, -.04, 1.12], [.68, .24, .45]);
  oval('Bow accent', coral, [0, .08, 1.32], [.24, .085, .19]);

  // Short side fins and handgrips read as a ride without hiding the rider.
  for (const side of [-1, 1]) {
    const fin = oval('Side fin', coral, [side * .96, -.31, -.43], [.4, .085, .52]);
    fin.rotation.y = side * -.3;
    oval('Handgrip', dark, [side * .52, .24, .65], [.11, .1, .24]);
    oval('Grip stem', cream, [side * .52, .1, .65], [.06, .15, .06]);
    oval('Rear running light', gold, [side * .68, -.04, -1.02], [.105, .1, .13]);
  }
  // The guard and shaft stay still; only the hub and three pitched blades spin.
  const motor = oval('Motor housing', dark, [0, -.24, -1.39], [.36, .32, .37]);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.56, .09, 10, 40), teal);
  guard.name = 'Propeller guard'; guard.position.set(0, -.23, -1.8); craft.add(guard);
  const guardLip = new THREE.Mesh(new THREE.TorusGeometry(.56, .025, 6, 40), cream);
  guardLip.position.set(0, -.23, -1.87); craft.add(guardLip);
  const propeller = new THREE.Group(); propeller.name = 'Spinning rear propeller';
  propeller.position.copy(guard.position); craft.add(propeller);
  oval('Propeller hub', coral, [0, 0, -.04], [.16, .16, .12], propeller);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Group(); blade.rotation.z = i * Math.PI * 2 / 3; propeller.add(blade);
    const paddle = oval('Yellow propeller blade', gold, [.05, .32, 0], [.14, .24, .055], blade);
    paddle.rotation.y = .32; paddle.rotation.z = -.28;
  }
  const wake = new THREE.Vector3();
  let bubbleClock = 0, spinSpeed = 0;
  return {
    craft, propeller,
    update(dt, speed, boosting, emitBubble) {
      const target = 2 + speed * 1.15 + (boosting ? 8 : 0);
      spinSpeed += (target - spinSpeed) * (1 - Math.exp(-dt * 5));
      propeller.rotation.z = (propeller.rotation.z + spinSpeed * dt) % (Math.PI * 2);
      motor.scale.z = .37 + (boosting ? .018 : 0);
      bubbleClock += dt;
      if (speed > 1 && bubbleClock > (boosting ? .028 : .085)) {
        bubbleClock = 0;
        propeller.getWorldPosition(wake);
        wake.addScaledVector(new THREE.Vector3(0, 0, -1).transformDirection(craft.matrixWorld), .18);
        emitBubble(wake, boosting ? .17 : .11);
      }
    }
  };
}

// Zeeb can greet the player at rest even with a steady camera. Playful mode
// also earns a short glance after a turn, once steering has settled again.
export function createPilotCamera() {
  const state = { phase: 0, side: 1, cooldown: 0, turningFor: 0, pilotYaw: 0,
    orbit: 0, amount: 0, presentation: 1, lastMode: 'welcome',
    idleFor: 0, movingFor: 0, armed: false, kind: null };
  const ease = (current, target, dt, rate) => current + (target - current) * (1 - Math.exp(-dt * rate));
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * t * (10 + t * (-15 + t * 6)); };
  function reset() {
    Object.assign(state, { phase: 0, cooldown: 0, turningFor: 0, idleFor: 0,
      movingFor: 0, armed: false, kind: null, amount: 0, orbit: 0, pilotYaw: 0 });
  }
  return {
    state, reset,
    update(dt, { mode, yawRate, turn, speed, targetDistance, portrait, reducedMotion,
      playful = true, activeInput = false, blocked = false }) {
      if (mode === 'paused' || dt <= 0) return state;
      if (mode !== state.lastMode) {
        reset();
        state.lastMode = mode;
      }
      const showingOff = mode === 'welcome';
      state.presentation = reducedMotion ? (showingOff ? 1 : 0)
        : ease(state.presentation, showingOff ? 1 : 0, dt, mode === 'countdown' ? 3 : 2.4);
      state.cooldown = Math.max(0, state.cooldown - dt);
      const playing = mode === 'racing' || mode === 'explore';
      const safe = playing && !blocked && !reducedMotion && targetDistance > 18;
      const idle = mode === 'explore' && !activeInput && speed < .25 && Math.abs(yawRate) < .08;
      state.idleFor = safe && idle ? state.idleFor + dt : 0;
      state.movingFor = activeInput && speed > 1 ? state.movingFor + dt : 0;
      if (state.movingFor > .4) state.armed = true;
      if (safe && speed > 2 && Math.abs(turn) > .08) {
        state.turningFor = Math.min(.8, state.turningFor + Math.abs(yawRate) * dt);
        if (state.phase === 0) state.side = Math.sign(turn);
      } else if (!safe || speed < 2) state.turningFor = 0;
      const settledTurn = Math.abs(turn) < .025 && Math.abs(yawRate) < .12;
      const idleHello = state.armed && state.idleFor > .85;
      const passingGlance = playful && speed > 2 && settledTurn && state.turningFor > .22;
      if (safe && state.phase === 0 && state.cooldown === 0 && (idleHello || passingGlance)) {
        state.phase = .001; state.kind = idleHello ? 'hello' : 'glance';
        state.cooldown = idleHello ? 9 : 7; state.armed = false; state.turningFor = 0;
      }
      // Input always wins. Returning the visual pose never changes swim yaw,
      // velocity, touch capture, or the direction of the next movement.
      const cancelled = !safe || (state.kind === 'hello' ? activeInput || !idle
        : !playful || !settledTurn || speed < 2);
      if (cancelled) { state.phase = 0; state.kind = null; }
      let amount = 0;
      if (state.phase > 0) {
        state.phase += dt / (state.kind === 'hello' ? 2.4 : 1.8);
        if (state.phase >= 1) { state.phase = 0; state.kind = null; }
        else amount = smooth(state.phase / .3) * smooth((1 - state.phase) / .3);
      }
      state.amount = amount;
      const maxOrbit = portrait ? .18 : .35;
      const orbit = playful && state.kind === 'glance' ? state.side * maxOrbit * amount : 0;
      state.orbit = ease(state.orbit, orbit, dt, 8);
      const glanceYaw = -state.side * (Math.PI - Math.abs(state.orbit) - .28) * amount;
      const pilotTarget = mode === 'finished' ? -2.6 : showingOff || reducedMotion ? 0 : glanceYaw;
      state.pilotYaw = ease(state.pilotYaw, pilotTarget, dt, mode === 'finished' ? 3 : cancelled ? 18 : 12);
      return state;
    }
  };
}
