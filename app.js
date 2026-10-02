/* ==========================================================================
   app.js — page chrome: progress bar, nav, tabs, glossary search
   ========================================================================== */
(function () {
  "use strict";

  /* --------------------------------------------------- reading progress */
  const progressBar = document.getElementById("progressBar");
  const topbar = document.getElementById("topbar");

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + "%";
    if (topbar) topbar.classList.toggle("scrolled", doc.scrollTop > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------ mobile nav */
  const navToggle = document.getElementById("navToggle");
  const topnav = document.getElementById("topnav");
  if (navToggle && topnav) {
    navToggle.addEventListener("click", () => {
      const open = topnav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    topnav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        topnav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ------------------------------------------------- active section links */
  const navLinks = Array.prototype.slice.call(document.querySelectorAll(".topnav a"));
  const linkMap = navLinks
    .map((a) => {
      const id = a.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      return section ? { a: section, link: a } : null;
    })
    .filter(Boolean);

  function updateActive() {
    const y = window.scrollY + window.innerHeight * 0.28;
    let current = linkMap[0];
    linkMap.forEach((item) => {
      if (item.a.offsetTop <= y) current = item;
    });
    navLinks.forEach((l) => l.classList.remove("active"));
    if (current) current.link.classList.add("active");
  }
  window.addEventListener("scroll", updateActive, { passive: true });
  updateActive();

  /* ----------------------------------------------------------- code tabs */
  const tabWrap = document.getElementById("codeTabs");
  if (tabWrap) {
    const tabs = tabWrap.querySelectorAll(".code-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tabWrap.querySelectorAll(".code-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = document.getElementById(tab.dataset.code);
        if (panel) panel.classList.add("active");
      });
    });
  }

  /* ------------------------------------------------------- glossary search */
  const search = document.getElementById("glossarySearch");
  const grid = document.getElementById("glossaryGrid");
  const empty = document.getElementById("glossaryEmpty");
  if (search && grid) {
    const terms = Array.prototype.slice.call(grid.querySelectorAll(".term"));
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      terms.forEach((t) => {
        const hit = !q || t.textContent.toLowerCase().indexOf(q) >= 0;
        t.hidden = !hit;
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ------------------------------------------- exercise keyboard niceties */
  document.querySelectorAll(".exercise").forEach((ex) => {
    ex.addEventListener("toggle", () => {
      if (ex.open) {
        const body = ex.querySelector(".ex-body");
        if (body) body.setAttribute("tabindex", "-1");
      }
    });
  });

  /* ------------------------------------------- re-align anchor after init */
  function realignHash() {
    if (!location.hash) return;
    let target = null;
    try { target = document.querySelector(location.hash); } catch (e) { return; }
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }
  window.addEventListener("load", () => {
    realignHash();
    setTimeout(realignHash, 250);
    setTimeout(realignHash, 900);
  });
})();
