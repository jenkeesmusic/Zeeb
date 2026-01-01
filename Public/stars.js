/**
 * Modular Star Background System for Zeeb's Asteroid Dodger
 * Usage: 
 *   const starfield = createStarfield(ctx, W, H, { count: 100, color: "#ffffff" });
 *   // In draw loop: starfield.draw(dt);
 */

function createStarfield(ctx, W, H, options = {}) {
  const {
    count = 100,
    color = "#ffffff",
    bgColor = "#000000",
    minSpeed = 20,
    maxSpeed = 80,
    minSize = 0.6,
    maxSize = 1.6,
    twinkle = true,
    twinkleSpeed = 2.0
  } = options;

  // Create stars array
  const stars = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
    size: minSize + Math.random() * (maxSize - minSize),
    twinkleOffset: Math.random() * Math.PI * 2
  }));

  let time = 0;

  return {
    stars,
    
    /**
     * Update and draw the starfield
     * @param {number} dt - Delta time in seconds
     * @param {number} speedMultiplier - Optional speed multiplier (e.g. 0.5 for slower during intro)
     */
    draw(dt, speedMultiplier = 1) {
      time += dt;
      
      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      // Draw and update stars
      for (const s of stars) {
        // Move star
        s.x -= s.speed * dt * speedMultiplier;
        
        // Wrap around when off screen
        if (s.x < -4) {
          s.x = W + Math.random() * 40;
          s.y = Math.random() * H * 0.9;
          s.speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          s.size = minSize + Math.random() * (maxSize - minSize);
        }
        
        // Calculate alpha with twinkle effect
        let alpha;
        if (twinkle) {
          alpha = 0.5 + 0.5 * Math.sin(time * twinkleSpeed + s.twinkleOffset);
        } else {
          alpha = 0.5 + Math.random() * 0.5;
        }
        
        // Draw star
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
    },
    
    /**
     * Just update stars without drawing (for when you need separate update/draw)
     */
    update(dt, speedMultiplier = 1) {
      time += dt;
      for (const s of stars) {
        s.x -= s.speed * dt * speedMultiplier;
        if (s.x < -4) {
          s.x = W + Math.random() * 40;
          s.y = Math.random() * H * 0.9;
          s.speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          s.size = minSize + Math.random() * (maxSize - minSize);
        }
      }
    },
    
    /**
     * Just draw stars without updating (for when you need separate update/draw)
     */
    render() {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
      
      for (const s of stars) {
        let alpha;
        if (twinkle) {
          alpha = 0.5 + 0.5 * Math.sin(time * twinkleSpeed + s.twinkleOffset);
        } else {
          alpha = 0.5 + Math.random() * 0.5;
        }
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
    },
    
    /**
     * Reset all stars to random positions
     */
    reset() {
      time = 0;
      for (const s of stars) {
        s.x = Math.random() * W;
        s.y = Math.random() * H;
        s.speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        s.size = minSize + Math.random() * (maxSize - minSize);
      }
    }
  };
}

// Preset configurations for each level
const STAR_PRESETS = {
  level1: {
    count: 120,
    color: "#ffffff",
    bgColor: "#000000",
    twinkleSpeed: 2.0
  },
  level2: {
    count: 140,
    color: "#b0fff0", // Teal/cyan tint
    bgColor: "#000000",
    twinkleSpeed: 2.2
  },
  level3: {
    count: 160,
    color: "#ffd0a8", // Warm orange tint
    bgColor: "#000000",
    twinkleSpeed: 2.4
  },
  level4: {
    count: 50,
    color: "#caffc6", // Green tint
    bgColor: "#030a05",
    twinkle: false // Level 4 uses random flicker instead
  }
};
