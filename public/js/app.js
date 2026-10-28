(function () {
  "use strict";

  var CURRENCY = "MAD";
  var CFG = { whatsapp: "", storeName: "QuickPara", hours: "" };
  var CATS = [];
  var PRODUCTS = [];
  var BY_ID = {};
  var CAT_BY_ID = {};
  var TONE = {};

  var STORE_KEY = "quickpara-cart-v2";
  var state = { cart: {}, cat: "all", q: "" };

  var ICONS = {
    visage: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    corps: '<path d="M9 3h6v3H9z"/><path d="M8 6h8l1 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9z"/><path d="M7.5 13h9"/>',
    bebe: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    complements: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.2 9.2 5.6 5.6"/>',
    hygiene: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
    soins: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.bag) + "</svg>";
  }

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString("fr-FR") + " " + CURRENCY; }
  function tone(p) { return TONE[p.category] || "tone-none"; }
  function catIcon(p) { return (CAT_BY_ID[p.category] || {}).icon || "bag"; }

  /* ---------- data ---------- */
  function setup(data) {
    CFG = data.settings || CFG;
    CATS = data.categories || [];
    PRODUCTS = data.products || [];
    BY_ID = {}; CAT_BY_ID = {}; TONE = {};
    PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });
    CATS.forEach(function (c, i) { CAT_BY_ID[c.id] = c; TONE[c.id] = "tone-" + (i % 6); });
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      Object.keys(raw).forEach(function (id) {
        var q = parseInt(raw[id], 10);
        if (BY_ID[id] && q > 0) state.cart[id] = q;
      });
    } catch (e) { /* storage unavailable: cart lives in memory only */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.cart)); } catch (e) { /* ignore */ }
  }

  /* ---------- whatsapp ---------- */
  function waLink(text) {
    return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text);
  }
  function buildOrderMessage() {
    var lines = ["Bonjour " + CFG.storeName + ", je souhaite commander :", ""];
    var total = 0;
    Object.keys(state.cart).forEach(function (id) {
      var p = BY_ID[id], q = state.cart[id], sub = p.price * q;
      total += sub;
      lines.push("• " + q + " × " + p.name + " (" + fmt(p.price) + ") = " + fmt(sub));
    });
    lines.push("", "Total estimé : " + fmt(total), "");
    var name = $("#f-name").value.trim(), city = $("#f-city").value.trim(), note = $("#f-note").value.trim();
    if (name) lines.push("Nom : " + name);
    if (city) lines.push("Ville / quartier : " + city);
    if (note) lines.push("Précisions : " + note);
    lines.push("", "Merci de me confirmer la disponibilité et la livraison.");
    return lines.join("\n");
  }

  /* ---------- catalogue ---------- */
  function renderChips() {
    var all = [{ id: "all", label: "Tous", icon: "bag" }].concat(CATS);
    $("#chips").innerHTML = all.map(function (c) {
      return '<button class="chip" role="tab" data-cat="' + esc(c.id) + '" aria-selected="' + (state.cat === String(c.id)) + '">' +
        icon(c.icon) + esc(c.label) + "</button>";
    }).join("");
  }

  function visual(p) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<span class="glyph">' + icon(catIcon(p)) + "</span>";
  }

  function cardFooter(p) {
    var q = state.cart[p.id] || 0;
    var action = q
      ? '<div class="stepper" role="group" aria-label="Quantité de ' + esc(p.name) + '">' +
          '<button data-act="dec" aria-label="Retirer un">−</button><span>' + q + '</span><button data-act="inc" aria-label="Ajouter un">+</button></div>'
      : '<button class="add" data-act="add">Ajouter</button>';
    return '<span class="price">' + Number(p.price).toLocaleString("fr-FR") + "<small>" + CURRENCY + "</small></span>" + action;
  }

  function renderSkeleton() {
    var one = '<div class="card skel"><div class="card-visual"></div><div class="card-body"><i></i><i></i><i class="short"></i></div></div>';
    $("#grid").innerHTML = new Array(8).fill(one).join("");
  }

  function renderGrid() {
    var q = state.q.trim().toLowerCase();
    var list = PRODUCTS.filter(function (p) {
      if (state.cat !== "all" && String(p.category) !== state.cat) return false;
      if (!q) return true;
      return (p.name + " " + (p.brand || "") + " " + (p.desc || "")).toLowerCase().indexOf(q) !== -1;
    });
    $("#result-count").textContent = list.length + (list.length > 1 ? " produits" : " produit");

    if (!list.length) {
      var msg = PRODUCTS.length ? "Aucun produit ne correspond à votre recherche." : "Le catalogue arrive très bientôt.";
      $("#grid").innerHTML = '<div class="empty"><p>' + msg + "</p>" +
        '<a href="#" class="btn btn-wa" data-wa-ask data-ask-q="' + esc(state.q) + '">Demandez-nous sur WhatsApp</a></div>';
      return;
    }
    $("#grid").innerHTML = list.map(function (p) {
      return '<article class="card" data-id="' + esc(p.id) + '">' +
        '<div class="card-visual ' + tone(p) + '">' + visual(p) + "</div>" +
        '<div class="card-body">' +
          (p.brand ? '<span class="brand">' + esc(p.brand) + "</span>" : "") +
          "<h3>" + esc(p.name) + "</h3>" +
          '<p class="desc">' + esc(p.desc || "") + "</p>" +
          '<div class="card-foot">' + cardFooter(p) + "</div>" +
        "</div></article>";
    }).join("");
  }

  function refreshCard(id) {
    var el = document.querySelector('.card[data-id="' + id + '"] .card-foot');
    if (el && BY_ID[id]) el.innerHTML = cardFooter(BY_ID[id]);
  }

  /* ---------- cart ---------- */
  function cartCount() {
    return Object.keys(state.cart).reduce(function (n, id) { return n + state.cart[id]; }, 0);
  }
  function cartTotal() {
    return Object.keys(state.cart).reduce(function (n, id) { return n + state.cart[id] * BY_ID[id].price; }, 0);
  }

  function setQty(id, q) {
    if (q <= 0) delete state.cart[id]; else state.cart[id] = Math.min(q, 99);
    save();
    refreshCard(id);
    renderCart();
  }

  function renderCart() {
    var n = cartCount();
    var badge = $("#cart-count");
    badge.hidden = n === 0;
    badge.textContent = n;

    var ids = Object.keys(state.cart);
    $("#cart-foot").hidden = ids.length === 0;

    if (!ids.length) {
      $("#cart-body").innerHTML = '<div class="cart-empty"><span class="glyph">' + icon("bag") + "</span>" +
        "<b>Votre panier est vide</b><p>Ajoutez des produits pour préparer votre commande.</p></div>";
      return;
    }
    $("#cart-body").innerHTML = ids.map(function (id) {
      var p = BY_ID[id], q = state.cart[id];
      return '<div class="line" data-id="' + esc(id) + '">' +
        '<div class="line-thumb ' + tone(p) + '">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : icon(catIcon(p))) + "</div>" +
        '<div class="line-info"><b>' + esc(p.name) + "</b><small>" + fmt(p.price) + "</small></div>" +
        '<div class="line-side"><span class="line-total">' + fmt(p.price * q) + "</span>" +
          '<div class="stepper" role="group" aria-label="Quantité">' +
            '<button data-act="dec" aria-label="Retirer un">−</button><span>' + q + '</span><button data-act="inc" aria-label="Ajouter un">+</button></div>' +
        "</div></div>";
    }).join("");
    $("#cart-total").textContent = fmt(cartTotal());
  }

  var lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    $("#overlay").hidden = false;
    var d = $("#drawer");
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock");
    $("#close-cart").focus();
  }
  function closeCart() {
    $("#overlay").hidden = true;
    var d = $("#drawer");
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  function bump() {
    var b = $("#open-cart");
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
  }

  /* ---------- events ---------- */
  function onStepperClick(e, resolveId) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = resolveId(btn);
    if (!id || !BY_ID[id]) return;
    var cur = state.cart[id] || 0, act = btn.getAttribute("data-act");
    if (act === "add") { setQty(id, 1); toast("Ajouté au panier"); bump(); }
    else if (act === "inc") { setQty(id, cur + 1); if (!btn.closest(".drawer")) bump(); }
    else if (act === "dec") { setQty(id, cur - 1); }
  }

  function bind() {
    $("#chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      state.cat = b.getAttribute("data-cat");
      renderChips();
      renderGrid();
    });

    $("#search").addEventListener("input", function (e) {
      state.q = e.target.value;
      renderGrid();
    });

    $("#grid").addEventListener("click", function (e) {
      var retry = e.target.closest("[data-retry]");
      if (retry) { boot(); return; }
      onStepperClick(e, function (b) { var c = b.closest(".card"); return c && c.getAttribute("data-id"); });
    });
    $("#cart-body").addEventListener("click", function (e) {
      onStepperClick(e, function (b) { var l = b.closest(".line"); return l && l.getAttribute("data-id"); });
    });

    $("#open-cart").addEventListener("click", openCart);
    $("#close-cart").addEventListener("click", closeCart);
    $("#overlay").addEventListener("click", closeCart);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $("#drawer").classList.contains("open")) closeCart();
    });

    $("#clear-cart").addEventListener("click", function () {
      var ids = Object.keys(state.cart);
      state.cart = {};
      save();
      ids.forEach(refreshCard);
      renderCart();
    });

    $("#checkout").addEventListener("click", function () {
      if (!cartCount()) return;
      window.open(waLink(buildOrderMessage()), "_blank", "noopener");
    });

    // Free-text WhatsApp contact (hero, banner, floating button, empty search)
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-wa-ask]");
      if (!a) return;
      e.preventDefault();
      if (!CFG.whatsapp) return;
      var q = a.getAttribute("data-ask-q");
      var text = q
        ? "Bonjour " + CFG.storeName + ", je cherche : " + q
        : "Bonjour " + CFG.storeName + ", j'ai une question.";
      window.open(waLink(text), "_blank", "noopener");
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    renderSkeleton();
    $("#result-count").textContent = "";
    fetch("/api/catalog", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        setup(data);
        load();
        $("#footer-hours").textContent = CFG.hours || "";
        renderChips();
        renderGrid();
        renderCart();
      })
      .catch(function () {
        $("#grid").innerHTML = '<div class="empty"><p>Impossible de charger le catalogue pour le moment.</p>' +
          '<button class="btn btn-primary" data-retry>Réessayer</button></div>';
      });
  }

  bind();
  boot();
})();
