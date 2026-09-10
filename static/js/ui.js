(function () {
  function initHeroSlider(root) {
    const track = root.querySelector(".hero-track");
    const slides = root.querySelectorAll(".hero-slide");
    const dotsWrap = root.querySelector(".hero-dots");
    if (!track || slides.length < 2) return;

    let index = Math.floor(Math.random() * slides.length);
    let timer;

    slides.forEach((_, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Go to slide " + (i + 1));
      btn.addEventListener("click", () => go(i, true));
      dotsWrap.appendChild(btn);
    });

    const dots = dotsWrap.querySelectorAll("button");

    function render() {
      track.style.transform = "translateX(-" + index * 100 + "%)";
      dots.forEach((d, i) => d.classList.toggle("active", i === index));
    }

    function go(i, manual) {
      index = (i + slides.length) % slides.length;
      render();
      if (manual) restart();
    }

    function next() {
      go(index + 1, false);
    }

    function restart() {
      clearInterval(timer);
      timer = setInterval(next, 4200 + Math.floor(Math.random() * 1200));
    }

    const prevBtn = root.querySelector(".hero-nav.prev");
    const nextBtn = root.querySelector(".hero-nav.next");
    if (prevBtn) prevBtn.addEventListener("click", () => go(index - 1, true));
    if (nextBtn) nextBtn.addEventListener("click", () => go(index + 1, true));

    let startX = 0;
    root.addEventListener(
      "touchstart",
      (e) => {
        startX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    root.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) go(index + 1, true);
        else go(index - 1, true);
      },
      { passive: true }
    );

    render();
    restart();
  }

  function initTipSlider(root) {
    const track = root.querySelector(".tip-track");
    const slides = root.querySelectorAll(".tip-slide");
    if (!track || slides.length < 2) return;
    let index = 0;
    setInterval(() => {
      index = (index + 1) % slides.length;
      track.style.transform = "translateX(-" + index * 100 + "%)";
    }, 3800 + Math.floor(Math.random() * 1400));
  }

  function initBackgroundFX() {
    if (document.getElementById("bg-fx")) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const wrap = document.createElement("div");
    wrap.id = "bg-fx";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML =
      '<span class="bg-blob b1"></span>' +
      '<span class="bg-blob b2"></span>' +
      '<span class="bg-blob b3"></span>';

    const canvas = document.createElement("canvas");
    canvas.className = "bg-canvas";
    wrap.appendChild(canvas);
    document.body.insertBefore(wrap, document.body.firstChild);

    if (reduce) return; // blobs are already static; skip particle motion

    const ctx = canvas.getContext("2d");
    let w = 0,
      h = 0,
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let raf = null;
    let running = true;

    function isDark() {
      return document.documentElement.classList.contains("dark");
    }

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(
        26,
        Math.min(90, Math.round((w * h) / 17000))
      );
      particles = new Array(count).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8,
        hot: Math.random() < 0.18, // a few orange accents
      }));
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      const dark = isDark();
      const dot = dark ? "94,234,212" : "13,148,136"; // teal
      const hot = "255,106,26"; // orange
      const linkBase = dark ? "94,234,212" : "11,110,99";
      const maxDist = 132;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle =
          "rgba(" + (p.hot ? hot : dot) + "," + (dark ? 0.85 : 0.7) + ")";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            const a = (1 - d / maxDist) * (dark ? 0.22 : 0.16);
            ctx.strokeStyle = "rgba(" + linkBase + "," + a + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        frame();
      }
    });

    resize();
    frame();
  }

  function initScrollReveal() {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const selector = [
      "main > section",
      "main > div.home-grid",
      "main > div.cta-strip",
      "main > div.aml-note",
      "main > div.page-hero",
      ".svc-card",
      ".feature-card",
      ".stat-box",
      ".rate-card",
      ".cool-card",
      ".order-mcard",
      ".orders-panel",
      ".panel",
    ].join(",");

    const seen = new Set();
    const els = [];
    document.querySelectorAll(selector).forEach((el) => {
      if (seen.has(el)) return;
      // skip if it's nested inside another already-revealing element
      if (el.closest(".reveal")) return;
      seen.add(el);
      els.push(el);
    });

    if (!els.length) return;

    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("reveal", "in"));
      return;
    }

    els.forEach((el) => el.classList.add("reveal"));

    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          // small stagger between siblings for a lively cascade
          const sibs = Array.from(el.parentElement ? el.parentElement.children : []);
          const idx = Math.max(0, sibs.indexOf(el));
          el.style.transitionDelay = Math.min(idx * 60, 300) + "ms";
          el.classList.add("in");
          obs.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    els.forEach((el) => io.observe(el));
  }

  function scrambleNumbers() {
    document.querySelectorAll("[data-rand]").forEach((el) => {
      const min = Number(el.dataset.min || 12);
      const max = Number(el.dataset.max || 98);
      const suffix = el.dataset.suffix || "";
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      el.textContent = n + suffix;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initBackgroundFX();
    document.querySelectorAll("[data-hero-slider]").forEach(initHeroSlider);
    document.querySelectorAll("[data-tip-slider]").forEach(initTipSlider);
    initScrollReveal();
    scrambleNumbers();
    setInterval(scrambleNumbers, 7000);
  });
})();
