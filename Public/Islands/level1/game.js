// Level 1: Ocean Animation with Zeeb Surfing
// Focus: Wave-hopping mechanic with multiple wave layers

class Player {
    constructor(ocean) {
        this.ocean = ocean;
        this.baseXRatio = 0.32;
        this.x = ocean.width * this.baseXRatio;
        this.y = ocean.height * 0.5;
        this.baseY = this.y;
        
        // Wave layer management
        // With back waves hidden, only ride on wave index 2 (front visible wave)
        this.currentWaveIndex = 2; // Rideable wave is now index 2 (front wave)
        this.targetWaveIndex = 2;
        
        // Jumping physics
        this.velocityY = 0;
        this.gravity = 600; // pixels/sec²
        this.jumpPower = -350; // pixels/sec
        this.isJumping = false;
        this.lastJumpTime = -Infinity;
        this.jumpCount = 0;       // Track jumps used (0, 1, or 2 for double-jump)
        this.maxJumps = 2;        // Allow double-jump
        this.jumpStartWave = 1;
        this.jumpStartY = 0;      // Cached starting Y for smooth jump
        this.jumpTargetY = 0;     // Cached target Y for smooth landing
        
        // Wave riding animation (when catching danger wave)
        this.isRidingWave = false;
        this.rideWaveTimer = 0;
        this.rideWaveDuration = 0.8; // Duration of wave-riding animation
        
        // Smooth Y position tracking to prevent jitter
        this.smoothY = this.y;
        this.bobOffset = 0;
        
        // Additional floating motion parameters
        this.floatTime = 0;          // Track time for floating animation
        this.floatAmplitude = 8;     // Pixels of additional float motion
        this.floatSpeed = 1.8;       // Speed of floating oscillation
        
        // Images
        this.surfboardImage = new Image(); // Green.png includes Zeeb
        this.imagesLoaded = false;
        this.boardIncludesZeeb = true; // Green.png already has Zeeb on it
        this.boardAspect = null;
        this.tiltBase = -0.08;
        this.tiltBob = 0.04;
        this.tiltSpeed = 1.4;
        this.rideAdjustByWaveIndex = {
            0: 0.6,   // Layer 3 (back): ride much higher
            1: 0.15,  // Layer 2 (middle): ride a bit higher
            2: -0.15  // Layer 1 (front/face): ride a bit lower
        };
        
        // Sizes
        this.surfboardWidth = 100;
        this.surfboardHeight = 30;
        this.scale = 1;
        this.zeebSizeMultiplier = 1.5; // 25% smaller than the previous 2x size
        
        // Intro animation: surf in from left on first load
        this.isEntering = false;
        this.entryTimer = 0;
        this.entryDuration = 1.6;
        this.entryStartXRatio = -0.22;
        this.entryProgress = 0;
        this.entryDropHeightRatio = 0.18;

        this.updateLayout();
    }

    updateLayout() {
        const scale = Math.min(this.ocean.width / 900, this.ocean.height / 600);
        const sizeScale = Math.max(0.75, Math.min(1.2, scale));
        this.scale = sizeScale;

        this.x = this.ocean.width * this.baseXRatio;
        this.surfboardWidth = 120 * sizeScale * this.zeebSizeMultiplier;
        this.surfboardHeight = 35 * sizeScale * this.zeebSizeMultiplier;
    }

    getSurfboardHeight() {
        if (this.boardAspect) {
            return this.surfboardWidth * this.boardAspect;
        }
        return this.surfboardHeight;
    }

    getRideSurfaceY(waveIndex, x) {
        const baseSurfaceY = this.ocean.getWaveSurfaceYAtX(waveIndex, x);
        const adjustRatio = this.rideAdjustByWaveIndex[waveIndex] || 0;
        const adjustPx = this.getSurfboardHeight() * adjustRatio;
        // Smaller Y is higher on the canvas.
        return baseSurfaceY - adjustPx;
    }
    
    loadImages(onComplete) {
        // Load surfboard with Zeeb (green.png includes Zeeb on the board)
        this.surfboardImage.onload = () => {
            if (this.surfboardImage.naturalWidth > 0) {
                this.boardAspect = this.surfboardImage.naturalHeight / this.surfboardImage.naturalWidth;
            }
            this.imagesLoaded = true;
            if (onComplete) onComplete();
        };
        this.surfboardImage.onerror = () => {
            console.error('Failed to load green surfboard with Zeeb');
            this.imagesLoaded = true;
            if (onComplete) onComplete();
        };
        this.surfboardImage.src = '../img/green.png';
    }

    beginEntry() {
        this.isEntering = true;
        this.entryTimer = 0;
        this.entryProgress = 0;
        this.isJumping = false;
        this.velocityY = 0;
        this.jumpCount = 0;

        const entryX = this.ocean.width * this.entryStartXRatio;
        const entryY = this.getRideSurfaceY(this.currentWaveIndex, entryX) - (this.ocean.height * this.entryDropHeightRatio);
        this.x = entryX;
        this.y = entryY;
        this.smoothY = entryY;
    }
    
    jump() {
        if (this.isEntering) {
            return;
        }

        // Allow jump if: not jumping yet, OR already jumping but haven't used all jumps
        if (this.jumpCount < this.maxJumps) {
            // Cache the current Y position at jump start (only on first jump)
            if (!this.isJumping) {
                this.jumpStartY = this.y;
                this.jumpStartWave = this.currentWaveIndex;
            }
            
            // Apply jump velocity (slightly weaker for second jump)
            const jumpMultiplier = this.jumpCount === 0 ? 1.0 : 0.85;
            this.velocityY = this.jumpPower * jumpMultiplier;
            this.isJumping = true;
            this.jumpCount++;
            this.lastJumpTime = this.ocean.elapsedTime;
            
            // With only wave 2 visible, stay on the same wave (no switching)
            // Keep target same as current for now
            this.targetWaveIndex = 2;
            
            // Cache the target Y position at jump start (without bobbing for stability)
            this.jumpTargetY = this.getStableWaveSurfaceY(this.targetWaveIndex, this.x);
        }
    }
    
    // Get wave surface Y without bobbing for stable jump targets
    getStableWaveSurfaceY(waveIndex, x) {
        const wave = this.ocean.waves[waveIndex];
        if (!wave) return this.ocean.height * 0.5;
        
        const image = this.ocean.images[`wave${waveIndex + 1}`];
        const metrics = this.ocean.getWaveMetrics(image, wave);
        const crestMap = this.ocean.waveCrests[waveIndex + 1];
        
        if (!crestMap || !crestMap.values) {
            return metrics.waveY + metrics.waveHeight * wave.surfaceRatio;
        }
        
        const tileWidth = metrics.tileWidth;
        const localX = ((x + wave.offset) % tileWidth + tileWidth) % tileWidth;
        const crestValues = crestMap.values;
        const crestIndex = Math.min(
            crestValues.length - 1,
            Math.max(0, Math.floor((localX / tileWidth) * (crestValues.length - 1)))
        );
        let crestRatio = crestValues[crestIndex];
        
        // SAFEGUARD: Clamp crest ratio to reasonable bounds (0.1 to 0.6)
        crestRatio = Math.max(0.1, Math.min(0.6, crestRatio));
        
        const adjustRatio = this.rideAdjustByWaveIndex[waveIndex] || 0;
        const adjustPx = this.getSurfboardHeight() * adjustRatio;
        
        const surfaceY = metrics.waveY + metrics.waveHeight * crestRatio - adjustPx;
        
        // SAFEGUARD: Clamp final Y to reasonable screen bounds
        const minY = this.ocean.height * 0.35;
        const maxY = this.ocean.height * 0.85;
        return Math.max(minY, Math.min(maxY, surfaceY));
    }
    
    update(deltaTime) {
        const dt = Math.min(deltaTime / 1000, 0.05); // Convert to seconds, cap delta

        // Safety check: ensure wave index is valid (only wave 2 is visible now)
        if (this.currentWaveIndex !== 2) {
            this.currentWaveIndex = 2;
            this.targetWaveIndex = 2;
            this.isJumping = false;
            this.velocityY = 0;
        }
        
        if (this.isEntering) {
            this.entryTimer += dt;
            const progress = Math.min(1, this.entryTimer / this.entryDuration);
            this.entryProgress = progress;
            const startX = this.ocean.width * this.entryStartXRatio;
            const endX = this.ocean.width * this.baseXRatio;
            this.x = startX + (endX - startX) * progress;

            const targetY = this.getRideSurfaceY(this.currentWaveIndex, this.x);
            const minY = this.ocean.height * 0.35;
            const maxY = this.ocean.height * 0.85;
            const rideTargetY = Math.max(minY, Math.min(maxY, targetY));
            const dropOffset = -(this.ocean.height * this.entryDropHeightRatio) * (1 - progress);
            const introTargetY = rideTargetY + dropOffset;
            this.smoothY = introTargetY;
            this.y = introTargetY;

            if (progress >= 1) {
                this.isEntering = false;
                this.x = endX;
                this.y = rideTargetY;
                this.smoothY = rideTargetY;
            }
        } else if (this.isJumping) {
            // Keep Zeeb anchored on screen while the waves move under him
            this.x = this.ocean.width * this.baseXRatio;

            // Update jumping physics
            this.velocityY += this.gravity * dt;
            this.y += this.velocityY * dt;
            
            // Update target Y to follow wave contour (but without bobbing jitter)
            let targetY = this.getStableWaveSurfaceY(this.targetWaveIndex, this.x);
            
            // Bounds check on jump target (prevent extreme values)
            const minLandY = this.ocean.height * 0.40;
            const maxLandY = this.ocean.height * 0.85;
            targetY = Math.max(minLandY, Math.min(maxLandY, targetY));
            this.jumpTargetY = targetY;
            
            // Check if landed on target wave (going down and past target)
            if (this.y >= this.jumpTargetY && this.velocityY > 0) {
                this.y = this.jumpTargetY;
                this.smoothY = this.y; // Reset smooth tracking to match landed position
                this.velocityY = 0;
                this.isJumping = false;
                this.jumpCount = 0; // Reset jump count on landing
                this.currentWaveIndex = this.targetWaveIndex;
                // Landing splash burst from back tip of surfboard
                const tip = this.getBackTip();
                this.ocean.spawnSpray(tip.x, tip.y, 'burst');
            }
            
            // Safety: prevent falling through the bottom
            const maxY = this.ocean.height * 0.90;
            if (this.y > maxY) {
                this.y = this.jumpTargetY;
                this.smoothY = this.y; // Reset smooth tracking
                this.velocityY = 0;
                this.isJumping = false;
                this.jumpCount = 0; // Reset jump count on landing
                this.currentWaveIndex = this.targetWaveIndex;
            }
        } else {
            // Keep Zeeb anchored on screen while the waves move under him
            this.x = this.ocean.width * this.baseXRatio;

            // When not jumping, smoothly follow the wave surface
            const targetY = this.getRideSurfaceY(this.currentWaveIndex, this.x);
            
            // Bounds checking: prevent extreme Y values
            const minY = this.ocean.height * 0.35;  // Don't go too high
            const maxY = this.ocean.height * 0.85; // Don't go too low
            const clampedTargetY = Math.max(minY, Math.min(maxY, targetY));
            
            // Rate limiting: prevent sudden jumps
            const maxDelta = this.ocean.height * 0.03; // Max 3% of height per frame
            let smoothTargetY = clampedTargetY;
            const deltaY = clampedTargetY - this.smoothY;
            if (Math.abs(deltaY) > maxDelta) {
                smoothTargetY = this.smoothY + Math.sign(deltaY) * maxDelta;
            }
            
            // Sync Zeeb's extra bob with the active wave rhythm.
            const activeWave = this.ocean.waves[this.currentWaveIndex];
            const wavePhase =
                this.ocean.elapsedTime * (activeWave?.bobSpeed || this.floatSpeed) +
                (activeWave?.bobPhase || 0);
            const syncAmplitude = this.floatAmplitude * 0.55;
            const floatOffset =
                Math.sin(wavePhase) * syncAmplitude +
                Math.sin(wavePhase * 2 + 0.9) * (syncAmplitude * 0.25);
            
            // Smooth interpolation to prevent jitter
            const smoothing = 0.35; // Increased for more responsive movement
            this.smoothY = this.smoothY + (smoothTargetY - this.smoothY) * smoothing;
            this.y = this.smoothY + floatOffset;
        }
        
        // Final Y bounds check (safety net)
        const absoluteMaxY = this.ocean.height * 0.90;
        if (this.y > absoluteMaxY) {
            this.y = absoluteMaxY;
            this.smoothY = this.y;
        }
        
        // Update wave-riding animation timer
        if (this.isRidingWave) {
            this.rideWaveTimer -= dt;
            if (this.rideWaveTimer <= 0) {
                this.isRidingWave = false;
                this.rideWaveTimer = 0;
            }
        }
        
        // Final validation: ensure wave index stays valid (only wave 2 is visible)
        if (this.currentWaveIndex !== 2) {
            this.currentWaveIndex = 2;
        }
    }
    
    draw(ctx) {
        if (!this.imagesLoaded) return;
        
        // Use actual Y position (which already includes wave bobbing)
        const actualY = this.y;
        const surfboardHeight = this.boardAspect
            ? this.surfboardWidth * this.boardAspect
            : this.surfboardHeight;
        
        // Position surfboard so it rides on the wave, nudged up a bit
        // to keep Zeeb from hanging off the bottom of the screen.
        const surfboardY = actualY - surfboardHeight * 0.64;

        // Add extra tilt during jump (nose up/down based on vertical velocity)
        const jumpTilt = this.isJumping ? Math.sin(this.velocityY * 0.001) * 0.15 : 0;
        
        // Add subtle tilt based on floating motion when not jumping
        const floatTilt = (!this.isJumping && !this.isEntering) ? 
            Math.sin(this.ocean.elapsedTime * 2.2 + 0.5) * 0.05 : 0;
        
        // Wave-riding tilt - dig left side into the wave!
        let rideTilt = 0;
        if (this.isRidingWave) {
            // Progress from 0 to 1 over the animation duration
            const rideProgress = 1 - (this.rideWaveTimer / this.rideWaveDuration);
            // Smooth curve: dig in hard at start, ease out at end
            // Peak tilt around 30% through, then ease back to normal
            const tiltCurve = Math.sin(rideProgress * Math.PI) * (1 - rideProgress * 0.5);
            rideTilt = -0.35 * tiltCurve; // Negative = left side dips down (digging in)
        }
        
        const entryTilt = this.isEntering
            ? -0.30 * (1 - this.entryProgress) // Linear nose-up fade during entry.
            : 0;
        const tilt = this.tiltBase + Math.sin(this.ocean.elapsedTime * this.tiltSpeed) * this.tiltBob + jumpTilt + rideTilt + floatTilt + entryTilt;
        const boardCenterY = surfboardY + surfboardHeight / 2;

        // Scale during jump for depth effect
        const jumpScale = this.isJumping ? 1 + Math.abs(this.velocityY) * 0.0002 : 1;
        const drawWidth = this.surfboardWidth * jumpScale;
        const drawHeight = surfboardHeight * jumpScale;
        
        // 3D twist effect during jump - simulates back of board rotating
        // Uses a skew transform to create perspective rotation illusion
        let twistSkew = 0;
        let twistScaleX = 1;
        if (this.isJumping) {
            // Calculate twist based on jump phase
            // Going up: twist one way, going down: twist the other way
            const jumpPhase = this.velocityY / Math.abs(this.jumpPower);
            
            // Smooth twist that peaks at top of jump arc and reverses direction
            twistSkew = Math.sin(jumpPhase * Math.PI) * 0.12;
            
            // Slight horizontal squeeze to enhance 3D effect
            twistScaleX = 1 - Math.abs(Math.sin(jumpPhase * Math.PI)) * 0.08;
            
            // Direction based on which wave we're jumping to
            if (this.targetWaveIndex > this.jumpStartWave) {
                twistSkew *= -1; // Twist towards viewer when jumping forward
            }
        }

        ctx.save();
        ctx.translate(this.x, boardCenterY);
        ctx.rotate(tilt);
        
        // Apply 3D twist effect using transform matrix
        // transform(scaleX, skewY, skewX, scaleY, translateX, translateY)
        if (this.isJumping) {
            ctx.transform(twistScaleX, twistSkew, 0, 1, 0, 0);
        }
        
        // Draw surfboard with Zeeb - always draw once imagesLoaded is true
        // to prevent blinking from intermittent image.complete checks
        if (this.surfboardImage.naturalWidth > 0) {
            ctx.drawImage(
                this.surfboardImage,
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );
        } else {
            // Fallback surfboard (only if image truly failed to load)
            ctx.fillStyle = '#4169E1';
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );
        }
        
