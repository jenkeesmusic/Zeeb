/* Level 3 — Segmented from Level 2
   Even faster spawns, higher asteroid speeds, denser fields, separate best score key
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
const winOverlay = $("winOverlay");
const winVideo = $("winVideo");
const replayL3 = $("replayL3");
const playVideoBtn = $("playVideoBtn");
let winPlaying = false;
let winEnded = false;
let winBtnRect = null;

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
if (winVideo) {
  winVideo.addEventListener("ended", () => {
    winPlaying = false;
    winEnded = true;
  });
}

// Sound effects (reuse pew)
const laserSound = new Audio("../audio/pew.wav");
laserSound.volume = 0.38;

// Canvas dimensions from HTML attributes
const W = canvas.width;
const H = canvas.height;

// Assets (segmented art for L3)
const IMAGES = {
  rocket: new Image(),
  asteroids: [new Image(), new Image(), new Image()],
  crash: new Image(),
  coin: new Image(),
  laser: new Image(),
};

IMAGES.rocket.src = "../img/spaceship3.png?v=20251024T201542";
IMAGES.asteroids[0].src = "../img/astroid1.png";
IMAGES.asteroids[1].src = "../img/astroid2.png";
IMAGES.asteroids[2].src = "../img/astroid3.png";
IMAGES.crash.src = "../img/crash.png";
IMAGES.coin.src = "../img/coin.png";
IMAGES.laser.src = "../img/laser3.png";

// Game state
let state = "ready"; // "ready" | "running" | "paused" | "crashing" | "over"
let lastTs = 0;
let score = 0;
let coins = 0;
// Separate best for Level 3
let best = parseInt(localStorage.getItem("zeeb_best_l3") || "0", 10);
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
    this.x = 86;
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
    this.speed = 400; // L3 keyboard speed bump
    this.sprite = IMAGES.rocket;
    this.r = Math.max(this.w, this.h) * 0.38;

    // Face right, mild tilt
    this.angle = Math.PI / 2;
    this.tilt = 0;
  }

  reset() {
    this.x = 86;
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
      const centerY = this.y + this.h / 2;
      const diff = targetY - centerY;
      // L3: snappiest finger follow
      this.y += diff * Math.min(1, dt * 20);
      this.vy = diff;
    } else {
      this.vy *= 0.9;
      this.y += this.vy * dt;
    }

    // Clamp
    if (this.y < 0) this.y = 0;
    if (this.y + this.h > H) this.y = H - this.h;

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
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffa870";
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
    this.size = randRange(40, 86);
    this.sprite = IMAGES.asteroids[(Math.random() * IMAGES.asteroids.length) | 0];
    this.x = W + this.size + randRange(0, 100);
    this.y = randRange(this.size * 0.5, H - this.size * 0.5);
    // L3: Faster base + stronger scaling
    const base = 320;
    const extra = Math.min(480, score * 2.8);
    this.vx = -(base + extra + randRange(0, 200));
    this.r = (this.size / 2) * 0.8;
    this.rotation = randRange(0, Math.PI * 2);
    this.vr = randRange(-2.6, 2.6);
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
      ctx.save();
      ctx.fillStyle = "#bbb";
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
  constructor(x, y, vy = 0) {
    this.w = 60;
    this.h = 6;
    this.x = x;
    this.y = y;
    this.vx = 1000; // L3 faster
    this.vy = vy;   // vertical velocity to create cone spread
    this.sprite = IMAGES.laser;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw() {
    if (this.sprite && this.sprite.complete) {
      ctx.save();
      ctx.drawImage(this.sprite, this.x, this.y, this.w, this.h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = "#ff7a30";
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.restore();
    }
  }

  offscreen() {
    return this.x > W + this.w;
  }

  hits(asteroid) {
    const laserCenterX = this.x + this.w / 2;
    const laserCenterY = this.y + this.h / 2;
    return dist(laserCenterX, laserCenterY, asteroid.x, asteroid.y) <= asteroid.r + this.h / 2;
  }
}

class Coin {
  constructor() {
    this.size = 40;
    this.sprite = IMAGES.coin;
    this.x = W + this.size + randRange(0, 140);
    this.y = randRange(this.size, H - this.size);
    // L3: coins drift faster
    this.vx = -320;
    this.r = this.size / 2;
    this.pulse = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.pulse += dt * 5.5;
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

// World
const rocket = new Rocket();
let asteroids = [];
let coins_arr = [];
let lasers = [];
let explosions = [];
let spawnTimer = 0;
let coinSpawnTimer = 0;
let crashAnim = { active: false, t: 0, duration: 900, x: 0, y: 0 };
let stars = [];
let lastShot = 0;

function initStars() {
  const COUNT = 160; // denser starfield for L3
  stars = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.35 + 0.35,
    tw: Math.random() * Math.PI * 2,
  }));
}

function spawnIntervalMs() {
  // L3: even faster spawn cadence
  const minMs = 240;
  const maxMs = 600;
  const t = Math.min(1, score / 600);
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
  // Attempt autoplay with sound; if blocked, start muted then periodically try to unmute
  try {
    bgMusic.muted = false;
    bgMusic.volume = 0.6;
    const p = bgMusic.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        try {
          // Fallback: start muted to satisfy autoplay, then try to unmute later
          bgMusic.muted = true;
          const p2 = bgMusic.play();
          if (p2 && typeof p2.catch === "function") p2.catch(() => {});
          // Try to unmute a few times in the background (no user tap)
          let attempts = 0;
          const maxAttempts = 12; // ~12s
          const unmuteTimer = setInterval(() => {
            attempts++;
            if (document.hidden) return; // wait until tab visible
            try {
              bgMusic.muted = false;
              bgMusic.volume = 0.6;
              const p3 = bgMusic.play();
              if (!bgMusic.muted) {
                clearInterval(unmuteTimer);
              }
              if (p3 && typeof p3.catch === "function") {
                p3.catch(() => {
                  // keep trying
                });
              }
            } catch (_) {}
            if (attempts >= maxAttempts) clearInterval(unmuteTimer);
          }, 1000);
        } catch (_) {}
      });
    }
  } catch (_) {}
}

function gameOver() {
  state = "over";
  finalScoreEl.textContent = `Score: ${Math.floor(score)}`;
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem("zeeb_best_l3", String(best));
  }
  updateHud();
  show(gameOverEl);
  bgMusic.pause();
}

function triggerCrash(cx, cy) {
  crashAnim = { active: true, t: 0, duration: 900, x: cx, y: cy };
  state = "crashing";
  try { if (navigator.vibrate) navigator.vibrate(200); } catch (_) {}
}

function togglePause() {
  if (state === "running") {
    state = "paused";
    bgMusic.pause();
  } else if (state === "paused") {
    state = "running";
    lastTs = performance.now();
    try {
      bgMusic.muted = false;
      bgMusic.volume = 0.6;
      const p = bgMusic.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }
}

function updateHud() {
  scoreEl.textContent = Math.floor(score).toString();
  coinsEl.textContent = coins.toString();
  bestEl.textContent = Math.floor(best).toString();
}

function update(dt) {
  if (state === "crashing") {
    crashAnim.t += dt * 1000;
    if (crashAnim.t >= crashAnim.duration) {
      gameOver();
    }
    return;
  }

  rocket.update(dt);
  for (const a of asteroids) a.update(dt);
  for (const c of coins_arr) c.update(dt);
  for (const l of lasers) l.update(dt);

  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].t += dt * 1000;
    if (explosions[i].t >= explosions[i].duration) explosions.splice(i, 1);
  }

  // culling
  asteroids = asteroids.filter((a) => !a.offscreen());
  coins_arr = coins_arr.filter((c) => !c.offscreen());
  lasers = lasers.filter((l) => !l.offscreen());

  // spawns (L3: chance for triple)
  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnIntervalMs()) {
    spawnTimer = 0;
    const r = Math.random();
    let count = 1;
    if (r < 0.12) count = 3;
    else if (r < 0.34) count = 2;
    for (let i = 0; i < count; i++) {
      const a = new Asteroid();
      if (count >= 2) a.y = Math.max(30, Math.min(H - 30, a.y + (i === 0 ? -28 : i === 1 ? 0 : 28)));
      asteroids.push(a);
    }
  }

  coinSpawnTimer += dt * 1000;
  if (coinSpawnTimer >= 1600) { // faster coin spawns
    coinSpawnTimer = 0;
    coins_arr.push(new Coin());
  }

  // laser hits
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const a = asteroids[j];
      if (laser.hits(a)) {
        explosions.push({ x: a.x, y: a.y, t: 0, duration: 440 });
        // Coin drop
        const drop = new Coin();
        drop.x = a.x;
        drop.y = a.y;
        coins_arr.push(drop);

        asteroids.splice(j, 1);
        lasers.splice(i, 1);
        score += Math.floor(a.size * 1.25); // more points in L3
        updateHud();
        break;
      }
    }
  }

  // collisions
  const { cx, cy } = rocket.center();
  for (const a of asteroids) {
    if (dist(cx, cy, a.x, a.y) <= rocket.r + a.r) {
      triggerCrash(cx, cy);
      return;
    }
  }

  // coin collect
  for (let i = coins_arr.length - 1; i >= 0; i--) {
    const c = coins_arr[i];
    if (dist(cx, cy, c.x, c.y) <= rocket.r + c.r) {
      coins++;
      coins_arr.splice(i, 1);
      updateHud();

      // Win condition: at 15 coins, play video embedded into canvas
      if (!window.__winTriggered && coins >= 15) {
        window.__winTriggered = true;
        state = "win";
        try { bgMusic.pause(); } catch (_) {}
        if (winOverlay) { try { hide(winOverlay); } catch (_) {} }
        if (winVideo) {
          try {
            winEnded = false;
            winPlaying = true;
            winVideo.muted = true; // reliable autoplay
            winVideo.currentTime = 0;
            const p = winVideo.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
          } catch (_) {}
        }
      }
    }
  }

  // Score per time (more)
  score += dt * 14;
  if (score > best) best = Math.floor(score);
  updateHud();
}

function drawBackground() {
  // Warmer starfield for L3
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const t = performance.now() / 1000;
  ctx.save();
  for (const s of stars) {
    const a = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffd0a8";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  // Canvas-embedded win video mode
  if (state === "win") {
    const vw = (winVideo && winVideo.videoWidth) ? winVideo.videoWidth : 1280;
    const vh = (winVideo && winVideo.videoHeight) ? winVideo.videoHeight : 720;

    // Fit within canvas with margin
    let maxW = Math.floor(W * 0.86);
    let maxH = Math.floor(H * 0.66);
    let drawW = maxW;
    let drawH = Math.floor(drawW * (vh / vw));
    if (drawH > maxH) {
      drawH = maxH;
      drawW = Math.floor(drawH * (vw / vh));
    }
    const dx = Math.floor((W - drawW) / 2);
    const dy = Math.floor((H - drawH) / 2);

    // Dim backdrop
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Frame glow/border
    ctx.save();
    ctx.shadowColor = "#ffcf99";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(255, 220, 180, 0.15)";
    ctx.fillRect(dx - 8, dy - 8, drawW + 16, drawH + 16);
    ctx.restore();

    // Draw video frame
    if (winVideo) {
      try { ctx.drawImage(winVideo, dx, dy, drawW, drawH); } catch (_) {}
    }

    // Overlay text prompts
    ctx.save();
    ctx.fillStyle = "#ffe7d2";
    ctx.textAlign = "center";
    ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText("You Win!", W / 2, Math.max(40, dy - 20));
    if (winEnded) {
      // Draw a Restart (Level 1) button
      const btnW = 260;
      const btnH = 56;
      const bx = Math.floor((W - btnW) / 2);
      const by = Math.min(H - 20, dy + drawH + 60) - btnH; // ensure on screen
      // button background
      ctx.save();
      ctx.fillStyle = "rgba(255, 220, 180, 0.35)";
      ctx.strokeStyle = "#ffcf99";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(bx, by, btnW, btnH);
      ctx.fill();
      ctx.stroke();
      // label
      ctx.fillStyle = "#2b1a0e";
      ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Restart (Level 1)", bx + btnW / 2, by + btnH / 2);
      ctx.restore();

      // Save hitbox for pointer handling
      winBtnRect = { x: bx, y: by, w: btnW, h: btnH };
    }
    ctx.restore();

    return; // don't draw regular scene on win
  }

  rocket.draw();
  for (const a of asteroids) a.draw();
  for (const c of coins_arr) c.draw();
  for (const l of lasers) l.draw();

  for (const ex of explosions) {
    if (IMAGES.crash && IMAGES.crash.complete) {
      const p = Math.min(1, ex.t / ex.duration);
      const size = 60 + 96 * p;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.translate(ex.x, ex.y);
      ctx.drawImage(IMAGES.crash, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  if (state === "crashing" && IMAGES.crash && IMAGES.crash.complete && crashAnim.active) {
    const p = Math.min(1, crashAnim.t / crashAnim.duration);
    const size = 140 + 160 * p;
    ctx.save();
    ctx.translate(crashAnim.x, crashAnim.y);
    ctx.drawImage(IMAGES.crash, -size / 2, -size / 2, size, size);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = `rgba(255, 160, 80, ${0.18 * (1 - p)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state === "paused") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffe7d2";
    ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Paused (press P to resume)", W / 2, H / 2);
    ctx.restore();
  }
}

// Main loop
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;

  if (state === "running" || state === "crashing") {
    update(dt);
  }
  draw();

  requestAnimationFrame(loop);
}

// Helpers
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

// Events
startBtn.addEventListener("click", () => {
  unlockMusic();
  if (state === "ready" || state === "over") startGame();
});
restartBtn.addEventListener("click", () => {
  if (state === "over") startGame();
});

/* Replay Level 3 from win overlay */
if (typeof replayL3 !== "undefined" && replayL3) {
  replayL3.addEventListener("click", () => {
    if (winVideo) {
      try { winVideo.pause(); winVideo.currentTime = 0; } catch (_) {}
    }
    if (winOverlay) hide(winOverlay);
    window.__winTriggered = false;
    startGame();
  });
}

