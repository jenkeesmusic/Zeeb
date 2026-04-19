const openShowBtn = document.getElementById('openShow');
const showOverlay = document.getElementById('showOverlay');
const closeShowBtn = document.getElementById('closeShow');
const episodeButtons = document.querySelectorAll('.episode');
const video = document.getElementById('showVideo');
const source = document.getElementById('showSource');
const playerTitle = document.getElementById('playerTitle');
const isPhoneLayout = () => window.matchMedia('(max-width: 640px)').matches;

let showPreviousFocus = null;

const openOverlay = () => {
  showPreviousFocus = document.activeElement;
  showOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  closeShowBtn.focus();
};

const closeOverlay = () => {
  showOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
  if (source) {
    source.src = '';
    video.load();
  }
  if (playerTitle) {
    playerTitle.textContent = 'Pick an episode above';
  }
  if (showPreviousFocus && typeof showPreviousFocus.focus === 'function') {
    showPreviousFocus.focus();
  }
  showPreviousFocus = null;
};

openShowBtn.addEventListener('click', openOverlay);
closeShowBtn.addEventListener('click', closeOverlay);

showOverlay.addEventListener('click', (event) => {
  if (event.target === showOverlay) {
    closeOverlay();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !showOverlay.classList.contains('hidden')) {
    closeOverlay();
  }
});

const playIslandsBtn = document.getElementById('playIslands');
const betaOverlay = document.getElementById('betaOverlay');
const betaCancelBtn = document.getElementById('betaCancel');

let betaPreviousFocus = null;

const closeBeta = () => {
  betaOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  if (betaPreviousFocus && typeof betaPreviousFocus.focus === 'function') {
    betaPreviousFocus.focus();
  }
  betaPreviousFocus = null;
};

playIslandsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  betaPreviousFocus = document.activeElement;
  betaOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  betaCancelBtn.focus();
});

betaCancelBtn.addEventListener('click', closeBeta);

betaOverlay.addEventListener('click', (e) => {
  if (e.target === betaOverlay) closeBeta();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !betaOverlay.classList.contains('hidden')) {
    closeBeta();
  }
});

const menuMusic = document.getElementById('menuMusic');
const muteBtn = document.getElementById('muteBtn');
const MUTE_KEY = 'gbg-muted';

const applyMuteState = (muted) => {
  if (menuMusic) menuMusic.muted = muted;
  if (muteBtn) {
    muteBtn.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
    const icon = muteBtn.querySelector('.mute-icon');
    const label = muteBtn.querySelector('.mute-label');
    if (icon)  icon.textContent  = muted ? '🔇' : '🔊';
    if (label) label.textContent = muted ? 'MUTED' : 'SOUND';
  }
};

let isMuted = false;
try { isMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) {}
applyMuteState(isMuted);

if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    try { localStorage.setItem(MUTE_KEY, isMuted ? '1' : '0'); } catch (_) {}
    applyMuteState(isMuted);
    if (menuMusic && !isMuted && menuMusic.paused) {
      menuMusic.play().catch(() => {});
    }
  });
}

if (menuMusic) {
  menuMusic.volume = 0.3;
  const startMusic = () => {
    menuMusic.play().catch(() => {});
    document.removeEventListener('click', startMusic);
    document.removeEventListener('keydown', startMusic);
    document.removeEventListener('touchstart', startMusic);
  };
  document.addEventListener('click', startMusic);
  document.addEventListener('keydown', startMusic);
  document.addEventListener('touchstart', startMusic);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      menuMusic.pause();
    } else {
      menuMusic.play().catch(() => {});
    }
  });
}

episodeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const src = button.dataset.src;
    const title = button.dataset.title || 'Playing episode';

    if (!src) {
      return;
    }

    source.src = src;
    playerTitle.textContent = title;
    video.load();
    video.play();
    if (isPhoneLayout()) {
      requestAnimationFrame(() => {
        video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  });
});
