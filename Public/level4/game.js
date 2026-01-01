// Level 4 — Cucumber Battle (Stage 1)
const $ = (id) => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = $("overlay");
const completeOverlay = $("completeOverlay");
const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const bgMusic = $("bgMusic");
const hpEl = $("hpEl");
const zeebHpEl = $("zeebHpEl");
const zeebHpBar = $("zeebHpBar");
const cucumberHpBar = $("cucumberHpBar");
const winOverlay = $("winOverlay");
const finaleVideo = $("finaleVideo");
let finaleVideoPlaying = false;
let finaleVideoEnded = false;

const W = canvas.width;
const H = canvas.height;

const IMAGES = {
  rocket: new Image(),
  laser: new Image(),
  cucumber: new Image(),
  planet: new Image(),
  asteroid1: new Image(),
  asteroid2: new Image(),
  asteroid3: new Image(),
};
IMAGES.rocket.src = "../img/Rocket1.png?v=20251024T201542";
IMAGES.laser.src = "../img/laser3.png";
IMAGES.cucumber.src = "../img/Cucumber.png?v=20251130T1340";
IMAGES.planet.src = "../img/plamet_zeeb.png";
IMAGES.asteroid1.src = "../img/astroid1.png";
IMAGES.asteroid2.src = "../img/astroid2.png";
IMAGES.asteroid3.src = "../img/astroid3.png";

// Array of asteroid images for random selection
const ASTEROID_IMAGES = [IMAGES.asteroid1, IMAGES.asteroid2, IMAGES.asteroid3];

// Audio
const laserSound = new Audio("../audio/pew.wav");
laserSound.volume = 0.35;
let musicPlaying = false;

function unlockMusic() {
  if (musicPlaying) return;
  // Same approach as Level 3: try unmuted first, fallback to muted then unmute
  try {
    bgMusic.muted = false;
    bgMusic.volume = 0.6;
    const p = bgMusic.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Fallback: start muted to satisfy autoplay, then try to unmute periodically
        try {
          bgMusic.muted = true;
          const p2 = bgMusic.play();
          if (p2 && typeof p2.catch === "function") p2.catch(() => {});
          // Try to unmute every second
          let attempts = 0;
          const maxAttempts = 20;
          const unmuteTimer = setInterval(() => {
            attempts++;
            if (document.hidden) return;
            try {
              bgMusic.muted = false;
              bgMusic.volume = 0.6;
              const p3 = bgMusic.play();
              if (!bgMusic.muted && !bgMusic.paused) {
                musicPlaying = true;
                clearInterval(unmuteTimer);
              }
              if (p3 && typeof p3.catch === "function") p3.catch(() => {});
            } catch (_) {}
            if (attempts >= maxAttempts) clearInterval(unmuteTimer);
          }, 1000);
        } catch (_) {}
      });
    } else {
      musicPlaying = true;
    }
  } catch (_) {}
}

// Also unlock on any interaction
document.addEventListener("click", unlockMusic, { once: false });
document.addEventListener("touchstart", unlockMusic, { once: false });
document.addEventListener("keydown", unlockMusic, { once: false });

 // State
let state = "ready"; // "ready" | "intro" | "running" | "complete" | "gameover"
let lastTs = 0;

 // Intro sequence state
const INTRO_DURATION = 5.0; // 5 seconds
let introTimer = 0;
let introShown = false; // Only show intro once per page load
let hp = 250; // Cucumber HP (increased so battle lasts through the music drop)
let zeebHp = 150; // Player HP (increased for boss battle survivability)
const MAX_CUCUMBER_HP = 250;
const MAX_ZEEB_HP = 150;
let lastShot = 0;
let dropTimer = 0;

const keys = new Set();
let pointerActive = false;
let targetY = H / 2;
let shootOnRelease = false;
let moveStartTime = 0;

// Power-up event at 56 seconds
let powerUpTriggered = false;
let powerUpEffectTimer = 0;
const POWER_UP_TIME = 56; // seconds into the music

// Stars for background - using shared module
const starfield = createStarfield(ctx, W, H, STAR_PRESETS.level4);