        ctx.restore();
    }

    getBackTip() {
        const surfboardHeight = this.getSurfboardHeight();
        const surfboardY = this.y - surfboardHeight * 0.64;
        const boardCenterY = surfboardY + surfboardHeight / 2;
        const tilt = this.tiltBase +
            Math.sin(this.ocean.elapsedTime * this.tiltSpeed) * this.tiltBob;
        const halfW = this.surfboardWidth / 2;
        return {
            x: this.x - halfW * Math.cos(tilt),
            y: boardCenterY - halfW * Math.sin(-tilt) + 65
        };
    }
}

class OceanAnimation {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Base size before DPR scaling
        this.baseWidth = 900;
        this.baseHeight = 600;
        this.canvas.width = this.baseWidth;
        this.canvas.height = this.baseHeight;
        this.width = this.baseWidth;
        this.height = this.baseHeight;
        this.dpr = window.devicePixelRatio || 1;
        this.assetVersion = '20260202a';
        this.cloudSystem = (typeof window !== 'undefined' && window.CloudSystem)
            ? new window.CloudSystem({
                width: this.width,
                height: this.height,
                basePath: '../img/Clouds/'
            })
            : null;
        
        // Glow cache for danger waves
        this.glowCache = new WeakMap();

        this.visibleWaveLayers = [1, 2]; // Show only middle/front BG wave layers

        // Gerstner wave system (physically-based, replaces SVG tiling)
        this.useGerstnerWaves = true; // Toggle: true = Gerstner, false = SVG tiles
        this.gerstnerWaves = new GerstnerWaveSystem();
        this.gerstnerWaves.init();
        this.showDangerWaveExtra = true; // Show extra danger wave
        
        // Images
        this.images = {
            sky: new Image(),
            islandLeft: new Image(),
            islandRight: new Image(),
            wave1: new Image(),
            wave2: new Image(),
            wave3: new Image(),
            wave4: new Image(),
            fishAliveLeft: new Image(),
            fishAliveRight: new Image(),
            fishDeadLeft: new Image(),
            fishDeadRight: new Image(),
            dangerWave2: new Image(),
            dangerWave3: new Image(),
            dangerWave4: new Image(),
            dangerWave5: new Image()
        };
        
        // Danger wave image rotation - cycles through GraceWave2, 3, 4
        this.dangerWaveImages = []; // Filled after loading: [dangerWave2, dangerWave3, dangerWave4]
        this.dangerWaveImageIndex = 0; // Current rotation index
        
        // Per-sprite tip positions (ratios of waveWidth/waveHeight)
        // These define where the curling tip is on each GraceWave sprite
        // Tip is at the very top of the curling wave, left of center
        this.dangerWaveTipPositions = [
            { tipXRatio: 0.15, tipYRatio: -0.03, crestStartX: 0.05, crestEndX: 0.25 }, // GraceWave2
            { tipXRatio: 0.17, tipYRatio: -0.03, crestStartX: 0.07, crestEndX: 0.27 }, // GraceWave3
            { tipXRatio: 0.13, tipYRatio: -0.02, crestStartX: 0.03, crestEndX: 0.23 }, // GraceWave4
            { tipXRatio: 0.15, tipYRatio: -0.03, crestStartX: 0.05, crestEndX: 0.25 }  // GraceWave5
        ];
        
        // Wave / ocean water layers - positioned at very bottom of screen.
        // NOTE: The tiled SVG images each contain a wavy crest on top AND a
        // solid colour body below.  The body is what visually reads as the
        // "ocean water" surface.  To darken or recolour the ocean water you
        // should either edit the SVG fill or adjust the alpha / tint applied
        // when drawing (see drawTiledWave).
        //
        // Layer index → name mapping:
        //   0  backOceanWater    (wave1.svg)  – furthest, slowest
        //   1  midOceanWater     (wave2.svg)  – dark-blue mid layer
        //   2  frontOceanWater   (wave3.svg)  – closest, Zeeb rides this
        //   3  bottomOceanWater  (wave2.svg)  – thin dark strip at bottom
        this.waves = [
            { // [0] backOceanWater (wave1.svg) - furthest, slowest, lighter blue
                name: 'backOceanWater',
                asset: 'wave1.svg',
                offset: 0,
                speed: 120,         // Full speed (ramps from 80% over first 20s)
                heightRatio: 0.50,  // Wave height
                yPosition: 0.55,    // Positioned low to ride the bottom
                surfaceRatio: 0.15,
                bobAmount: 0.008,   // Minimal bob to prevent gap
                bobSpeed: 2.5,      // Much faster bobbing
                bobPhase: 0,
                initialOffset: 0,
                loopCount: 0,
                offsetInitialized: false
            },
            { // [1] midOceanWater (wave2.svg) - dark blue, medium speed
                name: 'midOceanWater',
                asset: 'wave2.svg',
                offset: 0,
                speed: 180,         // Full speed (ramps from 80% over first 20s)
                heightRatio: 0.60,  // Wave height (15% larger)
                yPosition: 0.56,    // Moved a bit further lower on screen
                surfaceRatio: 0.15,
                bobAmount: 0.025,   // Increased bobbing for more realistic motion
                bobSpeed: 2.5,      // Slightly slower for more natural feel
                bobPhase: 1.2,
                initialOffset: 0.35,
                loopCount: 0,
                offsetInitialized: false
            },
            { // [2] frontOceanWater (wave3.svg) - closest, fastest, lighter teal/blue
                // This is the primary ocean water surface the player rides on.
                // Its apparent colour (~#73d5fe) comes from the SVG fill #1e88e5
                // at 80% SVG opacity drawn with 90% canvas alpha over the sky.
                // To darken the ocean water, lower the alpha values or edit wave3.svg fill.
                name: 'frontOceanWater',
                asset: 'wave3.svg',
                offset: 0,
                speed: 300,         // Full speed (ramps from 80% over first 20s)
                heightRatio: 0.62,  // Wave height (15% taller)
                yPosition: 0.57,    // Positioned slightly lower to hide edge
                alpha: 0.9,         // Slightly more translucent to reveal fish
                surfaceRatio: 0.15,
                bobAmount: 0.030,   // More noticeable bobbing for front wave
                bobSpeed: 3.0,      // Natural bobbing speed
                bobPhase: 2.1,
                initialOffset: 0.15,
                loopCount: 0,
                offsetInitialized: false
            },
            { // [3] bottomOceanWater (wave2.svg) - very short dark blue at the bottom
                name: 'bottomOceanWater',
                asset: 'wave2.svg',
                offset: 0,
                speed: 80,          // Full speed (ramps from 80% over first 20s)
                heightRatio: 0.20,  // Slightly taller
                yPosition: 0.85,    // Positioned at very bottom
                yOffsetPx: -20,     // Move wave up ~50px from previous position
                alpha: 0.9,
                surfaceRatio: 0.10,
                bobAmount: 0.003,   // Very minimal bob
                bobSpeed: 2.0,      // Slow bobbing
                bobPhase: 0.6,
                initialOffset: 0.5,
                loopCount: 0,
                offsetInitialized: false
            }
        ];

        this.fish = {
            active: false,
            state: 'alive',
            entrySide: 'left',
            x: -200,
            y: this.height * 0.7,
            width: 120,
            height: 44,
            speed: 0,
            sinkSpeed: 60,
            loopsPerSpawnMin: 3,
            loopsPerSpawnMax: 6,
            nextSpawnLoop: 3,
            rightEntryChance: 0.2,
            depthOffsetRatio: 0.10,
            wiggleTime: 0,
            direction: -1,
            surfaceWaveIndex: 2,
            hitPlayer: false,
            initialSpawnTime: 1.5,     // First fish spawns at 1.5 seconds
            initialSpawnInterval: 2.5, // Spawn every 2.5 seconds in first 10 seconds
            initialPhaseDuration: 10,  // First 10 seconds have frequent fish
            lastInitialSpawn: 0        // Track last spawn time in initial phase
        };
        
        // Create player
        this.player = new Player(this);
        
        // Dangerous wave system
        this.dangerWave = {
            active: false,
            x: 0,                    // Position of danger zone
            width: 120,              // Width of danger zone
            speed: 200,              // Pixels per second (faster than normal waves)
            warningTime: 2.0,        // Seconds of warning before danger hits
            spawnInterval: 5,        // Seconds between danger waves (varies)
            nextSpawnTime: 3,        // Time until next spawn
            color: 'rgba(255, 100, 50, 0.6)', // Warning color
            foamColor: 'rgba(255, 255, 255, 0.9)',
            hitPlayer: false,
            graceTime: 0.25,         // Small delay before wipeout triggers (increased for fairness)
            contactStart: null,
            sizeMultiplier: 2.16,   // 60% larger than previous danger-wave size
            yOffsetRatio: 0.10      // Lower so part of wave sits beyond frame bottom
        };

        this.dangerWaveExtra = {
            active: false,
            x: 0,
            width: 120,
            speed: 200,
            warningTime: 2.0,
            spawnChance: 0.15,       // Base chance to spawn with main wave (scales with score)
            color: 'rgba(255, 100, 50, 0.6)',
            foamColor: 'rgba(255, 255, 255, 0.9)',
            hitPlayer: false,
            graceTime: 0.25,
            contactStart: null,
            sizeMultiplier: 1.45,    // Reverted extra danger-wave size
            yOffsetRatio: 0.10       // Lower so part of wave sits beyond frame bottom
        };

        // Target vertical line where danger-wave tops should align.
        this.dangerWaveHitY = 400;
        
        // Golden wave system removed

        // Island parallax drift (very slow, left to right)
        this.islandDriftX = 0;
        this.islandDriftSpeed = 4; // px/s — super slow background drift

        // Game state
        this.state = 'title';       // 'title' | 'transition' | 'playing' | 'gameover'
        this.transitionTimer = 0;
        this.transitionDuration = 1.2; // seconds for island fade-out
        this.titleMusicTriggered = false; // true after first interaction starts music
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.crashTimer = 0;        // Timer for crash animation
        this.crashDuration = 1.5;   // Seconds to show crash
        
        // Close call bonus feedback
        this.showCloseCall = false;
        this.closeCallTimer = 0;
        
        // Golden wave bonus feedback removed
        
        // Crash animation details
        this.crashAnimation = {
            active: false,
            zeebX: 0,           // Zeeb's position during crash
            zeebY: 0,
            zeebScale: 1,       // Scale for shrinking effect
            zeebRotation: 0,    // Rotation for spinning effect
            waveX: 0,           // The wave that caught Zeeb
            waveWidth: 0,       // Width of the wave
            suctionX: 0,        // Target suction point (C curve)
            suctionY: 0,
            initialX: 0,        // Starting position
            initialY: 0
        };
        
        // Water spray particle system
        this.sprayParticles = [];
        this.sprayConfig = {
            // Continuous wake trail — wide churned-water patches
            wakeRate: 5,
            wakeSpeedX: { min: -55, max: -20 },
            wakeSpeedY: { min: -2, max: 2 },
            wakeLife: 0.9,
            wakeSize: { min: 3, max: 6 },
            // Thin foam lines that trail behind
            foamRate: 3,
            foamSpeedX: { min: -45, max: -15 },
            foamSpeedY: { min: -1.5, max: 1.5 },
            foamLife: 0.7,
            foamSize: { min: 2, max: 4 },
            // Fine water droplets near the board
            dropRate: 2,
            dropSpeedX: { min: -35, max: -8 },
            dropSpeedY: { min: -12, max: -2 },
            dropLife: 0.35,
            dropSize: { min: 1, max: 2.5 },
            // Landing burst
            burstCount: 14,
            burstSpeedX: { min: -80, max: 10 },
            burstSpeedY: { min: -60, max: -10 },
            burstLife: 0.5,
            burstSize: { min: 2, max: 5 },
            burstFoamCount: 8,
            burstFoamSpeedX: { min: -70, max: -10 },
            burstFoamSpeedY: { min: -4, max: 4 },
            burstFoamLife: 0.7,
            burstFoamSize: { min: 4, max: 8 }
        };

        // Animation timing
        this.elapsedTime = 0;
        this.fps = 0;
        this.lastTime = 0;
        this.isLoaded = false;
        this.waveCrests = {};
        this.waveDefs = {
            1: {
                width: 1920,
                height: 300,
                d: 'M0,120c133.3-26.7,266.7-30,400-10,133.3,20,266.7,16.7,400-10s266.7-23.3,400,10c133.3,33.3,266.7,36.7,400,10,133.3-26.7,240-26.7,320,0v180H0V120Z'
            },
            2: {
                width: 1920,
                height: 300,
                d: 'M0,100c100-26.7,206.7-30,320-10,106.7,20,213.3,13.3,320-20,106.7-26.7,213.3-16.7,320,30,106.7,46.7,213.3,50,320,10s213.3-46.7,320-20c106.7,26.7,213.3,30,320,10v200H0V100Z'
            },
            3: {
                width: 1920,
                height: 300,
                d: 'M0,130c53.3-13.3,106.7-18.3,160-15,53.3,6.7,106.7,15,160,25s106.7,8.3,160-5c53.3-13.3,106.7-25,160-35s106.7-11.7,160-5c53.3,10,106.7,23.3,160,40,53.3,20,106.7,33.3,160,40s106.7,5,160-5c53.3-13.3,106.7-25,160-35,53.3-6.7,106.7-8.3,160-5,53.3,6.7,106.7,11.7,160,15,53.3,2,106.7-3,160-15v170H0v-170Z'
            }
        };
        for (let i = 1; i <= 3; i++) {
            this.waveCrests[i] = this.buildCrestMapFromPath(this.waveDefs[i]);
        }
        
        this.showDebug = new URLSearchParams(window.location.search).has('debug');
        
        // Keyboard controls
        // Unlock audio on first user interaction (browsers block autoplay)
        const unlockAudio = () => {
            if (!this.titleMusicTriggered && this.state === 'title') {
                this.titleMusicTriggered = true;
                this.startTitleMusic();
            }
        };
        window.addEventListener('keydown', unlockAudio, { once: true });
        window.addEventListener('click', unlockAudio, { once: true });
        window.addEventListener('touchstart', unlockAudio, { once: true });

