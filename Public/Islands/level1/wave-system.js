// Gerstner Wave System for Zeeb Islands
// Physically-based 2D wave rendering — no SVGs, no tiling seams

class GerstnerWaveLayer {
    /**
     * @param {object} config
     * @param {string} config.name         - Layer name
     * @param {string} config.fillColor    - CSS color for the wave body
     * @param {string} config.crestColor   - Lighter color at the wave crest
     * @param {string} config.deepColor    - Darker color at the wave depth
     * @param {string} config.foamColor    - Color for whitecap foam at crests
     * @param {number} config.alpha        - Canvas globalAlpha (0–1)
     * @param {number} config.yPosition    - Base Y as ratio of canvas height (0–1)
     * @param {number} config.speed        - Base speed multiplier (scales all component speeds)
     * @param {Array}  config.components   - Wave components: {wavelength, amplitude, steepness, speed}
     *                                       speed = phase velocity in px/s for this component
     */
    constructor(config) {
        this.name = config.name;
        this.fillColor = config.fillColor;
        this.crestColor = config.crestColor || config.fillColor;
        this.deepColor = config.deepColor || config.fillColor;
        this.foamColor = config.foamColor || 'rgba(255, 255, 255, 0.6)';
        this.alpha = config.alpha ?? 1;
        this.yPosition = config.yPosition;
        this.speedMultiplier = config.speed ?? 1;
        this.components = config.components || [];
    }
}

class GerstnerWaveSystem {
    constructor() {
        this.layers = [];
        this.elapsedTime = 0;
        this.phaseTime = 0;          // accumulated phase time (never reverses)
        this.score = 0;

        // Speed tiers — each milestone bumps the wave speed with a surge
        this.speedTiers = [
            { score: 0,    speed: 3.64 },  // Chill
            { score: 200,  speed: 4.42 },  // Picking up
            { score: 500,  speed: 5.20 },  // Cruising
            { score: 900,  speed: 6.24 },  // Getting intense
            { score: 1500, speed: 7.54 },  // Survival mode
            { score: 2000, speed: 8.32 },  // White knuckle
            { score: 3000, speed: 9.10 },  // Expert
            { score: 4500, speed: 9.80 },  // Beast mode
            { score: 6000, speed: 10.40 }, // Legendary
            { score: 8000, speed: 11.00 }, // Untouchable
            { score: 10000, speed: 11.60 }, // Insane
            { score: 13000, speed: 12.10 }, // Godlike
            { score: 16000, speed: 12.50 }, // Max
        ];
        this.currentTier = 0;
        this.currentSpeed = this.speedTiers[0].speed;
        this.lerpRate = 0.4;         // how fast speed catches up (per second, 0-1)

        // Amber flush on speed tier change
        this.flushTimer = 0;         // counts down from flushDuration
        this.flushDuration = 2.5;    // seconds for flush to fade
        this.flushAmber = { r: 255, g: 230, b: 50 }; // bright gold-yellow target
    }

