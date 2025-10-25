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
      // Store original text once, and define a wrapper to span-ify per letter
      if (!title.dataset.original) {
        title.dataset.original = title.textContent || "";
      }
      function wrapTitle() {
        const text = title.dataset.original || "";
        const frag = document.createDocumentFragment();
        let idx = 0;
        for (const ch of Array.from(text)) {
          const span = document.createElement("span");
          span.textContent = ch;
          span.style.setProperty("--i", String(idx++));
          frag.appendChild(span);
        }
        title.textContent = "";
        title.appendChild(frag);
        title.dataset.wrapped = "true";
      }
      // Initial wrap
      if (!title.dataset.wrapped) wrapTitle();

      const wave = () => {
        // Rebuild spans if the count doesn't match original text length for any reason
        const original = title.dataset.original || "";
        const currentSpans = title.querySelectorAll("span").length;
        if (!title.dataset.wrapped || currentSpans !== Array.from(original).length) {
          wrapTitle();
        }

        // simple, reliable re-trigger: remove class, force reflow, then add next frame
        title.classList.remove("title-wave");
        // eslint-disable-next-line no-unused-expressions
        title.offsetWidth;
        requestAnimationFrame(() => {
          title.classList.add("title-wave");
          // ensure class is cleared only after the last letter finishes
          const spans = title.querySelectorAll("span");
          const count = spans.length || 1;
          const stagger = 50;   // ms per char (must match CSS)
          const duration = 600; // ms (matches @keyframes duration)
          const total = duration + (count - 1) * stagger + 100; // small buffer
          setTimeout(() => title.classList.remove("title-wave"), total);
        });
      };

      planet.addEventListener("click", wave, { passive: true });
      planet.addEventListener("touchstart", wave, { passive: true });

    }
  }
})();
