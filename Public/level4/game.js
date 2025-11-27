// Level 4 — Cucumber Battle (Stage 1)
const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = $("overlay");
const completeOverlay = $("completeOverlay");
const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const bgMusic = $("bgMusic");
const hitsEl = $("hitsEl");
const hpEl = $("hpEl");

const W = canvas.width;
const H = canvas.height;

const IMAGES = {
  rocket: new Image(),
  laser: new Image(),
  cucumber: new Image(),
  planet: new Image(),
};
IMAGES.rocket.src = "../img/Rocket1.png?v=20251024T201542";
IMAGES.laser.src = "../img/laser3.png";
IMAGES.cucumber.src = "../img/Cucumber2.png";
IMAGES.planet.src = "../img/plamet_zeeb.png";

// Audio
const laserSound = new Audio("../audio/pew.wav");
laserSound.volume = 0.35;
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

// State
let state = "ready"; // "ready" | "running" | "complete"
let phase = 1; // 1 = bounce-off, 2 = falling asteroids ricochet
let lastTs = 0;
let hits = 0;
let hp = 100;
let lastShot = 0;
let dropTimer = 0;

const keys = new Set();
let pointerActive = false;
let targetY = H / 2;
let shootOnRelease = false;
let moveStartTime = 0;

// Stars for background
const stars = Array.from({ length: 50 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  speed: 20 + Math.random() * 80,
  size: 0.6 + Math.random() * 1.6,
}));

class Rocket {
  constructor() {
    this.w = 105;
    this.h = 105;
    this.x = 70;
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
    this.speed = 340;
    this.angle = Math.PI / 2;
    this.tilt = 0;
  }
  reset() {
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
    this.tilt = 0;
  }
  update(dt) {
    let dir = 0;
    if (keys.has("ArrowUp") || keys.has("w")) dir -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) dir += 1;

    if (dir !== 0) {
      this.vy = dir * this.speed;
      this.y += this.vy * dt;
    } else if (pointerActive) {
      const centerY = this.y + this.h / 2;
      const diff = targetY - centerY;
      this.y += diff * Math.min(1, dt * 16);
      this.vy = diff;
    } else {
      this.vy *= 0.9;
      this.y += this.vy * dt;
    }

