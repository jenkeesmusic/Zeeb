(function initStartScreen() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  function wire() {
    const zeeb = document.getElementById("zeebHero");
    const bgMusic = document.getElementById("bgMusic");
    if (!zeeb || !bgMusic) return;

    try {
      bgMusic.pause();
      bgMusic.muted = true;
    } catch (_) {}

    zeeb.style.cursor = "pointer";

    const onInteract = () => {
      try {
        bgMusic.muted = false;
        bgMusic.volume = 0.6;
        const p = bgMusic.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) {}

      zeeb.classList.remove("tickle");
      // eslint-disable-next-line no-unused-expressions
      zeeb.offsetWidth;
      zeeb.classList.add("tickle");
    };

    zeeb.addEventListener("click", onInteract, { passive: true });
    zeeb.addEventListener("touchstart", onInteract, { passive: true });

    zeeb.addEventListener("animationend", (e) => {
      if (e.animationName === "zeeb-tickle") {
        zeeb.classList.remove("tickle");
      }
    });

    const planet = document.querySelector(".planet-zeeb");
    const title = document.getElementById("startTitle");
    if (planet && title) {
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
      if (!title.dataset.wrapped) wrapTitle();

      const wave = () => {
        const original = title.dataset.original || "";
        const currentSpans = title.querySelectorAll("span").length;
        if (!title.dataset.wrapped || currentSpans !== Array.from(original).length) {
          wrapTitle();
        }

        title.classList.remove("title-wave");
        // eslint-disable-next-line no-unused-expressions
        title.offsetWidth;
        requestAnimationFrame(() => {
          title.classList.add("title-wave");
          const spans = title.querySelectorAll("span");
          const count = spans.length || 1;
          const stagger = 50;
          const duration = 600;
          const total = duration + (count - 1) * stagger + 100;
          setTimeout(() => title.classList.remove("title-wave"), total);
        });
      };

      planet.addEventListener("click", wave, { passive: true });
      planet.addEventListener("touchstart", wave, { passive: true });

    }
  }
})();