        window.addEventListener('keydown', (event) => {
            if (this.state === 'confirm-quit') {
                if (event.key === 'y' || event.key === 'Y' || event.key === 'Enter') {
                    window.location.href = '../../index.html';
                } else if (event.key === 'n' || event.key === 'N' || event.key === 'Escape') {
                    this.state = this.prevState || 'playing';
                }
                return;
            }
            if (event.key === 'p' || event.key === 'P') {
                if (this.state === 'playing') {
                    this.state = 'paused';
                } else if (this.state === 'paused') {
                    this.state = 'playing';
                    this.lastTime = performance.now(); // prevent time jump
                }
                return;
            }
            if (this.state === 'paused') {
                this.state = 'playing';
                this.lastTime = performance.now();
                return;
            }
            if (event.key === 'd' || event.key === 'D') {
                this.showDebug = !this.showDebug;
            } else if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault(); // Prevent page scroll
                if (this.state === 'title') {
                    this.startPlaying();
                } else if (this.state === 'gameover') {
                    this.restartGame();
                } else if (this.state === 'playing' && this.crashTimer <= 0) {
                    this.player.jump();
                }
            }
        });

        // Canvas click/touch handler
        const canvasClick = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const scaleX = this.width / rect.width;
            const scaleY = this.height / rect.height;
            const cx = (clientX - rect.left) * scaleX;
            const cy = (clientY - rect.top) * scaleY;

            // Pause button hit test (playing state only — opens pause menu)
            if (this.state === 'playing') {
                const pb = this.getPauseButtonRect();
                const dx = cx - (pb.x + pb.w / 2);
                const dy = cy - (pb.y + pb.h / 2);
                if (dx * dx + dy * dy <= (pb.w / 2 + 8) ** 2) {
                    this.state = 'paused';
                    e.preventDefault();
                    return;
                }
                // Tap anywhere else to jump (mobile)
                if (this.crashTimer <= 0) {
                    this.player.jump();
                }
                e.preventDefault();
                return;
            }

            // Pause overlay button hit test (Resume / Main Menu)
            if (this.state === 'paused' && this._pauseBtns) {
                const b = this._pauseBtns;
                if (cx >= b.btnX && cx <= b.btnX + b.btnW) {
                    if (cy >= b.resumeY && cy <= b.resumeY + b.btnH) {
                        this.state = 'playing';
                        this.lastTime = performance.now();
                        e.preventDefault();
                        return;
                    }
                    if (cy >= b.menuY && cy <= b.menuY + b.btnH) {
                        window.location.href = '../../index.html';
                        e.preventDefault();
                        return;
                    }
                }
            }

            if (this.state === 'title') {
                this.startPlaying();
                return;
            }
            if (this.state === 'gameover') {
                this.restartGame();
                return;
            }
            if (this.state === 'confirm-quit' && this._confirmBtns) {
                const b = this._confirmBtns;
                if (cy >= b.btnY && cy <= b.btnY + b.btnH) {
                    if (cx >= b.yesX && cx <= b.yesX + b.btnW) {
                        window.location.href = '../../index.html';
                    } else if (cx >= b.noX && cx <= b.noX + b.btnW) {
                        this.state = this.prevState || 'playing';
                    }
                }
            }
        };
        this.canvas.addEventListener('click', canvasClick);
        this.canvas.addEventListener('touchstart', canvasClick);

        // Prevent mobile annoyances on canvas
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Home link — return to main menu
        const homeLink = document.getElementById('homeLink');
        if (homeLink) {
            homeLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.state === 'title') {
                    // On title screen, go straight to main menu
                    window.location.href = '../../index.html';
                    return;
                }
                if (this.state === 'confirm-quit') return;
                this.prevState = this.state;
                this.state = 'confirm-quit';
            });
        }

        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 100);
        });

        // Audio
        this.titleMusic = new Audio('../Audio/The Drums Of Tiki.m4a');
        this.titleMusic.loop = true;
        this.titleMusic.volume = 0;
        this.titleMusicStarted = false;
        this.titleMusicFade = null; // { dir: 'in'|'out', elapsed: 0, duration: 5 }

        this.music = new Audio('../Audio/level 1 music Tidal wave; No ocean sounds.m4a');
        this.music.loop = true;
        this.music.volume = 0.5;
        this.musicStarted = false;
        
        // Load images
        this.loadImages();
    }

    // Create a glowing silhouette canvas for danger wave effects
    getGlowCanvas(img) {
        if (!img || !img.complete || img.naturalWidth <= 0) return null;
        
        // Check cache first
        if (this.glowCache.has(img)) {
            return this.glowCache.get(img);
        }
        
        // Create glow canvas
        const glowCanvas = document.createElement('canvas');
        const glowCtx = glowCanvas.getContext('2d');
        
        // Make canvas larger for blur effect
        const padding = 40; // Extra space for blur
        glowCanvas.width = img.naturalWidth + padding * 2;
        glowCanvas.height = img.naturalHeight + padding * 2;
        
        // Draw the image centered with padding
        glowCtx.drawImage(img, padding, padding, img.naturalWidth, img.naturalHeight);
        
        // Create white silhouette using source-in composite operation
        glowCtx.globalCompositeOperation = 'source-in';
        glowCtx.fillStyle = '#ffffff';
        glowCtx.fillRect(0, 0, glowCanvas.width, glowCanvas.height);
        
        // Apply blur for glow effect
        glowCtx.filter = 'blur(10px)';
        glowCtx.drawImage(glowCanvas, 0, 0);
        
        // Cache and return
        this.glowCache.set(img, glowCanvas);
        return glowCanvas;
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const nextWidth = rect.width || this.baseWidth;
        const nextHeight = rect.height || this.baseHeight;

        this.width = nextWidth;
        this.height = nextHeight;
        this.dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = true;
        this.player.updateLayout();
        if (this.cloudSystem) {
            try {
                this.cloudSystem.resize(this.width, this.height);
            } catch (err) {
                console.warn('Cloud system resize failed; disabling clouds.', err);
                this.cloudSystem = null;
            }
        }
    }

    getWaveMetrics(image, wave) {
        const waveHeight = this.height * wave.heightRatio;
        const waveY = this.height * wave.yPosition + (wave.yOffsetPx || 0);
        let tileWidth = this.width;

        if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
            const scale = waveHeight / image.naturalHeight;
            tileWidth = image.naturalWidth * scale;
        }

        if (!tileWidth || !Number.isFinite(tileWidth)) {
            tileWidth = this.width;
        }

        return {
            waveHeight,
            waveY,
            tileWidth: Math.max(tileWidth, 1)
        };
    }

    getDangerWaveTopY() {
        // Keep a consistent "hit line" around the 400px ruler mark.
        return Math.max(0, Math.min(this.height - 40, this.dangerWaveHitY));
    }
    
    tokenizePath(d) {
        const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
        return tokens || [];
    }

    sampleCubic(p0, p1, p2, p3, steps, visit) {
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            const x =
                mt * mt * mt * p0.x +
                3 * mt * mt * t * p1.x +
                3 * mt * t * t * p2.x +
                t * t * t * p3.x;
            const y =
                mt * mt * mt * p0.y +
                3 * mt * mt * t * p1.y +
                3 * mt * t * t * p2.y +
                t * t * t * p3.y;
            visit(x, y);
        }
    }

    sampleLine(p0, p1, steps, visit) {
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = p0.x + (p1.x - p0.x) * t;
            const y = p0.y + (p1.y - p0.y) * t;
            visit(x, y);
        }
    }

    buildCrestMapFromPath(def) {
        if (!def || !def.d) {
            return null;
        }

        const width = def.width;
        const height = def.height;
        const bins = 1024;
        const crest = new Float32Array(bins);
        crest.fill(Number.POSITIVE_INFINITY);

        const visit = (x, y) => {
            const clampedX = Math.max(0, Math.min(width, x));
            const idx = Math.max(0, Math.min(bins - 1, Math.floor((clampedX / width) * (bins - 1))));
            if (y < crest[idx]) {
                crest[idx] = y;
            }
        };

        const tokens = this.tokenizePath(def.d);
        let i = 0;
        let cmd = '';
        let cx = 0;
        let cy = 0;
        let sx = 0;
        let sy = 0;

        const readNumber = () => {
            const value = parseFloat(tokens[i]);
            i += 1;
            return value;
        };

        while (i < tokens.length) {
            const token = tokens[i];
            if (/^[a-zA-Z]$/.test(token)) {
                cmd = token;
                i += 1;
            }

            if (cmd === 'M' || cmd === 'm') {
                const x = readNumber();
                const y = readNumber();
                cx = cmd === 'm' ? cx + x : x;
                cy = cmd === 'm' ? cy + y : y;
                sx = cx;
                sy = cy;
                visit(cx, cy);
                cmd = cmd === 'm' ? 'l' : 'L';
                continue;
            }

            if (cmd === 'C' || cmd === 'c') {
                const isRel = cmd === 'c';
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const x1 = readNumber();
                    const y1 = readNumber();
                    const x2 = readNumber();
                    const y2 = readNumber();
                    const x = readNumber();
                    const y = readNumber();

                    const p0 = { x: cx, y: cy };
                    const p1 = { x: isRel ? cx + x1 : x1, y: isRel ? cy + y1 : y1 };
                    const p2 = { x: isRel ? cx + x2 : x2, y: isRel ? cy + y2 : y2 };
                    const p3 = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };

                    this.sampleCubic(p0, p1, p2, p3, 40, visit);
                    cx = p3.x;
                    cy = p3.y;
                }
                continue;
            }

            if (cmd === 'L' || cmd === 'l') {
                const isRel = cmd === 'l';
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const x = readNumber();
                    const y = readNumber();
                    const p0 = { x: cx, y: cy };
                    const p1 = { x: isRel ? cx + x : x, y: isRel ? cy + y : y };
                    this.sampleLine(p0, p1, 8, visit);
                    cx = p1.x;
                    cy = p1.y;
                }
                continue;
            }

            if (cmd === 'H' || cmd === 'h') {
                const isRel = cmd === 'h';
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const x = readNumber();
                    const p0 = { x: cx, y: cy };
                    const p1 = { x: isRel ? cx + x : x, y: cy };
                    this.sampleLine(p0, p1, 6, visit);
                    cx = p1.x;
                }
                continue;
            }

            if (cmd === 'V' || cmd === 'v') {
                const isRel = cmd === 'v';
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const y = readNumber();
                    const p0 = { x: cx, y: cy };
                    const p1 = { x: cx, y: isRel ? cy + y : y };
                    this.sampleLine(p0, p1, 6, visit);
                    cy = p1.y;
                }
                continue;
            }

            if (cmd === 'Z' || cmd === 'z') {
                const p0 = { x: cx, y: cy };
                const p1 = { x: sx, y: sy };
                this.sampleLine(p0, p1, 10, visit);
                cx = sx;
                cy = sy;
                continue;
            }

            // Unknown command; skip token to avoid infinite loop.
            i += 1;
        }

        // Fill any empty bins by carrying forward the last known crest.
        let last = height * 0.2;
        for (let idx = 0; idx < bins; idx++) {
            if (!Number.isFinite(crest[idx])) {
                crest[idx] = last;
            } else {
                last = crest[idx];
            }
        }

        // Convert to ratios so they scale with the wave height.
        for (let idx = 0; idx < bins; idx++) {
            crest[idx] = crest[idx] / height;
        }

        return {
            sourceWidth: width,
            values: crest
        };
    }

    getWaveSurfaceY(waveIndex) {
        // Gerstner: use center of screen as X sample point
        if (this.useGerstnerWaves) {
            return this.gerstnerWaves.getSurfaceY(waveIndex, this.width * 0.5, this.width, this.height);
        }
        if (waveIndex < 0 || waveIndex >= this.waves.length) return this.height * 0.5;

        const wave = this.waves[waveIndex];
        const metrics = this.getWaveMetrics(this.images[`wave${waveIndex + 1}`], wave);
        const bob = Math.sin(this.elapsedTime * wave.bobSpeed + (wave.bobPhase || 0)) * (this.height * wave.bobAmount);

        return metrics.waveY + metrics.waveHeight * wave.surfaceRatio + bob;
    }

    getWaveSurfaceYAtX(waveIndex, x) {
        // Gerstner: query exact surface Y at the given X
        if (this.useGerstnerWaves) {
            const y = this.gerstnerWaves.getSurfaceY(waveIndex, x, this.width, this.height);
            const minY = this.height * 0.35;
            const maxY = this.height * 0.85;
            return Math.max(minY, Math.min(maxY, y));
        }
        if (waveIndex < 0 || waveIndex >= this.waves.length) return this.height * 0.5;

        const wave = this.waves[waveIndex];
        const image = this.images[`wave${waveIndex + 1}`];
        const metrics = this.getWaveMetrics(image, wave);
        const bob = Math.sin(this.elapsedTime * wave.bobSpeed + (wave.bobPhase || 0)) * (this.height * wave.bobAmount);
        const crestMap = this.waveCrests[waveIndex + 1];

        if (!crestMap || !crestMap.values) {
            return metrics.waveY + metrics.waveHeight * wave.surfaceRatio + bob;
        }

        const tileWidth = metrics.tileWidth;
        const localX = ((x + wave.offset) % tileWidth + tileWidth) % tileWidth;
        const crestValues = crestMap.values;
        const crestIndex = Math.min(
            crestValues.length - 1,
            Math.max(0, Math.floor((localX / tileWidth) * (crestValues.length - 1)))
        );
        let crestRatio = crestValues[crestIndex];

        // SAFEGUARD: Clamp crest ratio to reasonable bounds (0.1 to 0.6)
        // This prevents extreme Y values from bad crest map data
        crestRatio = Math.max(0.1, Math.min(0.6, crestRatio));

        const surfaceY = metrics.waveY + metrics.waveHeight * crestRatio + bob;

        // SAFEGUARD: Clamp final Y to reasonable screen bounds
        const minY = this.height * 0.35;
        const maxY = this.height * 0.85;
        return Math.max(minY, Math.min(maxY, surfaceY));
    }

    advanceWave(wave, dt, tileWidth) {
        if (!wave) {
            return;
        }

        // Use Gerstner wave system's speed multiplier if available, otherwise fallback
        const speedMultiplier = this.useGerstnerWaves
            ? this.gerstnerWaves.getSpeedMultiplier()
            : (() => {
                const rampDuration = 20;
                const rampStart = 0.8;
                const rampProgress = Math.min(1, this.elapsedTime / rampDuration);
                const ramp = rampStart + (1 - rampStart) * rampProgress;
                const scoreBoost = this.score >= 900 ? 1.4 : 1.0;
                return ramp * scoreBoost;
            })();
        const effectiveSpeed = wave.speed * speedMultiplier;

        if (!tileWidth || !Number.isFinite(tileWidth)) {
            wave.offset += effectiveSpeed * dt;
            return;
        }

        if (!wave.offsetInitialized) {
            wave.offset = tileWidth * (wave.initialOffset || 0);
            wave.offsetInitialized = true;
        }

        const nextOffset = wave.offset + effectiveSpeed * dt;
        const loopsPassed = Math.floor(nextOffset / tileWidth);
        if (loopsPassed > 0) {
            wave.loopCount = (wave.loopCount || 0) + loopsPassed;
        }
        wave.offset = nextOffset % tileWidth;
    }

    spawnFish(frontWave) {
        const scale = Math.max(0.8, Math.min(1.2, Math.min(this.width / 900, this.height / 600)));
        const entrySide = Math.random() < this.fish.rightEntryChance ? 'right' : 'left';
        const direction = entrySide === 'left' ? 1 : -1;
        this.fish.active = true;
        this.fish.state = 'alive';
        this.fish.entrySide = entrySide;
        this.fish.wiggleTime = 0;
        this.fish.hitPlayer = false;
        this.fish.width = 120 * scale;
        this.fish.height = 44 * scale;
        this.fish.direction = direction;
        this.fish.x = entrySide === 'right'
            ? this.width + this.fish.width * 1.6
            : -this.fish.width * 1.6;
        this.fish.speed = frontWave.speed * 1.05 * direction;
        const baseY = this.getWaveSurfaceYAtX(this.fish.surfaceWaveIndex, this.fish.x);
        this.fish.y = baseY + this.height * this.fish.depthOffsetRatio;
    }

    getNextFishSpawnGap() {
        const minGap = Math.min(this.fish.loopsPerSpawnMin, this.fish.loopsPerSpawnMax);
        const maxGap = Math.max(this.fish.loopsPerSpawnMin, this.fish.loopsPerSpawnMax);
        return minGap + Math.floor(Math.random() * (maxGap - minGap + 1));
    }

    updateFish(dt) {
        const frontWave = this.waves[2];
        if (!frontWave) {
            return;
        }

        // Check if we're in the initial 10-second phase with frequent fish spawning
        const inInitialPhase = this.elapsedTime <= this.fish.initialPhaseDuration;
        
        if (!this.fish.active) {
            if (inInitialPhase) {
                // In first 10 seconds: spawn fish more frequently
                if (this.elapsedTime >= this.fish.lastInitialSpawn + this.fish.initialSpawnInterval) {
                    this.spawnFish(frontWave);
                    this.fish.lastInitialSpawn = this.elapsedTime;
                }
            } else {
                // After 10 seconds: use normal loop-based spawning
                if ((frontWave.loopCount || 0) >= this.fish.nextSpawnLoop) {
                    this.spawnFish(frontWave);
                    this.fish.nextSpawnLoop += this.getNextFishSpawnGap();
                }
            }
        }

        if (!this.fish.active) {
            return;
        }

        if (this.fish.state === 'dead') {
            this.fish.y += this.fish.sinkSpeed * dt;
        } else {
            this.fish.x += this.fish.speed * dt;
            this.fish.wiggleTime += dt * 2;
            const baseY = this.getWaveSurfaceYAtX(this.fish.surfaceWaveIndex, this.fish.x);
            const wiggle = Math.sin(this.fish.wiggleTime) * (this.height * 0.01);
            this.fish.y = baseY + this.height * this.fish.depthOffsetRatio + wiggle;
        }

        if (this.fish.state === 'alive' && !this.fish.hitPlayer && !this.gameOver && this.crashTimer <= 0) {
            const zeebX = this.player.x;
            const zeebY = this.player.y;
            const zeebWidth = this.player.surfboardWidth * 0.35;
            const zeebHeight = this.player.getSurfboardHeight() * 0.5;
            const fishWidth = this.fish.width * 0.6;
            const fishHeight = this.fish.height * 0.5;

            const hit =
                Math.abs(zeebX - this.fish.x) < (zeebWidth + fishWidth) * 0.5 &&
                Math.abs(zeebY - this.fish.y) < (zeebHeight + fishHeight) * 0.5;

            if (hit) {
                this.fish.hitPlayer = true;
                this.fish.state = 'dead';
                this.fish.speed = 0; // Dead fish should sink, not swim.
            }
        }

        if (
            (this.fish.direction < 0 && this.fish.x < -this.fish.width * 2) ||
            (this.fish.direction > 0 && this.fish.x > this.width + this.fish.width * 2) ||
            (this.fish.state === 'dead' && this.fish.y > this.height + this.fish.height * 2)
        ) {
            this.fish.active = false;
        }
    }
    
    // ==================== DANGEROUS WAVE SYSTEM ====================
    
    spawnDangerWaveInstance(wave, sizeMultiplier = 1) {
        if (!wave) {
            return;
        }
        wave.active = true;
        wave.x = this.width + 100; // Start off-screen right
        wave.width = (80 + Math.random() * 60) * sizeMultiplier; // Random width 80-140
        wave.heightScale = 0.92 + Math.random() * 0.08; // 92-100% of peak height (consistent since all sprites are same size)
        wave.hitPlayer = false;
        wave.contactStart = null;
        wave.everCleared = false;   // Reset cleared tracking
        wave.pointsAwarded = false; // Reset points tracking
        wave.clearanceY = null;     // Reset clearance height tracking
        
        // Assign rotating danger wave image (GraceWave2, 3, 4)
        if (this.dangerWaveImages.length > 0) {
            const imgIdx = this.dangerWaveImageIndex % this.dangerWaveImages.length;
            wave.img = this.dangerWaveImages[imgIdx];
            wave.imgName = `GraceWave${imgIdx + 2}.png`;
            // Assign per-sprite tip position for crest/foam alignment
            wave.tipPos = this.dangerWaveTipPositions[imgIdx] || this.dangerWaveTipPositions[0];
            this.dangerWaveImageIndex++;
        }
    }

    // Spawn timing scales with score — more waves as you climb
    getDangerSpawnTiming() {
        const s = this.score;
        if (s >= 2000) return { min: 1.5, range: 1.5, extraChance: 0.65 };
        if (s >= 1500) return { min: 2.0, range: 1.5, extraChance: 0.55 };
        if (s >= 900)  return { min: 2.5, range: 2.0, extraChance: 0.45 };
        if (s >= 500)  return { min: 3.0, range: 2.0, extraChance: 0.35 };
        if (s >= 200)  return { min: 3.5, range: 2.5, extraChance: 0.25 };
        return                { min: 4.0, range: 3.0, extraChance: 0.15 };
    }

    spawnDangerWave() {
        this.spawnDangerWaveInstance(this.dangerWave, this.dangerWave.sizeMultiplier || 1);

        const timing = this.getDangerSpawnTiming();
        this.dangerWave.nextSpawnTime = this.elapsedTime + timing.min + Math.random() * timing.range;

        if (Math.random() < timing.extraChance) {
            this.spawnDangerWaveInstance(this.dangerWaveExtra, this.dangerWaveExtra.sizeMultiplier || 1.1);
            // Stagger the extra wave so it comes after the main wave
            this.dangerWaveExtra.x += 250 + Math.random() * 150; // 250-400 pixels behind
        }
    }
    
    updateDangerWave(dt) {
        // Handle crash timer countdown
        if (this.crashTimer > 0) {
            this.crashTimer -= dt;
            if (this.crashTimer <= 0) {
                this.crashTimer = 0;
                this.crashAnimation.active = false;  // Reset crash animation
                
                // Clear all active danger waves for a clean restart
                this.dangerWave.active = false;
                this.dangerWave.hitPlayer = false;
                this.dangerWave.contactStart = null;
                this.dangerWaveExtra.active = false;
                this.dangerWaveExtra.hitPlayer = false;
                this.dangerWaveExtra.contactStart = null;
                // Give player breathing room before next danger wave (scales with score)
                const postCrash = this.getDangerSpawnTiming();
                this.dangerWave.nextSpawnTime = this.elapsedTime + postCrash.min + Math.random() * 1.5;
                
                // Also clear any active fish
                this.fish.active = false;
                
                // Check for game over
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.state = 'gameover';
                }
            }
        }
        
        // Don't spawn new waves if game over or currently crashing
        if (this.gameOver || this.crashTimer > 0) {
            return;
        }
        
        // Spawn new danger wave if it's time
        if (!this.dangerWave.active && this.elapsedTime >= this.dangerWave.nextSpawnTime) {
            this.spawnDangerWave();
        }
        
        // Golden wave spawning removed
        
        this.updateDangerWaveInstance(this.dangerWave, dt);
        this.updateDangerWaveInstance(this.dangerWaveExtra, dt);
        // Golden wave update removed
    }
    
    // Golden wave functions removed

    updateDangerWaveInstance(wave, dt) {
        if (!wave || !wave.active) {
            return;
        }

        // Move danger wave from right to left (boost speed at 900+ points)
        const dangerBoost = this.score >= 900 ? 1.4 : 1.0;
        wave.x -= wave.speed * dangerBoost * dt;

        // Check collision with player
        if (!wave.hitPlayer) {
            // Get Zeeb's actual position on the surfboard (centered on board)
            const zeebX = this.player.x;
            const zeebY = this.player.y;
            
            // Zeeb's collision box (smaller than surfboard, just around Zeeb himself)
            const zeebWidth = this.player.surfboardWidth * 0.3;  // Zeeb is about 30% of board width
            const zeebHeight = this.player.getSurfboardHeight() * 0.6; // Zeeb is about 60% of board height
            const zeebLeft = zeebX - zeebWidth / 2;
            const zeebRight = zeebX + zeebWidth / 2;
            
            // Calculate visual sprite dimensions (must match drawDangerWave)
            const img = wave.img || this.images.dangerWave2;
            const waveHeight = this.height * 0.24 * (wave.sizeMultiplier || 1) * (wave.heightScale || 1);
            let waveWidth = waveHeight;
            if (img.complete && img.naturalWidth > 0) {
                const aspect = img.naturalWidth / img.naturalHeight;
                waveWidth = waveHeight * aspect;
            }
            
            // Sprite is drawn at waveX = dw.x - waveWidth * 0.3
            // The dangerous curl is on the LEFT side of the sprite
            const spriteLeft = wave.x - waveWidth * 0.3;
            
            // Only the left 40% of the sprite is the dangerous curling part
            const dangerousPortionRatio = 0.4;
            const dangerLeft = spriteLeft;
            const dangerRight = spriteLeft + waveWidth * dangerousPortionRatio;
            
            // Wave height for collision
            const waveTop = this.getDangerWaveTopY();
            const waveBottom = this.height;
            
            // Check if danger wave overlaps with Zeeb's position
            const horizontalHit = dangerRight > zeebLeft && dangerLeft < zeebRight;
            
            // Vertical zones for collision detection
            // Player clears if they are ABOVE the wave top at any point during the wave's approach
            const clearanceHeight = waveTop + 20; // Add 20px margin - more forgiving!
            const inDangerZone = zeebY > waveTop + 30; // Only crash if DEEP in the wave (30px below top)
            const playerCleared = zeebY < clearanceHeight; // Player is ABOVE the clearance line
            const recentlyJumped = (this.elapsedTime - this.player.lastJumpTime) <= 0.6;
            
            // Track if player EVER cleared during this wave's approach
            // This handles the case where the wave is faster than the jump arc
            // Check this BEFORE any collision logic - even if wave hasn't reached player yet
            if (playerCleared && (this.player.isJumping || recentlyJumped)) {
                if (!wave.everCleared) {
                    wave.everCleared = true;
                    wave.clearanceY = zeebY; // Track how high they got
                    console.log(`CLEARED! Zeeb at Y=${zeebY.toFixed(0)}, waveTop=${waveTop.toFixed(0)}, clearance=${clearanceHeight.toFixed(0)}`);
                }
            }
            
            // EARLY EXIT: If player ever cleared this wave, they're safe - no crash possible!
            if (wave.everCleared) {
                // Wave was cleared - just need to award points when we overlap
                if (horizontalHit && !wave.pointsAwarded) {
                    wave.hitPlayer = true; // Mark as passed
                    wave.pointsAwarded = true;
                    wave.contactStart = null;
                    
                    // Check for close call bonus - only triggers if BARELY cleared!
                    // Player must be above wave top (positive distance) but within 15px
                    const distanceAboveWave = waveTop - (wave.clearanceY || zeebY);
                    if (distanceAboveWave > 0 && distanceAboveWave < 15) {
                        // Close call! BARELY cleared the wave = bonus points!
                        this.score += 150; // 100 base + 50 close call bonus
                        this.showCloseCall = true;
                        this.closeCallTimer = 1.0; // Show "CLOSE CALL!" for 1 second
                        console.log(`CLOSE CALL! +150 points! (cleared by only ${distanceAboveWave.toFixed(0)}px)`);
                    } else {
                        this.score += 100;
                        console.log(`Nice jump! +100 points (cleared by ${distanceAboveWave.toFixed(0)}px)`);
                    }
                    
                    // Trigger wave-riding animation!
                    this.player.isRidingWave = true;
                    this.player.rideWaveTimer = this.player.rideWaveDuration;
                }
                // Skip all crash checks - player is safe
            } else if (horizontalHit) {
                // Player is horizontally overlapping with wave danger zone and NEVER cleared
                
                if (playerCleared && (this.player.isJumping || recentlyJumped)) {
                    // Currently clearing - mark it!
                    wave.everCleared = true;
                    wave.clearanceY = zeebY;
                    wave.hitPlayer = true;
                    wave.contactStart = null;
                    
                    if (!wave.pointsAwarded) {
                        wave.pointsAwarded = true;
                        const distanceAboveWave = waveTop - zeebY;
                        // Close call only if BARELY cleared (0-15px above wave)
                        if (distanceAboveWave > 0 && distanceAboveWave < 15) {
                            this.score += 150;
                            this.showCloseCall = true;
                            this.closeCallTimer = 1.0;
                            console.log(`CLOSE CALL! +150 points! (cleared by ${distanceAboveWave.toFixed(0)}px)`);
                        } else {
                            this.score += 100;
                            console.log(`Nice jump! +100 points (cleared by ${distanceAboveWave.toFixed(0)}px)`);
                        }
                        this.player.isRidingWave = true;
                        this.player.rideWaveTimer = this.player.rideWaveDuration;
                    }
                } else if (inDangerZone && !this.player.isJumping) {
                    // In danger zone and not jumping - they're gonna crash!
                    if (wave.contactStart === null) {
                        wave.contactStart = this.elapsedTime;
                        console.log(`Contact started - not jumping, zeebY=${zeebY.toFixed(0)} > waveTop+30=${(waveTop+30).toFixed(0)}`);
                    }
                    if (this.elapsedTime - wave.contactStart >= wave.graceTime) {
                        // CRASH! Player didn't jump (after grace delay)
                        wave.hitPlayer = true;
                        this.triggerCrash(wave.x, wave.width);
                        console.log('Wipeout! Didn\'t jump!');
                    }
                } else if (inDangerZone && this.player.isJumping && this.player.velocityY > 0) {
                    // In danger zone, jumping but going DOWN and NEVER cleared - didn't make it!
                    if (wave.contactStart === null) {
                        wave.contactStart = this.elapsedTime;
                        console.log(`Contact started - falling, zeebY=${zeebY.toFixed(0)}, vel=${this.player.velocityY.toFixed(0)}`);
                    }
                    if (this.elapsedTime - wave.contactStart >= wave.graceTime * 0.5) {
                        wave.hitPlayer = true;
                        this.triggerCrash(wave.x, wave.width);
                        console.log('Wipeout! Jump was not high enough!');
                    }
                }
                // If jumping and still rising, they're safe (might still clear)
            } else {
                wave.contactStart = null;
            }
        }

        // Remove danger wave when it goes off-screen
        if (wave.x < -wave.width) {
            wave.active = false;
        }
    }
    
    triggerCrash(waveX = null, waveWidth = null) {
        this.lives--;
        this.crashTimer = this.crashDuration;
        console.log(`CRASH! Lives remaining: ${this.lives}`);
        
        // Setup crash animation
        this.crashAnimation.active = true;
        this.crashAnimation.initialX = this.player.x;
        this.crashAnimation.initialY = this.player.y;
        this.crashAnimation.zeebX = this.player.x;
        this.crashAnimation.zeebY = this.player.y;
        this.crashAnimation.zeebScale = 1;
        this.crashAnimation.zeebRotation = 0;
        
        // Calculate suction point (left side of wave, in the C curve)
        if (waveX !== null && waveWidth !== null) {
            const visualOffset = waveWidth * 0.3;
            // The C curve is on the left side of the wave
            this.crashAnimation.suctionX = waveX - visualOffset - waveWidth * 0.7;
            // Pull toward the middle height of the wave
            this.crashAnimation.suctionY = this.height * 0.75;
            this.crashAnimation.waveX = waveX;
            this.crashAnimation.waveWidth = waveWidth;
        } else {
            // Fallback if wave position not provided
            this.crashAnimation.suctionX = this.width * 0.7;
            this.crashAnimation.suctionY = this.height * 0.75;
        }
    }
    
    drawDangerWave(ctx, wave) {
        if (!wave || !wave.active) return;
        
        const dw = wave;
        const img = wave.img || this.images.dangerWave2; // Use wave's assigned image, fallback to GraceWave2
        
        ctx.save();
        
        // Calculate wave size - keep it low in the frame
        const waveHeight = this.height * 0.24 * (dw.sizeMultiplier || 1) * (dw.heightScale || 1); // 24% peak height
        let waveWidth = waveHeight; // Default square aspect
        
        // Use actual image aspect ratio if loaded
        if (img.complete && img.naturalWidth > 0) {
            const aspect = img.naturalWidth / img.naturalHeight;
            waveWidth = waveHeight * aspect;
        }
        
        // Position the wave so bottom edge touches screen bottom
        const waveY = this.getDangerWaveTopY();
        const waveX = dw.x - waveWidth * 0.3; // Offset so curl hits at dw.x
        
        // Add subtle bobbing animation
        const bob = Math.sin(this.elapsedTime * 4) * 3;
        
        // Optional squash animation for more dynamic feel
        const squashScale = 1 + Math.sin(this.elapsedTime * 4) * 0.05;
        
        // === LAYER 1: Soft glow behind the wave ===
        if (img.complete && img.naturalWidth > 0) {
            const glowCanvas = this.getGlowCanvas(img);
            if (glowCanvas) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.2;
                
                // Draw glow just slightly larger for subtle edge separation
                const glowScale = 1.05;
                const glowWidth = waveWidth * glowScale;
                const glowHeight = waveHeight * glowScale * squashScale;
                const glowOffsetX = (glowWidth - waveWidth) / 2;
                const glowOffsetY = (glowHeight - waveHeight) / 2;
                
                ctx.drawImage(
                    glowCanvas,
                    waveX - glowOffsetX,
                    waveY + bob - glowOffsetY,
                    glowWidth,
                    glowHeight
                );
                ctx.restore();
            }
        }
        
        // === LAYER 2: Base sprite ===
        if (img.complete && img.naturalWidth > 0) {
            // Apply squash scale for dynamic animation
            ctx.save();
            ctx.translate(waveX + waveWidth/2, waveY + bob + waveHeight);
            ctx.scale(1, squashScale);
            ctx.drawImage(
                img,
                -waveWidth/2,
                -waveHeight,
                waveWidth,
                waveHeight
            );
            ctx.restore();
        } else {
            // Fallback if image not loaded - simple curved shape
            ctx.fillStyle = 'rgba(64, 164, 223, 0.8)';
            ctx.beginPath();
            ctx.arc(dw.x, this.height * 0.5, 60, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // === LAYER 3: Foam accent particles across entire wave ===
        // Scattered white dots distributed across the wave sprite for a natural foam look
        ctx.save();
        const particleCount = 14;

        for (let i = 0; i < particleCount; i++) {
            const seed = i * 137.5;
            const timeOffset = seed + this.elapsedTime * 2;

            // Distribute particles across the full wave area
            // Use golden-ratio-based spacing for natural scatter
            const rawX = (i * 0.618033988) % 1; // golden ratio mod 1 for even spread
            const rawY = ((i * 0.414213562) + 0.1) % 0.85; // silver ratio for Y, clamped to wave body

            // Map to wave sprite coordinates
            const px = waveX + waveWidth * (0.05 + rawX * 0.85);
            // Concentrate more particles in upper portion where foam naturally appears
            const yBias = rawY * rawY; // Quadratic bias toward top
            const py = waveY + bob + waveHeight * (0.05 + yBias * 0.65) + Math.sin(timeOffset) * 2;

            // Gentle flicker effect — each particle twinkles independently
            const flicker = Math.sin(timeOffset * 3 + seed) * 0.5 + 0.5;
            const radius = 0.6 + (Math.sin(timeOffset * 2 + seed) + 1) * 0.6;

            ctx.globalAlpha = 0.15 + flicker * 0.25;
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 2;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.25)';

            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        
        ctx.restore();
    }
    
    drawCrashEffect(ctx) {
        if (this.crashTimer <= 0) return;
        
        const progress = 1 - (this.crashTimer / this.crashDuration);  // 0 to 1 as animation progresses
        
        // Ease functions for smooth animation
        const easeInQuad = (t) => t * t;
        const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
        
        ctx.save();
        
        // Screen shake effect (less intense)
        const shake = Math.sin(this.crashTimer * 30) * 5 * (1 - progress);
        ctx.translate(shake, shake * 0.5);
        
        // Red flash overlay (fades out)
        ctx.fillStyle = `rgba(255, 0, 0, ${(1 - progress) * 0.2})`;
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.restore();
        
        // Animate Zeeb getting sucked into the wave
        if (this.crashAnimation.active) {
            ctx.save();
            
            // Update Zeeb's position - pulled toward the C curve
            const pullProgress = easeInQuad(progress);
            this.crashAnimation.zeebX = this.crashAnimation.initialX + 
                (this.crashAnimation.suctionX - this.crashAnimation.initialX) * pullProgress;
            this.crashAnimation.zeebY = this.crashAnimation.initialY + 
                (this.crashAnimation.suctionY - this.crashAnimation.initialY) * pullProgress;
            
            // Spinning effect - accelerates as he gets sucked in
            this.crashAnimation.zeebRotation = progress * progress * Math.PI * 8; // Multiple full rotations
            
            // Shrinking effect - gets smaller as he spins away
            this.crashAnimation.zeebScale = 1 - (progress * 0.9); // Shrinks to 10% size
            
            // Draw Zeeb spinning and shrinking
            const zeebSize = this.player.getSurfboardHeight();
            const drawWidth = this.player.surfboardWidth * this.crashAnimation.zeebScale;
            const drawHeight = zeebSize * this.crashAnimation.zeebScale;
            
            ctx.translate(this.crashAnimation.zeebX, this.crashAnimation.zeebY);
            ctx.rotate(this.crashAnimation.zeebRotation);
            
            // Add spiral motion for more dramatic effect
            const spiralOffset = Math.sin(progress * Math.PI * 6) * (30 * (1 - progress));
            ctx.translate(spiralOffset, 0);
            
            // Fade out as he gets sucked in
            ctx.globalAlpha = 1 - (progress * 0.7);
            
            // Draw Zeeb's surfboard (includes Zeeb)
            if (this.player.surfboardImage.complete && this.player.surfboardImage.naturalWidth > 0) {
                ctx.drawImage(
                    this.player.surfboardImage,
                    -drawWidth / 2,
                    -drawHeight / 2,
                    drawWidth,
                    drawHeight
                );
            }
            
            ctx.restore();
        }
        
        // "WIPEOUT!" text appears after Zeeb starts spinning away
        if (progress > 0.3) {
            ctx.save();
            const textProgress = (progress - 0.3) / 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${easeOutQuad(textProgress)})`;
            ctx.font = "bold 48px 'Lilita One', Arial";
            ctx.textAlign = 'center';
            ctx.fillText('WIPEOUT!', this.width / 2, this.height / 2);
            ctx.restore();
        }
    }
    
    drawPauseOverlay() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, this.width, this.height);

        // Dialog box
        const boxW = 300;
        const boxH = 170;
        const boxX = (this.width - boxW) / 2;
        const boxY = (this.height - boxH) / 2;

        ctx.fillStyle = 'rgba(10, 20, 40, 0.92)';
        ctx.strokeStyle = 'rgba(100, 170, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 12);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.fillStyle = 'white';
        ctx.font = "48px 'Lilita One', 'Boogaloo', Arial";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', this.width / 2, boxY + 45);

        // Resume button
        const btnW = 200;
        const btnH = 38;
        const resumeY = boxY + 85;
        const btnX = (this.width - btnW) / 2;

        ctx.fillStyle = 'rgba(30, 100, 60, 0.8)';
        ctx.strokeStyle = 'rgba(80, 200, 120, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btnX, resumeY, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 16px 'Lilita One', Arial";
        ctx.fillText('Resume', this.width / 2, resumeY + btnH / 2);

        // Main Menu button
        const menuY = resumeY + btnH + 10;

        ctx.fillStyle = 'rgba(80, 50, 30, 0.8)';
        ctx.strokeStyle = 'rgba(200, 150, 80, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btnX, menuY, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText('Main Menu', this.width / 2, menuY + btnH / 2);

        ctx.restore();

        // Store button rects for click detection
        this._pauseBtns = { btnX, btnW, btnH, resumeY, menuY };
    }

    // Pause button geometry (top-right, below score)
    getPauseButtonRect() {
        const size = 36;
        const padding = 14;
        return { x: this.width - size - padding, y: 50, w: size, h: size };
    }

    drawPauseButton(ctx) {
        if (this.state !== 'playing' && this.state !== 'paused') return;
        const { x, y, w, h } = this.getPauseButtonRect();
        ctx.save();
        // Semi-transparent background circle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w / 2 + 2, 0, Math.PI * 2);
        ctx.fill();
        // Icon
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        if (this.state === 'paused') {
            // Play triangle ▶
            ctx.beginPath();
            ctx.moveTo(x + w * 0.3, y + h * 0.2);
            ctx.lineTo(x + w * 0.8, y + h * 0.5);
            ctx.lineTo(x + w * 0.3, y + h * 0.8);
            ctx.closePath();
            ctx.fill();
        } else {
            // Pause bars ⏸
            const barW = w * 0.2;
            const barH = h * 0.55;
            const barY = y + h * 0.225;
            ctx.fillRect(x + w * 0.25, barY, barW, barH);
            ctx.fillRect(x + w * 0.55, barY, barW, barH);
        }
        ctx.restore();
    }

    drawConfirmQuit() {
        const ctx = this.ctx;
        // Dim overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, this.width, this.height);

        // Dialog box
        const boxW = 340;
        const boxH = 150;
        const boxX = (this.width - boxW) / 2;
        const boxY = (this.height - boxH) / 2;

        ctx.fillStyle = 'rgba(10, 20, 40, 0.92)';
        ctx.strokeStyle = 'rgba(100, 170, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 12);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 22px Boogaloo, cursive";
        ctx.fillText('Return to Main Menu?', this.width / 2, boxY + 40);

        // Yes button
        const btnW = 100;
        const btnH = 36;
        const btnY = boxY + 85;
        const yesX = this.width / 2 - btnW - 15;
        const noX = this.width / 2 + 15;

        ctx.fillStyle = 'rgba(30, 100, 60, 0.8)';
        ctx.strokeStyle = 'rgba(80, 200, 120, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(yesX, btnY, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 16px 'Lilita One', Arial";
        ctx.fillText('Yes', yesX + btnW / 2, btnY + btnH / 2);

        // No button
        ctx.fillStyle = 'rgba(100, 30, 30, 0.8)';
        ctx.strokeStyle = 'rgba(200, 80, 80, 0.6)';
        ctx.beginPath();
        ctx.roundRect(noX, btnY, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText('No', noX + btnW / 2, btnY + btnH / 2);

        ctx.restore();

        // Store button rects for click detection
        this._confirmBtns = { yesX, noX, btnY, btnW, btnH };
    }

    drawGameUI(ctx) {
        ctx.save();
        
        // Score display (top right)
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 3;
        ctx.font = "bold 24px 'Lilita One', Arial";
        ctx.textAlign = 'right';
        ctx.strokeText(`Score: ${this.score}`, this.width - 20, 35);
        ctx.fillText(`Score: ${this.score}`, this.width - 20, 35);
        
        // Lives display (top left)
        ctx.textAlign = 'left';
        ctx.font = "24px 'Lilita One', Arial";
        const livesText = `Lives: ${Math.max(0, this.lives)}`;
        ctx.strokeText(livesText, 20, 35);
        ctx.fillText(livesText, 20, 35);
        
        // Close call bonus feedback (animated text)
        if (this.showCloseCall && this.closeCallTimer > 0) {
            const progress = 1 - (this.closeCallTimer / 1.0); // 0 to 1 over 1 second
            
            // Green color for success, fades out
            const alpha = Math.max(0, 1 - progress);
            ctx.fillStyle = `rgba(50, 255, 100, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 100, 0, ${alpha})`;
            ctx.lineWidth = 4;
            
            // Text rises and grows as it fades
            const rise = progress * 30; // Rise 30 pixels
            const scale = 1 + progress * 0.3; // Grow 30% larger
            
            ctx.font = `bold ${Math.floor(32 * scale)}px 'Lilita One', Arial`;
            ctx.textAlign = 'center';
            
            const textY = this.height * 0.35 - rise;
            ctx.strokeText('CLOSE CALL! +150', this.width / 2, textY);
            ctx.fillText('CLOSE CALL! +150', this.width / 2, textY);
        }
        
        // Golden wave bonus feedback removed
        
        // Game over overlay
        if (this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.width, this.height);
            
            ctx.fillStyle = 'white';
            ctx.font = "bold 48px Boogaloo, cursive";
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);
            
            ctx.font = "24px 'Lilita One', Arial";
            ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 20);
            ctx.fillText('Press SPACE to restart', this.width / 2, this.height / 2 + 60);
        }
        
        ctx.restore();
    }
    
    spawnSpray(x, y, type) {
        const cfg = this.sprayConfig;
        const rnd = Math.random;
        const lerp = (a, b) => a + rnd() * (b - a);

        const push = (kind, spdX, spdY, life, sz, count, spreadX, spreadY) => {
            for (let i = 0; i < count; i++) {
                this.sprayParticles.push({
                    kind,
                    x: x + (rnd() - 0.5) * (spreadX || 8),
                    y: y + (rnd() - 0.5) * (spreadY || 4),
                    vx: lerp(spdX.min, spdX.max),
                    vy: lerp(spdY.min, spdY.max),
                    life: 0,
                    maxLife: life * (0.7 + rnd() * 0.6),
                    size: lerp(sz.min, sz.max),
                    rot: rnd() * Math.PI * 2
                });
            }
        };

        if (type === 'burst') {
            // Water droplets arcing up
            push('drop', cfg.burstSpeedX, cfg.burstSpeedY, cfg.burstLife, cfg.burstSize, cfg.burstCount, 20, 8);
            // Wider foam patches from impact
            push('wake', cfg.burstFoamSpeedX, cfg.burstFoamSpeedY, cfg.burstFoamLife, cfg.burstFoamSize, cfg.burstFoamCount, 16, 6);
        } else {
            // Churned water trail — wide semi-transparent patches
            push('wake', cfg.wakeSpeedX, cfg.wakeSpeedY, cfg.wakeLife, cfg.wakeSize, cfg.wakeRate, 8, 6);
            // Thin foam lines trailing behind
            push('foam', cfg.foamSpeedX, cfg.foamSpeedY, cfg.foamLife, cfg.foamSize, cfg.foamRate, 6, 3);
            // Fine droplets kicked up near the board
            push('drop', cfg.dropSpeedX, cfg.dropSpeedY, cfg.dropLife, cfg.dropSize, cfg.dropRate, 10, 4);
        }
    }

    updateSpray(dt) {
        for (let i = this.sprayParticles.length - 1; i >= 0; i--) {
            const p = this.sprayParticles[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.sprayParticles.splice(i, 1);
                continue;
            }
            if (p.kind === 'drop') {
                // Droplets arc up then fall back to water
                p.vy += 120 * dt;
            } else {
                // Wake and foam drift horizontally in the water
                p.vy *= (1 - 1.5 * dt);
            }
            p.vx *= (1 - 0.4 * dt);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    drawSpray(ctx) {
        if (this.sprayParticles.length === 0) return;
        ctx.save();
        ctx.shadowBlur = 0;

        for (const p of this.sprayParticles) {
            const t = p.life / p.maxLife;
            const fadeOut = 1 - t;
            const r = p.size * (1 + t * 0.4); // Grow slightly as they spread

            if (p.kind === 'wake') {
                // Churned water — soft blue-white ellipses that widen over time
                ctx.globalAlpha = fadeOut * 0.3;
                ctx.fillStyle = 'rgba(200, 230, 250, 0.6)';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, r * 1.8, r * 0.8, 0, 0, Math.PI * 2);
                ctx.fill();
                // White highlight in center
                ctx.globalAlpha = fadeOut * 0.2;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.kind === 'foam') {
                // Thin white foam lines trailing behind
                ctx.globalAlpha = fadeOut * 0.35;
                ctx.fillStyle = 'rgba(230, 245, 255, 0.7)';
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.beginPath();
                ctx.ellipse(0, 0, r * 2.2, r * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (p.kind === 'drop') {
                // Water droplets — small bright circles
                ctx.globalAlpha = fadeOut * 0.5;
                ctx.fillStyle = 'rgba(210, 235, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
                ctx.fill();
                // Bright specular highlight
                ctx.globalAlpha = fadeOut * 0.35;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(p.x - r * 0.15, p.y - r * 0.15, r * 0.25, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    restartGame() {
        this.state = 'playing';
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.crashTimer = 0;
        this.sprayParticles = [];
        this.dangerWave.active = false;
        this.dangerWave.nextSpawnTime = this.elapsedTime + 3;
        // Golden wave reset removed
        this.player.currentWaveIndex = 2;
        this.player.targetWaveIndex = 2;
        this.player.isJumping = false;
        this.player.jumpCount = 0;
        this.player.velocityY = 0;
        // Reset fish spawning for initial phase
        this.fish.lastInitialSpawn = 0;
        const frontWave = this.waves[2];
        this.fish.nextSpawnLoop = Math.ceil((frontWave.loopCount || 0)) + this.getNextFishSpawnGap();
        this.player.beginEntry();
    }

    drawFish(ctx) {
        if (!this.fish.active) {
            return;
        }

        ctx.save();
        ctx.globalAlpha = 0.9;

        // Swap the image selection - fish entering from left should use right-facing image
        const fishImage = this.fish.state === 'dead'
            ? (this.fish.entrySide === 'left' ? this.images.fishDeadRight : this.images.fishDeadLeft)
            : (this.fish.entrySide === 'left' ? this.images.fishAliveRight : this.images.fishAliveLeft);

        if (fishImage.complete && fishImage.naturalWidth > 0) {
            ctx.save();
            ctx.drawImage(
                fishImage,
                this.fish.x - this.fish.width * 0.5,
                this.fish.y - this.fish.height * 0.6,
                this.fish.width,
                this.fish.height
            );
            ctx.restore();
        } else {
            ctx.fillStyle = '#7aa7c7';
            ctx.beginPath();
            ctx.ellipse(
                this.fish.x,
                this.fish.y,
                this.fish.width * 0.5,
                this.fish.height * 0.5,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();
    }

    drawTiledWave(image, metrics, offset, yOffset = 0, alpha = 1, waveIndex = 0) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        if (!image || !image.complete || image.naturalWidth <= 0) {
            // Fallback: Draw colored rectangles if waves don't load
            const colors = ['#4A90E2', '#357ABD', '#2E5A8E', '#1a3a5c'];
            this.ctx.fillStyle = colors[waveIndex % colors.length];
            this.ctx.fillRect(0, metrics.waveY + yOffset, this.width, metrics.waveHeight);
            this.ctx.restore();
            return;
        }

        const tileWidth = metrics.tileWidth;
        const tileHeight = metrics.waveHeight;
        const yPos = metrics.waveY + yOffset;

        // Calculate starting position and snap to integer pixels to prevent
        // sub-pixel gaps between tiles (which cause hairline seams).
        const normalizedOffset = ((offset % tileWidth) + tileWidth) % tileWidth;
        const startX = Math.round(-normalizedOffset - tileWidth);
        const roundedTileWidth = Math.round(tileWidth);
        const roundedYPos = Math.round(yPos);
        const drawHeight = Math.round(tileHeight) + 1;

        // Rasterize overlapping SVG copies to a cached canvas so the
        // anti-aliased edges at the SVG viewBox boundary overlap each other.
        // We then source-clip the clean interior — no seams.
        const pad = 4;
        const cacheKey = `_tileCache_${waveIndex}`;
        let cached = this[cacheKey];
        if (!cached || cached.w !== roundedTileWidth || cached.h !== drawHeight) {
            const offscreen = document.createElement('canvas');
            offscreen.width = roundedTileWidth + pad * 2;
            offscreen.height = drawHeight;
            const offCtx = offscreen.getContext('2d');
            // Draw 3 copies so the center tile's edges are covered by neighbors
            offCtx.drawImage(image, pad - roundedTileWidth, 0, roundedTileWidth, drawHeight);
            offCtx.drawImage(image, pad, 0, roundedTileWidth, drawHeight);
            offCtx.drawImage(image, pad + roundedTileWidth, 0, roundedTileWidth, drawHeight);
            cached = { canvas: offscreen, w: roundedTileWidth, h: drawHeight, pad };
            this[cacheKey] = cached;
        }

        for (let x = startX; x < this.width + roundedTileWidth; x += roundedTileWidth) {
            // Source-clip from the interior (skipping the padded edges)
            this.ctx.drawImage(
                cached.canvas,
                pad, 0, roundedTileWidth, drawHeight,
                x, roundedYPos, roundedTileWidth, drawHeight
            );
        }

        this.ctx.restore();
    }
    
    loadImages() {
        let loadCount = 0;
        const totalImages = 15; // sky + 2 islands + 4 waves + 4 fish + 4 dangerWaves
        let playerLoaded = false;
        
        const checkLoaded = () => {
            loadCount++;
            if (loadCount === totalImages && playerLoaded) {
                this.isLoaded = true;
                console.log('All images loaded');
                this.start();
            }
        };
        
        // Load player images (just the surfboard with Zeeb)
        this.player.loadImages(() => {
            playerLoaded = true;
            if (loadCount === totalImages) {
                this.isLoaded = true;
                console.log('All images loaded');
                this.start();
            }
        });
        
        // Load sky
        this.images.sky.onload = checkLoaded;
        this.images.sky.onerror = () => {
            console.error('Failed to load sky.jpeg');
            checkLoaded();
        };
        const versionTag = this.assetVersion ? `?v=${this.assetVersion}` : '';
        this.images.sky.src = `../img/sky.jpeg${versionTag}`;
        
        // Load island (left)
        this.images.islandLeft.onload = checkLoaded;
        this.images.islandLeft.onerror = () => {
            console.error('Failed to load Island Left.svg');
            checkLoaded();
        };
        this.images.islandLeft.src = `../img/Island Left.svg${versionTag}`;

        // Load island (right)
        this.images.islandRight.onload = checkLoaded;
        this.images.islandRight.onerror = () => {
            console.error('Failed to load Island Right.svg');
            checkLoaded();
        };
        this.images.islandRight.src = `../img/Island Right.svg${versionTag}`;
        
        // Load waves (SVG files)
        this.images.wave1.onload = checkLoaded;
        this.images.wave1.onerror = () => {
            console.error('Failed to load wave1.svg');
            checkLoaded();
        };
        this.images.wave1.src = `../img/wave1.svg${versionTag}`;
        
        this.images.wave2.onload = checkLoaded;
        this.images.wave2.onerror = () => {
            console.error('Failed to load wave2.svg');
            checkLoaded();
        };
        this.images.wave2.src = `../img/wave2.svg${versionTag}`;
        
        this.images.wave3.onload = checkLoaded;
        this.images.wave3.onerror = () => {
            console.error('Failed to load wave3.svg');
            checkLoaded();
        };
        this.images.wave3.src = `../img/wave3.svg${versionTag}`;
        
        // Load wave4 using wave2.svg (dark blue bottom wave)
        this.images.wave4.onload = checkLoaded;
        this.images.wave4.onerror = () => {
            console.error('Failed to load wave2.svg for wave4');
            checkLoaded();
        };
        this.images.wave4.src = `../img/wave2.svg${versionTag}`;

        this.images.fishAliveLeft.onload = checkLoaded;
        this.images.fishAliveLeft.onerror = () => {
            console.error('Failed to load alive_fish_left.svg');
            checkLoaded();
        };
        this.images.fishAliveLeft.src = `../img/alive_fish_left.svg${versionTag}`;

        this.images.fishAliveRight.onload = checkLoaded;
        this.images.fishAliveRight.onerror = () => {
            console.error('Failed to load alive_fish_right.svg');
            checkLoaded();
        };
        this.images.fishAliveRight.src = `../img/alive_fish_right.svg${versionTag}`;

        this.images.fishDeadLeft.onload = checkLoaded;
        this.images.fishDeadLeft.onerror = () => {
            console.error('Failed to load dead_fish.svg');
            checkLoaded();
        };
        this.images.fishDeadLeft.src = `../img/dead_fish.svg${versionTag}`;

        this.images.fishDeadRight.onload = checkLoaded;
        this.images.fishDeadRight.onerror = () => {
            console.error('Failed to load dead_fish_right.svg');
            checkLoaded();
        };
        this.images.fishDeadRight.src = `../img/dead_fish_right.svg${versionTag}`;
        
        // Load danger wave images - GraceWave2, 3, 4 (rotated between spawns)
        this.images.dangerWave2.onload = checkLoaded;
        this.images.dangerWave2.onerror = () => {
            console.error('Failed to load GraceWave2.png');
            checkLoaded();
        };
        this.images.dangerWave2.src = `../img/GraceWave2.png${versionTag}`;
        
        this.images.dangerWave3.onload = checkLoaded;
        this.images.dangerWave3.onerror = () => {
            console.error('Failed to load GraceWave3.png');
            checkLoaded();
        };
        this.images.dangerWave3.src = `../img/GraceWave3.png${versionTag}`;
        
        this.images.dangerWave4.onload = checkLoaded;
        this.images.dangerWave4.onerror = () => {
            console.error('Failed to load GraceWave4.png');
            checkLoaded();
        };
        this.images.dangerWave4.src = `../img/GraceWave4.png${versionTag}`;
        
        this.images.dangerWave5.onload = checkLoaded;
        this.images.dangerWave5.onerror = () => {
            console.error('Failed to load GraceWave5.png');
            checkLoaded();
        };
        this.images.dangerWave5.src = `../img/GraceWave5.png${versionTag}`;
    }
    
    updateTitle(deltaTime) {
        const dt = Math.min(deltaTime / 1000, 0.05);
        this.elapsedTime += dt;

        // Animate clouds
        if (this.cloudSystem) {
            try {
                this.cloudSystem.update(dt);
            } catch (err) {
                this.cloudSystem = null;
            }
        }

        // Animate wave layers
        if (this.useGerstnerWaves) {
            this.gerstnerWaves.update(dt, this.elapsedTime, this.score);
        }
        for (let i = 0; i < this.waves.length; i++) {
            const wave = this.waves[i];
            const image = this.images[`wave${i + 1}`];
            const metrics = this.getWaveMetrics(image, wave);
            this.advanceWave(wave, dt, metrics.tileWidth);
        }

        // Title music fade
        this.updateTitleMusicFade(dt);

        if (dt > 0) {
            this.fps = 1 / dt;
        }
    }

    drawTitle() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Sky background (full opacity + cyan gradient overlay)
        const hasSky = this.images.sky.complete && this.images.sky.naturalWidth > 0;
        if (hasSky) {
            ctx.drawImage(this.images.sky, 0, 0, this.width, this.height);
        } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#98D8E8');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Clouds
        if (this.cloudSystem) {
            try {
                this.cloudSystem.draw(ctx);
            } catch (err) {
                this.cloudSystem = null;
            }
        }

        // Horizon
        this.drawHorizon();

        // Islands (gentle pulsate)
        const s = 1.0 + Math.sin(this.elapsedTime * 1.5) * 0.02;
        const islandLeftImg = this.images.islandLeft;
        if (islandLeftImg.complete && islandLeftImg.naturalWidth > 0) {
            const pixelsPerInch = 96;
            const baseH = pixelsPerInch * 1;
            const islandAspect = islandLeftImg.naturalWidth / islandLeftImg.naturalHeight;
            const baseW = baseH * islandAspect;
            const baseX = this.width * 0.08;
            const baseY = 400 * 0.75;
            const drawW = baseW * s;
            const drawH = baseH * s;
            const drawX = baseX - (drawW - baseW) / 2;
            const drawY = baseY - (drawH - baseH) / 2;
            ctx.drawImage(islandLeftImg, drawX, drawY, drawW, drawH);

            const islandRightImg = this.images.islandRight;
            if (islandRightImg.complete && islandRightImg.naturalWidth > 0) {
                const rightAspect = islandRightImg.naturalWidth / islandRightImg.naturalHeight;
                const rightBaseW = baseH * rightAspect;
                const rightBaseX = this.width * 0.92 - rightBaseW;
                const rightBaseY = 425 * 0.75;
                const rightDrawW = rightBaseW * s;
                const rightDrawH = baseH * s;
                const rightDrawX = rightBaseX - (rightDrawW - rightBaseW) / 2;
                const rightDrawY = rightBaseY - (rightDrawH - baseH) / 2;
                ctx.drawImage(islandRightImg, rightDrawX, rightDrawY, rightDrawW, rightDrawH);
            }
        }

        // Wave layers (no fish, no danger waves)
        if (this.useGerstnerWaves) {
            for (let i = 0; i < this.gerstnerWaves.layers.length; i++) {
                if (this.visibleWaveLayers.includes(i)) {
                    this.gerstnerWaves.drawLayer(this.ctx, i, this.width, this.height);
                }
            }
        } else {
            for (let i = 0; i < this.waves.length; i++) {
                const wave = this.waves[i];
                const image = this.images[`wave${i + 1}`];
                const metrics = this.getWaveMetrics(image, wave);
                const bob = Math.sin(this.elapsedTime * wave.bobSpeed + (wave.bobPhase || 0)) * (this.height * wave.bobAmount);
                const alpha = wave.alpha ?? 1;
                if (this.visibleWaveLayers.includes(i)) {
                    this.drawTiledWave(image, metrics, wave.offset, bob, alpha, i);
                }
            }
        }

        // Dark gradient overlay for text readability
        ctx.save();
        const overlay = ctx.createLinearGradient(0, 0, 0, this.height * 0.55);
        overlay.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        overlay.addColorStop(0.6, 'rgba(0, 0, 0, 0.15)');
        overlay.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, this.width, this.height * 0.55);
        ctx.restore();

        // Title text: "Zeeb's Island Adventure"
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow / glow
        ctx.shadowColor = 'rgba(0, 80, 180, 0.6)';
        ctx.shadowBlur = 20;

        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 52px Boogaloo, cursive";
        ctx.fillText("Zeeb's Island Adventure", this.width / 2, this.height * 0.22);

        // Second pass for sharper text (no shadow)
        ctx.shadowBlur = 0;
        ctx.fillText("Zeeb's Island Adventure", this.width / 2, this.height * 0.22);

        ctx.restore();

    }

    drawTransition() {
        const ctx = this.ctx;
        const t = Math.min(1, this.transitionTimer / this.transitionDuration);
        // Ease-in-out curve
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Draw the same scene as title (sky, clouds, horizon, waves)
        ctx.clearRect(0, 0, this.width, this.height);

        const hasSky = this.images.sky.complete && this.images.sky.naturalWidth > 0;
        if (hasSky) {
            ctx.drawImage(this.images.sky, 0, 0, this.width, this.height);
        } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#98D8E8');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        if (this.cloudSystem) {
            try { this.cloudSystem.draw(ctx); } catch (err) { this.cloudSystem = null; }
        }

        this.drawHorizon();

        // Fading islands — both fade and sink out
        const alpha = 1 - ease;
        const bob = 1.0 + Math.sin(this.elapsedTime * 1.5) * 0.02;
        const sinkY = ease * this.height * 0.08;

        const islandLeftImg = this.images.islandLeft;
        if (islandLeftImg.complete && islandLeftImg.naturalWidth > 0) {
            const pixelsPerInch = 96;
            const baseH = pixelsPerInch * 1 * bob;
            const islandAspect = islandLeftImg.naturalWidth / islandLeftImg.naturalHeight;
            const baseW = baseH * islandAspect;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(islandLeftImg, this.width * 0.08, 400 * 0.75 + sinkY, baseW, baseH);
            ctx.restore();

            const islandRightImg = this.images.islandRight;
            if (islandRightImg.complete && islandRightImg.naturalWidth > 0) {
                const rightAspect = islandRightImg.naturalWidth / islandRightImg.naturalHeight;
                const rightBaseW = baseH * rightAspect;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(islandRightImg, this.width * 0.92 - rightBaseW, 425 * 0.75 + sinkY, rightBaseW, baseH);
                ctx.restore();
            }
        }

        // Waves
        if (this.useGerstnerWaves) {
            for (let i = 0; i < this.gerstnerWaves.layers.length; i++) {
                if (this.visibleWaveLayers.includes(i)) {
                    this.gerstnerWaves.drawLayer(this.ctx, i, this.width, this.height);
                }
            }
        }

        // Title text fades out too
        const titleAlpha = 1 - ease;
        ctx.save();
        ctx.globalAlpha = titleAlpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 80, 180, 0.6)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 52px Boogaloo, cursive";
        ctx.fillText("Zeeb's Island Adventure", this.width / 2, this.height * 0.22);
        ctx.shadowBlur = 0;
        ctx.fillText("Zeeb's Island Adventure", this.width / 2, this.height * 0.22);
        ctx.restore();
    }

    start() {
        console.log('Starting ocean animation');
        // Build danger wave image rotation array
        this.dangerWaveImages = [this.images.dangerWave2, this.images.dangerWave3, this.images.dangerWave4, this.images.dangerWave5];
        this.dangerWaveImageIndex = 0;
        this.resize();
        this.state = 'title';
        this.lastTime = performance.now();
        this.startTitleMusic();
        this.animate();
    }

    startTitleMusic() {
        if (this.titleMusicStarted) return;
        this.titleMusicStarted = true;
        this.titleMusic.volume = 0;
        this.titleMusic.play().catch(() => {});
        this.titleMusicFade = { dir: 'in', elapsed: 0, duration: 5 };
    }

    updateTitleMusicFade(dt) {
        if (!this.titleMusicFade) return;
        this.titleMusicFade.elapsed += dt;
        const t = Math.min(1, this.titleMusicFade.elapsed / this.titleMusicFade.duration);
        if (this.titleMusicFade.dir === 'in') {
            this.titleMusic.volume = t * 0.5;
            if (t >= 1) this.titleMusicFade = null;
        } else {
            this.titleMusic.volume = Math.max(0, (1 - t) * 0.5);
            if (t >= 1) {
                this.titleMusic.pause();
                this.titleMusic.currentTime = 0;
                this.titleMusicFade = null;
            }
        }
    }

    goToTitle() {
        this.state = 'title';
        this.titleMusicTriggered = true; // already interacted
        this.gameOver = false;
        this.score = 0;
        this.lives = 3;
        this.crashTimer = 0;
        this.speedBoostTriggered = false;
        this.speedBoostFlash = 0;
        this.sprayParticles = [];
        this.dangerWave.active = false;
        // Stop gameplay music, start title music with fade-in
        this.music.pause();
        this.music.currentTime = 0;
        this.musicStarted = false;
        this.titleMusicStarted = false;
        this.titleMusicFade = null;
        this.titleMusic.currentTime = 0;
        this.startTitleMusic();
    }

    startPlaying() {
        // Begin transition: fade the title island out before gameplay
        this.state = 'transition';
        this.transitionTimer = 0;
        // Start music fade during transition
        if (!this.titleMusicStarted) {
            this.titleMusicStarted = true;
            this.titleMusic.volume = 0.5;
            this.titleMusic.play().catch(() => {});
        }
        this.titleMusicFade = { dir: 'out', elapsed: 0, duration: 5 };
        if (!this.musicStarted) {
            this.music.volume = 0.5;
            this.music.play().catch(() => {});
            this.musicStarted = true;
        }
    }

    finishTransition() {
        this.state = 'playing';
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.crashTimer = 0;
        this.sprayParticles = [];
        this.dangerWave.active = false;
        this.dangerWave.nextSpawnTime = this.elapsedTime + 3;
        this.player.beginEntry();
    }
    
    update(deltaTime) {
        // Convert deltaTime to seconds
        const dt = Math.min(deltaTime / 1000, 0.05);
        this.elapsedTime += dt;

        // Continue title music fade-out during gameplay
        this.updateTitleMusicFade(dt);

        if (this.cloudSystem) {
            try {
                this.cloudSystem.update(dt);
            } catch (err) {
                console.warn('Cloud system update failed; disabling clouds.', err);
                this.cloudSystem = null;
            }
        }

        // Drift islands slowly for parallax
        this.islandDriftX -= this.islandDriftSpeed * dt;

        // Update each wave layer
        if (this.useGerstnerWaves) {
            this.gerstnerWaves.update(dt, this.elapsedTime, this.score);
        }
        for (let i = 0; i < this.waves.length; i++) {
            const wave = this.waves[i];
            const image = this.images[`wave${i + 1}`];
            const metrics = this.getWaveMetrics(image, wave);

            this.advanceWave(wave, dt, metrics.tileWidth);
        }

        // Fish swims behind the front wave roughly every N front-wave loops.
        this.updateFish(dt);
        
        // Update dangerous wave system
        this.updateDangerWave(dt);
        
        // Update close call timer
        if (this.closeCallTimer > 0) {
            this.closeCallTimer -= dt;
            if (this.closeCallTimer <= 0) {
                this.closeCallTimer = 0;
                this.showCloseCall = false;
            }
        }
        
        // Golden bonus timer update removed

        // Update player (but not during crash)
        if (this.crashTimer <= 0 && !this.gameOver) {
            this.player.update(deltaTime);
        }

        // Continuous wake spray from left tip of surfboard
        if (!this.player.isJumping && !this.player.isEntering &&
            !this.gameOver && this.crashTimer <= 0) {
            const tip = this.player.getBackTip();
            this.spawnSpray(tip.x, tip.y, 'wake');
        }

        this.updateSpray(dt);

        if (dt > 0) {
            this.fps = 1 / dt;
        }
    }
    
    drawHorizon() {
        const ctx = this.ctx;
        const t = this.elapsedTime; // For animations

        // B: Sky gradient (area above the horizon blend).
        // Keep this very soft to avoid visible banding/stops.
        const skyGradientTop = this.height * 0.14;
        const skyGradientBottom = this.height * 0.56;
        ctx.save();
        const skyGradient = ctx.createLinearGradient(0, skyGradientTop, 0, skyGradientBottom);
        skyGradient.addColorStop(0,    'rgba(205, 242, 248, 0)');
        skyGradient.addColorStop(0.28, 'rgba(205, 242, 248, 0.06)');
        skyGradient.addColorStop(0.52, 'rgba(196, 238, 246, 0.14)');
        skyGradient.addColorStop(0.74, 'rgba(188, 233, 244, 0.11)');
        skyGradient.addColorStop(1,    'rgba(180, 228, 240, 0)');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, skyGradientTop, this.width, skyGradientBottom - skyGradientTop);
        ctx.restore();
        
        // A: Ocean BG (ocean background transition under the horizon).
        // === LAYER 1: Sky-to-ocean gradient ===
        // One continuous gradient from transparent sky down through
        // the horizon into deep ocean.  Extends well past where
        // waves begin (0.55) so there is no gap.
        const oceanBgTop = this.height * 0.28;
        const oceanBgBottom = this.height * 0.62;
        
        ctx.save();
        const oceanBg = ctx.createLinearGradient(0, oceanBgTop, 0, oceanBgBottom);
        // #325A9A-based ocean gradient (lighter near horizon, deeper below).
        oceanBg.addColorStop(0,    'rgba(92, 126, 184, 0)');
        oceanBg.addColorStop(0.10, 'rgba(86, 120, 178, 0.03)');
        oceanBg.addColorStop(0.22, 'rgba(74, 109, 168, 0.08)');
        oceanBg.addColorStop(0.34, 'rgba(63, 99, 158, 0.14)');
        oceanBg.addColorStop(0.46, 'rgba(56, 92, 152, 0.22)');
        oceanBg.addColorStop(0.58, 'rgba(50, 90, 154, 0.34)');     // Base #325A9A
        oceanBg.addColorStop(0.70, 'rgba(46, 84, 144, 0.46)');
        oceanBg.addColorStop(0.82, 'rgba(41, 76, 130, 0.56)');
        oceanBg.addColorStop(0.92, 'rgba(36, 68, 118, 0.63)');
        oceanBg.addColorStop(1,    'rgba(31, 60, 108, 0.68)');
        ctx.fillStyle = oceanBg;
        ctx.fillRect(0, oceanBgTop, this.width, oceanBgBottom - oceanBgTop);
        ctx.restore();
        
        // === LAYER 2: Warm horizon glow ===
        // A thin warm-toned band right at the horizon line that
        // suggests atmospheric scattering / golden hour light.
        const glowY = this.height * 0.43;
        const glowH = this.height * 0.035;
        
        ctx.save();
        const glow = ctx.createLinearGradient(0, glowY, 0, glowY + glowH);
        glow.addColorStop(0,   'rgba(180, 160, 120, 0)');
        glow.addColorStop(0.3, 'rgba(180, 160, 120, 0.06)');
        glow.addColorStop(0.5, 'rgba(200, 175, 130, 0.09)');
        glow.addColorStop(0.7, 'rgba(180, 160, 120, 0.06)');
        glow.addColorStop(1,   'rgba(180, 160, 120, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, glowY, this.width, glowH);
        ctx.restore();
        
        // === LAYER 3: Animated light sheen on distant water ===
        // A subtle brightness band that slowly drifts vertically,
        // giving the distant ocean a living, breathing quality.
        const sheenBase = this.height * 0.47;
        const sheenDrift = Math.sin(t * 0.4) * (this.height * 0.008); // slow drift
        const sheenY = sheenBase + sheenDrift;
        const sheenH = this.height * 0.045;
        
        ctx.save();
        const sheen = ctx.createLinearGradient(0, sheenY, 0, sheenY + sheenH);
        sheen.addColorStop(0,   'rgba(120, 180, 205, 0)');
        sheen.addColorStop(0.35,'rgba(120, 180, 205, 0.02)');
        sheen.addColorStop(0.5, 'rgba(130, 190, 212, 0.03)');
        sheen.addColorStop(0.65,'rgba(120, 180, 205, 0.02)');
        sheen.addColorStop(1,   'rgba(120, 180, 205, 0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(0, sheenY, this.width, sheenH);
        ctx.restore();
        
        // === LAYER 4: Distant water sparkle ===
        // Small twinkling white dots that drift across the distant
        // water surface, catching light and adding life.
        ctx.save();
        const sparkleY = this.height * 0.66;
        const sparkleH = this.height * 0.08;
        const sparkleCount = 14;
        for (let i = 0; i < sparkleCount; i++) {
            // Each sparkle has its own phase so they twinkle independently
            const phase = i * 1.7 + t * 0.3;
            const alpha = Math.max(0, Math.sin(phase) * 0.6 + 0.2);
            const sx = ((i * 137.5 + t * 8) % (this.width + 40)) - 20;
            const sy = sparkleY + Math.sin(i * 2.3 + t * 0.5) * sparkleH * 0.4;
            const size = 2.5 + Math.sin(phase * 1.3) * 1.5;
            
            ctx.globalAlpha = alpha * 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw sky background (full opacity + cyan gradient overlay)
        const hasSky = this.images.sky.complete && this.images.sky.naturalWidth > 0;
        if (hasSky) {
            this.ctx.drawImage(this.images.sky, 0, 0, this.width, this.height);
        } else {
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(1, '#98D8E8');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        // Soft cyan sky gradient overlay
        const skyGradientTop = this.height * 0.14;
        const skyGradientBottom = this.height * 0.56;
        this.ctx.save();
        const skyGrad = this.ctx.createLinearGradient(0, skyGradientTop, 0, skyGradientBottom);
        skyGrad.addColorStop(0,    'rgba(205, 242, 248, 0)');
        skyGrad.addColorStop(0.28, 'rgba(205, 242, 248, 0.06)');
        skyGrad.addColorStop(0.52, 'rgba(196, 238, 246, 0.14)');
        skyGrad.addColorStop(0.74, 'rgba(188, 233, 244, 0.11)');
        skyGrad.addColorStop(1,    'rgba(180, 228, 240, 0)');
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, skyGradientTop, this.width, skyGradientBottom - skyGradientTop);
        this.ctx.restore();

        // Cloud System: always-on parallax cloud layers over the sky.
        if (this.cloudSystem) {
            try {
                this.cloudSystem.draw(this.ctx);
            } catch (err) {
                console.warn('Cloud system draw failed; disabling clouds.', err);
                this.cloudSystem = null;
            }
        }
        
        // Draw horizon and distant water (between sky and waves)
        this.drawHorizon();
        
        // Draw distant islands with slow parallax drift
        const islandLeftImg = this.images.islandLeft;
        if (islandLeftImg.complete && islandLeftImg.naturalWidth > 0) {
            const pixelsPerInch = 96;
            const islandHeight = pixelsPerInch * 1;
            const islandAspect = islandLeftImg.naturalWidth / islandLeftImg.naturalHeight;
            const islandWidth = islandHeight * islandAspect;

            // Base positions + drift offset
            const leftBaseX = this.width * 0.08;
            const islandY = 400 * 0.75;

            // Wrap: total cycle width is screen + island so it reappears from right
            const cycle = this.width + islandWidth + 200;
            const leftX = ((leftBaseX + this.islandDriftX) % cycle + cycle) % cycle - islandWidth - 100;

            this.ctx.save();
            this.ctx.drawImage(islandLeftImg, leftX, islandY, islandWidth, islandHeight);
            this.ctx.restore();

            const islandRightImg = this.images.islandRight;
            if (islandRightImg.complete && islandRightImg.naturalWidth > 0) {
                const rightAspect = islandRightImg.naturalWidth / islandRightImg.naturalHeight;
                const islandRightWidth = islandHeight * rightAspect;
                const rightBaseX = this.width * 0.92 - islandRightWidth;
                const islandRightY = 425 * 0.75;

                const cycleR = this.width + islandRightWidth + 200;
                const rightX = ((rightBaseX + this.islandDriftX) % cycleR + cycleR) % cycleR - islandRightWidth - 100;

                this.ctx.save();
                this.ctx.drawImage(islandRightImg, rightX, islandRightY, islandRightWidth, islandHeight);
                this.ctx.restore();
            }
        }
        
        // Draw waves in order (back to front)
        if (this.useGerstnerWaves) {
            // Gerstner physics-based waves
            for (let i = 0; i < this.gerstnerWaves.layers.length; i++) {
                if (this.visibleWaveLayers.includes(i)) {
                    this.gerstnerWaves.drawLayer(this.ctx, i, this.width, this.height);
                }
                // Fish lives behind the front wave but in front of the mid/back water.
                if (i === 1) {
                    this.drawFish(this.ctx);
                }
            }
        } else {
            // SVG tiled waves (original)
            for (let i = 0; i < this.waves.length; i++) {
                const wave = this.waves[i];
                const image = this.images[`wave${i + 1}`];
                const metrics = this.getWaveMetrics(image, wave);
                const bob = Math.sin(this.elapsedTime * wave.bobSpeed + (wave.bobPhase || 0)) * (this.height * wave.bobAmount);
                const alpha = wave.alpha ?? 1;

                // Only draw visible wave layers
                if (this.visibleWaveLayers.includes(i)) {
                    this.drawTiledWave(image, metrics, wave.offset, bob, alpha, i);
                }

                // Fish lives behind the front wave but in front of the mid/back water.
                if (i === 1) {
                    this.drawFish(this.ctx);
                }
            }
        }
        
        // Draw danger waves above standard waves, but still behind Zeeb.
        this.drawDangerWave(this.ctx, this.dangerWave);
        if (this.showDangerWaveExtra) {
            this.drawDangerWave(this.ctx, this.dangerWaveExtra);
        }

        // Draw water spray behind player
        this.drawSpray(this.ctx);

        // Draw player in front of all wave layers.
        // Don't draw normal player during crash animation (he's being animated in drawCrashEffect)
        if (!this.crashAnimation.active || this.crashTimer <= 0) {
            this.player.draw(this.ctx);
        }
        
        // Draw crash effect overlay (includes Zeeb animation during crash)
        this.drawCrashEffect(this.ctx);
        
        // Draw game UI (score, lives, game over)
        this.drawGameUI(this.ctx);

        // Pause button (mobile-friendly)
        this.drawPauseButton(this.ctx);

        // Debug info
        if (this.showDebug) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px monospace';
            this.ctx.fillText(`FPS: ${this.fps.toFixed(0)}`, 10, 20);
            this.ctx.fillText(`Zeeb riding: wave[2] frontOceanWater`, 10, 40);
            // Wave layer legend
            this.ctx.fillText(`--- Wave Legend ---`, 10, 64);
            this.ctx.fillStyle = '#FF6B35';
            this.ctx.fillText(`■ [1] MID WAVE (wave2.svg) — orange dashes`, 10, 80);
            this.ctx.fillStyle = '#00FFFF';
            this.ctx.fillText(`■ [2] FRONT OCEAN (wave3.svg) — cyan dashes ← Zeeb`, 10, 96);
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(`Press SPACEBAR to jump!`, 10, 116);
            
            // Draw ruler on left side (inches with quarter-inch marks)
            this.drawDebugRuler(this.ctx);
            this.drawDebugLabels(this.ctx);
            this.drawDebugDangerWaveBoxes(this.ctx);
        }
    }

    drawDebugLabels(ctx) {
        const labelX = 140;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const drawLabel = (text, x, y) => {
            const textX = clamp(x, 10, this.width - 10);
            const textY = clamp(y, 12, this.height - 6);
            ctx.strokeText(text, textX, textY);
            ctx.fillText(text, textX, textY);
        };

        ctx.save();
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

        drawLabel('sky (Sky1.png)', 10, 16);

        const islandLeftImg = this.images.islandLeft;
        if (islandLeftImg.complete && islandLeftImg.naturalWidth > 0) {
            const pixelsPerInch = 96;
            const islandHeight = pixelsPerInch * 1;
            const islandAspect = islandLeftImg.naturalWidth / islandLeftImg.naturalHeight;
            const islandWidth = islandHeight * islandAspect;
            const islandX = this.width * 0.08;
            const islandY = 400 * 0.75;
            drawLabel('islandLeft (Island Left.svg)', islandX, islandY - 6);

            const islandRightImg = this.images.islandRight;
            if (islandRightImg.complete && islandRightImg.naturalWidth > 0) {
                const rightAspect = islandRightImg.naturalWidth / islandRightImg.naturalHeight;
                const islandRightWidth = islandHeight * rightAspect;
                const islandRightX = this.width * 0.92 - islandRightWidth;
                const islandRightY = 425 * 0.75;
                drawLabel('islandRight (Island Right.svg)', islandRightX, islandRightY - 6);
            }
        }

        // Wave layer debug info with color-coded surface lines
        const waveDebugColors = {
            0: { color: '#FFD700', desc: 'BACK', lineWidth: 2, dash: [6, 6] },
            1: { color: '#FF6B35', desc: 'MID WAVE', lineWidth: 5, dash: [20, 10] },
            2: { color: '#00FFFF', desc: 'FRONT OCEAN (Zeeb rides)', lineWidth: 3, dash: [6, 3] },
            3: { color: '#FF44FF', desc: 'BOTTOM STRIP', lineWidth: 2, dash: [6, 6] }
        };
        let prevLabelY = -Infinity;
        for (let i = 0; i < this.waves.length; i++) {
            const wave = this.waves[i];
            const image = this.images[`wave${i + 1}`];
            const metrics = this.getWaveMetrics(image, wave);
            const dbg = waveDebugColors[i] || { color: '#FFF', desc: '', lineWidth: 2, dash: [8, 4] };
            const name = wave.name || `wave${i + 1}`;
            const asset = wave.asset || `wave${i + 1}.svg`;
            const label = `[${i}] ${dbg.desc} — ${name} (${asset}) | speed:${wave.speed}px/s`;
            let labelY = metrics.waveY + metrics.waveHeight * 0.12;

            // Push label down if it overlaps the previous one
            if (labelY - prevLabelY < 18) {
                labelY = prevLabelY + 18;
            }

            if (this.visibleWaveLayers.includes(i)) {
                // Draw colored surface line across the wave top
                ctx.save();
                ctx.strokeStyle = dbg.color;
                ctx.lineWidth = dbg.lineWidth;
                ctx.setLineDash(dbg.dash);
                ctx.beginPath();
                ctx.moveTo(0, metrics.waveY);
                ctx.lineTo(this.width, metrics.waveY);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                // Draw short tick from the line down to the label
                ctx.save();
                ctx.strokeStyle = dbg.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(labelX - 10, metrics.waveY);
                ctx.lineTo(labelX - 10, labelY - 8);
                ctx.stroke();
                ctx.restore();

                // Draw colored dot next to label
                ctx.save();
                ctx.fillStyle = dbg.color;
                ctx.beginPath();
                ctx.arc(labelX - 10, labelY - 4, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                drawLabel(label, labelX, labelY);
                prevLabelY = labelY;
            }
        }

        const drawDangerLabel = (wave, baseName) => {
            if (!wave || !wave.active) {
                return;
            }
            const img = wave.img || this.images.dangerWave2;
            const waveHeight = this.height * 0.24 * (wave.sizeMultiplier || 1) * (wave.heightScale || 1);
            let waveWidth = waveHeight;
            if (img.complete && img.naturalWidth > 0) {
                const aspect = img.naturalWidth / img.naturalHeight;
                waveWidth = waveHeight * aspect;
            }
            const waveY = this.getDangerWaveTopY();
            const waveX = wave.x - waveWidth * 0.3;
            const imgName = wave.imgName || 'GraceWave?.png';
            drawLabel(`${baseName} (${imgName})`, waveX + 8, waveY + 18);
        };

        drawDangerLabel(this.dangerWave, 'dangerWave');
        if (this.showDangerWaveExtra) {
            drawDangerLabel(this.dangerWaveExtra, 'dangerWaveExtra');
        }

        if (this.fish.active) {
            const fishAsset = this.fish.state === 'dead'
                ? (this.fish.entrySide === 'right' ? 'dead_fish_right.svg' : 'dead_fish.svg')
                : (this.fish.entrySide === 'right' ? 'alive_fish_right.svg' : 'alive_fish_left.svg');
            drawLabel(`fish (${fishAsset})`, this.fish.x + 12, this.fish.y - 12);
        }

        if (this.crashAnimation.active && this.crashTimer > 0) {
            drawLabel('player (green.png)', this.crashAnimation.zeebX + 12, this.crashAnimation.zeebY - 12);
        } else {
            drawLabel('player (green.png)', this.player.x + 12, this.player.y - 12);
        }

        ctx.restore();
    }
    
    // Golden wave drawing function removed

    drawDebugDangerWaveBoxes(ctx) {
        const drawBox = (wave, label) => {
            if (!wave || !wave.active) {
                return;
            }

            // Match collision calculation from updateDangerWaveInstance
            const img = wave.img || this.images.dangerWave2;
            const waveHeight = this.height * 0.24 * (wave.sizeMultiplier || 1) * (wave.heightScale || 1);
            let waveWidth = waveHeight;
            if (img.complete && img.naturalWidth > 0) {
                const aspect = img.naturalWidth / img.naturalHeight;
                waveWidth = waveHeight * aspect;
            }
            const spriteLeft = wave.x - waveWidth * 0.3;
            const dangerousPortionRatio = 0.4;
            const dangerLeft = spriteLeft;
            const dangerRight = spriteLeft + waveWidth * dangerousPortionRatio;
            const waveTop = this.getDangerWaveTopY();
            const dangerTop = waveTop + 30;
            const dangerBottom = this.height;
            const boxWidth = dangerRight - dangerLeft;
            const boxHeight = dangerBottom - dangerTop;

            if (boxWidth <= 0 || boxHeight <= 0) {
                return;
            }

            const clearanceHeight = waveTop + 20;

            ctx.save();
            ctx.fillStyle = 'rgba(255, 64, 64, 0.18)';
            ctx.strokeStyle = 'rgba(255, 64, 64, 0.9)';
            ctx.lineWidth = 2;
            ctx.fillRect(dangerLeft, dangerTop, boxWidth, boxHeight);
            ctx.strokeRect(dangerLeft, dangerTop, boxWidth, boxHeight);

            // Wave top line
            ctx.strokeStyle = 'rgba(120, 200, 255, 0.95)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dangerLeft, waveTop);
            ctx.lineTo(dangerRight, waveTop);
            ctx.stroke();

            // Clearance line (safe jump threshold)
            ctx.strokeStyle = 'rgba(120, 255, 140, 0.95)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dangerLeft, clearanceHeight);
            ctx.lineTo(dangerRight, clearanceHeight);
            ctx.stroke();

            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            const textX = Math.min(this.width - 10, Math.max(10, dangerLeft + 6));
            const textY = Math.min(this.height - 6, Math.max(14, dangerTop + 14));
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 3;
            ctx.strokeText(label, textX, textY);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText(label, textX, textY);

            const lineY = textY + 14;
            const stats = [
                `dangerX: ${dangerLeft.toFixed(0)}..${dangerRight.toFixed(0)}`,
                `waveTop: ${waveTop.toFixed(0)} | clearance: ${clearanceHeight.toFixed(0)}`,
                `dangerTop: ${dangerTop.toFixed(0)} | waveW: ${wave.width.toFixed(0)}`,
                `heightScale: ${(wave.heightScale || 1).toFixed(2)}`
            ];
            for (let i = 0; i < stats.length; i++) {
                const y = lineY + i * 14;
                ctx.strokeText(stats[i], textX, y);
                ctx.fillText(stats[i], textX, y);
            }
            ctx.restore();
        };

        drawBox(this.dangerWave, 'wipeout box: dangerWave');
        if (this.showDangerWaveExtra) {
            drawBox(this.dangerWaveExtra, 'wipeout box: dangerWaveExtra');
        }
    }
    
    drawDebugRuler(ctx) {
        // Draw a vertical ruler on the left side of the screen
        // Assumes 96 DPI (standard screen) - 1 inch = 96 pixels
        const pixelsPerInch = 96;
        const rulerX = 5; // Position from left edge
        const rulerWidth = 30;
        const quarterInchPx = pixelsPerInch / 4;
        
        ctx.save();
        
        // Semi-transparent background for ruler
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, rulerWidth + 95, this.height);
        
        // Draw ruler markings
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        
        let quarterStep = 0;
        let y = this.height;
        
        while (y >= 0) {
            const quarterInch = quarterStep % 4;
            const inchCount = Math.floor(quarterStep / 4);
            
            if (quarterInch === 0) {
                // Full inch mark - longest line
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(rulerX, y);
                ctx.lineTo(rulerX + rulerWidth, y);
                ctx.stroke();
                
                // Label with inch number
                ctx.fillText(`${inchCount}"`, rulerX + rulerWidth + 3, y + 4);
            } else if (quarterInch === 2) {
                // Half inch mark - medium line
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(rulerX + 5, y);
                ctx.lineTo(rulerX + rulerWidth - 5, y);
                ctx.stroke();
                
                // Label with fraction
                ctx.font = '8px monospace';
                ctx.fillText(`${inchCount} ½`, rulerX + rulerWidth + 3, y + 3);
                ctx.font = '10px monospace';
            } else {
                // Quarter inch marks - short lines
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(rulerX + 10, y);
                ctx.lineTo(rulerX + rulerWidth - 10, y);
                ctx.stroke();
                
                // Label quarter inches
                ctx.font = '7px monospace';
                const fractionLabel = quarterInch === 1 ? '¼' : '¾';
                ctx.fillText(`${inchCount} ${fractionLabel}`, rulerX + rulerWidth + 3, y + 3);
                ctx.font = '10px monospace';
            }
            
            quarterStep++;
            y = this.height - (quarterStep * quarterInchPx);
        }
        
        // Draw percentage markers on the right side of ruler area
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.font = '9px monospace';
        for (let pct = 0; pct <= 100; pct += 10) {
            const pctY = this.height - (this.height * (pct / 100));
            ctx.fillText(`${pct}%`, rulerX + rulerWidth + 25, pctY + 3);
            
            // Small yellow tick
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rulerX + rulerWidth + 22, pctY);
            ctx.lineTo(rulerX + rulerWidth + 24, pctY);
            ctx.stroke();
        }

        // Draw pixel number bar (0 at top, increases downward)
        const numberBarX = rulerX + rulerWidth + 55;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
        ctx.font = '9px monospace';
        for (let y = 0; y <= this.height; y += 10) {
            const isMajor = y % 100 === 0;
            const isMid = y % 50 === 0;
            const tickLen = isMajor ? 10 : (isMid ? 7 : 4);
            ctx.lineWidth = isMajor ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(numberBarX, y);
            ctx.lineTo(numberBarX + tickLen, y);
            ctx.stroke();

            if (isMid) {
                ctx.fillText(`${y}`, numberBarX + tickLen + 2, y + 3);
            }
        }
        
        ctx.restore();
    }
    
    animate() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;

        if (this.isLoaded) {
            if (this.state === 'title') {
                this.updateTitle(deltaTime);
                this.drawTitle();
            } else if (this.state === 'transition') {
                this.updateTitle(deltaTime);
                this.transitionTimer += deltaTime / 1000;
                if (this.transitionTimer >= this.transitionDuration) {
                    this.finishTransition();
                }
                this.drawTransition();
            } else if (this.state === 'paused') {
                // Freeze game, draw last frame with pause overlay
                this.draw();
                this.drawPauseOverlay();
            } else if (this.state === 'confirm-quit') {
                // Freeze game, draw paused frame with dialog
                this.draw();
                this.drawConfirmQuit();
            } else {
                this.update(deltaTime);
                this.draw();
            }
        } else {
            // Show loading message on sky-colored background
            const loadGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
            loadGrad.addColorStop(0, '#87CEEB');
            loadGrad.addColorStop(1, '#98D8E8');
            this.ctx.fillStyle = loadGrad;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = "24px 'Lilita One', Arial";
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Loading ocean assets...', this.width / 2, this.height / 2);
            this.ctx.textAlign = 'left';
        }

        this.lastTime = currentTime;
        requestAnimationFrame(() => this.animate());
    }
}

// Start the animation when page loads
window.addEventListener('DOMContentLoaded', () => {
    const ocean = new OceanAnimation();
    console.log('Ocean animation initialized');
});