/* Play Video Button: enable video and music after user click */
if (typeof playVideoBtn !== "undefined" && playVideoBtn) {
  playVideoBtn.addEventListener("click", () => {
    // Play video with sound
    if (winVideo) {
      try {
        winVideo.muted = false;
        winVideo.volume = 1.0;
        const p = winVideo.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) {}
    }
    // Also play background music
    try {
      bgMusic.muted = false;
      bgMusic.volume = 0.6;
      bgMusic.currentTime = 0; // restart from beginning
      const p = bgMusic.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  });
}

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  unlockMusic();

  if (e.key === "p" || e.key === "P") {
    togglePause();
    return;
  }
  if (e.key === " " && (state === "ready" || state === "over")) {
    startGame();
    return;
  }

  // Shoot (triple-shot with cone spread)
  if (e.key === " " && state === "running") {
    const now = performance.now();
    if (now - lastShot >= 200) {
      const { cx, cy } = rocket.center();
      const x = cx + rocket.w / 2;
      const vx = 1000; // keep in sync with Laser.vx
      const timeToEdge = Math.max(0.001, (W - x) / vx);
      const spreadHalf = 72; // px half-spread at right edge (~2-3x wider)
      const vyTop = -spreadHalf / timeToEdge;
      const vyBottom = spreadHalf / timeToEdge;

      lasers.push(new Laser(x, cy - 8, vyTop));
      lasers.push(new Laser(x, cy, 0));
      lasers.push(new Laser(x, cy + 8, vyBottom));

      lastShot = now;
      laserSound.currentTime = 0;
      laserSound.play().catch(() => {});
    }
    return;
  }

  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.add("ArrowUp") || keys.add("w");
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.add("ArrowDown") || keys.add("s");
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    keys.delete("ArrowUp"); keys.delete("w");
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    keys.delete("ArrowDown"); keys.delete("s");
  }
});

