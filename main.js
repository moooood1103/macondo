/* ============================================================
   百年孤独 · 阅读报告 —— 动效脚本
   克制：滚动进度、节点头部、滚动揭示、蝶影画布
   ============================================================ */
(() => {
  "use strict";

  // 仅当脚本正常运行时才启用“先隐藏再显现”的动画；
  // 若脚本缺失或出错，页面内容始终保持可见。
  document.documentElement.classList.add("anim");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 封面入场 ---------- */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add("loaded"));
  });

  /* ---------- 顶栏与进度条 ---------- */
  const header = document.getElementById("siteHeader");
  const progressBar = document.getElementById("progressBar");
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (progressBar) progressBar.style.width = `${(p * 100).toFixed(2)}%`;
      header.classList.toggle("scrolled", window.scrollY > 8);
      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 滚动揭示（带轻微错落） ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          el.classList.add("in");
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    revealEls.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal"));
      const idx = siblings.indexOf(el);
      el.style.setProperty("--d", `${Math.min(idx, 5) * 0.09}s`);
      io.observe(el);
    });
  }

  /* ---------- 蝶影画布：若有若无的金色蝴蝶与萤火 ---------- */
  const canvas = document.getElementById("butterflies");
  const ctx = canvas.getContext("2d");
  const GOLD = { r: 217, g: 168, b: 94 };

  let W = 0, H = 0, DPR = 1;
  let butterflies = [];
  let fireflies = [];
  let rafId = null;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    const count = Math.max(4, Math.min(7, Math.round(W / 340)));
    butterflies = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 11 + Math.random() * 15,
      speed: 0.12 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      wander: Math.random() * Math.PI * 2,
      alpha: 0.5 + Math.random() * 0.28,
      flip: Math.random() > 0.5 ? 1 : -1,
    }));
    fireflies = Array.from({ length: Math.max(8, Math.round(W / 130)) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.8 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.9,
      alpha: 0.2 + Math.random() * 0.24,
    }));
  }

  function butterfly(ctx, b, t) {
    const flap = Math.sin(t * b.speed + b.phase);
    const wobble = 0.72 + 0.28 * flap;          // 振翅幅度
    const yaw = Math.sin(t * b.speed * 0.5 + b.phase) * 0.35;
    const a = b.alpha;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(yaw);
    ctx.scale(b.flip, 1);

    const s = b.size;
    ctx.fillStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${a})`;
    ctx.beginPath();
    // 上翅
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-s * 0.55 * wobble, -s * 0.62, -s * 1.15 * wobble, -s * 0.5, -s * 0.82 * wobble, s * 0.08);
    ctx.bezierCurveTo(-s * 0.45 * wobble, s * 0.05, -s * 0.2 * wobble, s * 0.14, 0, s * 0.22);
    ctx.closePath();
    ctx.fill();
    // 下翅
    ctx.beginPath();
    ctx.moveTo(0, s * 0.18);
    ctx.bezierCurveTo(-s * 0.42 * wobble, s * 0.12, -s * 0.72 * wobble, s * 0.4, -s * 0.5 * wobble, s * 0.62);
    ctx.bezierCurveTo(-s * 0.3 * wobble, s * 0.72, -s * 0.12 * wobble, s * 0.5, 0, s * 0.34);
    ctx.closePath();
    ctx.fill();
    // 身体
    ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${Math.min(1, a + 0.15)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.05);
    ctx.lineTo(0, s * 0.62);
    ctx.stroke();

    ctx.restore();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // 萤火：缓慢呼吸的微光
    for (const f of fireflies) {
      const pulse = 0.5 + 0.5 * Math.sin(t * f.speed + f.phase);
      ctx.fillStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${(f.alpha * pulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 蝴蝶：缓慢上浮、左右徘徊
    for (const b of butterflies) {
      const t0 = t * 0.001;
      b.x += Math.sin(t0 * 0.4 + b.wander) * 0.28;
      b.y -= b.speed * 0.35;
      if (b.y < -60) { b.y = H + 50; b.x = Math.random() * W; }
      if (b.x < -60) b.x = W + 40;
      if (b.x > W + 60) b.x = -40;
      butterfly(ctx, b, t0);
    }

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (rafId) return;
    rafId = requestAnimationFrame(draw);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function initCanvas() {
    resize();
    if (reduceMotion) {
      // 减少动效：绘制一帧静态蝶影，不再运行动画
      draw(0);
      stop();
      return;
    }
    start();
  }

  window.addEventListener("resize", () => {
    resize();
    if (!reduceMotion) stop();
  });
  window.addEventListener("resize", () => {
    if (!reduceMotion) start();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!reduceMotion) start();
  });

  initCanvas();
})();
