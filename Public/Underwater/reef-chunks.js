import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Reuse bit-identical triangle corners, including normals, paint and UVs.
// Integer hashing preserves seams without millions of temporary string keys.
export function indexExactGeometry(geometry) {
  if (geometry.index) return geometry;
  const attributes = Object.entries(geometry.attributes);
  if (attributes.some(([, a]) => a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array))) return geometry;
  const count = geometry.attributes.position.count;
  if (!count) return geometry;
  const bits = attributes.map(([, a]) => new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length));
  let capacity = 1;
  while (capacity < count * 2) capacity *= 2;
  const slots = new Uint32Array(capacity), remap = new Uint32Array(count), originals = new Uint32Array(count);
  let unique = 0;
  for (let i = 0; i < count; i++) {
    let hash = 2166136261;
    for (let a = 0; a < attributes.length; a++) {
      const size = attributes[a][1].itemSize;
      for (let k = 0; k < size; k++) hash = Math.imul(hash ^ bits[a][i * size + k], 16777619);
    }
    hash ^= hash >>> 16;
    let slot = hash & (capacity - 1), same = false;
    while (slots[slot]) {
      const previous = originals[slots[slot] - 1];
      same = true;
      for (let a = 0; a < attributes.length && same; a++) {
        const size = attributes[a][1].itemSize;
        for (let k = 0; k < size; k++) if (bits[a][i * size + k] !== bits[a][previous * size + k]) { same = false; break; }
      }
      if (same) break;
      slot = (slot + 1) & (capacity - 1);
    }
    if (!same) { originals[unique] = i; slots[slot] = ++unique; }
    remap[i] = slots[slot] - 1;
  }
  for (const [name, attr] of attributes) {
    const compact = new Float32Array(unique * attr.itemSize);
    for (let i = 0; i < unique; i++) {
      const from = originals[i] * attr.itemSize;
      compact.set(attr.array.subarray(from, from + attr.itemSize), i * attr.itemSize);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(compact, attr.itemSize, attr.normalized));
  }
  geometry.setIndex(new THREE.BufferAttribute(unique <= 65536 ? new Uint16Array(remap) : remap, 1));
  return geometry;
}

// Partition already-positioned scenery, preserving every triangle and its
// original normals/colors. Whole formations stay together at cell boundaries.
export function mergeSceneryCells(parts, material, name, { cellSize = 72, castShadow = true, padding = 0 } = {}) {
  const cells = new Map();
  for (const geometry of parts) {
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const key = `${Math.floor(center.x / cellSize)},${Math.floor(center.z / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(geometry);
  }
  const group = new THREE.Group(); group.name = name;
  for (const [cell, geometries] of cells) {
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error(`Cannot merge ${name} cell ${cell}`);
    geometries.forEach(g => g.dispose());
    indexExactGeometry(geometry);
    geometry.computeBoundingSphere(); geometry.boundingSphere.radius += padding;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${name} / ${cell}`; mesh.castShadow = castShadow; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  return group;
}

// Preserve the original sea-floor grid exactly, including normals along tile
// edges. Unlike a single world-sized plane, each tile can be frustum culled.
export function tileFloor(source, segments, material, tileSegments = 44) {
  const group = new THREE.Group(); group.name = 'Sea floor';
  for (let z = 0; z < segments; z += tileSegments) {
    for (let x = 0; x < segments; x += tileSegments) {
      const nx = Math.min(tileSegments, segments - x), nz = Math.min(tileSegments, segments - z);
      const geometry = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(source.attributes)) {
        const values = new attr.array.constructor((nx + 1) * (nz + 1) * attr.itemSize);
        for (let row = 0; row <= nz; row++) {
          const from = ((z + row) * (segments + 1) + x) * attr.itemSize;
          values.set(attr.array.subarray(from, from + (nx + 1) * attr.itemSize), row * (nx + 1) * attr.itemSize);
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(values, attr.itemSize, attr.normalized));
      }
      const indices = [];
      for (let row = 0; row < nz; row++) for (let col = 0; col < nx; col++) {
        const a = row * (nx + 1) + col, b = a + nx + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
      geometry.setIndex(indices); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `Sea floor / ${x},${z}`; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }
  source.dispose();
  return group;
}
