/* ==========================================================================
   visualizations.js — every interactive chart & widget on the page
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- utils */
  if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
      const r = Array.isArray(radii) ? radii[0] || 0 : (radii || 0);
      const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const C = {
    brand: "#eab308",
    brand2: "#2dd4bf",
    accent: "#2dd4bf",
    teal: "#2dd4bf",
    gold: "#eab308",
    ink: "#eef3f2",
    soft: "#bcc7c9",
    muted: "#8b979e",
    line: "rgba(226, 232, 240, 0.16)",
    grid: "rgba(226, 232, 240, 0.07)",
    paper: "#0d1319",
    fill: "rgba(234, 179, 8, 0.16)",
    fill2: "rgba(234, 179, 8, 0.18)"
  };

  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
      a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  const normalCdf = (x, mu, sd) => 0.5 * (1 + erf((x - mu) / (sd * Math.SQRT2)));
  const normalPdf = (x, mu, sd) =>
    Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  const factorial = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

  function fmt(x, d) {
    if (!isFinite(x)) return x > 0 ? "∞" : (x < 0 ? "−∞" : "NaN");
    return x.toFixed(d === undefined ? 4 : d);
  }

  /* canvas sizing: keep CSS-driven width, honour attribute aspect ratio */
  function setup(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ratio = canvas.height / canvas.width || 0.5;
    const w = Math.max(240, canvas.clientWidth || canvas.width || 640);
    const h = Math.round(w * ratio);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function makePlot(w, h, pad, xMin, xMax, yMin, yMax) {
    const px = pad.l, py = pad.t;
    const pw = Math.max(10, w - pad.l - pad.r);
    const ph = Math.max(10, h - pad.t - pad.b);
    return {
      px, py, pw, ph, xMin, xMax, yMin, yMax,
      X: (x) => px + ((x - xMin) / (xMax - xMin)) * pw,
      Y: (y) => py + ph - ((y - yMin) / (yMax - yMin)) * ph,
      invX: (sx) => xMin + ((sx - px) / pw) * (xMax - xMin),
      invY: (sy) => yMin + ((py + ph - sy) / ph) * (yMax - yMin)
    };
  }

  function frame(ctx, P, opts) {
    opts = opts || {};
    const { px, py, pw, ph } = P;
    ctx.save();
    // grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    const xTicks = opts.xTicks || 8;
    const yTicks = opts.yTicks || 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = py + (ph * i) / yTicks;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke();
    }
    for (let i = 0; i <= xTicks; i++) {
      const x = px + (pw * i) / xTicks;
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + ph); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);
    // labels
    ctx.fillStyle = C.muted;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (opts.xTicksAt) {
      opts.xTicksAt.forEach((xv) => {
        const x = P.X(xv);
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + ph); ctx.stroke();
        const label = opts.xFmt ? opts.xFmt(xv) : String(xv);
        if (label) ctx.fillText(label, x, py + ph + 6);
      });
    } else {
      for (let i = 0; i <= xTicks; i++) {
        const xv = P.xMin + ((P.xMax - P.xMin) * i) / xTicks;
        const x = px + (pw * i) / xTicks;
        ctx.fillText(opts.xFmt ? opts.xFmt(xv) : fmt(xv, 1), x, py + ph + 6);
      }
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= yTicks; i++) {
      const yv = P.yMax - ((P.yMax - P.yMin) * i) / yTicks;
      const y = py + (ph * i) / yTicks;
      ctx.fillText(opts.yFmt ? opts.yFmt(yv) : fmt(yv, 2), px - 8, y);
    }
    if (opts.xLabel) {
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillStyle = C.soft;
      ctx.fillText(opts.xLabel, px + pw / 2, py + ph + 30);
    }
    if (opts.yLabel) {
      ctx.save();
      ctx.translate(12, py + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(opts.yLabel, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function linePath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / mag) * mag;
  }

  /* redraw registry so resizing refreshes everything */
  const redrawers = [];
  function register(fn) { redrawers.push(fn); fn(); }
  let rzTimer;
  window.addEventListener("resize", () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => redrawers.forEach((f) => { try { f(); } catch (e) { /* noop */ } }), 160);
  });

  /* ============================================================== hero bg */
  /* Calm ambient drift: slow sine motion measured in real seconds, tiny
     amplitudes, canvas sized only on resize (never every frame). */
  function heroBackground() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas) return;
    const parent = canvas.parentElement;
    const curves = [
      { mu: 0.24, sd: 0.11, amp: 0.52, hue: "rgba(234, 179, 8, 0.20)", period: 26, phase: 0.0, drift: 0.018 },
      { mu: 0.50, sd: 0.17, amp: 0.40, hue: "rgba(45, 212, 191, 0.15)", period: 34, phase: 1.7, drift: 0.014 },
      { mu: 0.74, sd: 0.10, amp: 0.56, hue: "rgba(94, 234, 212, 0.17)", period: 22, phase: 3.4, drift: 0.020 },
      { mu: 0.60, sd: 0.24, amp: 0.28, hue: "rgba(234, 179, 8, 0.11)", period: 44, phase: 5.1, drift: 0.010 }
    ];
    let W = 0, H = 0, needsFit = true;
    function fit() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth, h = parent.clientHeight;
      if (!w || !h) return false;
      W = w; H = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      needsFit = false;
      return true;
    }
    function paint(elapsedSec) {
      if (needsFit && !fit()) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      const step = Math.max(4, Math.round(W / 220));
      curves.forEach((c) => {
        const wobble = Math.sin((2 * Math.PI * elapsedSec) / c.period + c.phase);
        const mu = c.mu + c.drift * wobble;
        const sd = c.sd * (1 + 0.03 * Math.cos((2 * Math.PI * elapsedSec) / (c.period * 1.37) + c.phase));
        ctx.beginPath();
        for (let x = 0; x <= W; x += step) {
          const z = x / W;
          const y = H - c.amp * Math.exp(-0.5 * ((z - mu) / sd) ** 2) * H * 0.82 - 12;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = c.hue;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = c.hue.replace(/0\.\d+\)/, "0.05)");
        ctx.fill();
      });
    }
    window.addEventListener("resize", () => { needsFit = true; });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      paint(0);
      window.addEventListener("resize", () => { needsFit = true; paint(0); });
      return;
    }
    const t0 = performance.now();
    (function loop(now) {
      paint((now - t0) / 1000);
      requestAnimationFrame(loop);
    })(t0);
  }

  /* ==================================================== PMF vs PDF statics */
  function pmfChart() {
    const canvas = document.getElementById("pmfCanvas");
    if (!canvas) return;
    register(function draw() {
      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const P = makePlot(w, h, { l: 46, r: 18, t: 18, b: 42 }, 0.4, 6.6, 0, 0.30);
      frame(ctx, P, {
        xTicksAt: [1, 2, 3, 4, 5, 6], yTicks: 3,
        xLabel: "outcome k", yLabel: "P(X = k)",
        xFmt: (x) => String(x), yFmt: (v) => v.toFixed(2)
      });
      const bw = P.pw / 8;
      for (let k = 1; k <= 6; k++) {
        const p = 1 / 6;
        const x = P.X(k) - bw / 2, y = P.Y(p), base = P.Y(0);
        const g = ctx.createLinearGradient(0, y, 0, base);
        g.addColorStop(0, "rgba(234, 179, 8, 0.85)");
        g.addColorStop(1, "rgba(234, 179, 8, 0.35)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, base - y, [5, 5, 0, 0]);
        ctx.fill();
        ctx.fillStyle = C.brand;
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("0.167", P.X(k), y - 7);
      }
      ctx.fillStyle = C.muted;
      ctx.font = "italic 12px system-ui";
      ctx.textAlign = "right";
      ctx.fillText("Σ P(X = k) = 1", w - 14, 16);
    });
  }

  function pdfChart() {
    const canvas = document.getElementById("pdfCanvas");
    if (!canvas) return;
    register(function draw() {
      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const P = makePlot(w, h, { l: 46, r: 18, t: 18, b: 42 }, -4, 4, 0, 0.45);
      frame(ctx, P, { xTicks: 8, yTicks: 3, xLabel: "x", yLabel: "f(x)", yFmt: (v) => v.toFixed(2) });
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const x = lerp(-4, 4, i / 200);
        pts.push([P.X(x), P.Y(normalPdf(x, 0, 1))]);
      }
      // shaded band = probability
      ctx.beginPath();
      ctx.moveTo(P.X(-1), P.Y(0));
      for (let i = 0; i <= 120; i++) {
        const x = lerp(-1, 1, i / 120);
        ctx.lineTo(P.X(x), P.Y(normalPdf(x, 0, 1)));
      }
      ctx.lineTo(P.X(1), P.Y(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(45, 212, 191, 0.22)";
      ctx.fill();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2.4;
      linePath(ctx, pts);
      ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("area = 0.6827", P.X(0), P.Y(0.12));
      ctx.fillStyle = C.muted;
      ctx.font = "italic 12px system-ui";
      ctx.textAlign = "right";
      ctx.fillText("∫ f(x) dx = 1  (total area)", w - 14, 16);
    });
  }

  /* ================================================= interactive PDF area */
  function pdfAreaWidget() {
    const canvas = document.getElementById("pdfAreaCanvas");
    const aIn = document.getElementById("pdfA");
    const bIn = document.getElementById("pdfB");
    const aOut = document.getElementById("pdfAOut");
    const bOut = document.getElementById("pdfBOut");
    const readout = document.getElementById("pdfAreaReadout");
    if (!canvas || !aIn || !bIn) return;

    function draw() {
      let a = parseFloat(aIn.value), b = parseFloat(bIn.value);
      if (a > b) { const t = a; a = b; b = t; }
      aOut.textContent = a.toFixed(1);
      bOut.textContent = b.toFixed(1);
      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const P = makePlot(w, h, { l: 52, r: 22, t: 22, b: 46 }, -4, 4, 0, 0.45);
      frame(ctx, P, { xTicks: 8, yTicks: 3, xLabel: "x", yLabel: "density  f(x)", yFmt: (v) => v.toFixed(2) });

      const pts = [];
      for (let i = 0; i <= 240; i++) {
        const x = lerp(-4, 4, i / 240);
        pts.push([P.X(x), P.Y(normalPdf(x, 0, 1))]);
      }
      // shaded region
      ctx.beginPath();
      ctx.moveTo(P.X(a), P.Y(0));
      for (let i = 0; i <= 160; i++) {
        const x = lerp(a, b, i / 160);
        ctx.lineTo(P.X(x), P.Y(normalPdf(x, 0, 1)));
      }
      ctx.lineTo(P.X(b), P.Y(0));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, P.Y(0.45), 0, P.Y(0));
      g.addColorStop(0, "rgba(234, 179, 8, 0.42)");
      g.addColorStop(1, "rgba(234, 179, 8, 0.12)");
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = C.brand;
      ctx.lineWidth = 2.5;
      linePath(ctx, pts);
      ctx.stroke();

      // markers
      [a, b].forEach((v) => {
        ctx.strokeStyle = C.accent;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(P.X(v), P.Y(0));
        ctx.lineTo(P.X(v), P.Y(normalPdf(v, 0, 1)));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.accent;
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(v === a ? "a" : "b", P.X(v), P.Y(normalPdf(v, 0, 1)) - 8);
      });

      const area = normalCdf(b, 0, 1) - normalCdf(a, 0, 1);
      readout.innerHTML =
        "P( <strong>" + a.toFixed(1) + "</strong> ≤ X ≤ <strong>" + b.toFixed(1) + "</strong> ) = " +
        "<strong>" + area.toFixed(4) + "</strong>  (" + (area * 100).toFixed(2) + "% of all probability)<br>" +
        "density at a = " + fmt(normalPdf(a, 0, 1)) + "  ·  density at b = " + fmt(normalPdf(b, 0, 1)) +
        "  ·  height ≠ probability";
    }
    register(draw);
    aIn.addEventListener("input", draw);
    bIn.addEventListener("input", draw);
  }

  /* ==================================================== sigma rule widget */
  function sigmaWidget() {
    const canvas = document.getElementById("sigmaCanvas");
    const readout = document.getElementById("sigmaReadout");
    const wrap = document.getElementById("widget-sigma-rule");
    if (!canvas || !wrap) return;
    let k = 1;
    const probs = { 1: 0.6827, 2: 0.9545, 3: 0.9973 };

    function draw() {
      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const P = makePlot(w, h, { l: 44, r: 18, t: 18, b: 42 }, -4, 4, 0, 0.45);
      frame(ctx, P, {
        xTicksAt: [-3, -2, -1, 0, 1, 2, 3], yTicks: 3,
        xLabel: "standard deviations from μ", yFmt: (v) => v.toFixed(2),
        xFmt: (x) => (x === 0 ? "μ" : (x > 0 ? "+" : "") + x + "σ")
      });
      const pts = [];
      for (let i = 0; i <= 240; i++) {
        const x = lerp(-4, 4, i / 240);
        pts.push([P.X(x), P.Y(normalPdf(x, 0, 1))]);
      }
      ctx.beginPath();
      ctx.moveTo(P.X(-k), P.Y(0));
      for (let i = 0; i <= 160; i++) {
        const x = lerp(-k, k, i / 160);
        ctx.lineTo(P.X(x), P.Y(normalPdf(x, 0, 1)));
      }
      ctx.lineTo(P.X(k), P.Y(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(234, 179, 8, 0.26)";
      ctx.fill();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.5;
      linePath(ctx, pts);
      ctx.stroke();

      ctx.font = "bold 11px system-ui";
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        ctx.strokeStyle = "rgba(226, 232, 240, 0.10)";
        ctx.beginPath();
        ctx.moveTo(P.X(i), P.Y(0));
        ctx.lineTo(P.X(i), P.Y(normalPdf(i, 0, 1)));
        ctx.stroke();
      }
      ctx.fillStyle = C.teal;
      ctx.textAlign = "center";
      ctx.font = "bold 12px system-ui";
      ctx.fillText((probs[k] * 100).toFixed(1) + "%", P.X(0), P.Y(0.20));

      readout.innerHTML =
        "P( μ − " + k + "σ &lt; X &lt; μ + " + k + "σ ) ≈ <strong>" + (probs[k] * 100).toFixed(2) + "%</strong><br>" +
        "Outside this band: " + ((1 - probs[k]) * 100).toFixed(2) + "% of all outcomes";
    }
    register(draw);
    wrap.querySelectorAll("[data-sigma]").forEach((btn) => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll("[data-sigma]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        k = parseInt(btn.dataset.sigma, 10);
        draw();
      });
    });
  }

  /* ============================================= distribution explorer */
  const DISTRIBUTIONS = {
    bernoulli: {
      name: "Bernoulli",
      story: "One trial, two outcomes — the coin of machine learning. Flip it and you get 1 with probability p, else 0.",
      formula: "P(X = 1) = p &nbsp;·&nbsp; P(X = 0) = 1 − p<br>Mean = p &nbsp;·&nbsp; Var = p(1 − p)",
      use: "Binary classification, dropout masks",
      sliders: [{ id: "p", label: "p (probability of 1)", min: 0, max: 1, step: 0.01, value: 0.5 }]
    },
    categorical: {
      name: "Categorical",
      story: "One trial, k outcomes — a weighted k-sided die. The softmax output of a classifier is exactly this.",
      formula: "P(X = i) = pᵢ &nbsp;·&nbsp; Σ pᵢ = 1",
      use: "Multi-class softmax, next-token prediction",
      sliders: [
        { id: "p0", label: "p(cat)", min: 0, max: 1, step: 0.01, value: 0.5 },
        { id: "p1", label: "p(dog)", min: 0, max: 1, step: 0.01, value: 0.3 },
        { id: "p2", label: "p(bird)", min: 0, max: 1, step: 0.01, value: 0.2 }
      ]
    },
    uniform: {
      name: "Uniform",
      story: "Every outcome equally likely. Maximum ignorance — if you know nothing else, start here.",
      formula: "Discrete: P(X = k) = 1/n<br>Continuous: f(x) = 1/(b − a) on [a, b]",
      use: "Random initialisation, random search",
      sliders: [
        { id: "a", label: "a (lower edge)", min: -4, max: 2, step: 0.1, value: -2 },
        { id: "b", label: "b (upper edge)", min: -1, max: 5, step: 0.1, value: 2 }
      ]
    },
    normal: {
      name: "Normal (Gaussian)",
      story: "The bell curve. Symmetric around μ, width controlled by σ. Shows up everywhere thanks to the CLT.",
      formula: "f(x) = 1/√(2πσ²) · exp( −(x − μ)² / (2σ²) )",
      use: "Weight init, gradient noise, VAE latents",
      sliders: [
        { id: "mu", label: "μ (mean)", min: -3, max: 3, step: 0.1, value: 0 },
        { id: "sigma", label: "σ (std dev)", min: 0.2, max: 2.5, step: 0.05, value: 1 }
      ]
    },
    poisson: {
      name: "Poisson",
      story: "How many rare events happen in a fixed window? λ is the average rate — and also the variance.",
      formula: "P(X = k) = λᵏ e^(−λ) / k!<br>Mean = Var = λ",
      use: "Event rates, request counts, arrivals",
      sliders: [{ id: "lam", label: "λ (average rate)", min: 0.2, max: 12, step: 0.1, value: 3 }]
    }
  };

  function distExplorer() {
    const canvas = document.getElementById("distCanvas");
    const controls = document.getElementById("distControls");
    const info = document.getElementById("distInfo");
    const wrap = document.getElementById("widget-dist-explorer");
    if (!canvas || !controls || !wrap) return;
    let current = "bernoulli";
    const state = {};

    function buildControls() {
      const d = DISTRIBUTIONS[current];
      controls.innerHTML = "";
      d.sliders.forEach((s) => {
        if (state[current] && state[current][s.id] !== undefined) s = Object.assign({}, s, { value: state[current][s.id] });
        const label = document.createElement("label");
        label.className = "slider";
        label.innerHTML = "<span>" + s.label + ": <output>" + s.value + "</output></span>";
        const input = document.createElement("input");
        input.type = "range";
        input.min = s.min; input.max = s.max; input.step = s.step; input.value = s.value;
        input.addEventListener("input", () => {
          if (!state[current]) state[current] = {};
          state[current][s.id] = parseFloat(input.value);
          label.querySelector("output").textContent = input.value;
          draw();
        });
        label.appendChild(input);
        controls.appendChild(label);
      });
    }

    function vals() {
      const d = DISTRIBUTIONS[current];
      const v = {};
      d.sliders.forEach((s) => {
        v[s.id] = state[current] && state[current][s.id] !== undefined ? state[current][s.id] : s.value;
      });
      return v;
    }

    function draw() {
      const v = vals();
      const d = DISTRIBUTIONS[current];
      info.innerHTML =
        "<h4>" + d.name + "</h4>" +
        "<p class='story'>" + d.story + "</p>" +
        "<div class='formula compact'><div class='formula-expr'>" + d.formula + "</div></div>" +
        "<div class='formula compact'><div class='formula-expr' id='distStats'></div></div>" +
        "<span class='use-tag'>ML use: " + d.use + "</span>";

      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      if (current === "bernoulli") drawBars(ctx, w, h, [
        { k: 0, p: 1 - v.p, label: "0" },
        { k: 1, p: v.p, label: "1" }
      ], "outcome", "probability");
      else if (current === "categorical") {
        const sum = v.p0 + v.p1 + v.p2 || 1;
        drawBars(ctx, w, h, [
          { k: 0, p: v.p0 / sum, label: "cat" },
          { k: 1, p: v.p1 / sum, label: "dog" },
          { k: 2, p: v.p2 / sum, label: "bird" }
        ], "class", "probability");
      } else if (current === "poisson") {
        const lam = v.lam;
        const kMax = Math.max(12, Math.ceil(lam + 4 * Math.sqrt(lam)));
        const bars = [];
        let total = 0;
        for (let k = 0; k <= kMax; k++) {
          const p = (Math.pow(lam, k) * Math.exp(-lam)) / factorial(k);
          bars.push({ k, p, label: String(k) });
          total += p;
        }
        drawBars(ctx, w, h, bars, "k (event count)", "P(X = k)");
        setStats("Mean = λ = " + lam.toFixed(2) + " · Var = λ = " + lam.toFixed(2) + " · SD = " + Math.sqrt(lam).toFixed(3) + " · Σ P = " + total.toFixed(4));
      } else if (current === "uniform") {
        const a = Math.min(v.a, v.b), b = Math.max(v.a, v.b);
        const width = Math.max(0.2, b - a);
        const P = makePlot(w, h, { l: 52, r: 22, t: 22, b: 48 }, -5, 5, 0, Math.max(0.7, 1 / width * 1.35));
        frame(ctx, P, { xTicks: 10, yTicks: 3, xLabel: "x", yLabel: "density f(x)", yFmt: (x) => x.toFixed(2) });
        const yTop = P.Y(1 / width);
        ctx.fillStyle = "rgba(45, 212, 191, 0.20)";
        ctx.fillRect(P.X(a), yTop, P.X(b) - P.X(a), P.Y(0) - yTop);
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(P.X(a), P.Y(0)); ctx.lineTo(P.X(a), yTop);
        ctx.lineTo(P.X(b), yTop); ctx.lineTo(P.X(b), P.Y(0));
        ctx.stroke();
        setStats("Height = 1/(b − a) = " + (1 / width).toFixed(4) + " · Mean = " + ((a + b) / 2).toFixed(3) + " · Var = (b−a)²/12 = " + (width * width / 12).toFixed(4) + " · Area = " + ((b - a) * (1 / width)).toFixed(4));
      } else if (current === "normal") {
        const mu = v.mu, sd = v.sigma;
        const P = makePlot(w, h, { l: 52, r: 22, t: 22, b: 48 }, -6, 6, 0, Math.max(0.45, normalPdf(mu, mu, sd) * 1.18));
        frame(ctx, P, { xTicks: 12, yTicks: 3, xLabel: "x", yLabel: "density f(x)", yFmt: (x) => x.toFixed(2) });
        const pts = [];
        for (let i = 0; i <= 260; i++) {
          const x = lerp(-6, 6, i / 260);
          pts.push([P.X(x), P.Y(normalPdf(x, mu, sd))]);
        }
        // ±1σ band
        ctx.beginPath();
        ctx.moveTo(P.X(mu - sd), P.Y(0));
        for (let i = 0; i <= 120; i++) {
          const x = lerp(mu - sd, mu + sd, i / 120);
          ctx.lineTo(P.X(x), P.Y(normalPdf(x, mu, sd)));
        }
        ctx.lineTo(P.X(mu + sd), P.Y(0));
        ctx.closePath();
        ctx.fillStyle = "rgba(234, 179, 8, 0.20)";
        ctx.fill();
        ctx.strokeStyle = C.brand;
        ctx.lineWidth = 2.6;
        linePath(ctx, pts);
        ctx.stroke();
        // mean line
        ctx.strokeStyle = C.accent;
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(P.X(mu), P.Y(0));
        ctx.lineTo(P.X(mu), P.Y(normalPdf(mu, mu, sd)));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.accent;
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("μ", P.X(mu), P.Y(0) + 18);
        setStats("μ = " + mu.toFixed(2) + " · σ = " + sd.toFixed(2) + " · σ² = " + (sd * sd).toFixed(3) +
          " · peak height = " + normalPdf(mu, mu, sd).toFixed(4) +
          " · P(μ±σ) = " + (normalCdf(mu + sd, mu, sd) - normalCdf(mu - sd, mu, sd)).toFixed(4));
      }
    }

    function setStats(html) {
      const el = document.getElementById("distStats");
      if (el) el.innerHTML = html;
    }

    function drawBars(ctx, w, h, bars, xLabel, yLabel) {
      const maxP = Math.max(0.08, ...bars.map((b) => b.p)) * 1.22;
      const P = makePlot(w, h, { l: 52, r: 22, t: 22, b: 48 }, -0.6, bars.length - 0.4, 0, maxP);
      frame(ctx, P, {
        xTicksAt: bars.map((b) => b.k), yTicks: 3, xLabel, yLabel,
        xFmt: (x) => {
          const b = bars.find((bb) => Math.abs(bb.k - x) < 1e-6);
          return b ? b.label : "";
        },
        yFmt: (y) => y.toFixed(2)
      });
      const bw = Math.min(64, P.pw / (bars.length + 1.4));
      bars.forEach((b) => {
        const x = P.X(b.k) - bw / 2, y = P.Y(b.p), base = P.Y(0);
        const g = ctx.createLinearGradient(0, y, 0, base);
        g.addColorStop(0, "rgba(234, 179, 8, 0.9)");
        g.addColorStop(1, "rgba(234, 179, 8, 0.32)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, Math.max(1, base - y), [5, 5, 0, 0]);
        ctx.fill();
        if (bars.length <= 8) {
          ctx.fillStyle = C.brand;
          ctx.font = "bold 11px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(b.p.toFixed(3), P.X(b.k), y - 7);
        }
      });
      if (current === "bernoulli" || current === "categorical") {
        const sum = bars.reduce((s, b) => s + b.p, 0);
        setStats("Σ P = " + sum.toFixed(4) + " · Mean = " + bars.reduce((s, b) => s + b.k * b.p, 0).toFixed(4) +
          " · Var = " + bars.reduce((s, b) => s + b.p * (b.k - bars.reduce((s2, b2) => s2 + b2.k * b2.p, 0)) ** 2, 0).toFixed(4));
      }
    }

    register(draw);
    wrap.querySelectorAll("[data-dist]").forEach((btn) => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll("[data-dist]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        current = btn.dataset.dist;
        buildControls();
        draw();
      });
    });
    buildControls();
    draw();
  }

  /* ================================================ expected value widget */
  function expectedValueWidget() {
    const canvas = document.getElementById("evCanvas");
    const readout = document.getElementById("evReadout");
    const reset = document.getElementById("evReset");
    if (!canvas) return;
    let weights = [1, 1, 1, 1, 1, 1];
    let dragIndex = -1;

    function probs() {
      const s = weights.reduce((a, b) => a + b, 0) || 1;
      return weights.map((w) => w / s);
    }

    function draw() {
      const p = probs();
      const mean = p.reduce((s, pi, i) => s + pi * (i + 1), 0);
      const variance = p.reduce((s, pi, i) => s + pi * (i + 1 - mean) ** 2, 0);
      const sd = Math.sqrt(variance);

      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const P = makePlot(w, h, { l: 52, r: 24, t: 26, b: 52 }, 0.35, 6.65, 0, 0.55);
      frame(ctx, P, {
        xTicksAt: [1, 2, 3, 4, 5, 6], yTicks: 4, xLabel: "outcome", yLabel: "P(X = x)",
        xFmt: (x) => String(x),
        yFmt: (y) => y.toFixed(2)
      });

      // ±1 SD band
      const lo = clamp(mean - sd, 0.35, 6.65), hi = clamp(mean + sd, 0.35, 6.65);
      ctx.fillStyle = "rgba(45, 212, 191, 0.10)";
      ctx.fillRect(P.X(lo), P.Y(0.55), P.X(hi) - P.X(lo), P.py + P.ph - P.Y(0.55));
      ctx.fillStyle = C.accent;
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("± 1 SD", (P.X(lo) + P.X(hi)) / 2, P.py + 12);

      const bw = P.pw / 9;
      for (let i = 0; i < 6; i++) {
        const x = P.X(i + 1) - bw / 2, y = P.Y(p[i]), base = P.Y(0);
        const g = ctx.createLinearGradient(0, y, 0, base);
        g.addColorStop(0, "rgba(234, 179, 8, 0.9)");
        g.addColorStop(1, "rgba(234, 179, 8, 0.3)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, Math.max(2, base - y), [5, 5, 0, 0]);
        ctx.fill();
        ctx.fillStyle = C.brand;
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(p[i].toFixed(3), P.X(i + 1), y - 6);
      }

      // mean line (balance point)
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(P.X(mean), P.Y(0));
      ctx.lineTo(P.X(mean), P.Y(0.55));
      ctx.stroke();
      ctx.fillStyle = C.teal;
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("E[X] = " + mean.toFixed(3), P.X(mean), P.Y(0.55) - 8);

      readout.innerHTML =
        "E[X] = Σ x·P(x) = <strong>" + mean.toFixed(4) + "</strong><br>" +
        "E[X²] = " + p.reduce((s, pi, i) => s + pi * (i + 1) ** 2, 0).toFixed(4) +
        " ·  Var(X) = E[X²] − (E[X])² = <strong>" + variance.toFixed(4) + "</strong><br>" +
        "SD = √Var = <strong>" + sd.toFixed(4) + "</strong>  ·  Σ P = " + p.reduce((a, b) => a + b, 0).toFixed(4);
    }

    function pointerToIndex(evt) {
      const rect = canvas.getBoundingClientRect();
      const x = ((evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left);
      const ratio = canvas.height / canvas.width;
      const w = rect.width, h = rect.width * ratio;
      const P = makePlot(w, h, { l: 52, r: 24, t: 26, b: 52 }, 0.35, 6.65, 0, 0.55);
      for (let i = 0; i < 6; i++) {
        const cx = P.X(i + 1);
        if (Math.abs(x - cx) < P.pw / 14) return i;
      }
      return -1;
    }

    function setFromPointer(evt) {
      const idx = dragIndex;
      if (idx < 0) return;
      const rect = canvas.getBoundingClientRect();
      const y = ((evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top);
      const ratio = canvas.height / canvas.width;
      const w = rect.width, h = rect.width * ratio;
      const P = makePlot(w, h, { l: 52, r: 24, t: 26, b: 52 }, 0.35, 6.65, 0, 0.55);
      const val = clamp(P.invY(y), 0.02, 0.55);
      weights[idx] = val * 6;
      draw();
    }

    const down = (e) => {
      dragIndex = pointerToIndex(e);
      if (dragIndex >= 0) { e.preventDefault(); setFromPointer(e); }
    };
    const move = (e) => { if (dragIndex >= 0) { e.preventDefault(); setFromPointer(e); } };
    const up = () => { dragIndex = -1; };
    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    if (reset) reset.addEventListener("click", () => { weights = [1, 1, 1, 1, 1, 1]; draw(); });
    register(draw);
  }

  /* ================================================== joint table widget */
  function jointTableWidget() {
    const table = document.getElementById("jointTable");
    const readout = document.getElementById("jointReadout");
    if (!table) return;
    const rows = [
      { label: "X = 0 (sun)", cells: [0.40, 0.10] },
      { label: "X = 1 (rain)", cells: [0.05, 0.45] }
    ];
    const colLabels = ["Y = 0 (no umbrella)", "Y = 1 (umbrella)"];

    function build() {
      let html = "<thead><tr><th class='corner'>P(X, Y)</th>";
      colLabels.forEach((c) => { html += "<th>" + c + "</th>"; });
      html += "<th>Marginal P(X)</th></tr></thead><tbody>";
      rows.forEach((r, i) => {
        const rowSum = r.cells[0] + r.cells[1];
        html += "<tr><th>" + r.label + "</th>";
        r.cells.forEach((v, j) => {
          html += "<td class='cell' data-r='" + i + "' data-c='" + j + "'>" + v.toFixed(2) + "</td>";
        });
        html += "<td class='marginal' data-rowm='" + i + "'>" + rowSum.toFixed(2) + "</td></tr>";
      });
      const col0 = rows[0].cells[0] + rows[1].cells[0];
      const col1 = rows[0].cells[1] + rows[1].cells[1];
      html += "<tr><th>Marginal P(Y)</th>";
      [col0, col1].forEach((v, j) => {
        html += "<td class='marginal' data-colm='" + j + "'>" + v.toFixed(2) + "</td>";
      });
      html += "<td class='marginal'>1.00</td></tr></tbody>";
      table.innerHTML = html;

      table.querySelectorAll("td.cell").forEach((td) => {
        td.addEventListener("mouseenter", () => {
          const r = +td.dataset.r, c = +td.dataset.c;
          table.querySelectorAll(".hl").forEach((el) => el.classList.remove("hl"));
          td.classList.add("hl");
          const rowM = table.querySelector("[data-rowm='" + r + "']");
          const colM = table.querySelector("[data-colm='" + c + "']");
          if (rowM) rowM.classList.add("hl");
          if (colM) colM.classList.add("hl");
          const joint = rows[r].cells[c];
          const rowSum = rows[r].cells[0] + rows[r].cells[1];
          const colSum = rows[0].cells[c] + rows[1].cells[c];
          readout.innerHTML =
            "joint: P(X=" + r + ", Y=" + c + ") = <strong>" + joint.toFixed(2) + "</strong><br>" +
            "row marginal P(X=" + r + ") = " + rowSum.toFixed(2) +
            " · column marginal P(Y=" + c + ") = " + colSum.toFixed(2) + "<br>" +
            "conditional P(Y=" + c + " | X=" + r + ") = " + joint.toFixed(2) + " / " + rowSum.toFixed(2) +
            " = <strong>" + (joint / rowSum).toFixed(3) + "</strong>" +
            (Math.abs(joint / rowSum - colSum) > 1e-9
              ? "  ≠  P(Y=" + c + ") = " + colSum.toFixed(2) + "  → dependent"
              : "  =  P(Y=" + c + ")  → independent");
        });
      });
      table.addEventListener("mouseleave", () => {
        table.querySelectorAll(".hl").forEach((el) => el.classList.remove("hl"));
        readout.textContent = "Hover a cell to inspect it.";
      });
    }
    build();
  }

  /* ========================================================== CLT widget */
  function cltWidget() {
    const canvas = document.getElementById("cltCanvas");
    const nIn = document.getElementById("cltN");
    const nOut = document.getElementById("cltNOut");
    const runBtn = document.getElementById("cltRun");
    const animBtn = document.getElementById("cltAnimate");
    const resetBtn = document.getElementById("cltReset");
    const readout = document.getElementById("cltReadout");
    if (!canvas || !nIn) return;

    let samples = [];
    let animTimer = null;

    const BINS = 44;
    const LO = 1, HI = 6;

    function histogram() {
      const counts = new Array(BINS).fill(0);
      samples.forEach((s) => {
        const idx = clamp(Math.floor(((s - LO) / (HI - LO)) * BINS), 0, BINS - 1);
        counts[idx]++;
      });
      return counts;
    }

    function draw() {
      const counts = histogram();
      const n = parseInt(nIn.value, 10);
      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      const maxCount = Math.max(10, ...counts);
      // theoretical normal for averages of n dice
      const mu = 3.5, sd = Math.sqrt(35 / 12 / n);
      const peak = normalPdf(mu, mu, sd) * samples.length * ((HI - LO) / BINS);
      const yMax = Math.max(maxCount, peak) * 1.18;

      const P = makePlot(w, h, { l: 56, r: 22, t: 22, b: 52 }, LO, HI, 0, yMax);
      frame(ctx, P, {
        xTicks: 5, yTicks: 4, xLabel: "sample mean", yLabel: "count",
        xFmt: (x) => x.toFixed(1), yFmt: (y) => Math.round(y).toString()
      });

      const bw = P.pw / BINS;
      counts.forEach((c, i) => {
        if (!c) return;
        const x = P.px + i * bw;
        const y = P.Y(c);
        const g = ctx.createLinearGradient(0, y, 0, P.Y(0));
        g.addColorStop(0, "rgba(45, 212, 191, 0.85)");
        g.addColorStop(1, "rgba(45, 212, 191, 0.35)");
        ctx.fillStyle = g;
        ctx.fillRect(x + 0.5, y, Math.max(1, bw - 1), P.Y(0) - y);
      });

      if (samples.length > 20) {
        const pts = [];
        for (let i = 0; i <= 180; i++) {
          const x = lerp(LO, HI, i / 180);
          const dens = normalPdf(x, mu, sd) * samples.length * ((HI - LO) / BINS);
          pts.push([P.X(x), P.Y(dens)]);
        }
        ctx.strokeStyle = C.brand;
        ctx.lineWidth = 2.4;
        linePath(ctx, pts);
        ctx.stroke();
        ctx.fillStyle = C.brand;
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "left";
        ctx.fillText("ideal normal overlay", P.px + 10, P.py + 16);
      }

      const mean = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
      const vs = samples.length ? samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length : 0;
      readout.innerHTML =
        "dice per average <strong>n = " + n + "</strong> · trials <strong>" + samples.length.toLocaleString() + "</strong><br>" +
        "sample mean = <strong>" + fmt(mean, 4) + "</strong> (expected 3.5000)<br>" +
        "sample SD = <strong>" + fmt(Math.sqrt(vs), 4) + "</strong> (theory " + fmt(Math.sqrt(35 / 12 / n), 4) + ")<br>" +
        (n === 1 ? "Flat — a single die is uniform, not normal." :
          n < 6 ? "Peaked but still blocky — the shape is still forming." :
            n < 20 ? "Starting to look like a bell curve." :
              "A near-perfect bell curve. This is the Central Limit Theorem.");
    }

    function run(count) {
      const n = parseInt(nIn.value, 10);
      for (let i = 0; i < count; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += 1 + Math.floor(Math.random() * 6);
        samples.push(s / n);
      }
      draw();
    }

    nIn.addEventListener("input", () => {
      nOut.textContent = nIn.value;
      samples = [];
      draw();
    });
    runBtn.addEventListener("click", () => run(2000));
    animBtn.addEventListener("click", () => {
      if (animTimer) { clearInterval(animTimer); animTimer = null; animBtn.textContent = "Animate"; return; }
      animBtn.textContent = "Stop";
      animTimer = setInterval(() => {
        run(200);
        if (samples.length >= 20000) { clearInterval(animTimer); animTimer = null; animBtn.textContent = "Animate"; }
      }, 120);
    });
    resetBtn.addEventListener("click", () => {
      samples = [];
      if (animTimer) { clearInterval(animTimer); animTimer = null; animBtn.textContent = "Animate"; }
      draw();
    });
    run(2000);
    register(draw);
  }

  /* =================================================== underflow widget */
  function underflowWidget() {
    const canvas = document.getElementById("ufCanvas");
    const pIn = document.getElementById("ufP");
    const nIn = document.getElementById("ufN");
    const pOut = document.getElementById("ufPOut");
    const nOut = document.getElementById("ufNOut");
    const readout = document.getElementById("ufReadout");
    if (!canvas || !pIn || !nIn) return;


    // Redraw with two side-by-side panels properly offset
    function draw2() {
      const p = parseFloat(pIn.value);
      const n = parseInt(nIn.value, 10);
      pOut.textContent = p.toFixed(3);
      nOut.textContent = String(n);

      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      const gap = 22;
      const half = (w - gap) / 2;

      ctx.save();
      const PA = makePlot(half, h, { l: 52, r: 14, t: 26, b: 44 }, 1, Math.max(n, 2), -20, 0);
      frame(ctx, PA, { xTicks: 4, yTicks: 4, xLabel: "words", yLabel: "log₁₀ product", yFmt: (v) => v.toFixed(0) });
      const ptsA = [];
      for (let k = 1; k <= n; k++) ptsA.push([PA.X(k), PA.Y(clamp(k * Math.log10(p), -20, 0))]);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2.3;
      linePath(ctx, ptsA); ctx.stroke();
      ctx.fillStyle = "rgba(194, 64, 47, 0.12)";
      ctx.fillRect(PA.px, PA.Y(-20), PA.pw, PA.Y(-16) - PA.Y(-20));
      ctx.fillStyle = "#f87171"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "right";
      ctx.fillText("underflow zone", PA.px + PA.pw - 8, PA.Y(-18.2));
      ctx.restore();

      ctx.save();
      ctx.translate(half + gap, 0);
      const PB = makePlot(half, h, { l: 52, r: 14, t: 26, b: 44 }, 1, Math.max(n, 2), Math.min(-1, n * Math.log(p) * 1.12), 0);
      frame(ctx, PB, { xTicks: 4, yTicks: 4, xLabel: "words", yLabel: "log P", yFmt: (v) => v.toFixed(1) });
      const ptsB = [];
      for (let k = 1; k <= n; k++) ptsB.push([PB.X(k), PB.Y(k * Math.log(p))]);
      ctx.strokeStyle = C.brand; ctx.lineWidth = 2.3;
      linePath(ctx, ptsB); ctx.stroke();
      ctx.fillStyle = C.brand; ctx.font = "bold 10px system-ui"; ctx.textAlign = "right";
      ctx.fillText("finite & usable", PB.px + PB.pw - 8, PB.py + 14);
      ctx.restore();

      const product = Math.pow(p, n);
      const logp = n * Math.log(p);
      readout.innerHTML =
        "raw product p<sup>n</sup> = " + (product === 0 ? "<span class='bad'>0.0 — underflowed!</span>" : product.toExponential(3)) + "<br>" +
        "log P = n·log p = <span class='ok'>" + logp.toFixed(4) + "</span>  ·  equivalent to 10^" + (n * Math.log10(p)).toFixed(1) + "<br>" +
        "Multiplication of probabilities becomes <strong>addition</strong> of log probabilities.";
    }

    pIn.addEventListener("input", draw2);
    nIn.addEventListener("input", draw2);
    register(draw2);
  }

  /* ======================================================= softmax widget */
  function softmaxFromLogits(z, stable) {
    const m = stable ? Math.max.apply(null, z) : 0;
    const exps = z.map((v) => Math.exp(v - m));
    const s = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / s);
  }
  function logSoftmax(z) {
    const m = Math.max.apply(null, z);
    const lse = m + Math.log(z.reduce((a, v) => a + Math.exp(v - m), 0));
    return z.map((v) => v - lse);
  }

  function softmaxWidget() {
    const canvas = document.getElementById("softmaxCanvas");
    const sliders = document.getElementById("softmaxSliders");
    const readout = document.getElementById("softmaxReadout");
    if (!canvas || !sliders) return;

    const LABELS = ["class A", "class B", "class C", "class D", "class E"];
    let logits = [2.0, 1.0, 0.1, -1.0, 0.5];
    let wide = false;

    function buildSliders() {
      sliders.innerHTML = "";
      logits.forEach((v, i) => {
        const row = document.createElement("div");
        row.className = "logit-row";
        row.innerHTML = "<span class='lname'>" + LABELS[i] + "</span>";
        const input = document.createElement("input");
        input.type = "range";
        input.min = wide ? "-10" : "-10";
        input.max = wide ? "720" : "10";
        input.step = wide ? "1" : "0.1";
        input.value = String(clamp(v, parseFloat(input.min), parseFloat(input.max)));
        const val = document.createElement("span");
        val.className = "lval";
        val.textContent = v.toFixed(wide ? 0 : 1);
        input.addEventListener("input", () => {
          logits[i] = parseFloat(input.value);
          val.textContent = logits[i].toFixed(wide ? 0 : 1);
          draw();
        });
        row.appendChild(input);
        row.appendChild(val);
        sliders.appendChild(row);
      });
    }

    function draw() {
      const probs = softmaxFromLogits(logits, true);
      const naive = softmaxFromLogits(logits, false);
      const lp = logSoftmax(logits);
      const naiveOk = naive.every((x) => isFinite(x));

      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);

      // left half: logits ; right half: probabilities
      const half = (w - 26) / 2;
      const maxAbs = Math.max(1, ...logits.map((x) => Math.abs(x)));
      const PL = makePlot(half, h, { l: 40, r: 8, t: 26, b: 40 }, -0.6, 4.6, -maxAbs * 1.15, maxAbs * 1.15);
      frame(ctx, PL, {
        xTicksAt: [0, 1, 2, 3, 4], yTicks: 4, xLabel: "logits  z", yFmt: (v) => v.toFixed(1),
        xFmt: (x) => { const i = Math.round(x); return i >= 0 && i < 5 ? LABELS[i].split(" ")[1] : ""; }
      });
      // zero line
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(PL.px, PL.Y(0)); ctx.lineTo(PL.px + PL.pw, PL.Y(0)); ctx.stroke();
      const bw = PL.pw / 7;
      logits.forEach((z, i) => {
        const x = PL.X(i) - bw / 2;
        const y = z >= 0 ? PL.Y(z) : PL.Y(0);
        const hh = Math.abs(PL.Y(z) - PL.Y(0));
        const g = ctx.createLinearGradient(0, y, 0, y + hh);
        g.addColorStop(0, "rgba(45, 212, 191, 0.85)");
        g.addColorStop(1, "rgba(45, 212, 191, 0.35)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, bw, Math.max(2, hh));
        ctx.fillStyle = C.accent;
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(z.toFixed(1), PL.X(i), z >= 0 ? y - 5 : y + hh + 12);
      });

      ctx.save();
      ctx.translate(half + 26, 0);
      const PP = makePlot(half, h, { l: 44, r: 10, t: 26, b: 40 }, -0.6, 4.6, 0, 1);
      frame(ctx, PP, {
        xTicksAt: [0, 1, 2, 3, 4], yTicks: 4, xLabel: "softmax(z)", yFmt: (v) => v.toFixed(2),
        xFmt: (x) => { const i = Math.round(x); return i >= 0 && i < 5 ? LABELS[i].split(" ")[1] : ""; }
      });
      probs.forEach((p, i) => {
        const x = PP.X(i) - bw / 2;
        const y = PP.Y(p);
        const g = ctx.createLinearGradient(0, y, 0, PP.Y(0));
        g.addColorStop(0, "rgba(234, 179, 8, 0.9)");
        g.addColorStop(1, "rgba(234, 179, 8, 0.32)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, Math.max(2, PP.Y(0) - y), [5, 5, 0, 0]);
        ctx.fill();
        ctx.fillStyle = C.brand;
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(p.toFixed(3), PP.X(i), y - 5);
      });
      ctx.restore();

      const entropy = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);
      readout.innerHTML =
        "logits: [ " + logits.map((z) => z.toFixed(wide ? 0 : 1)).join(", ") + " ]<br>" +
        "softmax: [ " + probs.map((p) => p.toFixed(4)).join(", ") + " ]  ·  Σ = <span class='ok'>" +
        probs.reduce((a, b) => a + b, 0).toFixed(6) + "</span><br>" +
        "log-softmax: [ " + lp.map((x) => x.toFixed(3)).join(", ") + " ]  ·  entropy = " + entropy.toFixed(4) + " nats<br>" +
        (naiveOk
          ? "naive exp(z) (no max shift): sum = " + naive.reduce((a, b) => a + b, 0).toFixed(4) + " — fine here"
          : "<span class='bad'>naive exp(z) overflows to Infinity — the max-shift trick saves us</span>");
    }

    function setLogits(next, isWide) {
      wide = !!isWide;
      logits = next.slice();
      buildSliders();
      draw();
    }

    document.getElementById("smReset").addEventListener("click", () => setLogits([2.0, 1.0, 0.1, -1.0, 0.5], false));
    document.getElementById("smOverflow").addEventListener("click", () => setLogits([700, 705, 710, 698, 702], true));
    document.getElementById("smSharp").addEventListener("click", () => setLogits([2, 12, 1, 0, 3], false));
    document.getElementById("smUniform").addEventListener("click", () => setLogits([3, 3, 3, 3, 3], false));

    buildSliders();
    register(draw);
  }

  /* =============================================== cross-entropy widget */
  function crossEntropyWidget() {
    const canvas = document.getElementById("ceCanvas");
    const targetIn = document.getElementById("ceTarget");
    const targetOut = document.getElementById("ceTargetOut");
    const readout = document.getElementById("ceReadout");
    if (!canvas || !targetIn) return;
    const logits = [2.0, 0.5, -1.0, 3.0, 0.1];
    const labels = ["class 0", "class 1", "class 2", "class 3", "class 4"];

    function draw() {
      const t = parseInt(targetIn.value, 10);
      targetOut.textContent = String(t);
      const probs = softmaxFromLogits(logits, true);
      const lp = logSoftmax(logits);
      const loss = -lp[t];

      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const P = makePlot(w, h, { l: 52, r: 22, t: 30, b: 52 }, -0.6, 4.6, 0, 1);
      frame(ctx, P, {
        xTicksAt: [0, 1, 2, 3, 4], yTicks: 4, xLabel: "class", yLabel: "predicted probability q",
        yFmt: (y) => y.toFixed(2),
        xFmt: (x) => String(x)
      });
      const bw = P.pw / 7;
      probs.forEach((p, i) => {
        const x = P.X(i) - bw / 2, y = P.Y(p);
        const isT = i === t;
        const g = ctx.createLinearGradient(0, y, 0, P.Y(0));
        if (isT) { g.addColorStop(0, "rgba(234, 179, 8, 0.92)"); g.addColorStop(1, "rgba(234, 179, 8, 0.35)"); }
        else { g.addColorStop(0, "rgba(45, 212, 191, 0.75)"); g.addColorStop(1, "rgba(45, 212, 191, 0.25)"); }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, Math.max(2, P.Y(0) - y), [5, 5, 0, 0]);
        ctx.fill();
        ctx.fillStyle = isT ? C.teal : C.brand;
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(p.toFixed(3), P.X(i), y - 6);
        if (isT) {
          ctx.fillStyle = C.teal;
          ctx.font = "bold 10px system-ui";
          ctx.fillText("← target", P.X(i), P.py + 12);
        }
      });
      readout.innerHTML =
        "logits = [2.0, 0.5, −1.0, 3.0, 0.1] · target = <strong>class " + t + "</strong><br>" +
        "q[target] = " + probs[t].toFixed(6) + " · log q[target] = " + lp[t].toFixed(6) + "<br>" +
        "L = −log q[target] = <strong>" + loss.toFixed(6) + "</strong><br>" +
        "<span class='muted-note'>PyTorch nn.CrossEntropyLoss() returns this exact number.</span>";
    }
    targetIn.addEventListener("input", draw);
    register(draw);
  }

  /* ======================================================= sampling widget */
  function samplingWidget() {
    const canvas = document.getElementById("sampCanvas");
    const readout = document.getElementById("sampReadout");
    const wrap = document.getElementById("widget-sampling");
    if (!canvas || !wrap) return;
    let source = "normal";
    let samples = [];

    const SOURCES = {
      normal: {
        range: [-4, 4],
        pdf: (x) => normalPdf(x, 0, 1),
        sample: () => {
          let u = 0, v = 0;
          while (u === 0) u = Math.random();
          while (v === 0) v = Math.random();
          return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        },
        name: "Standard normal N(0, 1)"
      },
      exponential: {
        range: [0, 6],
        pdf: (x) => (x < 0 ? 0 : Math.exp(-x)),
        sample: () => -Math.log(1 - Math.random()),
        name: "Exponential (λ = 1)"
      },
      uniform: {
        range: [0, 1],
        pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0),
        sample: () => Math.random(),
        name: "Uniform U(0, 1)"
      }
    };

    const BINS = 32;

    function draw() {
      const S = SOURCES[source];
      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const [lo, hi] = S.range;
      const counts = new Array(BINS).fill(0);
      samples.forEach((s) => {
        const idx = clamp(Math.floor(((s - lo) / (hi - lo)) * BINS), 0, BINS - 1);
        counts[idx]++;
      });
      const binW = (hi - lo) / BINS;
      let peak = 0;
      for (let i = 0; i <= 200; i++) peak = Math.max(peak, S.pdf(lerp(lo, hi, i / 200)));
      const maxDens = Math.max(peak * 1.02, ...counts.map((c) => c / (samples.length * binW || 1)));
      const P = makePlot(w, h, { l: 52, r: 22, t: 22, b: 48 }, lo, hi, 0, maxDens * 1.25);
      frame(ctx, P, {
        xTicks: 6, yTicks: 4, xLabel: "value", yLabel: "density", yFmt: (y) => y.toFixed(2), xFmt: (x) => x.toFixed(1)
      });
      const bw = P.pw / BINS;
      counts.forEach((c, i) => {
        if (!c) return;
        const dens = c / (samples.length * binW);
        const x = P.px + i * bw;
        const y = P.Y(dens);
        ctx.fillStyle = "rgba(45, 212, 191, 0.42)";
        ctx.fillRect(x + 0.5, y, Math.max(1, bw - 1), P.Y(0) - y);
      });
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const x = lerp(lo, hi, i / 200);
        pts.push([P.X(x), P.Y(S.pdf(x))]);
      }
      ctx.strokeStyle = C.brand;
      ctx.lineWidth = 2.4;
      linePath(ctx, pts);
      ctx.stroke();
      ctx.fillStyle = C.brand;
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("true PDF", P.px + 10, P.py + 14);

      const mean = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : NaN;
      const vs = samples.length ? samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length : NaN;
      readout.innerHTML =
        "source: <strong>" + S.name + "</strong> · samples = <strong>" + samples.length.toLocaleString() + "</strong><br>" +
        "sample mean = " + (samples.length ? fmt(mean, 4) : "—") +
        " · sample SD = " + (samples.length ? fmt(Math.sqrt(vs), 4) : "—") + "<br>" +
        "Watch the histogram settle onto the true PDF as the sample count grows.";
    }

    function add(n) {
      const S = SOURCES[source];
      for (let i = 0; i < n; i++) samples.push(S.sample());
      draw();
    }

    wrap.querySelectorAll("[data-samp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll("[data-samp]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        source = btn.dataset.samp;
        samples = [];
        draw();
      });
    });
    document.getElementById("sampOne").addEventListener("click", () => add(1));
    document.getElementById("sampMany").addEventListener("click", () => add(100));
    document.getElementById("sampReset").addEventListener("click", () => { samples = []; draw(); });
    register(draw);
  }

  /* ==================================================== sample-space widget */
  function sampleSpaceWidget() {
    const display = document.getElementById("ssDisplay");
    const sel = document.getElementById("ssEvent");
    const result = document.getElementById("ssResult");
    const rollBtn = document.getElementById("ssRoll");
    const outcome = document.getElementById("ssOutcome");
    const wrap = document.getElementById("widget-sample-space");
    if (!display || !wrap) return;

    const SPACES = {
      coin: {
        outcomes: ["H", "T"],
        events: [
          { name: "Heads", fav: ["H"] },
          { name: "Tails", fav: ["T"] },
          { name: "Anything (the whole sample space)", fav: ["H", "T"] }
        ],
        roll: () => (Math.random() < 0.5 ? "H" : "T")
      },
      die: {
        outcomes: ["1", "2", "3", "4", "5", "6"],
        events: [
          { name: "Even number", fav: ["2", "4", "6"] },
          { name: "Greater than 4", fav: ["5", "6"] },
          { name: "Exactly 3", fav: ["3"] },
          { name: "Odd number", fav: ["1", "3", "5"] }
        ],
        roll: () => String(1 + Math.floor(Math.random() * 6))
      },
      "two-dice": {
        outcomes: ["1,1", "1,2", "1,3", "1,4", "1,5", "1,6", "2,1", "2,2", "2,3", "2,4", "2,5", "2,6",
          "3,1", "3,2", "3,3", "3,4", "3,5", "3,6", "4,1", "4,2", "4,3", "4,4", "4,5", "4,6",
          "5,1", "5,2", "5,3", "5,4", "5,5", "5,6", "6,1", "6,2", "6,3", "6,4", "6,5", "6,6"],
        events: [
          {
            name: "Sum is 7", fav: ["1,6", "2,5", "3,4", "4,3", "5,2", "6,1"]
          },
          {
            name: "Doubles", fav: ["1,1", "2,2", "3,3", "4,4", "5,5", "6,6"]
          },
          {
            name: "Sum ≥ 10", fav: ["4,6", "5,5", "5,6", "6,4", "6,5", "6,6"]
          }
        ],
        roll: () => (1 + Math.floor(Math.random() * 6)) + "," + (1 + Math.floor(Math.random() * 6))
      }
    };

    let mode = "coin";

    function render() {
      const sp = SPACES[mode];
      display.innerHTML = sp.outcomes
        .map((o) => "<div class='ss-chip' data-o='" + o + "'>" + o + "</div>")
        .join("");
      sel.innerHTML = sp.events.map((e, i) => "<option value='" + i + "'>" + e.name + "</option>").join("");
      update();
    }

    function update() {
      const sp = SPACES[mode];
      const ev = sp.events[parseInt(sel.value || "0", 10)];
      const favSet = new Set(ev.fav);
      display.querySelectorAll(".ss-chip").forEach((chip) => {
        chip.classList.toggle("favourable", favSet.has(chip.dataset.o));
        chip.classList.remove("rolled");
      });
      const p = ev.fav.length / sp.outcomes.length;
      result.innerHTML =
        "|S| = " + sp.outcomes.length + "  ·  |event| = " + ev.fav.length + "<br>" +
        "P(event) = " + ev.fav.length + " / " + sp.outcomes.length + " = <strong>" + p.toFixed(4) + "</strong>" +
        (p === 1 ? "  (certain)" : p === 0 ? "  (impossible)" : "");
    }

    wrap.querySelectorAll("[data-ss]").forEach((btn) => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll("[data-ss]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        mode = btn.dataset.ss;
        outcome.textContent = "";
        render();
      });
    });
    sel.addEventListener("change", update);
    rollBtn.addEventListener("click", () => {
      const sp = SPACES[mode];
      const rolled = sp.roll();
      display.querySelectorAll(".ss-chip").forEach((chip) => {
        chip.classList.toggle("rolled", chip.dataset.o === rolled);
      });
      const ev = sp.events[parseInt(sel.value || "0", 10)];
      const hit = ev.fav.indexOf(rolled) >= 0;
      outcome.innerHTML = "Rolled <strong>" + rolled + "</strong> — " +
        (hit ? "<span style='color:#2dd4bf'>the event happened!</span>" : "<span style='color:#f87171'>not this time.</span>");
    });

    render();
  }

  /* ======================================================== cards widget */
  function cardsWidget() {
    const deck = document.getElementById("cardDeck");
    const steps = document.getElementById("condSteps");
    const result = document.getElementById("condResult");
    const toggle = document.getElementById("condToggle");
    if (!deck || !toggle) return;

    const SUITS = ["♠", "♥", "♦", "♣"];
    const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const cards = [];
    SUITS.forEach((s) => RANKS.forEach((r) => cards.push({ r, s })));

    let filtered = false;

    function render() {
      deck.innerHTML = cards.map((c) => {
        const isFace = ["J", "Q", "K"].indexOf(c.r) >= 0;
        const isKing = c.r === "K";
        let cls = "pcard";
        if (isKing && (!filtered || isFace)) cls += " king";
        else if (isFace) cls += " face";
        if (filtered && !isFace) cls += " dimmed";
        return "<div class='" + cls + "'>" + c.r + c.s + "</div>";
      }).join("");

      steps.innerHTML = filtered
        ? "P(King | Face) = P(King and Face) / P(Face)<br>&nbsp;&nbsp;= (4/52) / (12/52)<br>&nbsp;&nbsp;= 4/12"
        : "P(King) = 4/52 = 0.0769 &nbsp;← before we learn anything<br><span style='color:#8b979e'>Now press the button to condition on \"face card\"…</span>";

      result.innerHTML = filtered
        ? "P(King | Face card) = <strong>1/3 ≈ 0.3333</strong><br>Knowing the card is a face card tripled the odds from 7.7% to 33.3%."
        : "Deck of 52 cards · 12 face cards · 4 kings";

      toggle.textContent = filtered ? "Reset to the full deck" : "Show the \"given\" filter";
    }

    toggle.addEventListener("click", () => { filtered = !filtered; render(); });
    render();
  }

  /* ===================================================== bayes explorer */
  function bayesWidget() {
    const canvas = document.getElementById("bayesCanvas");
    const priorIn = document.getElementById("bayesPrior");
    const sensIn = document.getElementById("bayesSens");
    const fpIn = document.getElementById("bayesFp");
    const priorOut = document.getElementById("bayesPriorOut");
    const sensOut = document.getElementById("bayesSensOut");
    const fpOut = document.getElementById("bayesFpOut");
    const readout = document.getElementById("bayesReadout");
    if (!canvas || !priorIn || !sensIn || !fpIn) return;

    const N = 100000;

    function fmtPct(p) {
      const v = p * 100;
      if (v >= 10) return v.toFixed(1) + "%";
      if (v >= 1) return v.toFixed(2) + "%";
      return v.toFixed(3) + "%";
    }

    function vals() {
      const prior = Math.pow(10, parseFloat(priorIn.value));
      const sens = parseFloat(sensIn.value);
      const fp = parseFloat(fpIn.value);
      const evidence = sens * prior + fp * (1 - prior);
      const posterior = evidence > 0 ? (sens * prior) / evidence : 0;
      return { prior, sens, fp, evidence, posterior };
    }

    function draw() {
      const v = vals();
      priorOut.textContent = fmtPct(v.prior);
      sensOut.textContent = v.sens.toFixed(2);
      fpOut.textContent = v.fp.toFixed(3);

      const tp = v.sens * v.prior;
      const fn = (1 - v.sens) * v.prior;
      const fp = v.fp * (1 - v.prior);
      const tn = Math.max(0, (1 - v.fp) * (1 - v.prior));

      const { ctx, w, h } = setup(canvas);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = C.paper;
      ctx.fillRect(0, 0, w, h);

      const barX = Math.min(132, w * 0.30);
      const barW = Math.max(60, w - barX - 20);
      const bh = Math.max(24, h * 0.17);
      const y1 = h * 0.30 - bh / 2;
      const y2 = h * 0.74 - bh / 2;

      function segs(x, y, parts, total) {
        let cx = x;
        parts.forEach((s) => {
          const sw = total > 0 ? (s.f / total) * barW : 0;
          const dw = Math.min(s.f > 0 ? Math.max(sw, 2.5) : 0, x + barW - cx);
          if (dw > 0) {
            ctx.fillStyle = s.c;
            ctx.fillRect(cx, y, dw, bh);
            cx += dw;
          }
        });
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, barW, bh);
      }

      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = C.soft;
      ctx.fillText("All tested", 10, y1 + bh / 2);
      segs(barX, y1, [
        { f: tp, c: C.brand },
        { f: fn, c: "#f87171" },
        { f: fp, c: C.teal },
        { f: tn, c: "rgba(226, 232, 240, 0.14)" }
      ], 1);
      ctx.fillText("Positives only", 10, y2 + bh / 2);
      segs(barX, y2, [
        { f: v.posterior, c: C.brand },
        { f: 1 - v.posterior, c: C.teal }
      ], 1);

      const tpN = Math.round(tp * N).toLocaleString();
      const fpN = Math.round(fp * N).toLocaleString();
      readout.innerHTML =
        "P(B) = sens·prior + fp·(1−prior) = <strong>" + v.evidence.toPrecision(4) + "</strong><br>" +
        "P(A|B) = sens·prior / P(B) = <strong>" + fmtPct(v.posterior) + "</strong><br>" +
        "In " + N.toLocaleString() + " people: " + tpN + " true positives vs " + fpN +
        " false positives" + ((1 - v.posterior) > 0.5
          ? " — <span class='bad'>most alarms are false</span>"
          : " — <span class='ok'>most alarms are real</span>");
    }

    [priorIn, sensIn, fpIn].forEach((el) => el.addEventListener("input", draw));
    document.getElementById("bayesPresetMed").addEventListener("click", () => {
      priorIn.value = "-4"; sensIn.value = "0.99"; fpIn.value = "0.01"; draw();
    });
    document.getElementById("bayesPresetSpam").addEventListener("click", () => {
      priorIn.value = "-0.5"; sensIn.value = "0.05"; fpIn.value = "0.001"; draw();
    });
    register(draw);
  }

  /* ============================================================ init all */
  function init() {
    heroBackground();
    pmfChart();
    pdfChart();
    pdfAreaWidget();
    sigmaWidget();
    distExplorer();
    expectedValueWidget();
    jointTableWidget();
    bayesWidget();
    cltWidget();
    underflowWidget();
    softmaxWidget();
    crossEntropyWidget();
    samplingWidget();
    sampleSpaceWidget();
    cardsWidget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.VIZ = { redraw: () => redrawers.forEach((f) => { try { f(); } catch (e) { /* noop */ } }) };
})();
