(function initStartScreen() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  function wire() {
    const zeeb = document.getElementById("zeebHero");
    const bgMusic = document.getElementById("bgMusic");
    if (!zeeb) return;

    try {
      if (bgMusic) {
        bgMusic.pause();
        bgMusic.muted = true;
      }
    } catch (_) {}

    zeeb.style.cursor = "pointer";

    const onInteract = () => {
      try {
        if (bgMusic) {
          bgMusic.muted = false;
          bgMusic.volume = 0.6;
          const p = bgMusic.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
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

    // Secret level select — tap Planet Zeeb 8 times fast
    const planetEl = document.getElementById("planetZeeb");
    const levelSelectOverlay = document.getElementById("levelSelectOverlay");
    const closeLevelSelect = document.getElementById("closeLevelSelect");
    if (planetEl && levelSelectOverlay) {
      let tapCount = 0;
      let tapTimer = null;
      const TAPS_NEEDED = 8;
      const TAP_WINDOW = 3000; // ms to complete all taps

      const onPlanetTap = () => {
        tapCount++;
        if (tapCount === 1) {
          tapTimer = setTimeout(() => { tapCount = 0; }, TAP_WINDOW);
        }
        if (tapCount >= TAPS_NEEDED) {
          clearTimeout(tapTimer);
          tapCount = 0;
          levelSelectOverlay.classList.remove("hidden");
        }
      };

      planetEl.addEventListener("click", onPlanetTap);
      planetEl.addEventListener("touchstart", onPlanetTap, { passive: true });

      if (closeLevelSelect) {
        closeLevelSelect.addEventListener("click", () => {
          levelSelectOverlay.classList.add("hidden");
        });
      }
      levelSelectOverlay.addEventListener("click", (e) => {
        if (e.target === levelSelectOverlay) levelSelectOverlay.classList.add("hidden");
      });

      // Surf Shop hack — load shop with 50 coins
      var shopHack = document.getElementById("shopHack");
      if (shopHack) {
        shopHack.addEventListener("click", function (e) {
          e.preventDefault();
          localStorage.setItem("zeeb_coins", "50");
          window.location.href = "../Islands/shop/";
        });
      }
    }
  }
})();
