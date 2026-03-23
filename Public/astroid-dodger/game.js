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

const laserSound = new Audio("audio/pew.wav");
laserSound.volume = 0.3;

const W = canvas.width;
const H = canvas.height;

const IMAGES = {
  rocket: new Image(),
  asteroids: [new Image(), new Image(), new Image()],
  crash: new Image(),
  coin: new Image(),
  laser: new Image(),
  planet: new Image(),
};

IMAGES.rocket.src = "img/Rocket1.png?v=20251024T201542";
IMAGES.asteroids[0].src = "img/astroid1.png";
IMAGES.asteroids[1].src = "img/astroid2.png";
IMAGES.asteroids[2].src = "img/astroid3.png";
IMAGES.crash.src = "img/crash.png";
IMAGES.coin.src = "img/coin.png";
IMAGES.laser.src = "img/laser.png";
IMAGES.planet.src = "img/plamet_zeeb.png";

let state = "ready";
let lastTs = 0;
let score = 0;
let coins = 0;
let best = parseInt(localStorage.getItem("zeeb_best") || "0", 10);
bestEl.textContent = best.toString();
coinsEl.textContent = coins.toString();

const INTRO_DURATION = 4.0;
let introTimer = 0;
let introShown = false; // Only show intro once per page load

const keys = new Set();

let pointerActive = false;
let targetY = H / 2;

class Rocket {
  constructor() {
    this.w = 105;
    this.h = 105;
    this.x = 80;
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
    this.speed = 320;
    this.sprite = IMAGES.rocket;
    this.r = Math.max(this.w, this.h) * 0.4;

    this.angle = Math.PI / 2;
    this.tilt = 0;
  }

  reset() {
    this.x = 80;
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
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
      this.vy = diff; // track velocity for tilt
    } else {
      this.vy *= 0.9;
      this.y += this.vy * dt;
    }

    if (this.y < 0) this.y = 0;
    if (this.y + this.h > H) this.y = H - this.h;

