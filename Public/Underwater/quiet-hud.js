// Keep choices in the pause menu and leave the ocean for swimming.
export function createQuietHud({ rally }) {
  const $ = id => document.getElementById(id), menu = $('menu');
  menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'true');
  menu.insertAdjacentHTML('beforeend', `
    <div id="menuTrips" class="menu-actions"></div>
    <div id="menuWreck" class="menu-status" hidden></div>
    <div id="menuRace" class="menu-status" hidden></div>
    <details id="menuSettings"><summary>Music &amp; settings</summary><div id="settingButtons"></div></details>
    <details id="controlHelp"><summary>Controls</summary></details>`);
  for (const id of ['playBtn', 'rescueBtn', 'wreckReturn', 'wreckAgain']) $('menuTrips').append($(id));
  for (const id of ['wreckRoom', 'wreckClue']) $('menuWreck').append($(id));
  for (const id of ['zone', 'score', 'progress']) $('menuRace').append($(id));
  for (const id of ['musicBtn', 'nextBtn', 'cameraBtn', 'graphicsBtn']) $('settingButtons').append($(id));
  const depthToggle = document.createElement('button');
  depthToggle.id = 'depthButtonsToggle'; depthToggle.type = 'button';
  let depthButtons = false;
  try { depthButtons = localStorage.getItem('zeeb-depth-buttons') === 'on'; } catch {}
  function showDepthButtons() {
    document.body.classList.toggle('depth-buttons', depthButtons);
    depthToggle.textContent = `Touch depth buttons: ${depthButtons ? 'On' : 'Off'}`;
    depthToggle.setAttribute('aria-pressed', String(depthButtons));
  }
  depthToggle.addEventListener('click', () => {
    depthButtons = !depthButtons; showDepthButtons();
    try { localStorage.setItem('zeeb-depth-buttons', depthButtons ? 'on' : 'off'); } catch {}
  });
  showDepthButtons(); $('settingButtons').append(depthToggle);
  $('menuSettings').append($('now'));
  $('controlHelp').append($('menuHelp'));
  $('pauseBtn').textContent = 'Menu';
  $('pauseBtn').setAttribute('aria-label', 'Pause and open menu');
  $('pauseBtn').setAttribute('aria-haspopup', 'dialog');
  $('stage').tabIndex = -1;
  let previousMode;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || menu.hidden) return;
    const items = [...menu.querySelectorAll('button, summary, a[href]')]
      .filter(el => !el.disabled && el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !menu.contains(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  });
  return {
    update() {
      const mode = rally.state.mode;
      if (mode === previousMode) return;
      previousMode = mode;
      $('menuRace').hidden = mode !== 'paused' || rally.state.pausedMode !== 'racing';
      $('pauseBtn').setAttribute('aria-expanded', String(mode === 'paused'));
      if (menu.hidden) {
        $('menuSettings').open = $('controlHelp').open = false;
        if (menu.contains(document.activeElement)) $('stage').focus({ preventScroll: true });
      } else {
        $('menuHelp').hidden = false;
        menu.scrollTop = 0;
        $('startBtn').focus({ preventScroll: true });
      }
    }
  };
}