    /**
     * Initialize wave layers.
     * Each component has its own speed — longer wavelengths travel faster (like real ocean).
     * Steepness (0–1) controls how peaked the crests are: 0 = sine, ~0.7 = sharp crest.
     */
    init() {
        this.layers = [
            // Components have different speeds so waves evolve and roll
            // (safe now — phaseTime accumulation prevents reversals)

            // [0] backOceanWater — hidden but defined for index consistency
            new GerstnerWaveLayer({
                name: 'backOceanWater',
                fillColor: '#7bbaf5',
                crestColor: '#95d0ff',
                deepColor: '#5ea0e0',
                foamColor: 'rgba(255, 255, 255, 0.45)',
                alpha: 1,
                yPosition: 0.55,
                speed: 1,
                components: [
                    { wavelength: 600, amplitude: 14, steepness: 0.35, speed: 60 },
                    { wavelength: 350, amplitude: 8,  steepness: 0.25, speed: 45 },
                    { wavelength: 180, amplitude: 4,  steepness: 0.15, speed: 30 },
                ]
            }),

            // [1] midOceanWater — dark blue behind the front wave
            new GerstnerWaveLayer({
                name: 'midOceanWater',
                fillColor: '#4268b5',
                crestColor: '#5880cc',
                deepColor: '#334d8e',
                foamColor: 'rgba(220, 235, 255, 0.5)',
                alpha: 0.85,
                yPosition: 0.76,
                speed: 1,
                components: [
                    { wavelength: 600, amplitude: 14, steepness: 0.2, speed: 105 },
                    { wavelength: 350, amplitude: 6,  steepness: 0.15, speed: 75 },
                    { wavelength: 180, amplitude: 3,  steepness: 0.1,  speed: 50 },
                ]
            }),

            // [2] frontOceanWater — the wave Zeeb rides on
            new GerstnerWaveLayer({
                name: 'frontOceanWater',
                fillColor: '#4db0f8',
                crestColor: '#75c8ff',
                deepColor: '#3088d5',
                foamColor: 'rgba(255, 255, 255, 0.8)',
                alpha: 0.78,
                yPosition: 0.85,
                speed: 1,
                components: [
                    { wavelength: 550, amplitude: 16, steepness: 0.25, speed: 150 },
                    { wavelength: 300, amplitude: 8,  steepness: 0.15, speed: 105 },
                    { wavelength: 160, amplitude: 3,  steepness: 0.1,  speed: 65 },
                ]
            }),

            // [3] frontOcean — fuller wave layer just under Zeeb's wave
            new GerstnerWaveLayer({
                name: 'frontOcean',
                fillColor: '#2a78c8',
                crestColor: '#4a9ae5',
                deepColor: '#1c5a9e',
                foamColor: 'rgba(230, 240, 255, 0.55)',
                alpha: 0.82,
                yPosition: 0.91,
                speed: 1,
                components: [
                    { wavelength: 480, amplitude: 12, steepness: 0.2, speed: 130 },
                    { wavelength: 260, amplitude: 6,  steepness: 0.12, speed: 85 },
                    { wavelength: 140, amplitude: 3,  steepness: 0.08, speed: 55 },
                ]
            }),

            // [4] bottomOceanWater — dark strip at bottom
            new GerstnerWaveLayer({
                name: 'bottomOceanWater',
                fillColor: '#334d95',
                crestColor: '#4060aa',
                deepColor: '#1e3468',
                foamColor: 'rgba(200, 220, 255, 0.2)',
                alpha: 0.9,
                yPosition: 0.95,
                speed: 1,
                components: [
                    { wavelength: 500, amplitude: 6, steepness: 0.15, speed: 45 },
                    { wavelength: 250, amplitude: 3, steepness: 0.1,  speed: 30 },
                ]
            }),
        ];
    }

    /**
     * Get the effective speed multiplier based on score tiers + surge.
     */
    getSpeedMultiplier() {
        return this.currentSpeed;
    }

    /**
     * Update elapsed time, check for tier changes.
     */
    update(dt, elapsedTime, score) {
        this.elapsedTime = elapsedTime;
        const prevScore = this.score;
        this.score = score;

        // Find target tier speed and detect tier change
        let targetSpeed = this.speedTiers[0].speed;
        let prevTier = 0, newTier = 0;
        for (let i = 0; i < this.speedTiers.length; i++) {
            if (prevScore >= this.speedTiers[i].score) prevTier = i;
            if (this.score >= this.speedTiers[i].score) {
                targetSpeed = this.speedTiers[i].speed;
                newTier = i;
            }
        }

        // Speed tier flush disabled

        // Smoothly lerp toward target speed
        this.currentSpeed += (targetSpeed - this.currentSpeed) * this.lerpRate * dt;

        // Accumulate phase time using current speed — this only ever
        // increases, so waves can never visually reverse direction.
        this.phaseTime += dt * this.currentSpeed;
    }

    // Returns flush intensity 0-1 (0 = no flush, 1 = peak)
    getFlushIntensity() {
        if (this.flushTimer <= 0) return 0;
        const t = this.flushTimer / this.flushDuration; // 1→0
        // Quick peak then gradual fade
        return t * t;
    }

    // Mix a CSS hex color toward amber by intensity (0-1)
    flushColor(hexColor, intensity) {
        if (intensity <= 0) return hexColor;
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const a = this.flushAmber;
        const mix = intensity * 0.55; // max 55% amber blend — pops against blue
        const mr = Math.round(r + (a.r - r) * mix);
        const mg = Math.round(g + (a.g - g) * mix);
        const mb = Math.round(b + (a.b - b) * mix);
        return `#${mr.toString(16).padStart(2,'0')}${mg.toString(16).padStart(2,'0')}${mb.toString(16).padStart(2,'0')}`;
    }

