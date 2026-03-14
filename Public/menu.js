const openShowBtn = document.getElementById('openShow');
const showOverlay = document.getElementById('showOverlay');
const closeShowBtn = document.getElementById('closeShow');
const episodeButtons = document.querySelectorAll('.episode');
const video = document.getElementById('showVideo');
const source = document.getElementById('showSource');
const playerTitle = document.getElementById('playerTitle');
const showDialog = showOverlay ? showOverlay.querySelector('.show-dialog') : null;
const isPhoneLayout = () => window.matchMedia('(max-width: 720px)').matches;

const openOverlay = () => {
  showOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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
    playerTitle.textContent = 'Select an episode to play';
  }
  if (showDialog) {
    showDialog.classList.remove('has-selection');
  }
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

// Beta disclaimer for Zeeb Islands
const playIslandsBtn = document.getElementById('playIslands');
const betaOverlay = document.getElementById('betaOverlay');
const betaCancelBtn = document.getElementById('betaCancel');

const closeBeta = () => {
  betaOverlay.classList.add('hidden');
  document.body.style.overflow = '';
};

playIslandsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  betaOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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

episodeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const src = button.dataset.src;
    const title = button.dataset.title || 'Playing episode';

    if (!src) {
      return;
    }

    source.src = src;
    playerTitle.textContent = title;
    if (showDialog) {
      showDialog.classList.add('has-selection');
    }
    video.load();
    video.play();
    if (isPhoneLayout()) {
      requestAnimationFrame(() => {
        video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  });
});
