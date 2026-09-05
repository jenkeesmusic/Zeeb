import * as THREE from 'three';
import { COURSE_SCALE } from './reef-course.js';
import { createSculptedGarden } from './reef-garden.js';
import { createTreasureCove } from './treasure-cove.js';
import { createSceneryForms } from './scenery-forms.js';
import { createReefScenery } from './reef-scenery.js';
import { createColossalWreck } from './colossal-wreck.js';

export function createReef({ scene, floorY, timeUniform, spawnBubble, duck, rally, onDiscover, reducedMotion = false }) {
  let seed = 83117;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const range = (a, b) => a + random() * (b - a);
  const library = createSceneryForms();
  const garden = createSculptedGarden({ scene, floorY, timeUniform, sceneryForms:library.forms });
  const scenery = createReefScenery({ scene, floorY, timeUniform, forms:library.forms });
  const wreck = createColossalWreck({scene,timeUniform,forms:library.forms,duck,rally,spawnBubble,reducedMotion});
  library.dispose();
  const treasure = createTreasureCove({ scene, floorY, spawnBubble, reducedMotion });

  // Grace's original drawing is a little secret tucked inside a rocky alcove.
  // It stays still: no chase, teeth animation, or surprise entrance.
  const secret = new THREE.Group(); const secretX = 125 * COURSE_SCALE, secretZ = 17 * COURSE_SCALE, secretY = floorY(secretX, secretZ);
  secret.position.set(secretX, secretY, secretZ); secret.rotation.y = -.5; scene.add(secret);
  const secretStone = new THREE.MeshStandardMaterial({ color: 0x9592ac, roughness: .7 });
  for (const [x, y, z, sx, sy, sz] of [[-8, 3, 0, 2.5, 4.6, 3], [3, 3, 0, 6, 5.5, 3.2], [0, 7, -1, 8, 2, 3.4], [0, 2, -3, 8, 4, 1]]) {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), secretStone); rock.position.set(x, y, z); rock.scale.set(sx, sy, sz); secret.add(rock);
  }
  new THREE.TextureLoader().load('../Islands/level2/Shark_Grace.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const drawing = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .15, side: THREE.DoubleSide, color: 0xc4dbec }));
    drawing.position.set(-1, 3.4, -1.9); secret.add(drawing);
  }, undefined, () => {});
  let discovered = false, bubbleTimer = 0;
  const temp = new THREE.Vector3();
  return {
    treasure, secret, garden, scenery, wreck,
    update(dt, t) {
      treasure.update(dt, t);
      wreck.update(dt);
      bubbleTimer += dt;
      if (bubbleTimer > .3) {
        bubbleTimer = 0;
        for (const [bx, bz] of [[-12, 45], [80, 179], [157, 37]]) {
          const x=bx*COURSE_SCALE,z=bz*COURSE_SCALE;
          spawnBubble(temp.set(x + range(-.6, .6), floorY(x, z) + 1, z), range(.15, .35));
        }
      }
      if (!discovered && duck.position.distanceTo(secret.position.clone().add(new THREE.Vector3(0, 4, 0))) < 11) {
        discovered = true; onDiscover('You found Grace’s secret drawing!');
      }
    }
  };
}