    /**
     * Compute the Gerstner wave surface Y at a given X for a layer.
     *
     * Gerstner formula (2D):
     *   x' = x - sum( steepness * amplitude * sin(k*x - omega*t) )
     *   x' = x - sum( steepness * amplitude * sin(k*x - omega*t) )
     *   y' = sum( amplitude * cos(k*x - omega*t) )
     *
     * X displacement creates sharp crests and wide troughs.
     * Phase uses accumulated phaseTime so waves never reverse.
     */
    getSurfaceY(layerIndex, x, canvasWidth, canvasHeight) {
        const layer = this.layers[layerIndex];
        if (!layer) return canvasHeight * 0.5;

        const baseY = canvasHeight * layer.yPosition;
        const t = this.phaseTime * layer.speedMultiplier;

        // First pass: compute X displacement for Gerstner leaning crests
        let xDisplacement = 0;
        for (const comp of layer.components) {
            const k = (2 * Math.PI) / comp.wavelength;
            const omega = k * comp.speed;
            xDisplacement += comp.steepness * comp.amplitude * Math.sin(k * x + omega * t);
        }

        // Second pass: evaluate Y at the displaced X position
        const xShifted = x - xDisplacement;
        let yDisplacement = 0;
        for (const comp of layer.components) {
            const k = (2 * Math.PI) / comp.wavelength;
            const omega = k * comp.speed;
            yDisplacement += comp.amplitude * Math.cos(k * xShifted + omega * t);
        }

        return baseY - yDisplacement;
    }

    /**
     * Draw a wave layer with gradient body and foam highlights.
     */
    drawLayer(ctx, layerIndex, canvasWidth, canvasHeight, step = 2) {
        const layer = this.layers[layerIndex];
        if (!layer) return;

        // Sample surface points
        const points = [];
        let minY = canvasHeight, maxY = 0;
        for (let x = 0; x <= canvasWidth; x += step) {
            const y = this.getSurfaceY(layerIndex, x, canvasWidth, canvasHeight);
            points.push({ x, y });
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        // Ensure right edge
        const lastX = points[points.length - 1].x;
        if (lastX < canvasWidth) {
            const y = this.getSurfaceY(layerIndex, canvasWidth, canvasWidth, canvasHeight);
            points.push({ x: canvasWidth, y });
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        ctx.save();
        ctx.globalAlpha = layer.alpha;

        // --- 1. Wave body with vertical gradient (crest color → deep color) ---
        const flush = this.getFlushIntensity();
        const crestC = flush > 0 ? this.flushColor(layer.crestColor, flush) : layer.crestColor;
        const fillC  = flush > 0 ? this.flushColor(layer.fillColor, flush)  : layer.fillColor;
        const deepC  = flush > 0 ? this.flushColor(layer.deepColor, flush)  : layer.deepColor;
        const waveDepth = canvasHeight - minY;
        const gradBottom = minY + waveDepth * 0.7; // gradient finishes within the wave body
        const grad = ctx.createLinearGradient(0, minY, 0, gradBottom);
        grad.addColorStop(0, crestC);
        grad.addColorStop(0.3, fillC);
        grad.addColorStop(1, deepC);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(0, canvasHeight);
        for (const pt of points) {
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(canvasWidth, canvasHeight);
        ctx.closePath();
        ctx.fill();

        // --- 2. Foam/highlight along the surface ---
        // Draw a light stroke that's thicker at crests (high points) and
        // thinner/invisible in troughs.
        const waveRange = maxY - minY || 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            // How high is this point relative to the range? 1 = crest, 0 = trough
            const crestFactor = 1 - (p1.y - minY) / waveRange;
            // Only draw foam near crests (top 40%)
            if (crestFactor < 0.5) continue;

            const foamAlpha = (crestFactor - 0.5) * 2; // 0→1 for top half
            const foamWidth = 1.5 + foamAlpha * 3;

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.strokeStyle = layer.foamColor;
            ctx.globalAlpha = layer.alpha * foamAlpha * 0.8;
            ctx.lineWidth = foamWidth;
            ctx.stroke();
        }

        ctx.restore();
    }
}