    if (this.y < 0) this.y = 0;
    if (this.y + this.h > H) this.y = H - this.h;
    this.tilt = Math.max(-0.3, Math.min(0.3, -this.vy / 900));
  }
  draw() {
    const ang = this.angle + (this.tilt || 0);
    if (IMAGES.rocket && IMAGES.rocket.complete) {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(ang);
      ctx.drawImage(IMAGES.rocket, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(ang);
      ctx.fillStyle = "#7cf";
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

class Laser {
  constructor(x, y, vy = 0) {
    this.x = x;
    this.y = y;
    this.vx = 1000;
    this.vy = vy;
    this.w = 42;
    this.h = 12;
    this.active = true;
    this.canDamage = true;
    this.bounced = false;
    this.life = 2.5; // seconds
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.vy *= 0.99;
    if (
      this.x > W + 200 ||
      this.x < -200 ||
      this.y < -200 ||
      this.y > H + 200 ||
      this.life <= 0
    ) {
      this.active = false;
    }
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (IMAGES.laser && IMAGES.laser.complete) {
      const flip = this.vx < 0;
      ctx.scale(flip ? -1 : 1, 1);
      ctx.drawImage(IMAGES.laser, flip ? -this.w : 0, -this.h / 2, this.w, this.h);
    } else {
      ctx.fillStyle = this.bounced ? "#9af7a2" : "#ffde9a";
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    }
    ctx.restore();
  }
  rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }
}

class CucumberTarget {
  constructor() {
    this.w = 160;
    this.h = 240;
    this.baseX = W * 0.76; // anchor to right side above planet
    this.baseY = H - 120;
    this.t = 0;
    this.x = this.baseX;
    this.y = this.baseY;
  }
  reset() {
    this.t = 0;
    this.x = this.baseX;
    this.y = this.baseY;
  }
  update(dt) {
    this.t += dt;
    const sway = Math.sin(this.t * 0.8) * 120;
    const bob = Math.sin(this.t * 2.2) * 6;
    this.x = this.baseX + sway;
    this.y = this.baseY + bob;
  }
  rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  draw() {
    const r = this.rect();
    if (IMAGES.cucumber && IMAGES.cucumber.complete) {
      ctx.drawImage(IMAGES.cucumber, r.x, r.y, this.w, this.h);
    } else {
      ctx.fillStyle = "#6cf582";
      ctx.fillRect(r.x, r.y, this.w, this.h);
    }
  }
}

const rocket = new Rocket();
const cucumber = new CucumberTarget();
const lasers = [];
const sparks = [];
const fallingAsteroids = [];

function drawBackground(dt) {
  ctx.fillStyle = "#030a05";
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    s.x -= s.speed * dt;
    if (s.x < -4) {
      s.x = W + Math.random() * 40;
      s.y = Math.random() * H * 0.9;
      s.speed = 20 + Math.random() * 80;
      s.size = 0.6 + Math.random() * 1.6;
    }
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.fillStyle = "#caffc6";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPlanet() {
  // Right-side planet with proportional size
  const w = Math.floor(W * 0.36);
  const h = Math.floor(w * 0.55);
  const x = W - w - 32;
  const y = H - h + 12;
  if (IMAGES.planet && IMAGES.planet.complete) {
    ctx.drawImage(IMAGES.planet, x, y, w, h);
  } else {
    ctx.fillStyle = "#275a34";
    ctx.beginPath();
    ctx.ellipse(W / 2, y + h * 0.8, w * 0.5, h * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shoot() {
  const now = performance.now();
  if (now - lastShot < 220) return;
  lastShot = now;
  const { cx, cy } = rocket.center();
  const vx = 1000;
  const timeToEdge = Math.max(0.001, (W - cx) / vx);
  const spreadHalf = 42;
  const vyTop = -spreadHalf / timeToEdge;
  const vyBottom = spreadHalf / timeToEdge;

  lasers.push(new Laser(cx + rocket.w / 2, cy - 6, vyTop));
  lasers.push(new Laser(cx + rocket.w / 2, cy + 6, vyBottom));

  laserSound.currentTime = 0;
  laserSound.play().catch(() => {});
}

function handleCollisions() {
  const rect = cucumber.rect();
  const bounceChance = phase === 2 ? 0.9 : 0.82;
  for (const l of lasers) {
    if (!l.active || !l.canDamage) continue;
    if (intersects(l.rect(), rect)) {
      l.canDamage = false;
      hits += 1;
      hitsEl.textContent = hits.toString();

      const bounced = Math.random() < bounceChance;
      const dmg = phase === 2
        ? (bounced ? randRange(0.05, 0.15) : randRange(0.2, 0.35))
        : (bounced ? randRange(0.05, 0.35) : randRange(0.5, 0.8));
      hp = Math.max(0, hp - dmg);
      hpEl.textContent = hp.toFixed(1);
      sparks.push({ x: l.x, y: l.y, t: 0 });

      if (bounced) {
        l.bounced = true;
        l.vx = -Math.abs(l.vx) * 0.55;
        l.vy = (Math.random() * 2 - 1) * 240;
        l.life = Math.min(l.life, 0.8);
        l.active = true;
      } else {
        l.active = false;
      }

      if (hp <= 0) {
        winStage();
        break;
      }
    }
  }
}

class FallingAsteroid {
  constructor() {
    this.r = randRange(28, 46);
    this.x = randRange(W * 0.36, W * 0.62);
    this.y = -this.r - 20;
    this.vx = 0;
    this.vy = randRange(220, 320);
    this.deflected = false;
    this.active = true;
  }
  rect() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }
  update(dt) {
    if (!this.active) return;
    if (!this.deflected) {
      this.vy += 60 * dt;
    } else {
      this.vx += 40 * dt; // slight acceleration forward
      this.vy *= 0.99;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y > H + 120 || this.x > W + 160) {
      this.active = false;
    }
  }
  draw() {
    if (!this.active) return;
    ctx.save();
    ctx.fillStyle = this.deflected ? "#ffe6a8" : "#9fb0b8";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function handleAsteroidInteractions() {
  for (const l of lasers) {
    if (!l.active) continue;
    for (const a of fallingAsteroids) {
      if (!a.active) continue;
      if (intersects(l.rect(), a.rect())) {
        // Deflect asteroid forward; laser is spent
        a.deflected = true;
        a.vx = 900;
        a.vy = randRange(-80, 80);
        l.active = false;
        sparks.push({ x: l.x, y: l.y, t: 0 });
      }
    }
  }

  const cucRect = cucumber.rect();
  for (const a of fallingAsteroids) {
    if (!a.active || !a.deflected) continue;
    if (intersects(a.rect(), cucRect)) {
      const dmg = randRange(6, 10);
      hp = Math.max(0, hp - dmg);
      hpEl.textContent = hp.toFixed(1);
      a.active = false;
      sparks.push({ x: cucRect.x + cucRect.w / 2, y: cucRect.y + cucRect.h / 2, t: 0 });
      if (hp <= 0) {
        winStage();
        break;
      }
    }
  }

  // Cull inactive
  for (let i = fallingAsteroids.length - 1; i >= 0; i--) {
    if (!fallingAsteroids[i].active) fallingAsteroids.splice(i, 1);
  }
}

function update(dt) {
  rocket.update(dt);
  cucumber.update(dt);
  if (phase === 2) {
    dropTimer -= dt;
    if (dropTimer <= 0) {
      fallingAsteroids.push(new FallingAsteroid());
      dropTimer = randRange(0.8, 1.6);
    }
  }
  for (const l of lasers) l.update(dt);
  handleCollisions();
  handleAsteroidInteractions();

  if (phase === 1 && hp <= 20) {
    phase = 2;
    dropTimer = 0.2;
  }
  // Remove inactive lasers
  for (let i = lasers.length - 1; i >= 0; i--) {
    if (!lasers[i].active) lasers.splice(i, 1);
  }

  // Sparks
  for (const s of sparks) s.t += dt;
  for (let i = sparks.length - 1; i >= 0; i--) {
    if (sparks[i].t > 0.4) sparks.splice(i, 1);
  }
}

function draw(dt) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(dt || 0);
  drawPlanet();

  cucumber.draw();
  for (const a of fallingAsteroids) a.draw();
  for (const l of lasers) l.draw();

  // Sparks
  for (const s of sparks) {
    const alpha = Math.max(0, 1 - s.t / 0.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#9affb4";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 18 * (1 - alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  rocket.draw();

  // Ground shadow
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(W * 0.76, H - 38, 150, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (state === "running") update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

function resetStage() {
  hits = 0;
  hp = 100;
  phase = 1;
  dropTimer = 0;
  lasers.length = 0;
  sparks.length = 0;
  fallingAsteroids.length = 0;
  hpEl.textContent = hp.toFixed(1);
  hitsEl.textContent = hits.toString();
  rocket.reset();
  cucumber.reset();
  state = "ready";
}

function startStage() {
  unlockMusic();
  hide(overlay);
  hide(completeOverlay);
  resetStage();
  state = "running";
  lastTs = performance.now();
}

function winStage() {
  state = "complete";
  show(completeOverlay);
}

// Events
startBtn.addEventListener("click", () => {
  startStage();
});

restartBtn.addEventListener("click", () => {
  startStage();
});

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  unlockMusic();

  if (state === "running" && e.key === " ") {
    shoot();
    return;
  }
  if (state === "running") {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.add("ArrowUp") || keys.add("w");
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.add("ArrowDown") || keys.add("s");
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    keys.delete("ArrowUp"); keys.delete("w");
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    keys.delete("ArrowDown"); keys.delete("s");
  }
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockMusic();
  if (state !== "running") return;
  pointerActive = true;
  moveStartTime = performance.now();
  shootOnRelease = true;
  updateTargetY(e);
});

canvas.addEventListener("pointermove", (e) => {
  e.preventDefault();
  if (!pointerActive) return;
  updateTargetY(e);
  if (performance.now() - moveStartTime > 100) shootOnRelease = false;
});

window.addEventListener("pointerup", (e) => {
  if (pointerActive && state === "running" && shootOnRelease && performance.now() - moveStartTime < 200) {
    shoot();
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

// Helpers
function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

requestAnimationFrame(loop);

// Autostart Stage 1 when navigated with ?autostart=1 (e.g., skipping intro)
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("autostart") === "1") {
    setTimeout(() => {
      try { startStage(); } catch (_) {}
    }, 50);
  }
} catch (_) {}