    this.tilt = Math.max(-0.3, Math.min(0.3, -this.vy / 900));
  }

  draw(introScale = 1, introX = null, introY = null) {
    const ang = this.angle + (this.tilt || 0);
    const baseX = introX !== null ? introX : this.x;
    const baseY = introY !== null ? introY : this.y;
    const drawW = this.w * introScale;
    const drawH = this.h * introScale;
    
    if (this.sprite && this.sprite.complete) {
      ctx.save();
      ctx.translate(baseX + drawW / 2, baseY + drawH / 2);
      ctx.rotate(ang);
      ctx.drawImage(this.sprite, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(baseX + drawW / 2, baseY + drawH / 2);
      ctx.rotate(ang);
      ctx.fillStyle = "#6cf";
      ctx.beginPath();
      ctx.moveTo(-drawW * 0.4, -drawH * 0.4);
      ctx.lineTo(drawW * 0.5, 0);
      ctx.lineTo(-drawW * 0.4, drawH * 0.4);
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

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

const rocket = new Rocket();
let asteroids = [];
let coins_arr = [];
let lasers = [];
let explosions = [];
let spawnTimer = 0;
let coinSpawnTimer = 0;
let crashAnim = { active: false, t: 0, duration: 900, x: 0, y: 0 };
// Stars for background - using shared module
const starfield = createStarfield(ctx, W, H, STAR_PRESETS.level1);
let lastShot = 0; // for rate limiting shots

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
  starfield.reset();
  updateHud();
}

function startGame() {
  resetGame();
  hide(overlay);
  hide(gameOverEl);
  // Start with intro sequence only on first play
  if (!introShown) {
    state = "intro";
    introTimer = 0;
    introShown = true;
  } else {
    state = "running";
  }
  lastTs = performance.now();
  // Start background music (ensure unmuted)
  try {
    bgMusic.muted = false;
    bgMusic.volume = 0.6;
    const p = bgMusic.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) {
    // console.error("Audio play failed in startGame:", e);
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
      // console.error("Audio play failed in togglePause:", e);
    }
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
    if (explosions[i].t >= explosions[i].duration) {
      explosions.splice(i, 1);
    }
  }
  
  asteroids = asteroids.filter((a) => !a.offscreen());
  coins_arr = coins_arr.filter((c) => !c.offscreen());
  lasers = lasers.filter((l) => !l.offscreen());

  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnIntervalMs()) {
    spawnTimer = 0;

    const burst = Math.random() < 0.12 ? 2 : 1;
    for (let i = 0; i < burst; i++) {
      const newAst = new Asteroid();
      // Slight vertical offset if double spawn
      if (burst === 2) newAst.y = Math.max(30, Math.min(H - 30, newAst.y + (i === 0 ? -28 : 28)));
      asteroids.push(newAst);
    }
  }

  coinSpawnTimer += dt * 1000;
  if (coinSpawnTimer >= 2000) { // spawn a coin every 2 seconds
    coinSpawnTimer = 0;
    coins_arr.push(new Coin());
  }

  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const asteroid = asteroids[j];
      if (laser.hits(asteroid)) {
        explosions.push({ x: asteroid.x, y: asteroid.y, t: 0, duration: 400 });
        
        const newCoin = new Coin();
        newCoin.x = asteroid.x;
        newCoin.y = asteroid.y;
        coins_arr.push(newCoin);
        
        asteroids.splice(j, 1);
        lasers.splice(i, 1);
        score += Math.floor(asteroid.size);
        updateHud();
        break;
      }
    }
  }

  const { cx, cy } = rocket.center();
  
  for (const a of asteroids) {
    if (dist(cx, cy, a.x, a.y) <= rocket.r + a.r) {
      triggerCrash(cx, cy);
      return;
    }
  }

  for (let i = coins_arr.length - 1; i >= 0; i--) {
    const c = coins_arr[i];
    if (dist(cx, cy, c.x, c.y) <= rocket.r + c.r) {
      coins++;
      coins_arr.splice(i, 1);
      updateHud();

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

  score += dt * 10;
  if (score > best) {
    best = Math.floor(score);
  }
  updateHud();
}

function drawBackground(dt) {
  // Draw moving stars using shared module
  starfield.draw(dt || 0.016);
  
  const t = performance.now() / 1000;
  drawDistantPlanet(t);
}

function drawDistantPlanet(t) {
   const planetSize = 70;
   const planetX = W - 80;
   const planetY = 60;
   
   const floatX = Math.sin(t * 0.3) * 2;
   const floatY = Math.cos(t * 0.25) * 1.5;
   
   const pulsePhase = Math.sin(t * 1.2) * 0.5 + 0.5;
  const glowIntensity = 10 + pulsePhase * 14;
  const glowAlpha = 0.25 + pulsePhase * 0.15;
  
  ctx.save();
  
  ctx.globalAlpha = glowAlpha;
  const gradient = ctx.createRadialGradient(
    planetX + floatX, planetY + floatY, planetSize * 0.3,
    planetX + floatX, planetY + floatY, planetSize * 0.5 + glowIntensity
  );
  gradient.addColorStop(0, 'rgba(160, 100, 220, 0.6)');
  gradient.addColorStop(0.5, 'rgba(120, 70, 180, 0.3)');
  gradient.addColorStop(1, 'rgba(80, 50, 140, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(planetX + floatX, planetY + floatY, planetSize * 0.5 + glowIntensity, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.globalAlpha = 0.6 + pulsePhase * 0.1;
  
  if (IMAGES.planet && IMAGES.planet.complete) {
    ctx.drawImage(
      IMAGES.planet, 
      planetX + floatX - planetSize / 2, 
      planetY + floatY - planetSize / 2, 
      planetSize, 
      planetSize
    );
  } else {
    ctx.fillStyle = "#3a7d44";
    ctx.beginPath();
    ctx.arc(planetX + floatX, planetY + floatY, planetSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

function drawIntro() {
   ctx.clearRect(0, 0, W, H);
   drawBackground();
   
   const progress = Math.min(1, introTimer / INTRO_DURATION);
   
   const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
   
  const startScale = 4.0; // 4x normal size
  const endScale = 1.0;
  const startX = W / 2 - (rocket.w * startScale) / 2;
  const startY = H / 2 - (rocket.h * startScale) / 2;
  const endX = rocket.x;
  const endY = H / 2 - rocket.h / 2;
  
  let currentScale, currentX, currentY;
  
  if (progress < 0.5) {
    // Phase 1: Stay large and centered with slight pulse
    const pulsePhase = progress / 0.5;
    const pulse = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.03;
    currentScale = startScale * pulse;
    currentX = W / 2 - (rocket.w * currentScale) / 2;
    currentY = H / 2 - (rocket.h * currentScale) / 2;
  } else {
    // Phase 2: Shrink and move to battle position
    const shrinkProgress = (progress - 0.5) / 0.5;
    const eased = easeOutCubic(shrinkProgress);
    currentScale = startScale + (endScale - startScale) * eased;
    currentX = startX + (endX - startX) * eased;
    currentY = startY + (endY - startY) * eased;
  }
  
  rocket.draw(currentScale, currentX, currentY);
  
  let titleAlpha = 0;
  if (progress < 0.1) {
    // Fade in
    titleAlpha = progress / 0.1;
  } else if (progress < 0.6) {
    // Fully visible
    titleAlpha = 1;
  } else {
    // Fade out
    titleAlpha = 1 - (progress - 0.6) / 0.4;
  }
  
  if (titleAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = titleAlpha;
    
    ctx.shadowColor = "#00aaff";
    ctx.shadowBlur = 30;
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px 'Audiowide', 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ZEEB'S ASTROID DODGER", W / 2, H / 2 - 160);
    
    ctx.shadowBlur = 15;
    ctx.font = "26px 'Audiowide', 'Orbitron', sans-serif";
    ctx.fillStyle = "#88ccff";
    ctx.fillText("Level 1", W / 2, H / 2 - 100);
    
    ctx.restore();
  }
  
  if (progress > 0.8) {
    const readyAlpha = (progress - 0.8) / 0.2;
    ctx.save();
    ctx.globalAlpha = readyAlpha;
    ctx.fillStyle = "#ffff00";
    ctx.font = "bold 30px 'Audiowide', 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 20;
    ctx.fillText("GET READY!", W / 2, H - 80);
    ctx.restore();
  }
}

function draw() {
   if (state === "intro") {
    drawIntro();
    return;
  }
  
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  rocket.draw();
  for (const a of asteroids) a.draw();
  for (const c of coins_arr) c.draw();
  for (const l of lasers) l.draw();

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

  if (state === "crashing" && IMAGES.crash && IMAGES.crash.complete && crashAnim.active) {
    const p = Math.min(1, crashAnim.t / crashAnim.duration);
    const size = 120 + 140 * p;
    ctx.save();
    ctx.translate(crashAnim.x, crashAnim.y);
    ctx.drawImage(IMAGES.crash, -size / 2, -size / 2, size, size);
    ctx.restore();

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

function updateIntro(dt) {
   introTimer += dt;
   
   if (introTimer >= INTRO_DURATION) {
    state = "running";
    introTimer = 0;
  }
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0); // cap large dt spikes
  lastTs = ts;

  if (state === "intro") {
    updateIntro(dt);
  }
  if (state === "running" || state === "crashing") {
    update(dt);
  }
  // Let the player fly around and shoot on the start screen
  if (state === "ready" || state === "over") {
    rocket.update(dt);
    for (const l of lasers) l.update(dt);
    lasers = lasers.filter((l) => !l.offscreen());
  }
  draw();

  requestAnimationFrame(loop);
}

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

const howToPlayBtn = $("howToPlayBtn");
const howToPlayOverlay = $("howToPlayOverlay");
const closeHowToPlay = $("closeHowToPlay");

startBtn.addEventListener("click", () => {
  if (state === "ready" || state === "over") startGame();
});
restartBtn.addEventListener("click", () => {
  if (state === "over") startGame();
  });

  if (howToPlayBtn && howToPlayOverlay && closeHowToPlay) {
  howToPlayBtn.addEventListener("click", () => {
    howToPlayOverlay.classList.remove("hidden");
  });
  
  closeHowToPlay.addEventListener("click", () => {
    howToPlayOverlay.classList.add("hidden");
  });
  
  howToPlayOverlay.addEventListener("click", (e) => {
    if (e.target === howToPlayOverlay) {
      howToPlayOverlay.classList.add("hidden");
    }
  });
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !howToPlayOverlay.classList.contains("hidden")) {
      howToPlayOverlay.classList.add("hidden");
    }
  });
}

window.addEventListener("keydown", (e) => {
   if (["ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();

  if (e.key === "p" || e.key === "P") {
    togglePause();
    return;
  }
  if ((e.key === " " || e.key === "Enter") && (state === "ready" || state === "over")) {
    startGame();
    return;
  }

  if (e.key === " " && (state === "running" || state === "ready" || state === "over")) {
    const now = performance.now();
    if (now - lastShot >= 250) { // rate limit: max 4 shots per second
      const { cx, cy } = rocket.center();
      lasers.push(new Laser(cx + rocket.w / 2, cy - 4));
      lastShot = now;
      // Play laser sound
      laserSound.currentTime = 0;
      laserSound.play().catch(() => {});
    }
    if (state === "running") return;
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

let shootOnRelease = false;
let moveStartTime = 0;

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  pointerActive = true;
  moveStartTime = performance.now();
  shootOnRelease = true;
  updateTargetY(e);
  
  if ((state === "running" || state === "ready" || state === "over") && performance.now() - moveStartTime < 50) {
    const now = performance.now();
    if (now - lastShot >= 250) {
      const { cx, cy } = rocket.center();
      lasers.push(new Laser(cx + rocket.w / 2, cy - 4));
      lastShot = now;
      // Play laser sound
      laserSound.currentTime = 0;
      laserSound.play().catch(() => {});
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  e.preventDefault();
  if (pointerActive) {
    updateTargetY(e);
    if (performance.now() - moveStartTime > 100) {
      shootOnRelease = false;
    }
  }
});

window.addEventListener("pointerup", (e) => {
if (pointerActive && (state === "running" || state === "ready" || state === "over") && shootOnRelease && performance.now() - moveStartTime < 200) {
  const now = performance.now();
    if (now - lastShot >= 250) {
      const { cx, cy } = rocket.center();
      lasers.push(new Laser(cx + rocket.w / 2, cy - 4));
      lastShot = now;
      // Play laser sound
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

function hideAddressBar() {
  if (window.innerHeight !== window.outerHeight) {
    // Scroll slightly to trigger address bar hiding
    window.scrollTo(0, 1);
    setTimeout(() => window.scrollTo(0, 0), 0);
  }
}

show(overlay);
hide(gameOverEl);
updateHud();

setTimeout(hideAddressBar, 100);
window.addEventListener('orientationchange', () => setTimeout(hideAddressBar, 100));
 
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(loop);
});