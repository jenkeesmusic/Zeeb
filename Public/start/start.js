// Start Screen JS (isolated)
// - No music on load
// - Clicking Zeeb starts music and triggers a playful tickle animation

(function initStartScreen() {
  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  function wire() {
    const zeeb = document.getElementById("zeebHero");
    const bgMusic = document.getElementById("bgMusic");
    if (!zeeb || !bgMusic) return;

    // Ensure initial state: no autoplay
    try {
      bgMusic.pause();
      bgMusic.muted = true; // keep muted until user clicks Zeeb
    } catch (_) {}

    zeeb.style.cursor = "pointer";

    // Click/touch starts music and tickle animation
    const onInteract = () => {
      try {
        bgMusic.muted = false;
        bgMusic.volume = 0.6;
        const p = bgMusic.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) {}

      // retrigger tickle animation
      zeeb.classList.remove("tickle");
      // Reflow to restart animation each click
      // eslint-disable-next-line no-unused-expressions
      zeeb.offsetWidth;
      zeeb.classList.add("tickle");
    };

    zeeb.addEventListener("click", onInteract, { passive: true });
    zeeb.addEventListener("touchstart", onInteract, { passive: true });

    // Clean up tickle class when animation completes
    zeeb.addEventListener("animationend", (e) => {
      if (e.animationName === "zeeb-tickle") {
        zeeb.classList.remove("tickle");
      }
    });

    // Planet Zeeb click animates the title with a simple per-letter wave
    const planet = document.querySelector(".planet-zeeb");
    const title = document.getElementById("startTitle");
    if (planet && title) {
      // One-time wrap of each character in spans with a --i index for staggered delay
      if (!title.dataset.wrapped) {
        const text = title.textContent || "";
        const frag = document.createDocumentFragment();
        let idx = 0;
        for (const ch of text) {
          const span = document.createElement("span");
          span.textContent = ch;
          span.style.setProperty("--i", String(idx++));
          frag.appendChild(span);
        }
        title.textContent = "";
        title.appendChild(frag);
        title.dataset.wrapped = "true";
      }

      const wave = () => {
        title.classList.remove("title-wave");
        // restart CSS animation
        // eslint-disable-next-line no-unused-expressions
        title.offsetWidth;
        title.classList.add("title-wave");
      };

      planet.addEventListener("click", wave, { passive: true });
      planet.addEventListener("touchstart", wave, { passive: true });

      title.addEventListener("animationend", (e) => {
        if (e.animationName === "title-wave") {
          title.classList.remove("title-wave");
        }
      });
    }
  }
})();
