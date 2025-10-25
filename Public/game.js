/* Zeeb Rocket — Dodge the Astroids
   Canvas game with keyboard/touch controls, spawning asteroids, collisions, score + best
*/

const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = $("overlay");
const startBtn = $("startBtn");
const gameOverEl = $("gameOver");
const restartBtn = $("restartBtn");
const scoreEl = $("scoreEl");
const coinsEl = $("coinsEl");
const bestEl = $("bestEl");
const finalScoreEl = $("finalScore");
const bgMusic = $("bgMusic");

// Robust music unlock for mobile autoplay
let musicUnlocked = false;
function unlockMusic() {
  if (musicUnlocked) return;
  try {
    bgMusic.muted = false;
    bgMusic.volume = 0.6;
    const p = bgMusic.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
  musicUnlocked = true;
}


// Sound effects
const laserSound = new Audio("audio/pew.wav");
laserSound.volume = 0.3; // Lower volume so it doesn't overpower music

// Canvas dimensions from HTML attributes
const W = canvas.width;
const H = canvas.height;

// Assets
const IMAGES = {
  rocket: new Image(),
  asteroids: [new Image(), new Image(), new Image()],
  crash: new Image(),
  coin: new Image(),
  laser: new Image(),
};

IMAGES.rocket.src = "img/Rocket1.png?v=20251024T201542";
IMAGES.asteroids[0].src = "img/astroid1.png";
IMAGES.asteroids[1].src = "img/astroid2.png";
IMAGES.asteroids[2].src = "img/astroid3.png";
IMAGES.crash.src = "img/crash.png";
IMAGES.coin.src = "img/coin.png";
IMAGES.laser.src = "img/laser.png";

// Game state
let state = "ready"; // "ready" | "running" | "paused" | "crashing" | "over"
let lastTs = 0;
let score = 0;
let coins = 0;
let best = parseInt(localStorage.getItem("zeeb_best") || "0", 10);
bestEl.textContent = best.toString();
coinsEl.textContent = coins.toString();

const keys = new Set();

// Pointer/touch control
let pointerActive = false;
let targetY = H / 2;

// Entities
class Rocket {
  constructor() {
    this.w = 105;
    this.h = 105;
    this.x = 80;
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
    this.speed = 320; // px/s for keyboard
    this.sprite = IMAGES.rocket;
    // Collision radius (approximate)
    this.r = Math.max(this.w, this.h) * 0.4;

    // Orientation: face right towards incoming asteroids
    this.angle = Math.PI / 2; // 90° clockwise
    this.tilt = 0; // slight up/down tilt based on vertical velocity
  }

  reset() {
    this.x = 80;
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
  }

  update(dt) {
    // Keyboard control
    let dir = 0;
    if (keys.has("ArrowUp") || keys.has("w")) dir -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) dir += 1;

    if (dir !== 0) {
      this.vy = dir * this.speed;
      this.y += this.vy * dt;
    } else if (pointerActive) {
      // Direct follow: rocket center follows finger immediately
      const centerY = this.y + this.h / 2;
      const diff = targetY - centerY;
      // Fast, direct movement for toddler-friendly control
      this.y += diff * Math.min(1, dt * 16);
      this.vy = diff; // track velocity for tilt
    } else {
      // No input: slight damping
      this.vy *= 0.9;
      this.y += this.vy * dt;
    }

    // Clamp to canvas
    if (this.y < 0) this.y = 0;
    if (this.y + this.h > H) this.y = H - this.h;

    // Slight tilt based on vertical velocity (for polish)
    this.tilt = Math.max(-0.3, Math.min(0.3, -this.vy / 900));
  }

  draw() {
    const ang = this.angle + (this.tilt || 0);
    if (this.sprite && this.sprite.complete) {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(ang);
      ctx.drawImage(this.sprite, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    } else {
      // Fallback: rotated placeholder triangle
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(ang);
      ctx.fillStyle = "#6cf";
      ctx.beginPath();
      ctx.moveTo(-this.w * 0.4, -this.h * 0.4);
      ctx.lineTo(this.w * 0.5, 0);
      ctx.lineTo(-this.w * 0.4, this.h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  center() {
    return { cx: this.x + this.w / 2, cy: this.y + this.h / 2 };
  }
}

class Asteroid {
  constructor() {
    this.size = randRange(42, 96);
    this.sprite = IMAGES.asteroids[(Math.random() * IMAGES.asteroids.length) | 0];
    this.x = W + this.size + randRange(0, 60);
    this.y = randRange(this.size * 0.5, H - this.size * 0.5);
    // Speed increases with score
    const base = 180;
    const extra = Math.min(280, score * 1.5);
    this.vx = -(base + extra + randRange(0, 120));
    this.r = (this.size / 2) * 0.8; // collision radius
    this.rotation = randRange(0, Math.PI * 2);
    this.vr = randRange(-1.5, 1.5); // rotation speed
  }

  update(dt) {
    this.x += this.vx * dt;
    this.rotation += this.vr * dt;
  }

  draw() {
    const w = this.size;
    const h = this.size;
    const cx = this.x;
    const cy = this.y;

    if (this.sprite && this.sprite.complete) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.rotation);
      ctx.drawImage(this.sprite, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      // Fallback: simple circle
      ctx.save();
      ctx.fillStyle = "#999";
      ctx.beginPath();
      ctx.arc(cx, cy, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  offscreen() {
    return this.x < -this.size;
  }
}

class Laser {
  constructor(x, y) {
    this.w = 60;
    this.h = 12;
    this.x = x;
    this.y = y;
    this.vx = 800; // fast horizontal speed
    this.sprite = IMAGES.laser;
  }

  update(dt) {
    this.x += this.vx * dt;
  }

  draw() {
    if (this.sprite && this.sprite.complete) {
      ctx.save();
      ctx.drawImage(this.sprite, this.x, this.y, this.w, this.h);
      ctx.restore();
    } else {
      // Fallback: bright rectangle
      ctx.save();
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.restore();
    }
  }

  offscreen() {
    return this.x > W + this.w;
  }

  hits(asteroid) {
    // Simple bounding box collision
    const laserCenterX = this.x + this.w / 2;
    const laserCenterY = this.y + this.h / 2;
    return dist(laserCenterX, laserCenterY, asteroid.x, asteroid.y) <= asteroid.r + this.h / 2;
  }
}

class Coin {
  constructor() {
    this.size = 40;
    this.sprite = IMAGES.coin;
    this.x = W + this.size + randRange(0, 100);
    this.y = randRange(this.size, H - this.size);
    this.vx = -200; // coins move slower than asteroids
    this.r = this.size / 2; // collision radius
    this.pulse = Math.random() * Math.PI * 2; // for scale animation
  }

  update(dt) {
    this.x += this.vx * dt;
    this.pulse += dt * 4; // pulse speed
  }

  draw() {
    const scale = 1 + 0.15 * Math.sin(this.pulse);
    const w = this.size * scale;
    const h = this.size * scale;

    if (this.sprite && this.sprite.complete) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.drawImage(this.sprite, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      // Fallback: yellow circle
      ctx.save();
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  offscreen() {
    return this.x < -this.size;
  }
}

// Utilities
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

// Game world
const rocket = new Rocket();
let asteroids = [];
let coins_arr = [];
let lasers = [];
let explosions = [];
let spawnTimer = 0;
let coinSpawnTimer = 0;
let crashAnim = { active: false, t: 0, duration: 900, x: 0, y: 0 };
let stars = [];
let lastShot = 0; // for rate limiting shots

function initStars() {
  const COUNT = 120;
  stars = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.2 + 0.3,
    tw: Math.random() * Math.PI * 2,
  }));
}

function spawnIntervalMs() {
  // Faster spawns as score increases
  const minMs = 450;
  const maxMs = 1000;
  const t = Math.min(1, score / 600); // ramp over time
  return Math.floor(maxMs - (maxMs - minMs) * t);
}

function resetGame() {
  asteroids = [];
  coins_arr = [];
  lasers = [];
  explosions = [];
  score = 0;
  coins = 0;
  spawnTimer = 0;
  coinSpawnTimer = 0;
  lastShot = 0;
  crashAnim = { active: false, t: 0, duration: 900, x: 0, y: 0 };
  rocket.reset();
  initStars();
  updateHud();
}

function startGame() {
  resetGame();
  hide(overlay);
  hide(gameOverEl);
  state = "running";
  // Start background music (ensure unmuted)
  try {
    bgMusic.muted = false;
    bgMusic.volume = 0.6;
    const p = bgMusic.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) {
    console.log("Audio play failed:", e);
  }
}

function gameOver() {
  state = "over";
  finalScoreEl.textContent = `Score: ${Math.floor(score)}`;
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem("zeeb_best", String(best));
  }
  updateHud();
  show(gameOverEl);
  // Pause music on game over
  bgMusic.pause();
}

function triggerCrash(cx, cy) {
  crashAnim = { active: true, t: 0, duration: 900, x: cx, y: cy };
  state = "crashing";
  try {
    if (navigator.vibrate) navigator.vibrate(150);
  } catch (_) {}
}

function togglePause() {
  if (state === "running") {
    state = "paused";
    bgMusic.pause();
  } else if (state === "paused") {
    state = "running";
    lastTs = performance.now(); // reset timing delta
    try {
      bgMusic.muted = false;
      bgMusic.volume = 0.6;
      const p = bgMusic.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {
      console.log("Audio play failed:", e);
    }
  }
}

function updateHud() {
  scoreEl.textContent = Math.floor(score).toString();
  coinsEl.textContent = coins.toString();
  bestEl.textContent = Math.floor(best).toString();
}

function update(dt) {
  // Crash animation phase: wait briefly before showing Game Over
  if (state === "crashing") {
    crashAnim.t += dt * 1000;
    if (crashAnim.t >= crashAnim.duration) {
      gameOver();
    }
    return;
  }
  // Update entities
  rocket.update(dt);

  for (const a of asteroids) a.update(dt);
  for (const c of coins_arr) c.update(dt);
  for (const l of lasers) l.update(dt);
  
  // Update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].t += dt * 1000;
    if (explosions[i].t >= explosions[i].duration) {
      explosions.splice(i, 1);
    }
  }
  
  // Remove offscreen
  asteroids = asteroids.filter((a) => !a.offscreen());
  coins_arr = coins_arr.filter((c) => !c.offscreen());
  lasers = lasers.filter((l) => !l.offscreen());

  // Spawn asteroids
  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnIntervalMs()) {
    spawnTimer = 0;

    // Spawn 1 or sometimes 2 asteroids for variety
    const burst = Math.random() < 0.12 ? 2 : 1;
    for (let i = 0; i < burst; i++) {
      const newAst = new Asteroid();
      // Slight vertical offset if double spawn
      if (burst === 2) newAst.y = Math.max(30, Math.min(H - 30, newAst.y + (i === 0 ? -28 : 28)));
      asteroids.push(newAst);
    }
  }

  // Spawn coins
  coinSpawnTimer += dt * 1000;
  if (coinSpawnTimer >= 2000) { // spawn a coin every 2 seconds
    coinSpawnTimer = 0;
    coins_arr.push(new Coin());
  }

  // Laser hits asteroids
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const asteroid = asteroids[j];
      if (laser.hits(asteroid)) {
        // Destroy asteroid and laser
        explosions.push({ x: asteroid.x, y: asteroid.y, t: 0, duration: 400 });
        
        // Spawn a coin at the destroyed asteroid's location
        const newCoin = new Coin();
        newCoin.x = asteroid.x;
        newCoin.y = asteroid.y;
        coins_arr.push(newCoin);
        
        asteroids.splice(j, 1);
        lasers.splice(i, 1);
        // Award points based on asteroid size
        score += Math.floor(asteroid.size);
        updateHud();
        break;
      }
    }
  }

  // Collisions
  const { cx, cy } = rocket.center();
  
  // Check asteroid collisions
  for (const a of asteroids) {
    if (dist(cx, cy, a.x, a.y) <= rocket.r + a.r) {
      triggerCrash(cx, cy);
      return;
    }
  }

  // Check coin collection
  for (let i = coins_arr.length - 1; i >= 0; i--) {
    const c = coins_arr[i];
    if (dist(cx, cy, c.x, c.y) <= rocket.r + c.r) {
      coins++;
      coins_arr.splice(i, 1);
      updateHud();

      // Transition to Level 2 when player reaches 10 coins (trigger once)
      if (!window.__level2Triggered && coins >= 10) {
        window.__level2Triggered = true;
        try { bgMusic.pause(); } catch (_) {}
        // slight delay for feedback, then navigate
        setTimeout(() => {
          window.location.href = "level2/index.html";
        }, 400);
      }
    }
  }

  // Score by survival time
  score += dt * 10; // 10 pts per second
  if (score > best) {
    best = Math.floor(score);
  }
  updateHud();
}

function drawBackground() {
  // Pitch-black with minimal starfield
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const t = performance.now() / 1000;
  ctx.save();
  for (const s of stars) {
    const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  // Draw entities
  rocket.draw();
  for (const a of asteroids) a.draw();
  for (const c of coins_arr) c.draw();
  for (const l of lasers) l.draw();

  // Draw explosions
  for (const ex of explosions) {
    if (IMAGES.crash && IMAGES.crash.complete) {
      const p = Math.min(1, ex.t / ex.duration);
      const size = 60 + 80 * p;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(ex.x, ex.y);
      ctx.drawImage(IMAGES.crash, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  // Crash explosion effect
  if (state === "crashing" && IMAGES.crash && IMAGES.crash.complete && crashAnim.active) {
    const p = Math.min(1, crashAnim.t / crashAnim.duration);
    const size = 120 + 140 * p;
    ctx.save();
    ctx.translate(crashAnim.x, crashAnim.y);
    ctx.drawImage(IMAGES.crash, -size / 2, -size / 2, size, size);
    ctx.restore();

    // Slight screen flash
    ctx.save();
    ctx.fillStyle = `rgba(255, 120, 80, ${0.25 * (1 - p)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state === "paused") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#cfe6ff";
    ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Paused (press P to resume)", W / 2, H / 2);
    ctx.restore();
  }
}

// Main loop
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0); // cap large dt spikes
  lastTs = ts;

  if (state === "running" || state === "crashing") {
    update(dt);
  }
  draw();

  requestAnimationFrame(loop);
}

// Helpers: show/hide
function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

// Event listeners
startBtn.addEventListener("click", () => {
  if (state === "ready" || state === "over") startGame();
});
restartBtn.addEventListener("click", () => {
  if (state === "over") startGame();
});

window.addEventListener("keydown", (e) => {
  // Prevent scrolling on arrow keys/space
  if (["ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();

  if (e.key === "p" || e.key === "P") {
    togglePause();
    return;
  }
  if (e.key === " " && (state === "ready" || state === "over")) {
    startGame();
    return;
  }

  // Shoot laser with spacebar
  if (e.key === " " && state === "running") {
    const now = performance.now();
    if (now - lastShot >= 250) { // rate limit: max 4 shots per second
      const { cx, cy } = rocket.center();
      lasers.push(new Laser(cx + rocket.w / 2, cy - 4));
      lastShot = now;
      // Play laser sound
      laserSound.currentTime = 0;
      laserSound.play().catch(e => console.log("Sound play failed:", e));
    }
    return;
  }

  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.add("ArrowUp") || keys.add("w");
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.add("ArrowDown") || keys.add("s");
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    keys.delete("ArrowUp");
    keys.delete("w");
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    keys.delete("ArrowDown");
    keys.delete("s");
  }
});

// Pointer controls on canvas (mouse/touch unified)
let shootOnRelease = false;
let moveStartTime = 0;

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  pointerActive = true;
  moveStartTime = performance.now();
  shootOnRelease = true;
  updateTargetY(e);
  
  // Quick tap detection for shooting
  if (state === "running" && performance.now() - moveStartTime < 50) {
    const now = performance.now();
    if (now - lastShot >= 250) {
      const { cx, cy } = rocket.center();
      lasers.push(new Laser(cx + rocket.w / 2, cy - 4));
      lastShot = now;
      // Play laser sound
      laserSound.currentTime = 0;
      laserSound.play().catch(e => console.log("Sound play failed:", e));
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  e.preventDefault();
  if (pointerActive) {
    updateTargetY(e);
    // If user moves significantly, don't shoot on release
    if (performance.now() - moveStartTime > 100) {
      shootOnRelease = false;
    }
  }
});

window.addEventListener("pointerup", (e) => {
  if (pointerActive && state === "running" && shootOnRelease && performance.now() - moveStartTime < 200) {
    // Quick tap = shoot laser
    const now = performance.now();
    if (now - lastShot >= 250) {
      const { cx, cy } = rocket.center();
      lasers.push(new Laser(cx + rocket.w / 2, cy - 4));
      lastShot = now;
      // Play laser sound
      laserSound.currentTime = 0;
      laserSound.play().catch(e => console.log("Sound play failed:", e));
    }
  }
  pointerActive = false;
  shootOnRelease = false;
});

function updateTargetY(e) {
  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  // Scale to actual canvas coordinates if canvas is scaled
  const scaleY = H / rect.height;
  targetY = y * scaleY;
}

// Auto-hide mobile address bar on load
function hideAddressBar() {
  if (window.innerHeight !== window.outerHeight) {
    // Scroll slightly to trigger address bar hiding
    window.scrollTo(0, 1);
    setTimeout(() => window.scrollTo(0, 0), 0);
  }
}

/* Start in "ready" state with overlay visible */
show(overlay);
hide(gameOverEl);
updateHud();
initStars();

/* Try to autoplay start screen music (fallback: start muted then auto-unmute when possible) */
(function tryAutoplayMusic() { return;
  try {
    bgMusic.muted = false;
    bgMusic.volume = 0.6;
    const p = bgMusic.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        try {
          // Fallback: start muted to satisfy autoplay, then try unmuting shortly after
          bgMusic.muted = true;
          const p2 = bgMusic.play();
          if (p2 && typeof p2.catch === "function") p2.catch(() => {});
          let attempts = 0;
          const maxAttempts = 12; // ~12 seconds of retries
          const unmuteTimer = setInterval(() => {
            attempts++;
            if (document.hidden) return; // only try when tab is visible
            try {
              bgMusic.muted = false;
              bgMusic.volume = 0.6;
              const p3 = bgMusic.play();
              // If unmuted successfully, stop trying
              if (!bgMusic.muted) clearInterval(unmuteTimer);
              if (p3 && typeof p3.catch === "function") {
                p3.catch(() => {
                  // keep trying silently
                });
              }
            } catch (_) {}
            if (attempts >= maxAttempts) clearInterval(unmuteTimer);
          }, 1000);
        } catch (_) {}
      });
    }
  } catch (_) {}
})();

// Hide address bar on mobile
setTimeout(hideAddressBar, 100);
window.addEventListener('orientationchange', () => setTimeout(hideAddressBar, 100));

requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(loop);
});
