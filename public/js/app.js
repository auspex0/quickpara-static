(function () {
  "use strict";

  var CURRENCY = "MAD";
  var CFG = { whatsapp: "", storeName: "QuickPara", hours: "", minOrder: null, social: {} };
  var CATS = [];
  var PRODUCTS = [];
  var ZONES = [];
  var BRANDS = [];
  var BY_ID = {};
  var CAT_BY_ID = {};
  var ZONE_BY_ID = {};
  var TONE = {};

  var STORE_KEY = "quickpara-cart-v2";
  var ZONE_KEY = "quickpara-zone";
  var state = { cart: {}, cat: "all", brand: "all", q: "", zone: "" };

  var ICONS = {
    visage: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    corps: '<path d="M9 3h6v3H9z"/><path d="M8 6h8l1 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9z"/><path d="M7.5 13h9"/>',
    bebe: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    complements: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.2 9.2 5.6 5.6"/>',
    hygiene: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
    soins: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'
  };
  var SOCIAL = [
    { key: "instagram", label: "Instagram", d: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>' },
    { key: "facebook", label: "Facebook", d: '<path d="M14 8.5h3V4.5h-3A4 4 0 0 0 10 8.5V11H7v4h3v6h4v-6h3l1-4h-4V8.8c0-.2.1-.3.3-.3z"/>' },
    { key: "maps", label: "Google Maps", d: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>' },
    { key: "googleBusiness", label: "Google Business", d: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/>' }
  ];
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
  function brandKey(b) { return String(b || "").trim().replace(/\s+/g, " ").toLowerCase(); }
  function promoPercent(p) {
    return p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  }

  /* ---------- delivery (the rule the server will reuse for orders) ---------- */
  function feeFor(zone, subtotal) {
    if (!zone) return null;
    if (zone.freeFrom !== null && zone.freeFrom !== undefined && subtotal >= zone.freeFrom) return 0;
    return zone.fee;
  }

  /* ---------- data ---------- */
  function setup(data) {
    CFG = data.settings || CFG;
    CFG.social = CFG.social || {};
    CATS = data.categories || [];
    PRODUCTS = data.products || [];
    ZONES = data.zones || [];
    BY_ID = {}; CAT_BY_ID = {}; ZONE_BY_ID = {}; TONE = {};
    PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });
    CATS.forEach(function (c, i) { CAT_BY_ID[c.id] = c; TONE[c.id] = "tone-" + (i % 6); });
    ZONES.forEach(function (z) { ZONE_BY_ID[z.id] = z; });

    // Brands: grouped ignoring case and extra spaces; shown with the most common spelling.
    var groups = {};
    PRODUCTS.forEach(function (p) {
      var k = brandKey(p.brand);
      if (!k) return;
      var label = String(p.brand).trim().replace(/\s+/g, " ");
      var g = groups[k] || (groups[k] = { key: k, spellings: {} });
      g.spellings[label] = (g.spellings[label] || 0) + 1;
    });
    BRANDS = Object.keys(groups).map(function (k) {
      var sp = groups[k].spellings;
      // Most common spelling wins; on a tie prefer one that is not all lowercase ("La Roche-Posay" over "la roche-posay").
      var best = Object.keys(sp).sort(function (a, b) {
        var capA = a === a.toLowerCase() ? 1 : 0, capB = b === b.toLowerCase() ? 1 : 0;
        return sp[b] - sp[a] || capA - capB || a.localeCompare(b);
      })[0];
      return { key: k, label: best };
    }).sort(function (a, b) { return a.label.localeCompare(b.label, "fr"); });
    if (state.brand !== "all" && !groups[state.brand]) state.brand = "all";
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      Object.keys(raw).forEach(function (id) {
        var q = parseInt(raw[id], 10);
        if (BY_ID[id] && q > 0) state.cart[id] = q;
      });
      var z = localStorage.getItem(ZONE_KEY);
      if (z && ZONE_BY_ID[z]) state.zone = z;
    } catch (e) { /* storage unavailable: cart lives in memory only */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.cart)); } catch (e) { /* ignore */ }
  }
  function saveZone() {
    try { localStorage.setItem(ZONE_KEY, state.zone); } catch (e) { /* ignore */ }
  }

  /* ---------- whatsapp ---------- */
  function waLink(text) {
    return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text);
  }
  function customerLines() {
    var out = [];
    var name = $("#f-name").value.trim(), city = $("#f-city").value.trim(), note = $("#f-note").value.trim();
    if (name) out.push("Nom : " + name);
    if (city) out.push("Ville / quartier : " + city);
    if (note) out.push("Précisions : " + note);
    return out;
  }

  // Message built from the saved order: number and prices come from the server.
  function buildServerMessage(o) {
    var lines = ["Bonjour " + CFG.storeName + ", je souhaite commander (commande " + o.number + ") :", ""];
    o.lines.forEach(function (l) {
      lines.push("• " + l.qty + " × " + l.name + " (" + fmt(l.unitPrice) + ") = " + fmt(l.lineTotal));
    });
    lines.push("");
    if (o.zone) {
      lines.push("Sous-total : " + fmt(o.subtotal));
      lines.push("Zone : " + o.zone);
      lines.push("Livraison : " + (o.deliveryFee === 0 ? "Gratuite" : fmt(o.deliveryFee)));
      lines.push("Total : " + fmt(o.total), "");
    } else {
      lines.push("Total estimé : " + fmt(o.total), "");
    }
    lines = lines.concat(customerLines());
    lines.push("", "Merci de me confirmer la disponibilité et la livraison.");
    return lines.join("\n");
  }

  // Fallback message (no order number) used when the order could not be saved: the sale is never lost.
  function buildOrderMessage() {
    var lines = ["Bonjour " + CFG.storeName + ", je souhaite commander :", ""];
    var subtotal = 0;
    Object.keys(state.cart).forEach(function (id) {
      var p = BY_ID[id], q = state.cart[id], sub = p.price * q;
      subtotal += sub;
      lines.push("• " + q + " × " + p.name + " (" + fmt(p.price) + ") = " + fmt(sub));
    });
    lines.push("");
    var zone = ZONE_BY_ID[state.zone];
    if (ZONES.length && zone) {
      var fee = feeFor(zone, subtotal);
      lines.push("Sous-total : " + fmt(subtotal));
      lines.push("Zone : " + zone.label);
      lines.push("Livraison : " + (fee === 0 ? "Gratuite" : fmt(fee)));
      lines.push("Total : " + fmt(subtotal + fee), "");
    } else {
      lines.push("Total estimé : " + fmt(subtotal), "");
    }
    lines = lines.concat(customerLines());
    lines.push("", "Merci de me confirmer la disponibilité et la livraison.");
    return lines.join("\n");
  }

  function orderPayload() {
    return {
      items: Object.keys(state.cart).map(function (id) { return { id: Number(id), qty: state.cart[id] }; }),
      zone_id: state.zone ? Number(state.zone) : null,
      name: $("#f-name").value,
      city: $("#f-city").value,
      note: $("#f-note").value
    };
  }

  /* ---------- category addresses: /c/<slug> ---------- */
  function homeTitle() { return CFG.storeName + " — Parapharmacie & produits paramédicaux au Maroc"; }
  function catFromPath() {
    var m = location.pathname.match(/^\/c\/([a-z0-9-]+)\/?$/);
    if (!m) return "all";
    var c = CATS.filter(function (x) { return x.slug === m[1]; })[0];
    return c ? String(c.id) : "all";
  }
  function pathFor(cat) {
    if (cat === "all") return "/";
    var c = CAT_BY_ID[cat];
    return c && c.slug ? "/c/" + c.slug : null;
  }
  function syncTitle() {
    var c = state.cat !== "all" && CAT_BY_ID[state.cat];
    document.title = c ? c.label + " — " + CFG.storeName + " | Parapharmacie au Maroc" : homeTitle();
  }

  /* ---------- catalogue ---------- */
  function renderChips() {
    var all = [{ id: "all", label: "Tous", icon: "bag" }].concat(CATS);
    $("#chips").innerHTML = all.map(function (c) {
      return '<button class="chip" role="tab" data-cat="' + esc(c.id) + '" aria-selected="' + (state.cat === String(c.id)) + '">' +
        icon(c.icon) + esc(c.label) + "</button>";
    }).join("");
  }

  function renderBrands() {
    var wrap = $("#brand-wrap");
    wrap.hidden = BRANDS.length < 2;
    $("#brand").innerHTML = '<option value="all">Toutes les marques</option>' + BRANDS.map(function (b) {
      return '<option value="' + esc(b.key) + '"' + (state.brand === b.key ? " selected" : "") + ">" + esc(b.label) + "</option>";
    }).join("");
  }

  function renderSocial() {
    var links = SOCIAL.filter(function (s) { return /^https:\/\//.test(CFG.social[s.key] || ""); });
    var box = $("#social");
    box.hidden = !links.length;
    box.innerHTML = links.map(function (s) {
      return '<a href="' + esc(CFG.social[s.key]) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(s.label) + '" title="' + esc(s.label) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + s.d + "</svg></a>";
    }).join("");
  }

  function visual(p) {
    var badges = "";
    var pct = promoPercent(p);
    if (pct) badges += '<span class="badge-tag badge-promo">-' + pct + " %</span>";
    if (p.isNew) badges += '<span class="badge-tag badge-new">Nouveau</span>';
    var inner = p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : '<span class="glyph">' + icon(catIcon(p)) + "</span>";
    return (badges ? '<div class="badges">' + badges + "</div>" : "") + inner;
  }

  function cardFooter(p) {
    var q = state.cart[p.id] || 0;
    var action = q
      ? '<div class="stepper" role="group" aria-label="Quantité de ' + esc(p.name) + '">' +
          '<button data-act="dec" aria-label="Retirer un">−</button><span>' + q + '</span><button data-act="inc" aria-label="Ajouter un">+</button></div>'
      : '<button class="add" data-act="add">Ajouter</button>';
    var price = '<span class="price">' + Number(p.price).toLocaleString("fr-FR") + "<small>" + CURRENCY + "</small></span>";
    if (promoPercent(p)) {
      price = '<span class="price-col"><s class="old">' + esc(fmt(p.oldPrice)) + "</s>" + price + "</span>";
    }
    return price + action;
  }

  function renderSkeleton() {
    var one = '<div class="card skel"><div class="card-visual"></div><div class="card-body"><i></i><i></i><i class="short"></i></div></div>';
    $("#grid").innerHTML = new Array(8).fill(one).join("");
  }

  function renderGrid() {
    var q = state.q.trim().toLowerCase();
    var list = PRODUCTS.filter(function (p) {
      if (state.cat !== "all" && String(p.category) !== state.cat) return false;
      if (state.brand !== "all" && brandKey(p.brand) !== state.brand) return false;
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
  // Summed in whole cents, like the server, so the free-delivery threshold matches exactly.
  function cartSubtotal() {
    var cents = Object.keys(state.cart).reduce(function (n, id) { return n + state.cart[id] * Math.round(BY_ID[id].price * 100); }, 0);
    return cents / 100;
  }

  function setQty(id, q) {
    if (q <= 0) delete state.cart[id]; else state.cart[id] = Math.min(q, 99);
    save();
    refreshCard(id);
    renderCart();
  }

  function renderZoneSelect() {
    var sel = $("#f-zone");
    sel.hidden = !ZONES.length;
    if (!ZONES.length) return;
    sel.innerHTML = '<option value="">Zone de livraison…</option>' + ZONES.map(function (z) {
      var extra = z.fee === 0 ? "gratuite" : fmt(z.fee);
      return '<option value="' + z.id + '"' + (String(z.id) === state.zone ? " selected" : "") + ">" + esc(z.label) + " — " + extra + "</option>";
    }).join("");
  }

  // Totals, hint and the checkout button. The server applies the same rules to orders (item A).
  function updateSummary() {
    var subtotal = cartSubtotal();
    var zone = ZONE_BY_ID[state.zone];
    var fee = ZONES.length ? feeFor(zone, subtotal) : 0;
    var hint = "", warn = false, blocked = false;

    $("#sum-sub").textContent = fmt(subtotal);
    $("#sum-del-row").hidden = !ZONES.length;
    if (ZONES.length) $("#sum-del").textContent = zone ? (fee === 0 ? "Gratuite" : fmt(fee)) : "À choisir";
    $("#total-label").textContent = ZONES.length ? "Total" : "Total estimé";
    $("#cart-total").textContent = fmt(subtotal + (fee || 0));

    if (CFG.minOrder && subtotal < CFG.minOrder) {
      hint = "Minimum de commande : " + fmt(CFG.minOrder) + " (il manque " + fmt(CFG.minOrder - subtotal) + ").";
      warn = true; blocked = true;
    } else if (ZONES.length && !zone) {
      hint = "Choisissez votre zone de livraison pour continuer.";
      warn = true; blocked = true;
    } else if (zone && zone.freeFrom !== null && zone.freeFrom !== undefined && fee > 0) {
      hint = "Plus que " + fmt(zone.freeFrom - subtotal) + " pour la livraison gratuite.";
    }

    var h = $("#cart-hint");
    h.hidden = !hint;
    h.textContent = hint;
    h.classList.toggle("warn", warn);
    $("#checkout").disabled = blocked;
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
    updateSummary();
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

  /* ---------- checkout: save the order, then open WhatsApp ---------- */
  var sending = false;

  function showCartHint(msg, warn) {
    var h = $("#cart-hint");
    h.hidden = false;
    h.textContent = msg;
    h.classList.toggle("warn", !!warn);
  }

  function openIn(w, url) {
    if (w && !w.closed) { w.location.href = url; } else { window.location.href = url; }
  }

  function checkout() {
    var btn = $("#checkout");
    if (!cartCount() || btn.disabled || sending) return;

    // Open the tab now, during the click. Opening it after the network call would be blocked as a pop-up.
    var w = null;
    try { w = window.open("", "_blank"); } catch (e) { w = null; }
    if (w) {
      try {
        w.document.title = "WhatsApp";
        w.document.body.innerHTML = '<p style="font:16px system-ui,sans-serif;padding:24px;color:#12302d">Ouverture de WhatsApp…</p>';
        w.opener = null;
      } catch (e) { /* ignore */ }
    }

    var fallback = buildOrderMessage();
    sending = true;
    btn.classList.add("busy");

    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(orderPayload())
    })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
      })
      .then(function (res) {
        if (res.ok && res.j && res.j.number) {
          openIn(w, waLink(buildServerMessage(res.j)));
          showCartHint("Commande " + res.j.number + " préparée dans WhatsApp. Pensez à appuyer sur Envoyer.", false);
          return;
        }
        if (res.status === 400 && res.j && res.j.error) {
          // A real problem with the order (product gone, minimum, zone): tell the customer instead of sending.
          if (w && !w.closed) w.close();
          showCartHint(res.j.error, true);
          // Reload the catalogue (drops the missing products), then show the message again over the refreshed cart.
          if (res.j.unavailable) boot().then(function () { showCartHint(res.j.error, true); });
          return;
        }
        openIn(w, waLink(fallback)); // rate limit or server problem: still open WhatsApp, without a number
      })
      .catch(function () { openIn(w, waLink(fallback)); })
      .then(function () { sending = false; btn.classList.remove("busy"); });
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
      var p = pathFor(state.cat);
      if (p && p !== location.pathname) history.pushState(null, "", p);
      syncTitle();
      renderChips();
      renderGrid();
    });

    window.addEventListener("popstate", function () {
      if (!PRODUCTS.length && !CATS.length) return;
      state.cat = catFromPath();
      syncTitle();
      renderChips();
      renderGrid();
    });

    $("#brand").addEventListener("change", function (e) {
      state.brand = e.target.value;
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

    $("#f-zone").addEventListener("change", function (e) {
      state.zone = e.target.value;
      saveZone();
      updateSummary();
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

    $("#checkout").addEventListener("click", checkout);

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
    return fetch("/api/catalog", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        setup(data);
        load();
        // Drop cart lines whose product disappeared from the catalogue.
        Object.keys(state.cart).forEach(function (id) { if (!BY_ID[id]) delete state.cart[id]; });
        save();
        if (state.zone && !ZONE_BY_ID[state.zone]) state.zone = "";
        state.cat = catFromPath();
        syncTitle();
        $("#footer-hours").textContent = CFG.hours || "";
        renderChips();
        renderBrands();
        renderGrid();
        renderZoneSelect();
        renderSocial();
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
