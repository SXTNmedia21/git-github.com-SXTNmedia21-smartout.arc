// ===== Report popup — embeds any reports/*.html in an in-app modal =====
// Exposes window.openReportDoc({ src, title, subtitle, frameTitle, filterLabel, filters })
// and window.openDagsrapport() (a thin wrapper). A cohesive document-window: light header
// (brand + optional data filters + print/close) above the page area. Read, print, or close.
// Opening reports in-app avoids the blank "new tab" the sandboxed iframe can't navigate to.
(function () {
  if (window.openReportDoc) return;

  function injectStyle() {
    if (document.getElementById("dr-modal-style")) return;
    var css = `
    .dr-scrim{ position:fixed; inset:0; z-index:120; background:rgba(28,24,20,0.5); backdrop-filter:blur(5px);
      display:flex; align-items:center; justify-content:center; padding:26px; animation:dr-fade .18s ease; }
    @keyframes dr-fade{ from{opacity:0} to{opacity:1} }
    @keyframes dr-rise{ from{opacity:0; transform:translateY(12px) scale(.99)} to{opacity:1; transform:none} }
    .dr-win{ width:min(940px,100%); height:min(94vh,1040px); background:var(--card,#fff); border-radius:16px;
      overflow:hidden; display:flex; flex-direction:column; box-shadow:0 30px 90px rgba(28,24,20,0.42);
      border:1px solid var(--border,#e8e5e1); animation:dr-rise .22s cubic-bezier(.2,.8,.3,1); }
    .dr-head{ flex-shrink:0; display:flex; align-items:center; gap:13px; padding:15px 18px 13px; }
    .dr-mk{ width:30px;height:30px;border-radius:9px;background:var(--orange,#f97316); display:inline-flex;
      align-items:center;justify-content:center;flex-shrink:0; box-shadow:0 2px 9px rgba(249,115,22,.32); }
    .dr-mk span{ width:11px;height:11px;border-radius:3px;background:#fff; }
    .dr-id .t{ font-family:var(--font-display,'Instrument Serif',Georgia,serif); font-size:22px; line-height:1; color:var(--fg,#1c1814); letter-spacing:-0.01em; }
    .dr-id .s{ font-size:11.5px; color:var(--muted,#7a756e); margin-top:3px; }
    .dr-sp{ flex:1; }
    .dr-btn{ font-family:inherit; font-size:13px; font-weight:600; border:none; border-radius:9px;
      padding:9px 15px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:background .15s; }
    .dr-btn.ghost{ background:var(--secondary,#f5f3f0); color:var(--fg,#1c1814); }
    .dr-btn.ghost:hover{ background:var(--border,#e8e5e1); }
    .dr-btn.prim{ background:var(--orange,#f97316); color:#fff; }
    .dr-btn.prim:hover{ background:var(--orange-dark,#c2410c); }
    .dr-filters{ flex-shrink:0; display:flex; align-items:center; gap:8px; padding:0 18px 14px; flex-wrap:wrap; }
    .dr-flbl{ font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted-soft,#a8a39c); margin-right:3px; }
    .dr-chip{ font-family:inherit; font-size:12.5px; font-weight:600; border:1px solid var(--border,#e8e5e1);
      background:var(--card,#fff); color:var(--muted,#7a756e); border-radius:999px; padding:6px 13px; cursor:pointer; transition:all .14s; }
    .dr-chip:hover{ color:var(--fg,#1c1814); border-color:var(--border-strong,#d4cfc7); }
    .dr-chip.on{ background:var(--orange,#f97316); border-color:var(--orange,#f97316); color:#fff; }
    .dr-chip.all.on{ background:var(--fg,#1c1814); border-color:var(--fg,#1c1814); color:var(--card,#fff); }
    .dr-body{ flex:1; min-height:0; background:#ece8e2; border-top:1px solid var(--border,#e8e5e1); }
    .dr-frame{ width:100%; height:100%; border:none; background:#ece8e2; display:block; }
    @media (max-width:680px){ .dr-scrim{ padding:0; } .dr-win{ width:100%; height:100%; border-radius:0; border:none; } .dr-id .s{ display:none; } }
    `;
    var s = document.createElement("style");
    s.id = "dr-modal-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  window.openReportDoc = function (opts) {
    opts = opts || {};
    injectStyle();
    if (document.querySelector(".dr-scrim")) return; // already open

    var scrim = document.createElement("div");
    scrim.className = "dr-scrim";

    var win = document.createElement("div");
    win.className = "dr-win";

    var head = document.createElement("div");
    head.className = "dr-head";
    var esc = function (x) { return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };
    head.innerHTML =
      '<span class="dr-mk"><span></span></span>' +
      '<div class="dr-id"><div class="t">' + esc(opts.title || "Dagsrapport") + '</div>' +
      '<div class="s">' + esc(opts.subtitle || "Bistro Nord · torsdag 30. mai · klar for utskrift") + '</div></div>' +
      '<span class="dr-sp"></span>' +
      '<button class="dr-btn ghost" data-dr="close">Lukk</button>' +
      '<button class="dr-btn prim" data-dr="print">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 20h14"/></svg>' +
      'Skriv ut / lagre som PDF</button>';

    var filters = document.createElement("div");
    filters.className = "dr-filters";

    var body = document.createElement("div");
    body.className = "dr-body";
    var frame = document.createElement("iframe");
    frame.className = "dr-frame";
    frame.title = opts.frameTitle || "Rapport — Bistro Nord";
    frame.src = (opts.src || "reports/Dagsrapport.html");
    body.appendChild(frame);

    // ---- filter chips: choose what to view / print (optional) ----
    var CATS = opts.filters || null;
    var hasFilters = !!(CATS && CATS.length);
    var sel = {}; // selected section keys; empty = komplett (all)
    function selectedKeys() { return Object.keys(sel); }
    function isAll() { return selectedKeys().length === 0; }
    function applyToFrame() {
      if (!hasFilters) return;
      var keys = isAll() ? ["*"] : selectedKeys();
      try { if (frame.contentWindow.applyReportFilter) frame.contentWindow.applyReportFilter(keys); else if (frame.contentWindow.applyDagsrapportFilter) frame.contentWindow.applyDagsrapportFilter(keys); } catch (e) {}
    }
    function renderChips() {
      filters.innerHTML = '<span class="dr-flbl">' + esc(opts.filterLabel || "Vis / skriv ut") + '</span>';
      CATS.forEach(function (c) {
        var on = c.id === "all" ? isAll() : c.keys.every(function (k) { return sel[k]; });
        var b = document.createElement("button");
        b.className = "dr-chip" + (c.id === "all" ? " all" : "") + (on ? " on" : "");
        b.textContent = c.label;
        b.addEventListener("click", function () {
          if (c.id === "all") { sel = {}; }
          else {
            var allOn = c.keys.every(function (k) { return sel[k]; });
            c.keys.forEach(function (k) { if (allOn) delete sel[k]; else sel[k] = true; });
          }
          renderChips();
          applyToFrame();
        });
        filters.appendChild(b);
      });
    }
    if (hasFilters) { renderChips(); frame.addEventListener("load", applyToFrame); }

    win.appendChild(head);
    if (hasFilters) win.appendChild(filters);
    win.appendChild(body);
    scrim.appendChild(win);
    document.body.appendChild(scrim);
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function close() {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      scrim.remove();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    function print() {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch (err) { window.print(); }
    }

    head.addEventListener("click", function (e) {
      var t = e.target.closest("[data-dr]");
      if (!t) return;
      if (t.getAttribute("data-dr") === "close") close();
      if (t.getAttribute("data-dr") === "print") print();
    });
    scrim.addEventListener("mousedown", function (e) { if (e.target === scrim) close(); });
    document.addEventListener("keydown", onKey);

    return { close: close, print: print };
  };

  // Backward-compatible wrapper: the original Dagsrapport popup with its section chips.
  window.openDagsrapport = function (opts) {
    opts = opts || {};
    return window.openReportDoc({
      src: opts.src || "reports/Dagsrapport.html",
      title: "Dagsrapport",
      subtitle: "Bistro Nord · torsdag 30. mai · klar for utskrift",
      frameTitle: "Dagsrapport — Bistro Nord",
      filterLabel: "Vis / skriv ut",
      filters: [
        { id: "all", label: "Komplett", keys: ["*"] },
        { id: "bemanning", label: "Personalet", keys: ["bemanning"] },
        { id: "bookinger", label: "Bookinger", keys: ["bookinger"] },
        { id: "eventer", label: "Eventer", keys: ["eventer"] },
        { id: "allergi", label: "Allergier", keys: ["allergi"] },
        { id: "meny", label: "Kjøkken", keys: ["meny"] },
        { id: "leveranser", label: "Leveranser", keys: ["leveranser"] },
        { id: "avvik", label: "Avvik", keys: ["avvik"] },
        { id: "sjekk", label: "Sjekklister", keys: ["apning", "notater", "stenging"] }
      ],
    });
  };
})();
