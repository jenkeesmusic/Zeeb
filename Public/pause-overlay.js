/**
 * Universal Pause Overlay — shared across all Zeeb games
 *
 * Usage:
 *   1. Include pause-overlay.css and this script in your page
 *   2. Call PauseOverlay.init({ onResume, onMainMenu, menuUrl })
 *   3. Call PauseOverlay.show() / PauseOverlay.hide()
 *
 * Keyboard: pressing P or Escape while visible will resume.
 * Clicking/tapping Resume or anywhere outside the card will resume.
 */
var PauseOverlay = (function () {
    var el = null;
    var card = null;
    var callbacks = { onResume: null, onMainMenu: null };
    var menuUrl = '../../index.html';
    var _visible = false;

    function build() {
        if (el) return;
        el = document.createElement('div');
        el.className = 'pause-overlay';
        el.id = 'pauseOverlay';
        el.innerHTML =
            '<div class="pause-card">' +
                '<h2 class="pause-title">Paused</h2>' +
                '<div class="pause-buttons">' +
                    '<button class="pause-btn pause-btn-resume" id="pauseResume">Resume</button>' +
                    '<button class="pause-btn pause-btn-menu" id="pauseMenu">Main Menu</button>' +
                '</div>' +
                '<p class="pause-hint">P or Esc to resume</p>' +
            '</div>';
        document.body.appendChild(el);
        card = el.querySelector('.pause-card');

        // Resume button
        el.querySelector('#pauseResume').addEventListener('click', function (e) {
            e.stopPropagation();
            hide();
        });

        // Main Menu button
        el.querySelector('#pauseMenu').addEventListener('click', function (e) {
            e.stopPropagation();
            if (callbacks.onMainMenu) {
                callbacks.onMainMenu();
            } else {
                window.location.href = menuUrl;
            }
        });

        // Click outside card = resume
        el.addEventListener('click', function (e) {
            if (e.target === el) {
                hide();
            }
        });

        // Keyboard
        document.addEventListener('keydown', function (e) {
            if (!_visible) return;
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                hide();
            }
        }, true);
    }

    function show() {
        build();
        _visible = true;
        el.style.display = 'flex';
        // Force reflow then animate
        void el.offsetWidth;
        el.classList.add('visible');
    }

    function hide() {
        if (!el || !_visible) return;
        _visible = false;
        el.classList.remove('visible');
        el.style.display = 'none';
        if (callbacks.onResume) callbacks.onResume();
    }

    function isVisible() {
        return _visible;
    }

    function init(opts) {
        opts = opts || {};
        if (opts.onResume) callbacks.onResume = opts.onResume;
        if (opts.onMainMenu) callbacks.onMainMenu = opts.onMainMenu;
        if (opts.menuUrl) menuUrl = opts.menuUrl;
        build();
    }

    return { init: init, show: show, hide: hide, isVisible: isVisible };
})();
