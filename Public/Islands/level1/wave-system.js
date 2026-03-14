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
            { score: 0,    speed: 1.40 },  // Chill, learn the rhythm
            { score: 200,  speed: 1.70 },  // Picking up
            { score: 500,  speed: 2.00 },  // Cruising
            { score: 900,  speed: 2.40 },  // Getting intense
            { score: 1500, speed: 2.90 },  // Survival mode
            { score: 2000, speed: 3.20 },  // White knuckle
        ];
        this.currentTier = 0;
        this.surgeAmount = 0;        // current surge overshoot (0–1)
        this.surgeDuration = 2.0;    // seconds for surge to settle
        this.surgeElapsed = 0;
        this.surgeOvershoot = 0.12;  // 12% overshoot on each tier jump
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
                fillColor: '#4A90E2',
                crestColor: '#5da8f0',
                deepColor: '#2a6bb5',
                foamColor: 'rgba(255, 255, 255, 0.3)',
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
                fillColor: '#263d83',
                crestColor: '#3a5aaa',
                deepColor: '#1a2a5c',
                foamColor: 'rgba(200, 220, 255, 0.35)',
                alpha: 0.8,
                yPosition: 0.72,
                speed: 1,
                components: [
                    { wavelength: 600, amplitude: 16, steepness: 0.2, speed: 105 },
                    { wavelength: 350, amplitude: 8,  steepness: 0.15, speed: 75 },
                    { wavelength: 180, amplitude: 3,  steepness: 0.1,  speed: 50 },
                ]
            }),

            // [2] frontOceanWater — the wave Zeeb rides on
            new GerstnerWaveLayer({
                name: 'frontOceanWater',
                fillColor: '#1e88e5',
                crestColor: '#42a5f5',
                deepColor: '#0d5aa7',
                foamColor: 'rgba(255, 255, 255, 0.7)',
                alpha: 0.72,
                yPosition: 0.82,
                speed: 1,
                components: [
                    { wavelength: 550, amplitude: 20, steepness: 0.25, speed: 150 },
                    { wavelength: 300, amplitude: 10, steepness: 0.15, speed: 105 },
                    { wavelength: 160, amplitude: 4,  steepness: 0.1,  speed: 65 },
                ]
            }),

            // [3] bottomOceanWater — dark strip at bottom
            new GerstnerWaveLayer({
                name: 'bottomOceanWater',
                fillColor: '#1a2d6b',
                crestColor: '#243a80',
                deepColor: '#0c1530',
                foamColor: 'rgba(200, 220, 255, 0.2)',
                alpha: 0.9,
                yPosition: 0.92,
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
        // Find current tier
        let tierSpeed = this.speedTiers[0].speed;
        for (const tier of this.speedTiers) {
            if (this.score >= tier.score) tierSpeed = tier.speed;
        }

        // Add surge overshoot that decays
        let surge = 0;
        if (this.surgeElapsed < this.surgeDuration) {
            const t = this.surgeElapsed / this.surgeDuration;
            // Quick rise, smooth ease-out
            surge = this.surgeOvershoot * tierSpeed * (1 - t * t);
        }

        return tierSpeed + surge;
    }

    /**
     * Update elapsed time, check for tier changes.
     */
    update(dt, elapsedTime, score) {
        this.elapsedTime = elapsedTime;
        const prevScore = this.score;
        this.score = score;

        // Detect tier jump
        let prevTier = 0, newTier = 0;
        for (let i = 0; i < this.speedTiers.length; i++) {
            if (prevScore >= this.speedTiers[i].score) prevTier = i;
            if (this.score >= this.speedTiers[i].score) newTier = i;
        }
        if (newTier > prevTier) {
            // Trigger surge
            this.currentTier = newTier;
            this.surgeElapsed = 0;
        }

        this.surgeElapsed += dt;

        // Accumulate phase time using current speed — this only ever
        // increases, so waves can never visually reverse direction.
        this.phaseTime += dt * this.getSpeedMultiplier();
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
            xDisplacement += comp.steepness * comp.amplitude * Math.sin(k * x - omega * t);
        }

        // Second pass: evaluate Y at the displaced X position
        const xShifted = x - xDisplacement;
        let yDisplacement = 0;
        for (const comp of layer.components) {
            const k = (2 * Math.PI) / comp.wavelength;
            const omega = k * comp.speed;
            yDisplacement += comp.amplitude * Math.cos(k * xShifted - omega * t);
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
        const grad = ctx.createLinearGradient(0, minY, 0, canvasHeight);
        grad.addColorStop(0, layer.crestColor);
        grad.addColorStop(0.35, layer.fillColor);
        grad.addColorStop(1, layer.deepColor);
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
