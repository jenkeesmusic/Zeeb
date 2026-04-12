// Level 3: Beach Walkthrough — Zeeb walks through beach scenes to the Surf Shop
// Arrow keys / WASD / touch to move

(function () {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // ---------------------------------------------------------------------------
    // Scene definitions
    // ---------------------------------------------------------------------------
    // Each scene has a background image and exit zones that link to other scenes.
    // Exits: { edge: 'left'|'right'|'top'|'bottom', target: sceneIndex, spawnEdge: opposite }
    // Or: { zone: {x,y,w,h} (fraction of canvas), target: 'url' } for page nav
    // Colliders: { x, y, w, h } rects as fractions of canvas — or { x, y, r } circles
    const SCENES = [
        {
            // Scene 0 — 3-1: Beach entry, path curving right
            bg: '../img/Level3/3-1.png',
            exits: [
                { edge: 'right', target: 1, spawnEdge: 'left', spawnY: 0.50 },
            ],
            colliders: [
                { x: 0.28, y: 0.09, w: 0.07, h: 0.16 },  // 0: top palm tree
                { x: 0.33, y: 0.45, w: 0.12, h: 0.18 },  // 1: Coconut Town sign
                { x: 0.68, y: 0.60, w: 0.14, h: 0.27 },  // 2: double palm trees (trunks only)
                { x: -0.09, y: 0.01, w: 0.13, h: 1.00 },  // 3: ocean left edge
            ],
        },
        {
            // Scene 1 — 3-2: Path to surf shop (layered: sand bg + shop foreground)
            bg: '../img/Level3/3-sand.png',
            fg: '../img/Level3/3-2-foreground.png',
            exits: [
                { edge: 'left', target: 0, spawnEdge: 'right' },
                { zone: { x: 0.45, y: 0.02, w: 0.35, h: 0.30 }, target: 3, spawnX: 0.50, spawnY: 0.85 },
                { edge: 'right', target: 2, spawnEdge: 'left', spawnY: 0.52 },
            ],
            colliders: [
                { x: 0.07, y: 0.32, w: 0.12, h: 0.12 },  // 0: left palms (trunks)
                { x: 0.42, y: 0.82, w: 0.06, h: 0.15 },  // 1: Coconut Island sign
                { x: 0.72, y: 0.68, w: 0.15, h: 0.17 },  // 2: right palms (trunks)
                { x: 0.52, y: 0.20, w: 0.08, h: 0.18 },  // 3: shop left pillar
                { x: 0.82, y: 0.20, w: 0.08, h: 0.18 },  // 4: shop right pillar
                { x: 0.56, y: 0.33, w: 0.34, h: 0.06 },  // 5: shop counter bar
            ],
        },
        {
            // Scene 2 — 3-4: Danger path with signs
            bg: '../img/Level3/3-4.png',
            exits: [
                { edge: 'left', target: 1, spawnEdge: 'right' },
            ],
            colliders: [
                { x: 0.14, y: 0.44, w: 0.10, h: 0.13 },  // 0: Danger sign
                { x: 0.76, y: 0.67, w: 0.05, h: 0.09 },  // 1: octopus sign
                { x: 0.30, y: 0.10, w: 0.03, h: 0.11 },  // 2: top-left palm
                { x: 0.52, y: 0.11, w: 0.03, h: 0.08 },  // 3: center palm
                { x: 0.58, y: 0.19, w: 0.03, h: 0.07 },  // 4: upper-right palm
                { x: 0.60, y: 0.42, w: 0.02, h: 0.12 },  // 5: mid-right palm
                { x: 0.54, y: 0.42, w: 0.02, h: 0.09 },  // 6: lower-left palm
                { x: 0.40, y: 0.34, w: 0.05, h: 0.15 },  // 7: path palm
                { x: 0.63, y: 0.09, w: 0.03, h: 0.07 },  // 8: upper-right cluster
                { x: 0.54, y: 0.24, w: 0.02, h: 0.07 },  // 9: mid-center palm
                { x: 0.63, y: 0.24, w: 0.03, h: 0.10 },  // 10: mid-right palm
            ],
        },
        {
            // Scene 3 — Surf Shop interior (zoomed in shop, sand bg, board picker)
            bg: '../img/Level3/3-sand.png',
            fg: '../img/Level3/3-2-foreground.png',
            exits: [
                { edge: 'bottom', target: 1, spawnEdge: 'top', spawnX: 0.65, spawnY: 0.35 },
            ],
            colliders: [],
        },
    ];

    // ---------------------------------------------------------------------------
    // Surfboard shop data & state
    // ---------------------------------------------------------------------------
    const ALL_BOARDS = [
        { name: 'Red',        price: 0,  file: '../img/red.png',                key: 'red.png' },
        { name: 'Island',     price: 15, file: '../img/Surf_island_1.png',      key: 'Surf_island_1.png' },
        { name: 'Leaf',       price: 25, file: '../img/Surf_leaf_1.png',        key: 'Surf_leaf_1.png' },
        { name: 'Watermelon', price: 30, file: '../img/Surf_watermelon_1.png',  key: 'Surf_watermelon_1.png' },
        { name: 'Mermaid',    price: 50, file: '../img/Surf_mermaid_1.png',     key: 'Surf_mermaid_1.png' },
    ];

    // The owned board is whatever Zeeb finished level 2 with (default: red)
    function getOwnedBoardKey() {
        return localStorage.getItem('zeeb_board') || 'red.png';
    }

    function buildBoardList() {
        const ownedKey = getOwnedBoardKey();
        return ALL_BOARDS.map(b => ({
            ...b,
            owned: b.key === ownedKey,
            price: b.key === ownedKey ? 0 : b.price,
        }));
    }

    let BOARDS = buildBoardList();

    // Board Zeeb carries after purchasing (only new boards, not the default red)
    let carriedBoardImg = null;
    let carriedBoardKey = null;

    const boardImages = {};
    let boardsLoaded = false;

    async function loadBoardImages() {
        for (const b of ALL_BOARDS) {
            boardImages[b.file] = await loadImage(b.file);
        }
        boardsLoaded = true;
    }

    const shop = {
        selectedBoard: -1,
        hoveredBoard: -1,
        confirmed: false,
        dialogTimer: 0,
        dialogText: '',
        dialogQueue: [],
        showPicker: false,
        pickerDelay: 0,
        subtitles: [],
        cutsceneTriggered: false,
        cutscenePlaying: false,
        cutsceneDone: false,
    };

    function getCoins() {
        return parseInt(localStorage.getItem('zeeb_coins') || '0', 10);
    }

    function setCoins(n) {
        localStorage.setItem('zeeb_coins', n.toString());
    }

    // Duck cutscene audio — extracted from "Ducks Shop Talk movie.MOV"
    const duckCutsceneAudio = new Audio('../Audio/duck_shop_talk.m4a');
    duckCutsceneAudio.volume = 0.6;

    function enterShop() {
        BOARDS = buildBoardList();
        shop.selectedBoard = -1;
        shop.confirmed = false;
        shop.showPicker = false;
        shop.cutsceneTriggered = false;
        shop.cutscenePlaying = false;
        shop.cutsceneDone = false;
        shop.dialogText = '';
        shop.dialogTimer = 0;
        shop.dialogQueue = [];
        setCameraPreset(CAMERA_WIDE);
    }

    function triggerDuckCutscene() {
        if (shop.cutsceneTriggered) return;
        shop.cutsceneTriggered = true;
        shop.cutscenePlaying = true;
        player.moving = false;

        // Dim music during voice
        music.volume = 0.15;

        // Cut to close-up on duck/shop
        setCameraPreset(CAMERA_CLOSEUP);

        // Move Zeeb beside the shop counter
        player.x = 0.22;
        player.y = 0.62;
        player.facing = 'right';

        // Play duck VO audio
        duckCutsceneAudio.currentTime = 0;
        duckCutsceneAudio.play().then(() => {
            // Audio playing — will end via 'ended' event
        }).catch(() => {
            // Audio blocked — skip cutscene quickly
            setTimeout(() => {
                if (shop.cutscenePlaying) endDuckCutscene();
            }, 2000);
        });

        // Safety fallback — always end after audio duration + buffer
        setTimeout(() => {
            if (shop.cutscenePlaying) endDuckCutscene();
        }, 16000);

        // Subtitles synced to audio timestamps
        shop.subtitles = [
            { start: 0.9, end: 5.4, text: "Whoa, Zeeb! You're just in time! The islanders on Coconut Island have been waiting for you." },
            { start: 6.7, end: 11.9, text: "You need a surfboard for battle, so you must buy one here. I make them at the store, very high quality." },
            { start: 12.6, end: 14.3, text: "So now, please choose your surfboard." },
        ];
        shop.dialogText = '';
        shop.dialogTimer = 0;
    }

    function endDuckCutscene() {
        shop.cutscenePlaying = false;
        shop.cutsceneDone = true;
        shop.showPicker = true;
        shop.dialogText = '';

        // Restore music volume
        music.volume = 0.5;

        // Cut back to wide shot
        setCameraPreset(CAMERA_WIDE);
    }

    // End cutscene when audio finishes (or after dialog runs out)
    duckCutsceneAudio.addEventListener('ended', () => {
        if (shop.cutscenePlaying) endDuckCutscene();
    });

    function advanceDialog() {
        if (shop.dialogQueue.length > 0) {
            shop.dialogText = shop.dialogQueue.shift();
            shop.dialogTimer = 180; // frames to show
        } else {
            shop.dialogText = '';
            shop.dialogTimer = 0;
            // If audio already ended or no audio, end cutscene
            if (shop.cutscenePlaying && duckCutsceneAudio.ended) {
                endDuckCutscene();
            }
        }
    }

    function getBoardCardRects() {
        const rects = [];
        const count = BOARDS.length;
        const panelW = canvas.width * 0.82;
        const panelH = canvas.height * 0.78;
        const panelX = (canvas.width - panelW) / 2;
        const panelY = (canvas.height - panelH) / 2;
        const innerPad = panelW * 0.03;
        const availW = panelW - innerPad * 2;
        const gap = availW * 0.02;
        const cardW = (availW - (count - 1) * gap) / count;
        const cardH = panelH * 0.58;
        const startX = panelX + innerPad;
        const startY = panelY + panelH * 0.22;
        for (let i = 0; i < count; i++) {
            rects.push({
                x: startX + i * (cardW + gap),
                y: startY,
                w: cardW,
                h: cardH,
            });
        }
        return rects;
    }

    function getConfirmBtnRect() {
        const panelH = canvas.height * 0.78;
        const panelY = (canvas.height - panelH) / 2;
        const w = canvas.width * 0.18;
        const h = canvas.height * 0.06;
        return {
            x: (canvas.width - w) / 2,
            y: panelY + panelH * 0.87,
            w: w,
            h: h,
        };
    }

    function drawShopScene() {
        // Sand background is already drawn by render()
        // This draws inside the camera transform

        // Duck — drawn first so shop renders on top
        if (duckImg) {
            const t = Date.now() * 0.001;
            const bobY = Math.sin(t * 1.5) * 5;
            const bobX = Math.sin(t * 0.6) * 8;
            const sway = Math.sin(t * 0.8) * 0.03;
            const dh = canvas.height * shopDuck.size;
            const dAspect = duckImg.naturalWidth / duckImg.naturalHeight;
            const dw = dh * dAspect;
            const dx = canvas.width * shopDuck.x + bobX;
            const dy = canvas.height * shopDuck.y + bobY;
            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(sway);
            ctx.drawImage(duckImg, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        }

        // Foreground layer (shop on transparency, drawn over duck)
        if (fgImage) {
            const sw = canvas.width * shopDisplay.size;
            const sAspect = fgImage.naturalWidth / fgImage.naturalHeight;
            const sh = sw / sAspect;
            const sx = canvas.width * shopDisplay.x - sw / 2;
            const sy = canvas.height * shopDisplay.y - sh / 2;
            ctx.drawImage(fgImage, sx, sy, sw, sh);
        }
    }

    // Word-wrap helper — splits text into lines that fit within maxWidth
    function wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    // HUD layer for shop — drawn outside camera transform so it stays fixed on screen
    function drawShopHUD() {
        if (currentScene !== 3) return;

        // Subtitles — cinematic bar at bottom of screen
        if (shop.dialogText) {
            ctx.save();
            const fontSize = Math.round(canvas.height * 0.03);
            ctx.font = `bold ${fontSize}px "Lilita One", sans-serif`;
            ctx.textAlign = 'center';

            const maxW = canvas.width * 0.7;
            const lines = wrapText(shop.dialogText, maxW);
            const lineHeight = fontSize * 1.4;
            const padX = 24;
            const padY = 12;
            const blockH = lines.length * lineHeight + padY * 2;
            const barY = canvas.height - blockH - canvas.height * 0.04;

            // Dark semi-transparent bar
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.roundRect(canvas.width * 0.1, barY, canvas.width * 0.8, blockH, 8);
            ctx.fill();

            // Text
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], canvas.width * 0.5, barY + padY + (i + 0.75) * lineHeight);
            }
            ctx.restore();
        }

        // Board picker only appears after cutscene
        if (shop.showPicker) {
            drawBoardPicker();
        }
    }

    function drawBoardPicker() {
        const coins = getCoins();

        // Dim the background
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Panel container
        const panelW = canvas.width * 0.82;
        const panelH = canvas.height * 0.78;
        const panelX = (canvas.width - panelW) / 2;
        const panelY = (canvas.height - panelH) / 2;

        ctx.save();
        // Panel background
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#1a3a4a';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Title
        ctx.globalAlpha = 1;
        ctx.font = `bold ${Math.round(panelH * 0.07)}px "Lilita One", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('Choose Your Surfboard', canvas.width / 2, panelY + panelH * 0.09);

        // Coin balance
        ctx.font = `bold ${Math.round(panelH * 0.05)}px "Lilita One", sans-serif`;
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`${coins} coins`, canvas.width / 2, panelY + panelH * 0.16);
        ctx.restore();

        // Board cards inside the panel
        const rects = getBoardCardRects();
        for (let i = 0; i < BOARDS.length; i++) {
            const b = BOARDS[i];
            const r = rects[i];
            const img = boardImages[b.file];
            const canAfford = b.owned || coins >= b.price;
            const isSelected = shop.selectedBoard === i;
            const isHovered = shop.hoveredBoard === i;

            ctx.save();

            // Card background
            ctx.globalAlpha = canAfford ? 0.95 : 0.5;
            ctx.fillStyle = isSelected ? 'rgba(255,215,0,0.35)' : (isHovered && canAfford ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)');
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, 14);
            ctx.fill();

            ctx.strokeStyle = isSelected ? '#ffd700' : 'rgba(255,255,255,0.25)';
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.stroke();

            // Board image
            if (img) {
                const imgH = r.h * 0.52;
                const imgAspect = img.naturalWidth / img.naturalHeight;
                const imgW = imgH * imgAspect;
                const imgX = r.x + (r.w - imgW) / 2;
                const imgY = r.y + r.h * 0.06;
                ctx.globalAlpha = canAfford ? 1 : 0.35;
                ctx.drawImage(img, imgX, imgY, imgW, imgH);
            }

            // Board name
            ctx.globalAlpha = canAfford ? 1 : 0.5;
            ctx.font = `bold ${Math.round(r.h * 0.09)}px "Lilita One", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            const nameY = r.y + r.h * 0.66;
            ctx.strokeText(b.name, r.x + r.w / 2, nameY);
            ctx.fillText(b.name, r.x + r.w / 2, nameY);

            // Price / Owned
            ctx.font = `bold ${Math.round(r.h * 0.075)}px "Lilita One", sans-serif`;
            if (b.owned) {
                ctx.fillStyle = '#7dff7d';
                ctx.strokeText('Owned', r.x + r.w / 2, r.y + r.h * 0.78);
                ctx.fillText('Owned', r.x + r.w / 2, r.y + r.h * 0.78);
            } else {
                ctx.fillStyle = canAfford ? '#ffe44d' : '#ff6666';
                ctx.strokeText(`${b.price} coins`, r.x + r.w / 2, r.y + r.h * 0.78);
                ctx.fillText(`${b.price} coins`, r.x + r.w / 2, r.y + r.h * 0.78);
            }

            // Locked label
            if (!canAfford) {
                ctx.font = `bold ${Math.round(r.h * 0.06)}px "Lilita One", sans-serif`;
                ctx.fillStyle = '#ff4444';
                ctx.strokeText('Need coins!', r.x + r.w / 2, r.y + r.h * 0.90);
                ctx.fillText('Need coins!', r.x + r.w / 2, r.y + r.h * 0.90);
            }

            ctx.restore();
        }

        // Confirm button
        if (shop.selectedBoard >= 0) {
            const btn = getConfirmBtnRect();
            const isHover = shop._hoverConfirm;
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = isHover ? '#3ab44a' : '#2e9e42';
            ctx.beginPath();
            ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.globalAlpha = 1;
            ctx.font = `bold ${Math.round(btn.h * 0.55)}px "Lilita One", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText("Surf's Up!", btn.x + btn.w / 2, btn.y + btn.h * 0.68);
            ctx.restore();
        }
    }

    // Skip cutscene on click or any key
    canvas.addEventListener('click', (e) => {
        if (currentScene === 3 && shop.cutscenePlaying) {
            duckCutsceneAudio.pause();
            endDuckCutscene();
            return;
        }
    });
    window.addEventListener('keydown', (e) => {
        if (currentScene === 3 && shop.cutscenePlaying && e.key !== 'g' && e.key !== 'G') {
            duckCutsceneAudio.pause();
            endDuckCutscene();
        }
    });

    // Shop click handling
    canvas.addEventListener('click', (e) => {
        if (currentScene !== 3 || !shop.showPicker) return;

        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * canvas.width;
        const my = (e.clientY - rect.top) / rect.height * canvas.height;
        const coins = getCoins();

        // Check board cards
        const rects = getBoardCardRects();
        for (let i = 0; i < BOARDS.length; i++) {
            const r = rects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                if (BOARDS[i].owned || coins >= BOARDS[i].price) {
                    shop.selectedBoard = i;
                }
                return;
            }
        }

        // Check confirm button
        if (shop.selectedBoard >= 0) {
            const btn = getConfirmBtnRect();
            if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                const b = BOARDS[shop.selectedBoard];
                setCoins(coins - b.price);
                localStorage.setItem('zeeb_board', b.file);
                shop.confirmed = true;
                carriedBoardKey = b.key;
                // Only carry the board visually if it's a new one (not the default red)
                carriedBoardImg = (b.key !== 'red.png') ? (boardImages[b.file] || null) : null;
                shop.dialogText = `Nice choice! The ${b.name} board!`;
                shop.dialogTimer = 120;
                // Return to scene 1 after delay
                setTimeout(() => {
                    shop.showPicker = false;
                    shop.confirmed = false;
                    currentScene = 1;
                    loadScene(1);
                    player.x = 0.80;
                    player.y = 0.42;
                }, 2000);
                return;
            }
        }
    });

    // Shop hover tracking
    canvas.addEventListener('mousemove', (e) => {
        if (currentScene !== 3 || !shop.showPicker) {
            shop.hoveredBoard = -1;
            shop._hoverConfirm = false;
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * canvas.width;
        const my = (e.clientY - rect.top) / rect.height * canvas.height;
        const coins = getCoins();

        shop.hoveredBoard = -1;
        shop._hoverConfirm = false;

        const rects = getBoardCardRects();
        for (let i = 0; i < BOARDS.length; i++) {
            const r = rects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                if (BOARDS[i].owned || coins >= BOARDS[i].price) shop.hoveredBoard = i;
                return;
            }
        }

        if (shop.selectedBoard >= 0) {
            const btn = getConfirmBtnRect();
            if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                shop._hoverConfirm = true;
            }
        }
    });

    // ---------------------------------------------------------------------------
    // Sprite configuration (placeholder until real sprites are ready)
    // ---------------------------------------------------------------------------
    const SPRITE_PATHS = {
        idle: '../img/Level3/zeeb_sprites/Zeeb_front.webp',
        walk_right_1: '../img/Level3/zeeb_sprites/Zeeb_right.webp',
        walk_right_2: '../img/Level3/zeeb_sprites/Zeeb_front-right.webp',
        walk_left_1: '../img/Level3/zeeb_sprites/Zeeb_left.webp',
        walk_left_2: '../img/Level3/zeeb_sprites/Zeeb_front-left.webp',
        walk_up: '../img/Level3/zeeb_sprites/Zeeb_back.webp',
        walk_up_1: '../img/Level3/zeeb_sprites/Zeeb_back-left.webp',
        walk_up_2: '../img/Level3/zeeb_sprites/Zeeb_back-right.webp',
        walk_down: '../img/Level3/zeeb_sprites/Zeeb_front.webp',
    };

    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------
    let currentScene = 0;
    let bgImage = null;
    let fgImage = null;
    let bgLoaded = false;

    // Player position as fraction of canvas (0-1)
    let player = {
        x: 0.08,   // start near left edge
        y: 0.70,   // lower area (beach)
        size: 0.14, // height as fraction of canvas height
        speed: 0.002, // movement per frame (fraction)
        facing: 'right',
        frame: 0,
        frameTimer: 0,
        moving: false,
    };

    // Input state
    const keys = {};
    let touchDir = { x: 0, y: 0 };
    let touchActive = false;

    // Sprites
    const sprites = {};
    let spritesLoaded = false;
    let fallbackSprite = null;

    // ---------------------------------------------------------------------------
    // Asset loading
    // ---------------------------------------------------------------------------
    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    async function loadSprites() {
        // Load fallback first
        fallbackSprite = await loadImage(SPRITE_PATHS.idle);

        // Try loading directional sprites
        for (const [key, path] of Object.entries(SPRITE_PATHS)) {
            sprites[key] = await loadImage(path);
        }
        spritesLoaded = true;
    }

    async function loadScene(index) {
        bgLoaded = false;
        const scene = SCENES[index];
        bgImage = await loadImage(scene.bg);
        fgImage = scene.fg ? await loadImage(scene.fg) : null;
        if (index === 3) enterShop();
        bgLoaded = true;
    }

    // ---------------------------------------------------------------------------
    // Input handling
    // ---------------------------------------------------------------------------
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

    // Touch controls — tap/drag direction relative to player
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', () => { touchActive = false; });

    // Mouse controls — click and hold to walk toward cursor
    let mouseActive = false;
    canvas.addEventListener('mousedown', (e) => { mouseActive = true; handleMouse(e); });
    canvas.addEventListener('mousemove', (e) => { if (mouseActive) handleMouse(e); });
    canvas.addEventListener('mouseup', () => { mouseActive = false; touchActive = false; });
    canvas.addEventListener('mouseleave', () => { mouseActive = false; touchActive = false; });

    function handleMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        const dx = mx - player.x;
        const dy = my - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.02) {
            touchDir.x = dx / dist;
            touchDir.y = dy / dist;
            touchActive = true;
        } else {
            touchActive = false;
        }
    }

    function handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const tx = (touch.clientX - rect.left) / rect.width;
        const ty = (touch.clientY - rect.top) / rect.height;
        const dx = tx - player.x;
        const dy = ty - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.02) {
            touchDir.x = dx / dist;
            touchDir.y = dy / dist;
            touchActive = true;
        }
    }

    // ---------------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------------
    function update() {
        // Freeze movement during cutscene only (picker freezes via its own overlay)
        if (shop.cutscenePlaying) {
            // Sync subtitles to audio currentTime
            const t = duckCutsceneAudio.currentTime;
            const sub = shop.subtitles.find(s => t >= s.start && t <= s.end);
            shop.dialogText = sub ? sub.text : '';
            return;
        }

        let dx = 0, dy = 0;

        // Keyboard
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
        if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
        if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;

        // Touch
        if (touchActive) {
            dx += touchDir.x;
            dy += touchDir.y;
        }

        // Normalize diagonal
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
            dx = (dx / mag) * player.speed;
            dy = (dy / mag) * player.speed;
            player.moving = true;

            // Determine facing direction
            if (Math.abs(dx) > Math.abs(dy)) {
                player.facing = dx > 0 ? 'right' : 'left';
            } else {
                player.facing = dy > 0 ? 'down' : 'up';
            }
        } else {
            player.moving = false;
        }

        // Move (with collision check)
        const newX = player.x + dx;
        const newY = player.y + dy;

        // Check colliders before committing movement
        // Test a few points around player (center + offsets) for better coverage
        const colliders = SCENES[currentScene].colliders || [];
        const testPoints = [
            { x: newX, y: newY },
            { x: newX - 0.02, y: newY },
            { x: newX + 0.02, y: newY },
            { x: newX, y: newY - 0.03 },
        ];
        let blocked = false;
        for (const c of colliders) {
            for (const pt of testPoints) {
                if (c.w !== undefined) {
                    // Rectangle collider
                    if (pt.x >= c.x && pt.x <= c.x + c.w && pt.y >= c.y && pt.y <= c.y + c.h) {
                        blocked = true;
                        break;
                    }
                } else {
                    // Circle collider
                    const cdx = pt.x - c.x;
                    const cdy = pt.y - c.y;
                    if (Math.sqrt(cdx * cdx + cdy * cdy) < c.r) {
                        blocked = true;
                        break;
                    }
                }
            }
            if (blocked) break;
        }

        if (!blocked) {
            player.x = newX;
            player.y = newY;
        }

        // Clamp to canvas bounds (with small margin)
        player.x = Math.max(0.02, Math.min(0.98, player.x));
        player.y = Math.max(0.05, Math.min(0.95, player.y));

        // Animate walk frame
        if (player.moving) {
            player.frameTimer += 1;
            if (player.frameTimer > 10) {
                player.frame = (player.frame + 1) % 2;
                player.frameTimer = 0;
            }
        } else {
            player.frame = 0;
            player.frameTimer = 0;
        }

        // Scene 3: check if Zeeb is close to Duck to trigger cutscene
        if (currentScene === 3 && !shop.cutsceneTriggered) {
            const dx = player.x - shopDuck.x;
            const dy = player.y - shopDuck.y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.15) {
                triggerDuckCutscene();
            }
        }

        // Check exits
        checkExits();
    }

    function checkExits() {
        const scene = SCENES[currentScene];
        for (const exit of scene.exits) {
            if (exit.edge) {
                const margin = 0.025;
                let triggered = false;
                if (exit.edge === 'right' && player.x >= 0.97) triggered = true;
                if (exit.edge === 'left' && player.x <= 0.03) triggered = true;
                if (exit.edge === 'top' && player.y <= 0.06) triggered = true;
                if (exit.edge === 'bottom' && player.y >= 0.94) triggered = true;

                if (triggered) {
                    if (typeof exit.target === 'string') {
                        window.location.href = exit.target;
                        return;
                    }
                    // Transition to another scene
                    currentScene = exit.target;
                    loadScene(currentScene);

                    // Position player at the opposite edge
                    if (exit.spawnEdge === 'left') { player.x = 0.05; }
                    if (exit.spawnEdge === 'right') { player.x = 0.95; }
                    if (exit.spawnEdge === 'top') { player.y = 0.08; }
                    if (exit.spawnEdge === 'bottom') { player.y = 0.90; }
                    if (exit.spawnY !== undefined) { player.y = exit.spawnY; }
                    if (exit.spawnX !== undefined) { player.x = exit.spawnX; }
                    return;
                }
            }

            if (exit.zone) {
                const z = exit.zone;
                if (player.x >= z.x && player.x <= z.x + z.w &&
                    player.y >= z.y && player.y <= z.y + z.h) {
                    if (typeof exit.target === 'string') {
                        window.location.href = exit.target;
                        return;
                    }
                    // Numeric target — scene transition
                    currentScene = exit.target;
                    loadScene(currentScene);
                    if (exit.spawnX !== undefined) player.x = exit.spawnX;
                    if (exit.spawnY !== undefined) player.y = exit.spawnY;
                    return;
                }
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Duck shopkeeper (scene 1 only — behind the surf shop counter)
    // ---------------------------------------------------------------------------
    let duckImg = null;
    (async () => { duckImg = await loadImage('../img/duck.png'); })();

    const duck = {
        x: 0.726,
        y: 0.284,
        size: 0.428,
    };

    const shopDuck = {
        x: 0.512,
        y: 0.378,
        size: 0.566,
    };

    const shopDisplay = {
        x: 0.196,
        y: 0.675,
        size: 1.384,
    };

    function activeDuck() {
        return currentScene === 3 ? shopDuck : duck;
    }

    // ---------------------------------------------------------------------------
    // Camera system
    // ---------------------------------------------------------------------------
    const CAMERA_WIDE = { x: 0.5, y: 0.5, zoom: 1.0 };
    const CAMERA_CLOSEUP = { x: 0.50, y: 0.35, zoom: 1.6 };  // focused on duck/shop area
    const camera = { x: 0.5, y: 0.5, zoom: 1.0 };

    function setCameraPreset(preset) {
        camera.x = preset.x;
        camera.y = preset.y;
        camera.zoom = preset.zoom;
    }

    function applyCameraTransform() {
        if (camera.zoom === 1.0 && camera.x === 0.5 && camera.y === 0.5) return;
        const cx = canvas.width * camera.x;
        const cy = canvas.height * camera.y;
        ctx.translate(cx, cy);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-cx, -cy);
    }

    function drawDuck() {
        if (currentScene !== 1 || !duckImg) return;

        const t = Date.now() * 0.001;
        const bobY = Math.sin(t * 1.5) * 5;
        const bobX = Math.sin(t * 0.6) * 8;
        const sway = Math.sin(t * 0.8) * 0.03;

        const h = canvas.height * duck.size;
        const aspect = duckImg.naturalWidth / duckImg.naturalHeight;
        const w = h * aspect;
        const cx = duck.x * canvas.width + bobX;
        const cy = duck.y * canvas.height + bobY;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sway);
        ctx.drawImage(duckImg, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply camera transform
        ctx.save();
        applyCameraTransform();

        // Draw background
        if (bgImage && bgLoaded) {
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        }

        if (currentScene === 3) {
            // Shop scene — custom rendering
            drawPlayerShadow();
            drawShopScene();
            drawPlayer();
        } else {
            // Duck shopkeeper (between bg and fg layers)
            drawDuck();

            // Player shadow — on the sand, under the foreground
            drawPlayerShadow();

            // Foreground layer (shop elements drawn over duck and shadow)
            if (fgImage) {
                ctx.drawImage(fgImage, 0, 0, canvas.width, canvas.height);
            }

            // Draw player on top of foreground
            drawPlayer();
        }

        ctx.restore(); // end camera transform

        // Shop HUD (dialog, board picker) — fixed on screen, not affected by camera
        drawShopHUD();

        // Scene indicator (subtle) — drawn outside camera so it stays fixed on screen
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#fff';
        ctx.font = '14px "Lilita One", sans-serif';
        ctx.textAlign = 'left';
        const sceneNames = ['Beach Entry', 'Coconut Island', 'Danger Path', 'Surf Shop'];
        ctx.fillText(sceneNames[currentScene] || '', 10, 24);
        ctx.restore();

        // Debug grid (toggle with G key)
        if (showDebug) drawDebugGrid();
        drawAdminOverlay();
    }

    let showDebug = new URLSearchParams(window.location.search).has('debug');
    let adminMode = new URLSearchParams(window.location.search).has('admin');
    if (adminMode) showDebug = true; // admin implies debug

    // Admin drag state
    let dragTarget = null;      // { sceneIdx, colliderIdx }
    let dragOffset = { x: 0, y: 0 };
    let resizing = false;       // true when dragging the bottom-right corner
    let hoveredCollider = -1;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'g' || e.key === 'G') showDebug = !showDebug;
        // Scene skip: 1, 2, 3 keys
        if (e.key === '1') { currentScene = 0; loadScene(0); player.x = 0.5; player.y = 0.5; }
        if (e.key === '2') { currentScene = 1; loadScene(1); player.x = 0.5; player.y = 0.5; }
        if (e.key === '3') { currentScene = 2; loadScene(2); player.x = 0.5; player.y = 0.5; }
        if (e.key === '4') { currentScene = 3; loadScene(3); player.x = 0.5; player.y = 0.85; }
        if (e.key === '5') { setCoins(50); currentScene = 3; loadScene(3); player.x = 0.30; player.y = 0.55; shop.cutsceneTriggered = true; shop.cutsceneDone = true; shop.showPicker = true; setCameraPreset(CAMERA_WIDE); }
    });

    // ---------------------------------------------------------------------------
    // Admin mode — drag/resize colliders
    // ---------------------------------------------------------------------------
    function getCanvasFrac(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height,
        };
    }

    function hitTestCollider(fx, fy) {
        const colliders = SCENES[currentScene].colliders || [];
        // Check in reverse so topmost (last drawn) wins
        for (let i = colliders.length - 1; i >= 0; i--) {
            const c = colliders[i];
            if (c.w !== undefined) {
                if (fx >= c.x && fx <= c.x + c.w && fy >= c.y && fy <= c.y + c.h) return i;
            } else {
                const dx = fx - c.x, dy = fy - c.y;
                if (Math.sqrt(dx * dx + dy * dy) < c.r) return i;
            }
        }
        return -1;
    }

    function isNearCorner(fx, fy, c) {
        if (c.w === undefined) return false; // circles resize differently
        const cornerX = c.x + c.w;
        const cornerY = c.y + c.h;
        const threshold = 0.02;
        return Math.abs(fx - cornerX) < threshold && Math.abs(fy - cornerY) < threshold;
    }

    // Duck drag state
    let draggingDuck = false;
    let duckDragOffset = { x: 0, y: 0 };
    let resizingDuck = false;

    // Shop drag state
    let draggingShop = false;
    let shopDragOffset = { x: 0, y: 0 };
    let resizingShop = false;

    function hitTestDuck(fx, fy) {
        if ((currentScene !== 1 && currentScene !== 3) || !duckImg) return false;
        const d = activeDuck();
        const aspect = duckImg.naturalWidth / duckImg.naturalHeight;
        const halfH = d.size / 2;
        const halfW = (d.size * aspect * canvas.height) / (2 * canvas.width);
        return fx >= d.x - halfW && fx <= d.x + halfW &&
               fy >= d.y - halfH && fy <= d.y + halfH;
    }

    function isNearDuckCorner(fx, fy) {
        if (!duckImg) return false;
        const d = activeDuck();
        const aspect = duckImg.naturalWidth / duckImg.naturalHeight;
        const halfH = d.size / 2;
        const halfW = (d.size * aspect * canvas.height) / (2 * canvas.width);
        const cornerX = d.x + halfW;
        const cornerY = d.y + halfH;
        return Math.abs(fx - cornerX) < 0.02 && Math.abs(fy - cornerY) < 0.02;
    }

    function getShopBounds() {
        if (!fgImage || currentScene !== 3) return null;
        const sAspect = fgImage.naturalWidth / fgImage.naturalHeight;
        const halfW = shopDisplay.size / 2;
        const halfH = (shopDisplay.size / sAspect) * (canvas.width / canvas.height) / 2;
        return { halfW, halfH };
    }

    function hitTestShop(fx, fy) {
        const b = getShopBounds();
        if (!b) return false;
        return fx >= shopDisplay.x - b.halfW && fx <= shopDisplay.x + b.halfW &&
               fy >= shopDisplay.y - b.halfH && fy <= shopDisplay.y + b.halfH;
    }

    function isNearShopCorner(fx, fy) {
        const b = getShopBounds();
        if (!b) return false;
        const cornerX = shopDisplay.x + b.halfW;
        const cornerY = shopDisplay.y + b.halfH;
        return Math.abs(fx - cornerX) < 0.02 && Math.abs(fy - cornerY) < 0.02;
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!adminMode || !showDebug) return;
        if (e.button !== 0) return; // left click only

        const f = getCanvasFrac(e);

        // Check shop (scene 3 only)
        if (hitTestShop(f.x, f.y) && !hitTestDuck(f.x, f.y)) {
            e.stopPropagation();
            e.preventDefault();
            if (isNearShopCorner(f.x, f.y)) {
                resizingShop = true;
                draggingShop = true;
            } else {
                draggingShop = true;
                shopDragOffset.x = f.x - shopDisplay.x;
                shopDragOffset.y = f.y - shopDisplay.y;
            }
            touchActive = false;
            mouseActive = false;
            return;
        }

        // Check duck
        if (hitTestDuck(f.x, f.y)) {
            e.stopPropagation();
            e.preventDefault();
            if (isNearDuckCorner(f.x, f.y)) {
                resizingDuck = true;
                draggingDuck = true;
            } else {
                draggingDuck = true;
                const d = activeDuck();
                duckDragOffset.x = f.x - d.x;
                duckDragOffset.y = f.y - d.y;
            }
            touchActive = false;
            mouseActive = false;
            return;
        }

        const idx = hitTestCollider(f.x, f.y);
        if (idx < 0) return;

        e.stopPropagation();
        e.preventDefault();

        const c = SCENES[currentScene].colliders[idx];
        dragTarget = { sceneIdx: currentScene, colliderIdx: idx };
        selectedCollider = idx;

        if (c.w !== undefined && isNearCorner(f.x, f.y, c)) {
            resizing = true;
            dragOffset.x = f.x - (c.x + c.w);
            dragOffset.y = f.y - (c.y + c.h);
        } else {
            resizing = false;
            dragOffset.x = f.x - c.x;
            dragOffset.y = f.y - c.y;
        }

        // Suppress player movement while dragging
        touchActive = false;
        mouseActive = false;
    }, true);

    canvas.addEventListener('mousemove', (e) => {
        if (!adminMode || !showDebug) return;

        const f = getCanvasFrac(e);

        // Shop dragging
        if (draggingShop) {
            e.stopPropagation();
            e.preventDefault();
            if (resizingShop) {
                const dx = f.x - shopDisplay.x;
                shopDisplay.size = Math.max(0.1, dx * 2);
            } else {
                shopDisplay.x = f.x - shopDragOffset.x;
                shopDisplay.y = f.y - shopDragOffset.y;
            }
            return;
        }

        // Duck dragging
        if (draggingDuck) {
            e.stopPropagation();
            e.preventDefault();
            if (resizingDuck) {
                // Resize: distance from center determines size
                const d = activeDuck();
                const dy = f.y - d.y;
                d.size = Math.max(0.05, dy * 2);
            } else {
                const d = activeDuck();
                d.x = f.x - duckDragOffset.x;
                d.y = f.y - duckDragOffset.y;
            }
            return;
        }

        // Update hover cursor
        if (hitTestShop(f.x, f.y) && !hitTestDuck(f.x, f.y)) {
            canvas.style.cursor = isNearShopCorner(f.x, f.y) ? 'nwse-resize' : 'grab';
        } else if (hitTestDuck(f.x, f.y)) {
            canvas.style.cursor = isNearDuckCorner(f.x, f.y) ? 'nwse-resize' : 'grab';
        } else {
            const idx = hitTestCollider(f.x, f.y);
            hoveredCollider = idx;
            if (idx >= 0) {
                const c = SCENES[currentScene].colliders[idx];
                if (c.w !== undefined && isNearCorner(f.x, f.y, c)) {
                    canvas.style.cursor = 'nwse-resize';
                } else {
                    canvas.style.cursor = 'grab';
                }
            } else if (!dragTarget) {
                canvas.style.cursor = '';
            }
        }

        if (!dragTarget) return;
        e.stopPropagation();
        e.preventDefault();

        const c = SCENES[dragTarget.sceneIdx].colliders[dragTarget.colliderIdx];
        if (resizing && c.w !== undefined) {
            c.w = Math.max(0.02, f.x - dragOffset.x - c.x);
            c.h = Math.max(0.02, f.y - dragOffset.y - c.y);
        } else if (c.w !== undefined) {
            c.x = f.x - dragOffset.x;
            c.y = f.y - dragOffset.y;
        } else {
            // Circle: move center
            c.x = f.x - dragOffset.x;
            c.y = f.y - dragOffset.y;
        }
    }, true);

    canvas.addEventListener('mouseup', (e) => {
        if (draggingShop) {
            e.stopPropagation();
            e.preventDefault();
            draggingShop = false;
            resizingShop = false;
            canvas.style.cursor = '';
            return;
        }
        if (draggingDuck) {
            e.stopPropagation();
            e.preventDefault();
            draggingDuck = false;
            resizingDuck = false;
            canvas.style.cursor = '';
            return;
        }
        if (dragTarget) {
            e.stopPropagation();
            e.preventDefault();
            dragTarget = null;
            resizing = false;
            canvas.style.cursor = '';
        }
    }, true);

    function copyCollidersToClipboard() {
        const colliders = SCENES[currentScene].colliders || [];
        const lines = colliders.map((c, i) => {
            if (c.w !== undefined) {
                return `                { x: ${c.x.toFixed(2)}, y: ${c.y.toFixed(2)}, w: ${c.w.toFixed(2)}, h: ${c.h.toFixed(2)} },  // ${i}`;
            } else {
                return `                { x: ${c.x.toFixed(2)}, y: ${c.y.toFixed(2)}, r: ${c.r.toFixed(2)} },  // ${i}`;
            }
        });
        const sceneNames = ['Scene 0 — Beach Entry', 'Scene 1 — Coconut Island', 'Scene 2 — Danger Path', 'Scene 3 — Surf Shop'];
        let text = `// ${sceneNames[currentScene] || 'Scene ' + currentScene}\ncolliders: [\n${lines.join('\n')}\n],`;
        if (currentScene === 1 || currentScene === 3) {
            const d = activeDuck();
            const label = currentScene === 3 ? 'Shop Duck' : 'Duck';
            text += `\n\n// ${label}: { x: ${d.x.toFixed(3)}, y: ${d.y.toFixed(3)}, size: ${d.size.toFixed(3)} }`;
        }
        if (currentScene === 3) {
            text += `\n// Shop: { x: ${shopDisplay.x.toFixed(3)}, y: ${shopDisplay.y.toFixed(3)}, size: ${shopDisplay.size.toFixed(3)} }`;
        }
        console.log(text);
        navigator.clipboard.writeText(text).then(() => {
            adminCopyFlash = 60;
        }).catch(() => {
            // file:// may block clipboard — fallback: select from console
            adminCopyFlash = 60;
        });
    }

    let adminCopyFlash = 0;

    // Admin buttons (DOM elements, only created in admin mode)
    let selectedCollider = -1;

    if (adminMode) {
        const btnStyle = 'position:fixed;z-index:9999;padding:4px 10px;font:bold 11px monospace;background:#222;border-radius:4px;cursor:pointer;';

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy Colliders';
        copyBtn.style.cssText = btnStyle + 'top:8px;right:8px;color:#0f0;border:1px solid #0f0;';
        copyBtn.addEventListener('mouseenter', () => { copyBtn.style.background = '#0f0'; copyBtn.style.color = '#000'; });
        copyBtn.addEventListener('mouseleave', () => { copyBtn.style.background = '#222'; copyBtn.style.color = '#0f0'; });
        copyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyCollidersToClipboard(); });
        document.body.appendChild(copyBtn);

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Collider';
        addBtn.style.cssText = btnStyle + 'top:8px;right:130px;color:#ff0;border:1px solid #ff0;';
        addBtn.addEventListener('mouseenter', () => { addBtn.style.background = '#ff0'; addBtn.style.color = '#000'; });
        addBtn.addEventListener('mouseleave', () => { addBtn.style.background = '#222'; addBtn.style.color = '#ff0'; });
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const colliders = SCENES[currentScene].colliders;
            colliders.push({ x: 0.45, y: 0.45, w: 0.10, h: 0.10 });
            selectedCollider = colliders.length - 1;
        });
        document.body.appendChild(addBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete Selected';
        delBtn.style.cssText = btnStyle + 'top:8px;right:248px;color:#f44;border:1px solid #f44;';
        delBtn.addEventListener('mouseenter', () => { delBtn.style.background = '#f44'; delBtn.style.color = '#000'; });
        delBtn.addEventListener('mouseleave', () => { delBtn.style.background = '#222'; delBtn.style.color = '#f44'; });
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedCollider >= 0 && selectedCollider < SCENES[currentScene].colliders.length) {
                SCENES[currentScene].colliders.splice(selectedCollider, 1);
                selectedCollider = -1;
            }
        });
        document.body.appendChild(delBtn);

        const adminBtns = [copyBtn, addBtn, delBtn];
        function updateAdminBtnVisibility() {
            const vis = showDebug ? '' : 'none';
            adminBtns.forEach(b => b.style.display = vis);
        }
        updateAdminBtnVisibility();
        // Re-check each frame via render — hook into the G key toggle
        const origKeydown = window.addEventListener;
        window.addEventListener('keydown', (e) => {
            if (e.key === 'g' || e.key === 'G') {
                // showDebug toggles in the other listener; defer check
                requestAnimationFrame(updateAdminBtnVisibility);
            }
        });
    }

    function drawAdminOverlay() {
        if (!adminMode) return;

        ctx.save();

        // Resize handles on hovered/dragged collider
        const activeIdx = dragTarget ? dragTarget.colliderIdx : hoveredCollider;
        if (activeIdx >= 0) {
            const c = SCENES[currentScene].colliders[activeIdx];
            if (c && c.w !== undefined) {
                // Draw corner handle
                const hx = (c.x + c.w) * canvas.width;
                const hy = (c.y + c.h) * canvas.height;
                ctx.fillStyle = '#ff0';
                ctx.globalAlpha = 0.9;
                ctx.fillRect(hx - 6, hy - 6, 12, 12);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(hx - 6, hy - 6, 12, 12);
            }
        }

        // Shop bounding box + resize handle (scene 3)
        if (currentScene === 3 && fgImage) {
            const b = getShopBounds();
            if (b) {
                const sx = (shopDisplay.x - b.halfW) * canvas.width;
                const sy = (shopDisplay.y - b.halfH) * canvas.height;
                const sw = b.halfW * 2 * canvas.width;
                const sh = b.halfH * 2 * canvas.height;

                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = '#0ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(sx, sy, sw, sh);
                ctx.setLineDash([]);

                ctx.globalAlpha = 0.9;
                ctx.fillStyle = '#0ff';
                ctx.fillRect(sx + sw - 6, sy + sh - 6, 12, 12);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx + sw - 6, sy + sh - 6, 12, 12);

                ctx.globalAlpha = 1;
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = '#0ff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.textAlign = 'left';
                const shopLabel = `Shop: x=${shopDisplay.x.toFixed(3)} y=${shopDisplay.y.toFixed(3)} size=${shopDisplay.size.toFixed(3)}`;
                ctx.strokeText(shopLabel, sx, sy - 8);
                ctx.fillText(shopLabel, sx, sy - 8);
            }
        }

        // Duck bounding box + resize handle
        if ((currentScene === 1 || currentScene === 3) && duckImg) {
            const d = activeDuck();
            const aspect = duckImg.naturalWidth / duckImg.naturalHeight;
            const halfH = d.size / 2;
            const halfW = (d.size * aspect * canvas.height) / (2 * canvas.width);
            const dx = (d.x - halfW) * canvas.width;
            const dy = (d.y - halfH) * canvas.height;
            const dw = halfW * 2 * canvas.width;
            const dh = d.size * canvas.height;

            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(dx, dy, dw, dh);
            ctx.setLineDash([]);

            // Resize handle
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#ff0';
            ctx.fillRect(dx + dw - 6, dy + dh - 6, 12, 12);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(dx + dw - 6, dy + dh - 6, 12, 12);

            // Size label
            ctx.globalAlpha = 1;
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#ff0';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.textAlign = 'left';
            const duckLabel = `Duck: x=${d.x.toFixed(3)} y=${d.y.toFixed(3)} size=${d.size.toFixed(3)}`;
            ctx.strokeText(duckLabel, dx, dy - 8);
            ctx.fillText(duckLabel, dx, dy - 8);
        }

        // Admin badge
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#f0f';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('ADMIN — drag boxes to reposition', canvas.width - 14, 24);

        // Copy flash
        if (adminCopyFlash > 0) {
            ctx.globalAlpha = adminCopyFlash / 60;
            ctx.fillStyle = '#0f0';
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Colliders copied to clipboard!', canvas.width / 2, canvas.height / 2);
            adminCopyFlash--;
        }

        ctx.restore();
    }

    function drawDebugGrid() {
        ctx.save();

        // Grid lines every 10%
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';

        for (let i = 1; i < 20; i++) {
            const frac = i * 0.05;
            const x = canvas.width * frac;
            const y = canvas.height * frac;
            const isMajor = i % 2 === 0;

            ctx.globalAlpha = isMajor ? 0.5 : 0.25;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = isMajor ? 2 : 1;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();

            ctx.globalAlpha = isMajor ? 1 : 0.6;
            ctx.font = isMajor ? 'bold 22px monospace' : '14px monospace';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            const label = frac.toFixed(2);
            ctx.strokeText(label, x, isMajor ? 28 : 20);
            ctx.fillText(label, x, isMajor ? 28 : 20);
            ctx.strokeText(label, 40, y + (isMajor ? 8 : 5));
            ctx.fillText(label, 40, y + (isMajor ? 8 : 5));
        }

        // Player + duck position — big, outlined text
        ctx.globalAlpha = 1;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.fillStyle = '#0f0';
        ctx.strokeText(`Zeeb: ${player.x.toFixed(3)}, ${player.y.toFixed(3)}`, 14, canvas.height - 50);
        ctx.fillText(`Zeeb: ${player.x.toFixed(3)}, ${player.y.toFixed(3)}`, 14, canvas.height - 50);
        ctx.fillStyle = '#ff0';
        ctx.strokeText(`Duck: ${duck.x.toFixed(3)}, ${duck.y.toFixed(3)}`, 14, canvas.height - 20);
        ctx.fillText(`Duck: ${duck.x.toFixed(3)}, ${duck.y.toFixed(3)}`, 14, canvas.height - 20);
        ctx.fillStyle = '#0ff';
        ctx.strokeText(`Scene: ${currentScene}`, canvas.width - 220, canvas.height - 20);
        ctx.fillText(`Scene: ${currentScene}`, canvas.width - 220, canvas.height - 20);

        // Duck position crosshair
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        const ddx = duck.x * canvas.width;
        const ddy = duck.y * canvas.height;
        ctx.beginPath(); ctx.moveTo(ddx - 15, ddy); ctx.lineTo(ddx + 15, ddy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ddx, ddy - 15); ctx.lineTo(ddx, ddy + 15); ctx.stroke();

        // Draw colliders with big numbered labels
        const colliders = SCENES[currentScene].colliders || [];
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];

            const isSelected = adminMode && i === selectedCollider;

            if (c.w !== undefined) {
                // Rectangle collider
                const rx = c.x * canvas.width;
                const ry = c.y * canvas.height;
                const rw = c.w * canvas.width;
                const rh = c.h * canvas.height;

                ctx.globalAlpha = isSelected ? 0.3 : 0.15;
                ctx.fillStyle = isSelected ? '#ff0' : '#f00';
                ctx.fillRect(rx, ry, rw, rh);

                ctx.globalAlpha = isSelected ? 1 : 0.7;
                ctx.strokeStyle = isSelected ? '#ff0' : '#f00';
                ctx.lineWidth = isSelected ? 4 : 3;
                ctx.strokeRect(rx, ry, rw, rh);

                // Number label
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(`${i}`, rx + rw / 2, ry - 8);
                ctx.fillText(`${i}`, rx + rw / 2, ry - 8);
            } else {
                // Circle collider
                const cx = c.x * canvas.width;
                const cy = c.y * canvas.height;
                const cr = c.r * Math.min(canvas.width, canvas.height);

                ctx.globalAlpha = 0.15;
                ctx.fillStyle = '#f00';
                ctx.beginPath();
                ctx.arc(cx, cy, cr, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = '#f00';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(`${i}`, cx, cy - cr - 8);
                ctx.fillText(`${i}`, cx, cy - cr - 8);
            }
        }

        ctx.restore();
    }

    function drawPlayer() {
        const sprite = getPlayerSprite();
        if (!sprite) return;

        const playerSize = currentScene === 3 ? 0.215 : player.size;
        const h = canvas.height * playerSize;
        const aspect = sprite.naturalWidth / sprite.naturalHeight;
        const w = h * aspect;

        const px = player.x * canvas.width - w / 2;
        const py = player.y * canvas.height - h;

        // Waddle effect when moving
        if (player.moving) {
            const bounce = Math.abs(Math.sin(Date.now() * 0.01)) * h * 0.03;
            ctx.drawImage(sprite, px, py - bounce, w, h);
        } else {
            // Idle — gentle bob
            const bob = Math.sin(Date.now() * 0.003) * 2;
            ctx.drawImage(sprite, px, py + bob, w, h);
        }

        // Carried surfboard — tucked under arm, tilted
        if (carriedBoardImg && currentScene !== 3) {
            ctx.save();
            const boardH = h * 0.55;
            const boardAspect = carriedBoardImg.naturalWidth / carriedBoardImg.naturalHeight;
            const boardW = boardH * boardAspect;

            let bx, by, angle;
            if (player.facing === 'left') {
                bx = px + w * 0.1;
                by = py + h * 0.3;
                angle = 0.3; // slight tilt
            } else if (player.facing === 'up') {
                // Behind Zeeb — draw before sprite ideally, but just offset
                bx = px + w * 0.75;
                by = py + h * 0.3;
                angle = -0.2;
            } else {
                // right, down, idle
                bx = px + w * 0.9;
                by = py + h * 0.3;
                angle = -0.3; // slight tilt opposite
            }

            ctx.translate(bx, by);
            ctx.rotate(angle);
            ctx.drawImage(carriedBoardImg, -boardW / 2, -boardH / 2, boardW, boardH);
            ctx.restore();
        }

    }

    function drawPlayerShadow() {
        const sprite = getPlayerSprite();
        if (!sprite) return;
        const playerSize = currentScene === 3 ? 0.215 : player.size;
        const h = canvas.height * playerSize;
        const aspect = sprite.naturalWidth / sprite.naturalHeight;
        const w = h * aspect;

        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(
            player.x * canvas.width,
            player.y * canvas.height + 2,
            w * 0.35, h * 0.08, 0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }

    function getPlayerSprite() {
        if (!spritesLoaded) return fallbackSprite;

        if (!player.moving && !(currentScene === 3 && shop.cutscenePlaying)) {
            return sprites.idle || fallbackSprite;
        }

        const dir = player.facing;
        const f = player.frame + 1; // 1 or 2

        if (dir === 'right') {
            return sprites.walk_right_1 || sprites.idle || fallbackSprite;
        }
        if (dir === 'left') {
            return sprites.walk_left_1 || sprites.idle || fallbackSprite;
        }
        if (dir === 'up') {
            return sprites.walk_up || sprites.idle || fallbackSprite;
        }
        if (dir === 'down') {
            return sprites.walk_down || sprites.idle || fallbackSprite;
        }

        return sprites.idle || fallbackSprite;
    }

    // ---------------------------------------------------------------------------
    // Resize
    // ---------------------------------------------------------------------------
    function resize() {
        // Match the aspect ratio of the scene images (2732x1821)
        const aspect = 2732 / 1821;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > aspect) {
            w = h * aspect;
        } else {
            h = w / aspect;
        }

        canvas.width = Math.round(w * devicePixelRatio);
        canvas.height = Math.round(h * devicePixelRatio);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.style.margin = 'auto';
        canvas.style.position = 'absolute';
        canvas.style.top = '50%';
        canvas.style.left = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
    }

    window.addEventListener('resize', resize);

    // ---------------------------------------------------------------------------
    // Game loop
    // ---------------------------------------------------------------------------
    function loop() {
        update();
        render();
        requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------------------------
    // Music
    // ---------------------------------------------------------------------------
    const music = new Audio('../Audio/level3_coconut_island.m4a');
    music.loop = true;
    music.volume = 0;
    let musicStarted = false;

    function startMusic() {
        if (musicStarted) return;
        musicStarted = true;
        music.volume = 0.5;
        music.play().then(() => {
            console.log('Level 3 music playing');
        }).catch((err) => {
            console.warn('Music play failed:', err);
            musicStarted = false;
        });
    }

    // Unlock audio on every interaction until it works
    function unlockAudio() {
        startMusic();
        if (musicStarted) {
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        }
    }
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Pause/resume audio when tab/app is hidden (especially mobile Safari)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            music.pause();
        } else {
            if (musicStarted) music.play().catch(() => {});
        }
    });
    window.addEventListener('pagehide', () => { music.pause(); });

    // Also try on load in case autoplay is allowed
    music.addEventListener('canplaythrough', () => {
        console.log('Music loaded, ready to play');
    });
    music.addEventListener('error', (e) => {
        console.error('Music load error:', e.target.error);
    });

    // ---------------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------------
    async function init() {
        resize();
        await loadScene(0);
        await loadSprites();
        loadBoardImages(); // load in background, no need to block
        loop();
    }

    init();
})();