// Pointer-controls (tap = shoot, drag = move)
let shootOnRelease = false;
let moveStartTime = 0;

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockMusic();

  // Special handling in win mode: tap to unmute or to replay after video ends
  if (state === "win") {
    if (winVideo) {
      try {
        if (winEnded) {
          // If video finished, only navigate when tapping the Restart button
          const rect = canvas.getBoundingClientRect();
          const scaleX = W / rect.width;
          const scaleY = H / rect.height;
          const px = (e.clientX - rect.left) * scaleX;
          const py = (e.clientY - rect.top) * scaleY;

          if (winBtnRect &&
              px >= winBtnRect.x && px <= winBtnRect.x + winBtnRect.w &&
              py >= winBtnRect.y && py <= winBtnRect.y + winBtnRect.h) {
            window.location.href = "../index.html";
          }
        } else {
          // Unmute + continue playback
          winVideo.muted = false;
          const p = winVideo.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch (_) {}
    }
    return;
  }

  pointerActive = true;
  moveStartTime = performance.now();
  shootOnRelease = true;
  updateTargetY(e);
});
canvas.addEventListener("pointermove", (e) => {
  e.preventDefault();
  if (pointerActive) {
    updateTargetY(e);
    if (performance.now() - moveStartTime > 100) shootOnRelease = false;
  }
});
window.addEventListener("pointerup", () => {
  if (pointerActive && state === "running" && shootOnRelease && performance.now() - moveStartTime < 200) {
    const now = performance.now();
    if (now - lastShot >= 200) {
      const { cx, cy } = rocket.center();
      const x = cx + rocket.w / 2;
      const vx = 1000;
      const timeToEdge = Math.max(0.001, (W - x) / vx);
      const spreadHalf = 72; // px half-spread at right edge
      const vyTop = -spreadHalf / timeToEdge;
      const vyBottom = spreadHalf / timeToEdge;

      lasers.push(new Laser(x, cy - 8, vyTop));
      lasers.push(new Laser(x, cy, 0));
      lasers.push(new Laser(x, cy + 8, vyBottom));

      lastShot = now;
      laserSound.currentTime = 0;
      laserSound.play().catch(() => {});
    }
  }
  pointerActive = false;
  shootOnRelease = false;
});

function updateTargetY(e) {
  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const scaleY = H / rect.height;
  targetY = y * scaleY;
}

// Auto-hide address bar on load/orientation change
function hideAddressBar() {
  if (window.innerHeight !== window.outerHeight) {
    window.scrollTo(0, 1);
    setTimeout(() => window.scrollTo(0, 0), 0);
  }
}
setTimeout(hideAddressBar, 100);
window.addEventListener('orientationchange', () => setTimeout(hideAddressBar, 100));

/* Boot: auto-start Level 3 and attempt music autoplay */
updateHud();
initStars();
startGame();

requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(loop);
});
