(function initStartScreen() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  function wire() {
    // ===== The Zeeb Show functionality =====
    wireZeebShow();

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

  // ===== The Zeeb Show Video Player =====
  function wireZeebShow() {
    const zeebShowBtn = document.getElementById("zeebShowBtn");
    const zeebShowOverlay = document.getElementById("zeebShowOverlay");
    const closeZeebShowBtn = document.getElementById("closeZeebShow");
    const videoPlayerOverlay = document.getElementById("videoPlayerOverlay");
    const closeVideoBtn = document.getElementById("closeVideoPlayer");
    const video = document.getElementById("zeebShowVideo");
    const videoSource = document.getElementById("videoSource");
    const startOverlay = document.getElementById("overlay");
    const episodeCards = document.querySelectorAll(".episode-card");
    const bgMusic = document.getElementById("bgMusic");

    if (!zeebShowBtn || !zeebShowOverlay) return;

    // Open episode selection
    zeebShowBtn.addEventListener("click", () => {
      startOverlay.classList.add("hidden");
      zeebShowOverlay.classList.remove("hidden");
      // Pause background music when entering the show
      if (bgMusic) {
        try { bgMusic.pause(); } catch (_) {}
      }
    });

    // Close episode selection, back to start
    closeZeebShowBtn.addEventListener("click", () => {
      zeebShowOverlay.classList.add("hidden");
      startOverlay.classList.remove("hidden");
    });

    // Handle episode card clicks
    episodeCards.forEach(card => {
      card.addEventListener("click", () => {
        const src = card.dataset.src;
        if (!src || !videoSource || !video) return;

        // Set video source and play
        videoSource.src = src;
        video.load();
        
        // Hide episode selection, show video player
        zeebShowOverlay.classList.add("hidden");
        videoPlayerOverlay.classList.remove("hidden");
        
        // Play video
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      });
    });

    // Close video player, back to episode selection
    function closeVideo() {
      video.pause();
      video.currentTime = 0;
      videoPlayerOverlay.classList.add("hidden");
      zeebShowOverlay.classList.remove("hidden");
    }

    closeVideoBtn.addEventListener("click", closeVideo);

    // Also close when video ends
    video.addEventListener("ended", () => {
      setTimeout(closeVideo, 500); // Small delay before returning to menu
    });

    // Close video on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!videoPlayerOverlay.classList.contains("hidden")) {
          closeVideo();
        } else if (!zeebShowOverlay.classList.contains("hidden")) {
          zeebShowOverlay.classList.add("hidden");
          startOverlay.classList.remove("hidden");
        }
      }
    });
  }
})();
