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

// The chase camera briefly moves out to the side during a turn. Zeeb swivels
// toward it, revealing his face while the lens still points down the course.
export function createPilotCamera() {
  const state = { phase: 0, side: 1, cooldown: 0, turningFor: 0, pilotYaw: 0,
    orbit: 0, amount: 0, presentation: 1, lastMode: 'welcome' };
  const ease = (current, target, dt, rate) => current + (target - current) * (1 - Math.exp(-dt * rate));
  return {
    state,
    update(dt, { mode, yawRate, turn, speed, targetDistance, portrait, reducedMotion }) {
      if (mode === 'paused') return state;
      if (mode !== state.lastMode) {
        if (mode === 'countdown' || mode === 'welcome') {
          state.phase = state.cooldown = state.turningFor = 0;
        }
        state.lastMode = mode;
      }
      const showingOff = mode === 'welcome';
      state.presentation = reducedMotion ? (showingOff ? 1 : 0)
        : ease(state.presentation, showingOff ? 1 : 0, dt, mode === 'countdown' ? 3 : 2.4);
      state.cooldown = Math.max(0, state.cooldown - dt);
      const canPeek = (mode === 'racing' || mode === 'explore') && speed > 2 && targetDistance > 13;
      // Accumulate the actual turn, including the brief coasting between key
      // taps, so gentle steering earns a glance as reliably as holding a key.
      state.turningFor = canPeek && Math.abs(yawRate) > .2
        ? state.turningFor + Math.abs(yawRate) * dt : Math.max(0, state.turningFor - dt * .3);
      if (!reducedMotion && state.phase === 0 && state.cooldown === 0 && state.turningFor > .09) {
        state.phase = .001; state.side = Math.sign(yawRate); state.cooldown = 3.6;
        state.turningFor = 0;
      }
      let amount = 0;
      if (reducedMotion) { state.phase = 0; state.turningFor = 0; }
      if (state.phase > 0) {
        state.phase += dt / 1.25;
        if (state.phase >= 1) state.phase = 0;
        else amount = Math.sin(state.phase * Math.PI) ** 2;
      }
      state.amount = amount;
      const maxOrbit = portrait ? .34 : .70;
      const safety = THREE.MathUtils.smoothstep(targetDistance, 6, 15);
      // Near a hoop, narrow the camera swing; the rider can still glance back.
      const orbit = state.side * maxOrbit * amount * safety;
      state.orbit = ease(state.orbit, orbit, dt, 8);
      const glanceYaw = -state.side * (Math.PI - Math.abs(state.orbit) - .4) * amount;
      const pilotTarget = mode === 'finished' ? -2.6 : showingOff || reducedMotion ? 0 : glanceYaw;
      state.pilotYaw = ease(state.pilotYaw, pilotTarget, dt, mode === 'finished' ? 3 : 14);
      return state;
    }
  };
}