// Screen shake effect
const screenShake = {
  intensity: 0,
  duration: 0,
  offsetX: 0,
  offsetY: 0,
  
  trigger(damage) {
    this.intensity = Math.min(20, damage * 1.5);
    this.duration = 0.4;
  },
  
  update(dt) {
    if (this.duration > 0) {
      this.duration -= dt;
      const progress = this.duration / 0.4;
      const shake = this.intensity * progress;
      this.offsetX = (Math.random() - 0.5) * shake * 2;
      this.offsetY = (Math.random() - 0.5) * shake * 2;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  },
  
  reset() {
    this.intensity = 0;
    this.duration = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
};

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
    // Damage visual feedback
    this.hitTimer = 0;
    this.flashAlpha = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }
  reset() {
    this.y = H / 2 - this.h / 2;
    this.vy = 0;
    this.tilt = 0;
    this.hitTimer = 0;
    this.flashAlpha = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }
  onHit(damage) {
    this.hitTimer = 0.6;
    this.flashAlpha = 0.9;
    // Trigger screen shake
    screenShake.trigger(damage);
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
    
    // Update hit visual effects
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      this.flashAlpha *= 0.88;
      // Shake effect
      const shakeStrength = (this.hitTimer / 0.6) * 8;
      this.shakeX = (Math.random() - 0.5) * shakeStrength * 2;
      this.shakeY = (Math.random() - 0.5) * shakeStrength;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.flashAlpha = 0;
    }
  }
  draw(introScale = 1, introX = null, introY = null) {
    const ang = this.angle + (this.tilt || 0);
    // Use intro position if provided, otherwise normal position
    const baseX = introX !== null ? introX : this.x;
    const baseY = introY !== null ? introY : this.y;
    const drawX = baseX + this.shakeX;
    const drawY = baseY + this.shakeY;
    const drawW = this.w * introScale;
    const drawH = this.h * introScale;
    
    if (IMAGES.rocket && IMAGES.rocket.complete) {
      ctx.save();
      ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
      ctx.rotate(ang);
      ctx.drawImage(IMAGES.rocket, -drawW / 2, -drawH / 2, drawW, drawH);
      
      // Red flash overlay when hit
      if (this.flashAlpha > 0.05) {
        ctx.globalAlpha = this.flashAlpha;
        ctx.fillStyle = "#ff3333";
        ctx.beginPath();
        ctx.arc(0, 0, drawW * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
      ctx.rotate(ang);
      ctx.fillStyle = this.flashAlpha > 0.1 ? "#ff6666" : "#7cf";
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
    // Keep original aspect ratio of the image; no stretching
    this.h = 140;      // slightly smaller cucumber
    this.w = 93;       // fallback width until image loads (will be recomputed)
    // Position will be set relative to planet in updatePositionFromPlanet()
    this.baseX = W * 0.76;
    this.baseY = H - 100;
    this.t = 0;
    this.x = this.baseX;
    this.y = this.baseY;
    
    // Hit reaction state
    this.hitTimer = 0;
    this.hitIntensity = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.scaleBoost = 0;
    this.recoilX = 0;
    this.flashAlpha = 0;
    this.wobbleAngle = 0;
    this.painExpressionTimer = 0;
    
    // Dodge state
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeDirection = 0; // -1 left, 1 right
    this.dodgeOffset = 0;
    this.lookingUp = false;
    this.panicTimer = 0;

    // After the image loads, recompute width based on natural aspect ratio
    const updateAspect = () => {
      const iw = IMAGES.cucumber.naturalWidth || IMAGES.cucumber.width || this.w;
      const ih = IMAGES.cucumber.naturalHeight || IMAGES.cucumber.height || this.h;
      if (iw && ih) {
        this.w = Math.round(this.h * (iw / ih));
      }
    };
    if (IMAGES.cucumber && IMAGES.cucumber.complete) {
      updateAspect();
    } else if (IMAGES.cucumber) {
      IMAGES.cucumber.addEventListener("load", updateAspect, { once: true });
    }
  }
  reset() {
    this.t = 0;
    this.x = this.baseX;
    this.y = this.baseY;
    this.hitTimer = 0;
    this.hitIntensity = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.scaleBoost = 0;
    this.recoilX = 0;
    this.flashAlpha = 0;
    this.wobbleAngle = 0;
    this.painExpressionTimer = 0;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeDirection = 0;
    this.dodgeOffset = 0;
    this.lookingUp = false;
    this.panicTimer = 0;
  }
  
  // Called when asteroid hits
  onHit(damage) {
    this.hitTimer = 0.5; // Duration of hit reaction
    this.hitIntensity = Math.min(1, damage / 10); // Scale based on damage
    this.scaleBoost = 0.15 + this.hitIntensity * 0.1; // Squash effect
    this.recoilX = -30 - this.hitIntensity * 20; // Knockback
    this.flashAlpha = 0.8;
    this.painExpressionTimer = 0.8;
  }
  
  // Check for incoming overhead asteroids and dodge
  checkForOverheadAsteroids(asteroids) {
    if (this.isDodging || this.hitTimer > 0) return;
    
    for (const a of asteroids) {
      if (!a.active || !a.isOverhead) continue;
      
      // Check if asteroid is above cucumber and close enough to react
      const myX = this.baseX + Math.sin(this.t * 0.8) * 120; // Current sway position
      const distX = Math.abs(a.x - myX);
      const distY = a.y - (this.baseY - this.h);
      
      // If asteroid is overhead and getting close
      if (distX < 80 && distY > -200 && distY < -50) {
        this.lookingUp = true;
        this.panicTimer = 0.8;
      }
      
      // Dodge when asteroid is very close!
      if (distX < 60 && distY > -80 && distY < 0) {
        this.startDodge(a.x > myX ? -1 : 1);
        break;
      }
    }
  }
  
  startDodge(direction) {
    this.isDodging = true;
    this.dodgeTimer = 0.5;
    this.dodgeDirection = direction;
    this.lookingUp = false; // Stop looking up, focus on dodging
  }
  
  // Update cucumber position to stand on the planet
  updatePositionFromPlanet(planetObj) {
    // Position cucumber on top center of the planet
    const planetCenterX = planetObj.baseX + planetObj.w / 2 + planetObj.offsetX;
    const planetTopY = planetObj.baseY + planetObj.offsetY + 20; // Slightly into the planet surface
    this.baseX = planetCenterX;
    this.baseY = planetTopY;
  }
  
  update(dt, planetObj) {
    // Update position to follow planet
    if (planetObj) {
      this.updatePositionFromPlanet(planetObj);
    }
    
    this.t += dt;
    const sway = Math.sin(this.t * 0.8) * 60; // Reduced sway since on planet
    const bob = Math.sin(this.t * 2.2) * 4; // Reduced bob
    
    // Update dodge
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer > 0) {
        // Quick sidestep with easing
        const dodgeProgress = 1 - (this.dodgeTimer / 0.5);
        const eased = Math.sin(dodgeProgress * Math.PI); // Smooth in-out
        this.dodgeOffset = this.dodgeDirection * eased * 80;
      } else {
        this.isDodging = false;
        this.dodgeOffset = 0;
      }
    }
    
    // Panic timer decay
    if (this.panicTimer > 0) {
      this.panicTimer -= dt;
      if (this.panicTimer <= 0) {
        this.lookingUp = false;
      }
    }
    
    // Apply hit reaction effects
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      const progress = 1 - (this.hitTimer / 0.5);
      
      // Shake effect - rapid random displacement
      const shakeStrength = (1 - progress) * 12 * this.hitIntensity;
      this.shakeX = (Math.random() - 0.5) * shakeStrength * 2;
      this.shakeY = (Math.random() - 0.5) * shakeStrength;
      
      // Scale bounce back (squash then stretch)
      this.scaleBoost *= 0.85;
      
      // Recoil recovery
      this.recoilX *= 0.88;
      
      // Flash fade
      this.flashAlpha *= 0.9;
      
      // Wobble angle
      this.wobbleAngle = Math.sin(this.t * 25) * (1 - progress) * 0.15;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.scaleBoost = 0;
      this.recoilX = 0;
      this.flashAlpha = 0;
      this.wobbleAngle = 0;
    }
    
    // Pain expression decay
    if (this.painExpressionTimer > 0) {
      this.painExpressionTimer -= dt;
    }
    
    this.x = this.baseX + sway + this.shakeX + this.recoilX + this.dodgeOffset;
    this.y = this.baseY + bob + this.shakeY;
  }
  rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  draw() {
    const r = this.rect();
    
    ctx.save();
    
    // Apply wobble rotation around base
    ctx.translate(this.x, this.y);
    ctx.rotate(this.wobbleAngle);
    ctx.translate(-this.x, -this.y);
    
    // Apply squash/stretch scale
    const scaleX = 1 + this.scaleBoost * 0.5;
    const scaleY = 1 - this.scaleBoost * 0.3;
    ctx.translate(r.x + this.w / 2, r.y + this.h);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-(r.x + this.w / 2), -(r.y + this.h));
    
    if (IMAGES.cucumber && IMAGES.cucumber.complete) {
      // Draw with maintained aspect ratio (w computed from image AR)
      ctx.drawImage(IMAGES.cucumber, r.x, r.y, this.w, this.h);
      
      // Flash overlay when hit
      if (this.flashAlpha > 0.05) {
        ctx.globalAlpha = this.flashAlpha;
        ctx.fillStyle = "#ff6666";
        ctx.fillRect(r.x, r.y, this.w, this.h);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = "#6cf582";
      ctx.fillRect(r.x, r.y, this.w, this.h);
    }
    
    // Draw pain stars/swirls when recently hit
    if (this.painExpressionTimer > 0) {
      const painAlpha = Math.min(1, this.painExpressionTimer * 2);
      ctx.globalAlpha = painAlpha;
      
      // Draw spinning stars above head
      const starY = r.y - 20;
      const starX = r.x + this.w / 2;
      const starCount = 3;
      const starRadius = 30;
      
      for (let i = 0; i < starCount; i++) {
        const angle = (this.t * 4) + (i * Math.PI * 2 / starCount);
        const sx = starX + Math.cos(angle) * starRadius;
        const sy = starY + Math.sin(angle) * 8;
        
        // Draw star
        ctx.fillStyle = "#ffff77";
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const a = (j * Math.PI * 2 / 5) - Math.PI / 2 + this.t * 3;
          const outerR = 6;
          const innerR = 3;
          const ox = sx + Math.cos(a) * outerR;
          const oy = sy + Math.sin(a) * outerR;
          const ix = sx + Math.cos(a + Math.PI / 5) * innerR;
          const iy = sy + Math.sin(a + Math.PI / 5) * innerR;
          if (j === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    
    // Draw "looking up" expression (exclamation mark) when noticing overhead asteroid
    if (this.lookingUp && this.panicTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.panicTimer * 3);
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("!", r.x + this.w / 2, r.y - 30);
      ctx.globalAlpha = 1;
    }
    
    ctx.restore();
  }
}

const rocket = new Rocket();
const cucumber = new CucumberTarget();
const lasers = [];
const sparks = [];
const fallingAsteroids = [];

function drawBackground(dt, speedMultiplier = 1) {
  starfield.draw(dt, speedMultiplier);
}

// Planet state for floating animation and reactions
const planet = {
  baseX: 0,
  baseY: 0,
  w: 0,
  h: 0,
  t: 0,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  shakeX: 0,
  shakeY: 0,
  shakeTimer: 0,
  pulseScale: 1,
  
  init() {
    // Calculate size maintaining aspect ratio from actual image (smaller planet)
    const targetWidth = Math.floor(W * 0.20);
    if (IMAGES.planet && IMAGES.planet.complete) {
      const iw = IMAGES.planet.naturalWidth || IMAGES.planet.width;
      const ih = IMAGES.planet.naturalHeight || IMAGES.planet.height;
      if (iw && ih) {
        this.w = targetWidth;
        this.h = Math.floor(targetWidth * (ih / iw));
      } else {
        this.w = targetWidth;
        this.h = targetWidth; // Square fallback
      }
    } else {
      this.w = targetWidth;
      this.h = targetWidth;
    }
    // Position planet in lower right, fully visible
    this.baseX = W - this.w - 40;
    this.baseY = H - this.h - 15; // Fully in-frame with small margin
  },
  
  reset() {
    this.t = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.rotation = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;
    this.pulseScale = 1;
  },
  
  // Called when an asteroid spawns or passes nearby (minimal effect now)
  onAsteroidNear(intensity = 0.5) {
    // Very subtle pulse only, no shake
    this.pulseScale = 1 + intensity * 0.01;
  },
  
  update(dt) {
    this.t += dt;
    
    // Gentle floating motion - slow drifting in space
    // Multiple sine waves at different frequencies for organic movement
    this.offsetX = Math.sin(this.t * 0.15) * 8 + Math.sin(this.t * 0.08) * 4;
    this.offsetY = Math.cos(this.t * 0.12) * 6 + Math.sin(this.t * 0.06) * 3;
    
    // Very slow rotation - barely perceptible
    this.rotation = Math.sin(this.t * 0.08) * 0.015;
    
    // No shake effect - removed vibration
    this.shakeX = 0;
    this.shakeY = 0;
    
    // Pulse scale recovery (very slow)
    this.pulseScale += (1 - this.pulseScale) * 1.5 * dt;
  },
  
  draw() {
    const x = this.baseX + this.offsetX + this.shakeX;
    const y = this.baseY + this.offsetY + this.shakeY;
    
    ctx.save();
    
    // Apply rotation around center
    ctx.translate(x + this.w / 2, y + this.h / 2);
    ctx.rotate(this.rotation);
    ctx.scale(this.pulseScale, this.pulseScale);
    ctx.translate(-(x + this.w / 2), -(y + this.h / 2));
    
    if (IMAGES.planet && IMAGES.planet.complete) {
      // Draw with correct aspect ratio
      ctx.drawImage(IMAGES.planet, x, y, this.w, this.h);
    } else {
      // Fallback
      ctx.fillStyle = "#275a34";
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, y + this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
};

// Initialize planet when image loads
if (IMAGES.planet.complete) {
  planet.init();
} else {
  IMAGES.planet.addEventListener("load", () => planet.init(), { once: true });
}

function drawPlanet() {
  planet.draw();
}

function shoot() {
  const now = performance.now();
  if (now - lastShot < 220) return;
  lastShot = now;
  const { cx, cy } = rocket.center();

  // Single laser shot for boss level
  lasers.push(new Laser(cx + rocket.w / 2, cy, 0));

  laserSound.currentTime = 0;
  laserSound.play().catch(() => {});
}

function handleCollisions() {
  const rect = cucumber.rect();
  const bounceChance = 0.9;
  
  // Player rocket hitbox (tighter than visual)
  const rocketHitbox = {
    x: rocket.x + 20,
    y: rocket.y + 20,
    w: rocket.w - 40,
    h: rocket.h - 40
  };
  
  for (const l of lasers) {
    if (!l.active) continue;
    
    // Check if bounced laser hits the player rocket!
    if (l.bounced && l.canDamagePlayer !== false) {
      if (intersects(l.rect(), rocketHitbox)) {
        // Player hit by their own reflected laser!
        const dmg = randRange(8, 15);
        zeebHp = Math.max(0, zeebHp - dmg);
        updateHpDisplays();
        l.active = false;
        
        // Visual feedback
        rocket.onHit(dmg);
        
        // Sparks at rocket
        for (let i = 0; i < 8; i++) {
          sparks.push({ 
            x: rocket.x + rocket.w / 2 + randRange(-25, 25), 
            y: rocket.y + rocket.h / 2 + randRange(-25, 25), 
            t: 0 
          });
        }
        
        // Check if player is defeated
        if (zeebHp <= 0) {
          loseStage();
        }
        continue;
      }
    }
    
    // Check laser hitting cucumber
    if (!l.canDamage) continue;
    if (intersects(l.rect(), rect)) {
      l.canDamage = false;

      const bounced = Math.random() < bounceChance;
      // Lasers do minimal damage; main damage comes from ricocheted asteroids
      const dmg = bounced ? randRange(0.1, 0.5) : randRange(0.7, 1.2);
      hp = Math.max(0, hp - dmg);
      updateHpDisplays();
      sparks.push({ x: l.x, y: l.y, t: 0 });

      if (bounced) {
        l.bounced = true;
        l.canDamagePlayer = true; // Can now damage player
        
        // Calculate direction toward Zeeb
        const rocketCenterX = rocket.x + rocket.w / 2;
        const rocketCenterY = rocket.y + rocket.h / 2;
        const dx = rocketCenterX - l.x;
        const dy = rocketCenterY - l.y;
        const dist = Math.hypot(dx, dy);
        
        // Aim at Zeeb with some spread for fairness
        const speed = 650; // Consistent speed toward player
        const spread = randRange(-0.15, 0.15); // Small random spread angle
        const angle = Math.atan2(dy, dx) + spread;
        
        l.vx = Math.cos(angle) * speed;
        l.vy = Math.sin(angle) * speed;
        l.life = Math.min(l.life, 1.5); // Lives longer to reach Zeeb
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
  constructor(spawnX, isOverhead = false) {
    // Scaled down size (was 28-46, now smaller)
    this.size = randRange(32, 52);
    this.isOverhead = isOverhead;
    
    if (isOverhead) {
      // Overhead asteroids spawn above the cucumber's area
      this.x = spawnX;
      this.size = randRange(28, 42); // Slightly smaller for overhead
    } else {
      // Spawn between Zeeb and Planet Zeeb (left of cucumber), avoiding the rocket area
      this.x = (typeof spawnX === "number")
        ? spawnX
        : randRange(W * 0.36, W * 0.62);
    }
    this.y = -this.size - 20;
    this.vx = 0;
    // Slower straight-down fall until deflected
    this.vy = isOverhead ? randRange(180, 260) : randRange(120, 180);
    this.deflected = false;
    this.active = true;
    // Random asteroid image selection
    this.image = ASTEROID_IMAGES[Math.floor(Math.random() * ASTEROID_IMAGES.length)];
    // Random rotation for variety
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 2; // Random spin direction
  }
  rect() {
    const halfSize = this.size / 2;
    return { x: this.x - halfSize, y: this.y - halfSize, w: this.size, h: this.size };
  }
  update(dt) {
    if (!this.active) return;
    if (!this.deflected) {
      // Gentle acceleration while falling straight down
      this.vy += 35 * dt;
    } else {
      // Hostile asteroids accelerate toward player, normal ones toward cucumber
      if (this.isHostile) {
        this.vx -= 30 * dt; // Accelerate left toward player
      } else {
        this.vx += 40 * dt; // Accelerate right toward cucumber
      }
      this.vy *= 0.99;
      // Spin faster when deflected
      this.rotationSpeed = this.rotationSpeed * 1.01;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Rotate asteroid
    this.rotation += this.rotationSpeed * dt;

    // Different bounds for hostile vs normal asteroids
    if (this.isHostile) {
      if (this.y > H + 120 || this.x < -160) {
        this.active = false;
      }
    } else {
      if (this.y > H + 120 || this.x > W + 160) {
        this.active = false;
      }
    }
  }
  draw() {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    if (this.image && this.image.complete) {
      // Draw asteroid image centered and scaled
      const halfSize = this.size / 2;
      // Add glow effect when deflected
      if (this.deflected) {
        // Red hostile glow when going toward player, yellow when toward cucumber
        ctx.shadowColor = this.isHostile ? "#ff4444" : "#ffe6a8";
        ctx.shadowBlur = this.isHostile ? 20 : 15;
      }
      ctx.drawImage(this.image, -halfSize, -halfSize, this.size, this.size);
    } else {
      // Fallback to circle if image not loaded
      ctx.fillStyle = this.isHostile ? "#ff6666" : (this.deflected ? "#ffe6a8" : "#9fb0b8");
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function handleAsteroidInteractions() {
  for (const l of lasers) {
    if (!l.active) continue;
    for (const a of fallingAsteroids) {
      if (!a.active) continue;
      if (intersects(l.rect(), a.rect())) {
        a.deflected = true;
        
        // Check if laser is bounced (going left) - asteroid goes toward player!
        if (l.bounced || l.vx < 0) {
          // Deflect asteroid LEFT toward the player rocket - danger!
          a.vx = -700;
          a.vy = randRange(-100, 100);
          a.isHostile = true; // Mark as dangerous to player
        } else {
          // Normal deflection - asteroid goes right toward cucumber
          a.vx = 900;
          a.vy = randRange(-80, 80);
        }
        
        l.active = false;
        sparks.push({ x: l.x, y: l.y, t: 0 });
      }
    }
  }

  const cucRect = cucumber.rect();
  for (const a of fallingAsteroids) {
    if (!a.active || !a.deflected) continue;
    // Only non-hostile asteroids damage cucumber
    if (a.isHostile) continue;
    if (intersects(a.rect(), cucRect)) {
      const dmg = randRange(8, 14); // Increased damage range for longer battle
      hp = Math.max(0, hp - dmg);
      updateHpDisplays();
      a.active = false;
      
      // Trigger hit reaction on cucumber
      cucumber.onHit(dmg);
      
      // More dramatic sparks for asteroid impact
      for (let i = 0; i < 5; i++) {
        sparks.push({ 
          x: cucRect.x + cucRect.w / 2 + randRange(-20, 20), 
          y: cucRect.y + cucRect.h / 2 + randRange(-30, 30), 
          t: 0 
        });
      }
      
      if (hp <= 0) {
        winStage();
        break;
      }
    }
  }

  // Check for hostile asteroids hitting the player rocket!
  const rocketRect = {
    x: rocket.x + 15, // Tighter hitbox
    y: rocket.y + 15,
    w: rocket.w - 30,
    h: rocket.h - 30
  };
  for (const a of fallingAsteroids) {
    if (!a.active || !a.isHostile) continue;
    if (intersects(a.rect(), rocketRect)) {
      // Player got hit by ricocheted asteroid!
      const dmg = randRange(12, 20);
      zeebHp = Math.max(0, zeebHp - dmg);
      updateHpDisplays();
      a.active = false;
      
      // Visual feedback
      rocket.onHit(dmg);
      
      // More dramatic sparks for asteroid impact
      for (let i = 0; i < 12; i++) {
        sparks.push({ 
          x: rocket.x + rocket.w / 2 + randRange(-30, 30), 
          y: rocket.y + rocket.h / 2 + randRange(-30, 30), 
          t: 0 
        });
      }
      
      // Check if player is defeated
      if (zeebHp <= 0) {
        loseStage();
        break;
      }
    }
  }

  // Cull inactive
  for (let i = fallingAsteroids.length - 1; i >= 0; i--) {
    if (!fallingAsteroids[i].active) fallingAsteroids.splice(i, 1);
  }
}

// Spawn a falling asteroid in the corridor between the rocket and cucumber
function spawnAsteroid() {
  const cucRect = cucumber.rect();
  const rocketRight = rocket.x + rocket.w + 60;

  // Primary corridor based on live positions
  let minX = Math.max(W * 0.35, rocketRight);
  let maxX = Math.min(cucRect.x - 120, W * 0.78);

  // If band is too narrow or invalid early on, center-weight the spawn between rocket and cucumber
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !(maxX > minX) || (maxX - minX) < 80) {
    const approxCucLeft = Math.max(W * 0.60, cucRect.x);
    const center = (rocketRight + approxCucLeft) / 2;
    minX = Math.max(W * 0.45, center - 70);
    maxX = Math.min(W * 0.70, center + 70);
  }

  const spawnX = randRange(minX, maxX);
  fallingAsteroids.push(new FallingAsteroid(spawnX));
}

// Timer for overhead asteroid spawning
let overheadTimer = 3.0;

// Timer for fiery horizontal asteroid spawning
let fieryTimer = 5.0;

// Spawn an overhead asteroid that falls above the cucumber
function spawnOverheadAsteroid() {
  // Get cucumber's current and predicted position
  const cucCurrentX = cucumber.x;
  // Add some randomness to make it interesting - sometimes ahead, sometimes behind
  const offset = randRange(-40, 40);
  const spawnX = cucCurrentX + offset;
  
  fallingAsteroids.push(new FallingAsteroid(spawnX, true));
}

// Fiery asteroid class - horizontal attack from the right
class FieryAsteroid {
  constructor() {
    this.size = randRange(38, 55);
    // Spawn from right side, random Y position in playable area
    this.x = W + this.size;
    this.y = randRange(80, H - 80);
    // Move left toward Zeeb
    this.vx = -randRange(380, 520);
    this.vy = randRange(-30, 30); // Slight vertical drift
    this.active = true;
    // Random asteroid image
    this.image = ASTEROID_IMAGES[Math.floor(Math.random() * ASTEROID_IMAGES.length)];
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 4; // Fast spin
    // Fire trail particles
    this.trail = [];
    this.trailTimer = 0;
  }
  
  rect() {
    const halfSize = this.size / 2;
    return { x: this.x - halfSize, y: this.y - halfSize, w: this.size, h: this.size };
  }
  
  update(dt) {
    if (!this.active) return;
    
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationSpeed * dt;
    
    // Add fire trail particles
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trail.push({
        x: this.x + randRange(-8, 8),
        y: this.y + randRange(-8, 8),
        size: randRange(8, 16),
        life: 0.4,
        alpha: 1
      });
      this.trailTimer = 0.03; // Spawn trail particle every 30ms
    }
    
    // Update trail particles
    for (const p of this.trail) {
      p.life -= dt;
      p.alpha = p.life / 0.4;
      p.size *= 0.96;
    }
    this.trail = this.trail.filter(p => p.life > 0);
    
    // Deactivate when off left edge
    if (this.x < -this.size - 50) {
      this.active = false;
    }
  }
  
  draw() {
    if (!this.active) return;
    
    // Draw fire trail
    for (const p of this.trail) {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.8;
      // Fire gradient - orange to red
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, '#ffff44');
      gradient.addColorStop(0.3, '#ff8800');
      gradient.addColorStop(0.7, '#ff3300');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // Draw fiery glow around asteroid
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Outer glow
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 25;
    
    if (this.image && this.image.complete) {
      const halfSize = this.size / 2;
      ctx.drawImage(this.image, -halfSize, -halfSize, this.size, this.size);
      
      // Orange tint overlay
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ff6633";
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

const fieryAsteroids = [];

function spawnFieryAsteroid() {
  fieryAsteroids.push(new FieryAsteroid());
}

function handleFieryAsteroidCollisions() {
  const rocketHitbox = {
    x: rocket.x + 18,
    y: rocket.y + 18,
    w: rocket.w - 36,
    h: rocket.h - 36
  };
  
  for (const f of fieryAsteroids) {
    if (!f.active) continue;
    
    if (intersects(f.rect(), rocketHitbox)) {
      // Fiery asteroid hit - extra damage!
      const dmg = randRange(18, 28);
      zeebHp = Math.max(0, zeebHp - dmg);
      updateHpDisplays();
      f.active = false;
      
      // Big visual feedback
      rocket.onHit(dmg);
      
      // Extra sparks for fiery impact
      for (let i = 0; i < 15; i++) {
        sparks.push({ 
          x: rocket.x + rocket.w / 2 + randRange(-35, 35), 
          y: rocket.y + rocket.h / 2 + randRange(-35, 35), 
          t: 0 
        });
      }
      
      if (zeebHp <= 0) {
        loseStage();
        break;
      }
    }
  }
  
  // Cull inactive
  for (let i = fieryAsteroids.length - 1; i >= 0; i--) {
    if (!fieryAsteroids[i].active) fieryAsteroids.splice(i, 1);
  }
}

function update(dt) {
  rocket.update(dt);
  planet.update(dt);
  cucumber.update(dt, planet); // Pass planet so cucumber can stand on it
  screenShake.update(dt);
  
  // Check for power-up at 56 seconds in the music
  if (!powerUpTriggered && bgMusic && bgMusic.currentTime >= POWER_UP_TIME) {
    powerUpTriggered = true;
    powerUpEffectTimer = 3.0; // Red gradient effect lasts 3 seconds
    // Give Zeeb +25 HP boost!
    zeebHp = Math.min(zeebHp + 25, MAX_ZEEB_HP + 25); // Can exceed max slightly for boost
    updateHpDisplays();
    // Change page background from green to red gradient (same pattern, red colors)
    document.body.style.background = "radial-gradient(circle at 50% 20%, #330808, #100202 50%, #060101 100%)";
  }
  
  // Decay power-up effect timer
  if (powerUpEffectTimer > 0) {
    powerUpEffectTimer -= dt;
  }
  
  // Single-phase battle: asteroids always spawn
  dropTimer -= dt;
  if (dropTimer <= 0) {
    spawnAsteroid();
    // Slightly slower cadence to keep asteroids readable
    dropTimer = randRange(1.0, 1.8);
    // Planet reacts slightly when asteroids spawn nearby
    planet.onAsteroidNear(0.3);
  }
  
  // Overhead asteroids spawn occasionally
  overheadTimer -= dt;
  if (overheadTimer <= 0) {
    spawnOverheadAsteroid();
    // Random interval between overhead asteroids (2.5 to 5 seconds)
    overheadTimer = randRange(2.5, 5.0);
    // Planet reacts more to overhead asteroids
    planet.onAsteroidNear(0.6);
  }
  
  // Fiery asteroids spawn occasionally (not too much!)
  fieryTimer -= dt;
  if (fieryTimer <= 0) {
    spawnFieryAsteroid();
    // Random interval between fiery asteroids (6 to 10 seconds) - infrequent but dangerous
    fieryTimer = randRange(6.0, 10.0);
  }
  
  // Update fiery asteroids
  for (const f of fieryAsteroids) f.update(dt);
  handleFieryAsteroidCollisions();
  
  // Check for asteroids passing near the planet and make it react
  for (const a of fallingAsteroids) {
    if (!a.active) continue;
    const planetCenterX = planet.baseX + planet.w / 2;
    const planetCenterY = planet.baseY + planet.h / 2;
    const dist = Math.hypot(a.x - planetCenterX, a.y - planetCenterY);
    if (dist < 200 && a.y > H * 0.5) {
      planet.onAsteroidNear(0.4);
    }
  }
  
  // Let cucumber check for overhead asteroids and react
  cucumber.checkForOverheadAsteroids(fallingAsteroids);
  
  for (const l of lasers) l.update(dt);
  for (const a of fallingAsteroids) a.update(dt);
  handleCollisions();
  handleAsteroidInteractions();

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

function drawIntro(dt) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(dt || 0);
  
  // Calculate intro animation progress (0 to 1)
  const progress = Math.min(1, introTimer / INTRO_DURATION);
  
  // Easing function for smooth animation
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  
  // Phase 1 (0-0.4): Zeeb large and centered, title fades in
  // Phase 2 (0.4-0.6): Title fully visible
  // Phase 3 (0.6-1.0): Zeeb shrinks and moves to battle position, title fades out
  
  // Calculate Zeeb's scale and position
  const startScale = 4.0; // 4x normal size
  const endScale = 1.0;
  const startX = W / 2 - (rocket.w * startScale) / 2;
  const startY = H / 2 - (rocket.h * startScale) / 2;
  const endX = rocket.x;
  const endY = H / 2 - rocket.h / 2;
  
  let currentScale, currentX, currentY;
  
  if (progress < 0.4) {
    // Phase 1: Stay large and centered
    currentScale = startScale;
    currentX = startX;
    currentY = startY;
  } else if (progress < 0.6) {
    // Phase 2: Still large, maybe slight pulse
    const pulsePhase = (progress - 0.4) / 0.2;
    const pulse = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.05;
    currentScale = startScale * pulse;
    currentX = W / 2 - (rocket.w * currentScale) / 2;
    currentY = H / 2 - (rocket.h * currentScale) / 2;
  } else {
    // Phase 3: Shrink and move to battle position
    const shrinkProgress = (progress - 0.6) / 0.4;
    const eased = easeOutCubic(shrinkProgress);
    currentScale = startScale + (endScale - startScale) * eased;
    currentX = startX + (endX - startX) * eased;
    currentY = startY + (endY - startY) * eased;
  }
  
  // Draw Zeeb at intro position/scale
  rocket.draw(currentScale, currentX, currentY);
  
  // Draw title text
  let titleAlpha = 0;
  if (progress < 0.15) {
    // Fade in
    titleAlpha = progress / 0.15;
  } else if (progress < 0.7) {
    // Fully visible
    titleAlpha = 1;
  } else {
    // Fade out
    titleAlpha = 1 - (progress - 0.7) / 0.3;
  }
  
  if (titleAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = titleAlpha;
    
    // Title glow
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 30;
    
    // Main title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px 'Audiowide', 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CUCUMBER BATTLE", W / 2, H / 2 - 180);
    
    // Subtitle
    ctx.shadowBlur = 15;
    ctx.font = "26px 'Audiowide', 'Orbitron', sans-serif";
    ctx.fillStyle = "#88ffaa";
    ctx.fillText("Level 4", W / 2, H / 2 - 120);
    
    // "VS" text appears later
    if (progress > 0.25) {
      const vsAlpha = Math.min(1, (progress - 0.25) / 0.15);
      ctx.globalAlpha = titleAlpha * vsAlpha;
      ctx.font = "bold 68px 'Audiowide', 'Orbitron', sans-serif";
      ctx.fillStyle = "#ff6644";
      ctx.shadowColor = "#ff4400";
      ctx.shadowBlur = 25;
      ctx.fillText("VS", W / 2 + 200, H / 2 + 50);
      
      // Cucumber name
      ctx.font = "bold 32px 'Audiowide', 'Orbitron', sans-serif";
      ctx.fillStyle = "#66ff88";
      ctx.shadowColor = "#00ff44";
      ctx.fillText("THE CUCUMBER", W / 2 + 200, H / 2 + 110);
    }
    
    ctx.restore();
  }
  
  // Draw cucumber preview (fades in during intro)
  if (progress > 0.3) {
    const cucAlpha = Math.min(1, (progress - 0.3) / 0.2);
    ctx.save();
    ctx.globalAlpha = cucAlpha * 0.8;
    
    // Draw cucumber on the right side with proper aspect ratio
    if (IMAGES.cucumber && IMAGES.cucumber.complete) {
      const imgW = IMAGES.cucumber.naturalWidth || IMAGES.cucumber.width;
      const imgH = IMAGES.cucumber.naturalHeight || IMAGES.cucumber.height;
      // Target height, calculate width from aspect ratio
      const cucH = 200;
      const cucW = imgW && imgH ? Math.round(cucH * (imgW / imgH)) : 120;
      const cucX = W - 180 - cucW / 2;
      const cucY = H / 2 - cucH / 2 + 30;
      ctx.drawImage(IMAGES.cucumber, cucX, cucY, cucW, cucH);
    }
    
    ctx.restore();
  }
  
  // "GET READY" text near the end
  if (progress > 0.85) {
    const readyAlpha = (progress - 0.85) / 0.15;
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

function draw(dt) {
  // During intro, use special intro drawing
  if (state === "intro") {
    drawIntro(dt);
    return;
  }
  
  ctx.clearRect(0, 0, W, H);
  
  // Draw finale video when in win state
  if (state === "win") {
    // Black background for clean video viewing
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    
    const vw = (finaleVideo && finaleVideo.videoWidth) ? finaleVideo.videoWidth : 1280;
    const vh = (finaleVideo && finaleVideo.videoHeight) ? finaleVideo.videoHeight : 720;

    // Fit video within canvas with margin
    let maxW = Math.floor(W * 0.96);
    let maxH = Math.floor(H * 0.82);
    let drawW = maxW;
    let drawH = Math.floor(drawW * (vh / vw));
    if (drawH > maxH) {
      drawH = maxH;
      drawW = Math.floor(drawH * (vw / vh));
    }
    const dx = Math.floor((W - drawW) / 2);
    const dy = Math.floor((H - drawH) / 2);

    // Subtle frame glow
    ctx.save();
    ctx.shadowColor = "#44aa44";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#227722";
    ctx.lineWidth = 2;
    ctx.strokeRect(dx - 4, dy - 4, drawW + 8, drawH + 8);
    ctx.restore();

    // Draw video frame
    if (finaleVideo) {
      try { ctx.drawImage(finaleVideo, dx, dy, drawW, drawH); } catch (_) {}
    }

    // Title text
    ctx.save();
    ctx.fillStyle = "#aaffaa";
    ctx.textAlign = "center";
    ctx.font = "bold 36px 'Audiowide', 'Orbitron', system-ui, sans-serif";
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = 20;
    ctx.fillText("VICTORY!", W / 2, Math.max(40, dy - 20));
    
    // Show "Play Again" option when video ends
    if (finaleVideoEnded) {
      ctx.font = "bold 24px 'Audiowide', 'Orbitron', system-ui, sans-serif";
      ctx.fillStyle = "#ffff88";
      ctx.shadowColor = "#ffaa00";
      ctx.fillText("Press Space or Click to Restart Game", W / 2, dy + drawH + 45);
    }
    ctx.restore();
    
    return;
  }
  
  // Apply screen shake
  ctx.save();
  ctx.translate(screenShake.offsetX, screenShake.offsetY);
  
  drawBackground(dt || 0);
  drawPlanet();

  cucumber.draw();
  for (const a of fallingAsteroids) a.draw();
  for (const f of fieryAsteroids) f.draw();
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
  
  // Red damage vignette when taking damage
  if (screenShake.duration > 0) {
    const vignetteAlpha = (screenShake.duration / 0.4) * 0.4;
    const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.7);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(0.6, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(255, 0, 0, ${vignetteAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
  
  // Power-up red gradient effect at 56 seconds
  if (powerUpEffectTimer > 0) {
    const effectAlpha = Math.min(0.5, powerUpEffectTimer / 3.0 * 0.5);
    // Create a red gradient from edges toward center
    const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.8);
    gradient.addColorStop(0, 'rgba(255, 50, 50, 0)');
    gradient.addColorStop(0.4, `rgba(255, 30, 30, ${effectAlpha * 0.3})`);
    gradient.addColorStop(0.7, `rgba(200, 0, 0, ${effectAlpha * 0.5})`);
    gradient.addColorStop(1, `rgba(150, 0, 0, ${effectAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    
    // Show "+25 HP" text during first 2 seconds
    if (powerUpEffectTimer > 1.0) {
      const textAlpha = Math.min(1, (powerUpEffectTimer - 1.0) / 1.0);
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = "#ffff44";
      ctx.font = "bold 48px 'Audiowide', 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff6600";
      ctx.shadowBlur = 30;
      ctx.fillText("+25 POWER!", W / 2, H / 2 - 50);
      ctx.restore();
    }
  }
  
  ctx.restore();
}

function updateIntro(dt) {
  introTimer += dt;
  
  // Update background stars (handled by drawBackground with speed multiplier)
  
  // When intro is complete, transition to running state
  if (introTimer >= INTRO_DURATION) {
    state = "running";
    introTimer = 0;
    // Ensure asteroids are visible immediately
    for (let i = 0; i < 3; i++) spawnAsteroid();
    dropTimer = 0.6;
  }
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (state === "intro") updateIntro(dt);
  if (state === "running") update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

// Update HP bar displays
function updateHpDisplays() {
  // Update text values
  hpEl.textContent = Math.ceil(hp);
  zeebHpEl.textContent = Math.ceil(zeebHp);
  
  // Update bar widths
  const cucumberPercent = (hp / MAX_CUCUMBER_HP) * 100;
  const zeebPercent = (zeebHp / MAX_ZEEB_HP) * 100;
  
  cucumberHpBar.style.width = cucumberPercent + "%";
  zeebHpBar.style.width = zeebPercent + "%";
  
  // Update bar colors based on HP level
  // Cucumber bar
  cucumberHpBar.classList.remove("low", "critical");
  if (cucumberPercent <= 20) {
    cucumberHpBar.classList.add("critical");
  } else if (cucumberPercent <= 40) {
    cucumberHpBar.classList.add("low");
  }
  
  // Zeeb bar
  zeebHpBar.classList.remove("low", "critical");
  if (zeebPercent <= 20) {
    zeebHpBar.classList.add("critical");
  } else if (zeebPercent <= 40) {
    zeebHpBar.classList.add("low");
  }
}

function resetStage() {
  hp = MAX_CUCUMBER_HP;
  zeebHp = MAX_ZEEB_HP;
  dropTimer = 0;
  overheadTimer = 3.0; // First overhead asteroid after 3 seconds
  fieryTimer = 5.0; // First fiery asteroid after 5 seconds
  powerUpTriggered = false; // Reset power-up for new attempt
  powerUpEffectTimer = 0;
  // Reset page background to original green gradient
  document.body.style.background = "radial-gradient(circle at 50% 20%, #083316, #021007 50%, #010604 100%)";
  lasers.length = 0;
  sparks.length = 0;
  fallingAsteroids.length = 0;
  fieryAsteroids.length = 0;
  updateHpDisplays();
  rocket.reset();
  cucumber.reset();
  planet.reset();
  planet.init(); // Reinitialize planet position
  screenShake.reset();
  state = "ready";
}

function startStage() {
  // Reset and restart the music from the beginning
  try {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  } catch (_) {}
  
  unlockMusic();
  hide(overlay);
  hide(completeOverlay);
  // Reset overlay text in case it was changed by loseStage
  completeOverlay.querySelector("h2").textContent = "Victory!";
  completeOverlay.querySelector(".subtitle").textContent = "Nice ricochets. Cucumber has been defeated!";
  completeOverlay.querySelector("#restartBtn").textContent = "Play Again";
  resetStage();
  // Start with intro sequence only on first play
  if (!introShown) {
    state = "intro";
    introTimer = 0;
    introShown = true;
  } else {
    state = "running";
    // Spawn initial asteroids
    for (let i = 0; i < 3; i++) spawnAsteroid();
    dropTimer = 0.6;
  }
  lastTs = performance.now();
}

function winStage() {
  state = "win";
  try { bgMusic.pause(); } catch (_) {}
  
  // Play finale video (rendered directly on canvas, no overlay needed)
  if (finaleVideo) {
    try {
      finaleVideoEnded = false;
      finaleVideoPlaying = true;
      finaleVideo.currentTime = 0;
      finaleVideo.muted = false;
      finaleVideo.volume = 1.0;
      const p = finaleVideo.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }
}

// Handle finale video ended - show play again option
if (finaleVideo) {
  finaleVideo.addEventListener("ended", () => {
    finaleVideoPlaying = false;
    finaleVideoEnded = true;
  });
}

function loseStage() {
  state = "gameover";
  // Reuse complete overlay but change the message
  completeOverlay.querySelector("h2").textContent = "Zeeb Defeated!";
  completeOverlay.querySelector(".subtitle").textContent = "The cucumber's ricocheted asteroids got you. Try again!";
  completeOverlay.querySelector("#restartBtn").textContent = "Try Again";
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
  if (["ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) e.preventDefault();
  unlockMusic();

  // Start game with Space or Enter from menu/game over
  if ((e.key === " " || e.key === "Enter") && (state === "ready" || state === "complete" || state === "gameover")) {
    startStage();
    return;
  }
  
  // Restart whole game from win state after video ends
  if ((e.key === " " || e.key === "Enter") && state === "win" && finaleVideoEnded) {
    if (finaleVideo) try { finaleVideo.pause(); } catch (_) {}
    // Navigate to start screen to restart the whole game
    window.location.href = "../start/";
    return;
  }

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
  
  // Handle click to restart whole game after finale video
  if (state === "win" && finaleVideoEnded) {
    if (finaleVideo) try { finaleVideo.pause(); } catch (_) {}
    // Navigate to start screen to restart the whole game
    window.location.href = "../start/";
    return;
  }
  
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

/**
 * Autostart battle:
 * - Always start the battle immediately when level 4 loads (no skip option).
 * - The intro sequence will play, giving the dramatic reveal.
 */
setTimeout(() => {
  try { startStage(); } catch (_) {}
}, 100);
