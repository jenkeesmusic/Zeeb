// Course coordinates and swept hoop crossing are shared by the game and checks.
export const START = [0, -36, 0];
// Grow the tube outward: the clear opening remains 5.78 ft in radius.
export const HOOP_TUBE_RADIUS = .55;
export const HOOP_RADIUS = 5.78 + HOOP_TUBE_RADIUS;
export const PASS_RADIUS = 5.75;
export const PERFECT_RADIUS = 2.4;
// Stretch the route horizontally without changing hoop size or swim depth.
export const COURSE_SCALE = 1.4;
export const COURSE = [
  // Every gap gives room to steer and recover; the opening stays nearly straight.
  [0, -36, 20], [0, -38, 65], [4, -38, 120], [37, -39, 163],
  [91, -37, 166], [137, -34, 136], [160, -31, 84], [142, -33, 30],
  [106, -36, -9], [55, -39, -26], [4, -38, -41], [-48, -36, -39]
].map(([x, y, z]) => [x * COURSE_SCALE, y, z * COURSE_SCALE]);
export const ZONES = ['Coral gardens', 'Coral gardens', 'Coral gardens',
  'The moon arch', 'The moon arch', 'The moon arch',
  'Jellyfish grove', 'Jellyfish grove', 'Jellyfish grove',
  'The lost wreck', 'Treasure trail', 'Treasure cove'];

// Test the whole movement segment, so a fast boost cannot skip a thin hoop.
// Both directions count; coming back for a missed hoop is always allowed.
export function hoopCrossing(from, to, center, normal, radius) {
  const dot = (p) => (p[0] - center[0]) * normal[0] +
    (p[1] - center[1]) * normal[1] + (p[2] - center[2]) * normal[2];
  const a = dot(from), b = dot(to);
  if ((a < 0) === (b < 0) || Math.abs(a - b) < 1e-8) return null;
  const t = a / (a - b);
  const d = from.map((v, i) => v + (to[i] - v) * t - center[i]);
  const offset = Math.hypot(...d);
  return offset <= radius ? { offset, t } : null;
}
