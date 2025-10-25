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

    // Planet Zeeb click animates the title (bop up/down)
    const planet = document.querySelector(".planet-zeeb");
    const title = document.getElementById("startTitle");
    if (planet && title) {
      const bop = () => {
        title.classList.remove("title-bop");
        // restart CSS animation
        // eslint-disable-next-line no-unused-expressions
        title.offsetWidth;
        title.classList.add("title-bop");
      };
      planet.addEventListener("click", bop, { passive: true });
      planet.addEventListener("touchstart", bop, { passive: true });
      title.addEventListener("animationend", (e) => {
        if (e.animationName === "title-bop") {
          title.classList.remove("title-bop");
        }
      });
    }
  }
})();
