// Device-independent policy: measured frame times decide the automatic quality.
// Keep this module free of browser/Three dependencies so slow-device behavior is testable.
export const reefDetail = { value: 1 };
export const QUALITY = [
  { name: 'Light', ratio: .65, pixels: 400000, caustics: 0, lights: 0, shadows: false, bubbles: 120, fish: .28 },
  { name: 'Smooth', ratio: .85, pixels: 650000, caustics: 1, lights: 2, shadows: false, bubbles: 220, fish: .45 },
  { name: 'Balanced', ratio: 1, pixels: 1000000, caustics: 1, lights: 4, shadows: false, bubbles: 350, fish: .7 },
  { name: 'Detailed', ratio: 1.5, pixels: 1800000, caustics: 2, lights: Infinity, shadows: true, bubbles: 500, fish: 1 }
];

export function renderRatio(profile, width, height, dpr = 1) {
  return Math.min(dpr || 1, profile.ratio, Math.sqrt(profile.pixels / Math.max(1, width * height)));
}

export function createQualityController({ coarse = false, onChange = () => {} } = {}) {
  let level = coarse ? 1 : 2, mode = 'auto', ceiling = 3;
  let samples = [], seconds = 0, cooldown = 3, slow = 0, fast = 0;
  let last = { fps: 0, p90: 0 };
  function reset() { samples = []; seconds = 0; slow = fast = 0; cooldown = 3; }
  function change(next) {
    level = next; reset(); cooldown = 6;
    onChange(QUALITY[level]);
  }
  return {
    get profile() { return QUALITY[level]; },
    get mode() { return mode; },
    get stats() { return last; },
    reset,
    setMode(next) {
      if (!['auto', 'smooth', 'detailed'].includes(next)) return;
      mode = next; ceiling = 3;
      change(next === 'smooth' ? 1 : next === 'detailed' ? 3 : coarse ? 1 : 2);
    },
    sample(dt, active = true) {
      if (!active || !Number.isFinite(dt) || dt <= 0) { reset(); return; }
      // Backgrounding is handled by active/reset. Even a foreground frame
      // longer than a second must count, or the slowest devices never adapt.
      if (cooldown > 0) { cooldown -= dt; return; }
      samples.push(dt); seconds += dt;
      if (seconds < 2) return;
      samples.sort((a, b) => a - b);
      last = { fps: samples.length / seconds, p90: samples[Math.floor(samples.length * .9)] * 1000 };
      samples = []; seconds = 0;
      if (mode !== 'auto') return;
      slow = last.fps < 35 || last.p90 > 45 ? slow + 1 : 0;
      fast = last.fps > 57 && last.p90 < 19 ? fast + 2 : 0;
      if (slow >= 2 && level > 0) {
        // A failed upgrade is not retried every few seconds during the same swim.
        ceiling = Math.min(ceiling, level - 1); change(level - 1);
      } else if (fast >= 20 && level < ceiling) change(level + 1);
    }
  };
}

export function createFrameClock(now = 0) {
  let previous = now;
  return {
    reset(now) { previous = now; },
    sample(now, paused = false) {
      const realDt = Math.max(0, (now - previous) / 1000);
      previous = now;
      // Catch up through ordinary low FPS, but never jump through the ocean
      // after a long suspension. Physics runs in small steps inside this budget.
      const dt = paused ? 0 : Math.min(realDt, .25);
      const steps = dt > 0 ? Math.max(1, Math.ceil(dt / (1 / 60) - 1e-9)) : 0;
      return { realDt, dt, steps, step: steps ? dt / steps : 0 };
    }
  };
}
