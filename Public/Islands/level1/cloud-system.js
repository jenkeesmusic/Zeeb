// Level 1 cloud system.
// Two layers:
// - back clouds: softer and slower.
// - front clouds: larger, brighter, and faster.
(function () {
    class CloudSystem {
        constructor(options = {}) {
            this.width = options.width || 900;
            this.height = options.height || 600;
            this.basePath = options.basePath || '../img/Clouds/';
            this.imageNames = options.imageNames || [
                'C (1).png',
                'C (2).png',
                'C (3).png',
                'C (4).png',
                'C (5).png'
            ];

            this.images = [];
            this.clouds = [];
            this.spriteCache = new WeakMap();
            this.disableSpriteProcessing = false;
            this.cutoutErrorLogged = false;

            this.layers = [
                {
                    name: 'back clouds',
                    count: 5,
                    speed: 8,
                    alphaMin: 0.18,
                    alphaMax: 0.30,
                    scaleMin: 0.18,
                    scaleMax: 0.28,
                    yMinRatio: 0.02,
                    yMaxRatio: 0.30,
                    spacingRatio: 0.18,
                    brightWhite: false
                },
                {
                    name: 'front clouds',
                    count: 3,
                    speed: 28,
                    alphaMin: 0.78,
                    alphaMax: 0.95,
                    scaleMin: 0.36,
                    scaleMax: 0.52,
                    yMinRatio: 0.04,
                    yMaxRatio: 0.28,
                    spacingRatio: 0.26,
                    brightWhite: true
                }
            ];

            this.loadImages();
            this.rebuildClouds();
        }

        loadImages() {
            this.images = this.imageNames.map((name) => {
                const img = new Image();
                img.src = encodeURI(`${this.basePath}${name}`);
                return img;
            });
        }

        getPreparedSprite(img) {
            if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                return null;
            }

            if (this.disableSpriteProcessing) {
                return img;
            }

            if (this.spriteCache.has(img)) {
                return this.spriteCache.get(img);
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const cctx = canvas.getContext('2d');
                if (!cctx) {
                    this.spriteCache.set(img, img);
                    return img;
                }

                cctx.drawImage(img, 0, 0);

                const imageData = cctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const w = canvas.width;
                const h = canvas.height;

                // Estimate background color from corners.
                const corners = [
                    [0, 0],
                    [w - 1, 0],
                    [0, h - 1],
                    [w - 1, h - 1]
                ];
                let br = 0;
                let bg = 0;
                let bb = 0;
                for (const [cx, cy] of corners) {
                    const idx = (cy * w + cx) * 4;
                    br += data[idx];
                    bg += data[idx + 1];
                    bb += data[idx + 2];
                }
                br /= corners.length;
                bg /= corners.length;
                bb /= corners.length;

                const fadeStart = 28;
                const fadeEnd = 92;
                const fadeSpan = Math.max(1, fadeEnd - fadeStart);

                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a === 0) continue;

                    const dr = Math.abs(data[i] - br);
                    const dg = Math.abs(data[i + 1] - bg);
                    const db = Math.abs(data[i + 2] - bb);
                    const diff = dr + dg + db;

                    // Remove flat image panel while preserving cloud edges.
                    if (diff <= fadeStart) {
                        data[i + 3] = 0;
                    } else if (diff < fadeEnd) {
                        const keep = (diff - fadeStart) / fadeSpan;
                        data[i + 3] = Math.round(a * keep);
                    }
                }

                cctx.putImageData(imageData, 0, 0);
                this.spriteCache.set(img, canvas);
                return canvas;
            } catch (err) {
                // In file:// or strict contexts, pixel reads can throw.
                // Fail open so gameplay keeps rendering.
                this.disableSpriteProcessing = true;
                if (!this.cutoutErrorLogged) {
                    console.warn('Cloud cutout disabled; using raw cloud images.', err);
                    this.cutoutErrorLogged = true;
                }
                this.spriteCache.set(img, img);
                return img;
            }
        }

        resize(width, height) {
            this.width = width;
            this.height = height;

            for (const cloud of this.clouds) {
                const yRange = this.getYRangeForLayer(cloud.layer, cloud.height);
                cloud.y = Math.max(yRange.min, Math.min(yRange.max, cloud.y));
            }
        }

        rebuildClouds() {
            this.clouds = [];

            for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
                const cfg = this.layers[layerIndex];
                const totalSpan = this.width * 1.9;
                const spacing = totalSpan / Math.max(1, cfg.count);
                const startX = -this.width * 0.45;

                for (let i = 0; i < cfg.count; i++) {
                    const jitter = this.rand(-spacing * 0.2, spacing * 0.2);
                    const x = startX + spacing * i + jitter;
                    this.clouds.push(this.createCloud(layerIndex, x));
                }
            }
        }

        getYRangeForLayer(layerIndex, cloudHeight) {
            const cfg = this.layers[layerIndex];
            const min = this.height * cfg.yMinRatio;
            const max = Math.max(min, this.height * cfg.yMaxRatio - cloudHeight * 0.35);
            return { min, max };
        }

        getUsedCloudSets(excludeCloud) {
            const usedPairs = new Set();
            const usedImages = new Set();

            for (const cloud of this.clouds) {
                if (cloud === excludeCloud) continue;
                usedPairs.add(`${cloud.imageIndex}:${cloud.flipX ? 1 : 0}`);
                usedImages.add(cloud.imageIndex);
            }

            return { usedPairs, usedImages };
        }

        pickImageVariant(excludeCloud) {
            const imageCount = this.images.length;
            if (!imageCount) {
                return { imageIndex: 0, flipX: false };
            }

            const { usedPairs, usedImages } = this.getUsedCloudSets(excludeCloud);
            const allVariants = [];
            const preferred = [];

            for (let imageIndex = 0; imageIndex < imageCount; imageIndex++) {
                for (const flipX of [false, true]) {
                    const key = `${imageIndex}:${flipX ? 1 : 0}`;
                    if (usedPairs.has(key)) continue;
                    const variant = { imageIndex, flipX };
                    allVariants.push(variant);
                    if (!usedImages.has(imageIndex)) {
                        preferred.push(variant);
                    }
                }
            }

            const pool = preferred.length ? preferred : allVariants;
            if (pool.length) {
                return pool[Math.floor(Math.random() * pool.length)];
            }

            // Fallback should rarely happen.
            return {
                imageIndex: Math.floor(Math.random() * imageCount),
                flipX: Math.random() < 0.5
            };
        }

        createCloud(layerIndex, x, excludeCloud) {
            const cfg = this.layers[layerIndex];
            const variant = this.pickImageVariant(excludeCloud);
            const imageIndex = variant.imageIndex;
            const img = this.images[imageIndex];
            const flipX = variant.flipX;

            const scale = this.rand(cfg.scaleMin, cfg.scaleMax) * (this.width / 900);
            const minWidth = this.width * (cfg.brightWhite ? 0.24 : 0.14);
            const width = Math.max(minWidth, this.width * scale);
            const aspect = img && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 2.8;
            const height = width / Math.max(0.5, aspect);
            const yRange = this.getYRangeForLayer(layerIndex, height);

            return {
                layer: layerIndex,
                imageIndex,
                flipX,
                isFrontCloud: cfg.brightWhite,
                x,
                y: this.rand(yRange.min, yRange.max),
                width,
                height,
                speed: cfg.speed * this.rand(0.9, 1.15),
                alpha: this.rand(cfg.alphaMin, cfg.alphaMax),
                bobPhase: this.rand(0, Math.PI * 2),
                bobAmp: this.height * (cfg.brightWhite ? 0.001 : 0.0008)
            };
        }

        getFarthestXInLayer(layerIndex) {
            let maxX = -Infinity;
            for (const cloud of this.clouds) {
                if (cloud.layer !== layerIndex) continue;
                maxX = Math.max(maxX, cloud.x + cloud.width);
            }
            return Number.isFinite(maxX) ? maxX : this.width;
        }

        update(dt) {
            if (!Number.isFinite(dt) || dt <= 0) return;

            const rightEdge = this.width + this.width * 0.22;

            for (let i = 0; i < this.clouds.length; i++) {
                const cloud = this.clouds[i];
                const cfg = this.layers[cloud.layer];
                cloud.x -= cloud.speed * dt;
                cloud.bobPhase += dt * (cloud.isFrontCloud ? 0.18 : 0.12);

                if (cloud.x + cloud.width < -this.width * 0.25) {
                    const farthest = this.getFarthestXInLayer(cloud.layer);
                    const baseSpacing = this.width * cfg.spacingRatio;
                    const spawnX = Math.max(rightEdge, farthest + baseSpacing * this.rand(0.8, 1.35));
                    this.clouds[i] = this.createCloud(cloud.layer, spawnX, cloud);
                }
            }
        }

        drawCloudSprite(ctx, cloud, y) {
            const img = this.images[cloud.imageIndex];
            const sprite = this.getPreparedSprite(img);

            ctx.save();
            ctx.translate(cloud.flipX ? cloud.x + cloud.width : cloud.x, y);
            if (cloud.flipX) {
                ctx.scale(-1, 1);
            }

            if (sprite) {
                ctx.globalAlpha = cloud.alpha;
                ctx.drawImage(sprite, 0, 0, cloud.width, cloud.height);
            } else {
                ctx.globalAlpha = cloud.alpha;
                ctx.fillStyle = cloud.isFrontCloud
                    ? 'rgba(255, 255, 255, 0.8)'
                    : 'rgba(235, 245, 255, 0.5)';
                ctx.beginPath();
                ctx.ellipse(
                    cloud.width * 0.5,
                    cloud.height * 0.5,
                    cloud.width * 0.5,
                    cloud.height * 0.35,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }

            ctx.restore();
        }

        draw(ctx) {
            if (!ctx) return;

            // Draw back clouds first, then front clouds.
            for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
                for (const cloud of this.clouds) {
                    if (cloud.layer !== layerIndex) continue;
                    const y = cloud.y + Math.sin(cloud.bobPhase) * cloud.bobAmp;
                    this.drawCloudSprite(ctx, cloud, y);
                }
            }
        }

        rand(min, max) {
            return min + Math.random() * (max - min);
        }
    }

    window.CloudSystem = CloudSystem;
})();
