(function () {
  "use strict";

  var ICON_LABELS = { visage: "Visage", corps: "Corps & cheveux", bebe: "Bébé & maman", complements: "Compléments", hygiene: "Hygiène", soins: "Premiers soins", bag: "Générique" };
  var ICONS = {
    visage: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    corps: '<path d="M9 3h6v3H9z"/><path d="M8 6h8l1 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9z"/><path d="M7.5 13h9"/>',
    bebe: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    complements: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.2 9.2 5.6 5.6"/>',
    hygiene: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
    soins: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'
  };
  function svg(inner, extra) {
    return '<svg viewBox="0 0 24 24" fill="' + ((extra && extra.fill) || "none") + '" stroke="currentColor" stroke-width="' + ((extra && extra.sw) || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  }
  function icon(name) { return svg(ICONS[name] || ICONS.bag); }
  var TRASH = svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', { sw: 2 });
  var EDIT = svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', { sw: 2 });
  var UP = svg('<path d="M6 14l6-6 6 6"/>', { sw: 2.4 });
  var DOWN = svg('<path d="M6 10l6 6 6-6"/>', { sw: 2.4 });
  var STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>';

  var data = { settings: {}, categories: [], products: [], zones: [] };
  var ORDER_STATUS = [
    { key: "new", label: "Nouvelle (en attente WhatsApp)", short: "Nouvelles" },
    { key: "confirmed", label: "Confirmée", short: "Confirmées" },
    { key: "delivered", label: "Livrée", short: "Livrées" },
    { key: "cancelled", label: "Annulée", short: "Annulées" }
  ];
  var orders = { list: [], page: 1, pages: 1, total: 0, counts: {} };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return Number(n).toLocaleString("fr-FR") + " MAD"; }
  function catLabel(id) {
    var c = data.categories.find(function (x) { return x.id === id; });
    return c ? c.label : "Sans catégorie";
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ---------- api ---------- */
  function api(method, path, body, raw) {
    var opts = { method: method, headers: {}, credentials: "same-origin" };
    if (raw) { opts.body = raw.blob; opts.headers["Content-Type"] = raw.type; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
    return fetch("/api/admin" + path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.status === 401 && path !== "/login" && path !== "/me") {
          showLogin("Votre session a expiré. Reconnectez-vous.");
        }
        if (!r.ok) {
          var err = new Error((j && j.error) || "Erreur " + r.status);
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  var toastTimer;
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("bad", !!bad);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  /* ---------- views ---------- */
  function showLogin(msg) {
    $("#app-view").hidden = true;
    $("#login-view").hidden = false;
    $("#login-error").textContent = msg || "";
    $("#password").value = "";
    $("#password").focus();
  }
  function showApp() {
    $("#login-view").hidden = true;
    $("#app-view").hidden = false;
  }

  function reload() {
    return api("GET", "/data").then(function (d) {
      data = d;
      renderAll();
    });
  }

  function renderAll() {
    renderFilter();
    renderProducts();
    renderCategories();
    renderDelivery();
    renderSettings();
    renderBrandList();
  }

  /* ---------- orders ---------- */
  function when(ts) {
    try {
      return new Date(ts).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return new Date(ts).toLocaleString("fr-FR"); }
  }

  function renderOrderFilter() {
    var sel = $("#o-status"), cur = sel.value || "";
    var c = orders.counts || {};
    var all = ORDER_STATUS.reduce(function (n, s) { return n + (c[s.key] || 0); }, 0);
    sel.innerHTML = '<option value="">Toutes (' + all + ")</option>" + ORDER_STATUS.map(function (s) {
      return '<option value="' + s.key + '">' + s.short + " (" + (c[s.key] || 0) + ")</option>";
    }).join("");
    sel.value = cur;
    var badge = $("#o-badge");
    badge.hidden = !c.new;
    badge.textContent = c.new || "";
  }

  function orderHtml(o) {
    var st = ORDER_STATUS.map(function (s) {
      return '<option value="' + s.key + '"' + (s.key === o.status ? " selected" : "") + ">" + s.label + "</option>";
    }).join("");
    var lines = o.items.map(function (i) {
      return "<li><span>" + i.qty + " × " + esc(i.name) + " <small>(" + money(i.unit_price) + ")</small></span><b>" + money(i.unit_price * i.qty) + "</b></li>";
    }).join("");
    var who = [o.customer_name || "Sans nom", o.zone_label, o.city].filter(Boolean).map(esc).join(" · ");
    return '<div class="order st-' + o.status + '" data-id="' + o.id + '">' +
      '<button class="order-head" aria-expanded="false">' +
        '<span class="o-num">' + o.number + "<small>" + when(o.created_at) + "</small></span>" +
        '<span class="o-who">' + who + "</span>" +
        '<span class="o-total">' + money(o.total) + "</span>" +
      "</button>" +
      '<select class="o-st" aria-label="Statut de la commande ' + o.number + '">' + st + "</select>" +
      '<div class="order-body" hidden>' +
        "<ul>" + lines + "</ul>" +
        '<div class="o-sum"><span>Sous-total</span><b>' + money(o.subtotal) + "</b></div>" +
        (o.zone_label ? '<div class="o-sum"><span>Livraison (' + esc(o.zone_label) + ")</span><b>" + (o.delivery_fee ? money(o.delivery_fee) : "Gratuite") + "</b></div>" : "") +
        '<div class="o-sum total"><span>Total</span><b>' + money(o.total) + "</b></div>" +
        (o.note ? '<p class="o-notes"><b>Précisions :</b> ' + esc(o.note) + "</p>" : "") +
      "</div></div>";
  }

  function renderOrders() {
    renderOrderFilter();
    $("#o-count").textContent = plural(orders.total, "commande", "commandes");
    $("#o-list").innerHTML = orders.list.length
      ? orders.list.map(orderHtml).join("")
      : '<div class="empty-list">' + ($("#o-search").value || $("#o-status").value ? "Aucune commande ne correspond." : "Aucune commande pour l'instant. Elles apparaissent ici dès qu'un client clique sur « Commander sur WhatsApp ».") + "</div>";
    $("#o-more").hidden = orders.page >= orders.pages;
  }

  function loadOrders(more) {
    var page = more ? orders.page + 1 : 1;
    var qs = "?page=" + page + "&status=" + encodeURIComponent($("#o-status").value) + "&q=" + encodeURIComponent($("#o-search").value.trim());
    return api("GET", "/orders" + qs).then(function (r) {
      orders.list = more ? orders.list.concat(r.orders) : r.orders;
      orders.page = r.page; orders.pages = r.pages; orders.total = r.total; orders.counts = r.counts;
      renderOrders();
    }).catch(function (err) { toast(err.message, true); });
  }

  /* ---------- products ---------- */
  function renderFilter() {
    var sel = $("#p-filter"), cur = sel.value || "all";
    sel.innerHTML = '<option value="all">Toutes les catégories</option>' +
      data.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("") +
      '<option value="none">Sans catégorie</option>';
    sel.value = Array.prototype.some.call(sel.options, function (o) { return o.value === cur; }) ? cur : "all";
  }

  function renderBrandList() {
    var seen = {}, out = [];
    data.products.forEach(function (p) {
      var b = (p.brand || "").trim().replace(/\s+/g, " ");
      if (b && !seen[b.toLowerCase()]) { seen[b.toLowerCase()] = 1; out.push(b); }
    });
    out.sort(function (a, b) { return a.localeCompare(b, "fr"); });
    $("#brand-list").innerHTML = out.map(function (b) { return '<option value="' + esc(b) + '"></option>'; }).join("");
  }

  function filtersActive() {
    return $("#p-search").value.trim() !== "" || $("#p-filter").value !== "all";
  }

  // A product can only move within its own group (featured or not): featured ones always show first.
  function canMove(p, dir) {
    var i = data.products.indexOf(p), n = data.products[i + dir];
    return !!n && n.featured === p.featured;
  }

  function renderProducts() {
    var q = $("#p-search").value.trim().toLowerCase(), f = $("#p-filter").value;
    var list = data.products.filter(function (p) {
      if (f === "none" && p.category_id !== null) return false;
      if (f !== "all" && f !== "none" && String(p.category_id) !== f) return false;
      return !q || (p.name + " " + p.brand).toLowerCase().indexOf(q) !== -1;
    });
    $("#p-count").textContent = plural(data.products.length, "produit", "produits") +
      (list.length !== data.products.length ? " · " + list.length + " affiché" + (list.length > 1 ? "s" : "") : "");
    var locked = filtersActive();
    $("#p-hint").hidden = !locked || !data.products.length;

    if (!list.length) {
      $("#p-list").innerHTML = '<div class="empty-list">' + (data.products.length ? "Aucun produit ne correspond." : "Aucun produit pour l'instant. Cliquez sur « Nouveau produit » pour ajouter le premier.") + "</div>";
      return;
    }
    $("#p-list").innerHTML = list.map(function (p) {
      var c = data.categories.find(function (x) { return x.id === p.category_id; });
      var tags = "";
      if (p.featured) tags += '<span class="tag tag-star">À la une</span>';
      if (p.is_new) tags += '<span class="tag">Nouveau</span>';
      if (p.old_price) tags += '<span class="tag tag-promo">Promo</span>';
      var upOk = !locked && canMove(p, -1), downOk = !locked && canMove(p, 1);
      var price = p.old_price ? '<s class="old">' + money(p.old_price) + "</s> " + money(p.price) : money(p.price);
      return '<div class="row' + (p.visible ? "" : " off") + '" data-id="' + p.id + '">' +
        '<div class="thumb">' + (p.image_key ? '<img src="/img/' + esc(p.image_key) + '" alt="">' : icon(c ? c.icon : "bag")) + "</div>" +
        '<div class="row-info"><b>' + esc(p.name) + "</b><small>" + esc(p.brand ? p.brand + " · " : "") + esc(catLabel(p.category_id)) + (p.visible ? "" : " · caché") + "</small>" + (tags ? '<div class="tags">' + tags + "</div>" : "") + "</div>" +
        '<div class="row-price">' + price + "</div>" +
        '<div class="row-actions">' +
          '<span class="mover"><button class="icon-btn sm" data-act="up" aria-label="Monter ' + esc(p.name) + '"' + (upOk ? "" : " disabled") + ">" + UP + "</button>" +
          '<button class="icon-btn sm" data-act="down" aria-label="Descendre ' + esc(p.name) + '"' + (downOk ? "" : " disabled") + ">" + DOWN + "</button></span>" +
          '<button class="icon-btn star' + (p.featured ? " on" : "") + '" data-act="star" aria-pressed="' + p.featured + '" aria-label="Mettre à la une : ' + esc(p.name) + '">' + svg(STAR, { fill: p.featured ? "currentColor" : "none" }) + "</button>" +
          '<label class="switch" title="Visible sur le site"><input type="checkbox" data-act="toggle"' + (p.visible ? " checked" : "") + ' aria-label="Visible sur le site"><i></i></label>' +
          '<button class="icon-btn" data-act="edit" aria-label="Modifier ' + esc(p.name) + '">' + EDIT + "</button>" +
          '<button class="icon-btn danger" data-act="delete" aria-label="Supprimer ' + esc(p.name) + '">' + TRASH + "</button>" +
        "</div></div>";
    }).join("");
  }

  function productById(id) {
    return data.products.find(function (p) { return p.id === Number(id); });
  }
  // Every field the API expects (image_key omitted on purpose: the photo is kept).
  function productBody(p, over) {
    return Object.assign({
      name: p.name, brand: p.brand, category_id: p.category_id, price: p.price, old_price: p.old_price,
      description: p.description, visible: p.visible, is_new: p.is_new, featured: p.featured
    }, over || {});
  }

  function moveProduct(p, dir) {
    var ids = data.products.map(function (x) { return x.id; });
    var i = ids.indexOf(p.id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    guard(api("PUT", "/products/order", { ids: ids }));
  }

  /* ---------- product dialog ---------- */
  var dlg = { editing: null, blob: null, previewUrl: null, removed: false };

  function resizeImage(file) {
    return createImageBitmap(file).then(function (bmp) {
      var max = 900, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      return new Promise(function (res, rej) {
        c.toBlob(function (b) { b ? res(b) : rej(new Error("Impossible de traiter cette image")); }, "image/jpeg", 0.85);
      });
    });
  }

  function renderPhotoPreview() {
    var box = $("#p-photo-preview"), has = false;
    if (dlg.blob) { box.innerHTML = '<img src="' + dlg.previewUrl + '" alt="">'; has = true; }
    else if (dlg.editing && dlg.editing.image_key && !dlg.removed) { box.innerHTML = '<img src="/img/' + esc(dlg.editing.image_key) + '" alt="">'; has = true; }
    else box.innerHTML = icon("bag");
    $("#p-photo-remove").hidden = !has;
  }

  function openProduct(p) {
    if (dlg.previewUrl) URL.revokeObjectURL(dlg.previewUrl);
    dlg = { editing: p || null, blob: null, previewUrl: null, removed: false };
    $("#p-dialog-title").textContent = p ? "Modifier le produit" : "Nouveau produit";
    $("#p-category").innerHTML = '<option value="">Sans catégorie</option>' +
      data.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("");
    $("#p-name").value = p ? p.name : "";
    $("#p-brand").value = p ? p.brand : "";
    $("#p-price").value = p ? p.price : "";
    $("#p-old").value = p && p.old_price ? p.old_price : "";
    $("#p-desc").value = p ? p.description : "";
    $("#p-category").value = p && p.category_id !== null ? String(p.category_id) : "";
    $("#p-visible").checked = p ? p.visible : true;
    $("#p-new-badge").checked = p ? p.is_new : false;
    $("#p-featured").checked = p ? p.featured : false;
    $("#p-photo").value = "";
    $("#p-error").textContent = "";
    renderPhotoPreview();
    $("#p-dialog").showModal();
    $("#p-name").focus();
  }

  function closeProduct() { $("#p-dialog").close(); }

  function saveProduct(e) {
    e.preventDefault();
    var btn = $("#p-save");
    btn.disabled = true;
    $("#p-error").textContent = "";

    var body = {
      name: $("#p-name").value,
      brand: $("#p-brand").value,
      price: $("#p-price").value,
      old_price: $("#p-old").value === "" ? null : $("#p-old").value,
      category_id: $("#p-category").value === "" ? null : Number($("#p-category").value),
      description: $("#p-desc").value,
      visible: $("#p-visible").checked,
      is_new: $("#p-new-badge").checked,
      featured: $("#p-featured").checked
    };

    var step = Promise.resolve();
    if (dlg.blob) {
      step = api("POST", "/upload", undefined, { blob: dlg.blob, type: "image/jpeg" }).then(function (r) { body.image_key = r.key; });
    } else if (dlg.removed) {
      body.image_key = null;
    } else if (!dlg.editing) {
      body.image_key = null;
    }

    step.then(function () {
      return dlg.editing ? api("PUT", "/products/" + dlg.editing.id, body) : api("POST", "/products", body);
    }).then(function () {
      var wasNew = !dlg.editing;
      closeProduct();
      toast(wasNew ? "Produit ajouté" : "Produit enregistré");
      return reload();
    }).catch(function (err) {
      $("#p-error").textContent = err.message;
    }).then(function () { btn.disabled = false; });
  }

  /* ---------- categories ---------- */
  function iconOptions(selected) {
    return Object.keys(ICON_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? " selected" : "") + ">" + ICON_LABELS[k] + "</option>";
    }).join("");
  }

  function renderCategories() {
    $("#c-new-icon").innerHTML = iconOptions("bag");
    if (!data.categories.length) {
      $("#c-list").innerHTML = '<div class="empty-list">Aucune catégorie.</div>';
      return;
    }
    $("#c-list").innerHTML = data.categories.map(function (c) {
      var n = data.products.filter(function (p) { return p.category_id === c.id; }).length;
      return '<div class="cat-row" data-id="' + c.id + '">' +
        '<input type="text" value="' + esc(c.label) + '" maxlength="40" aria-label="Nom de la catégorie" data-f="label">' +
        '<select aria-label="Icône" data-f="icon">' + iconOptions(c.icon) + "</select>" +
        '<div class="row-actions"><small class="muted">' + plural(n, "produit", "produits") + "</small>" +
          '<button class="btn btn-ghost sm" data-act="save-cat">Enregistrer</button>' +
          '<button class="icon-btn danger" data-act="delete-cat" aria-label="Supprimer ' + esc(c.label) + '">' + TRASH + "</button></div>" +
        '<div class="cat-extra">' +
          '<label class="slug-field" title="Adresse de la page de cette catégorie"><span>quickpara.ma/c/</span><input type="text" value="' + esc(c.slug || "") + '" maxlength="60" placeholder="automatique" aria-label="Adresse de la catégorie" data-f="slug"></label>' +
          '<input type="text" value="' + esc(c.description || "") + '" maxlength="160" placeholder="Description pour Google (160 caractères max, facultatif)" aria-label="Description pour Google" data-f="desc">' +
        "</div></div>";
    }).join("");
  }

  /* ---------- delivery ---------- */
  function renderDelivery() {
    $("#min-order").value = data.settings.minOrder || "";
    if (!data.zones.length) {
      $("#z-list").innerHTML = '<div class="empty-list">Aucune zone : le panier n\'affiche pas de frais de livraison.</div>';
      return;
    }
    $("#z-list").innerHTML = data.zones.map(function (z, i) {
      return '<div class="zone-row" data-id="' + z.id + '">' +
        '<input type="text" value="' + esc(z.label) + '" maxlength="60" aria-label="Nom de la zone" data-f="label">' +
        '<input type="number" value="' + esc(z.fee) + '" min="0" step="0.5" inputmode="decimal" aria-label="Tarif en MAD" data-f="fee">' +
        '<input type="number" value="' + (z.free_from === null ? "" : esc(z.free_from)) + '" min="0" step="1" inputmode="numeric" placeholder="Gratuit dès…" aria-label="Livraison gratuite à partir de" data-f="free">' +
        '<div class="row-actions">' +
          '<span class="mover"><button class="icon-btn sm" data-act="z-up" aria-label="Monter ' + esc(z.label) + '"' + (i === 0 ? " disabled" : "") + ">" + UP + "</button>" +
          '<button class="icon-btn sm" data-act="z-down" aria-label="Descendre ' + esc(z.label) + '"' + (i === data.zones.length - 1 ? " disabled" : "") + ">" + DOWN + "</button></span>" +
          '<button class="btn btn-ghost sm" data-act="z-save">Enregistrer</button>' +
          '<button class="icon-btn danger" data-act="z-delete" aria-label="Supprimer ' + esc(z.label) + '">' + TRASH + "</button></div></div>";
    }).join("");
  }

  function moveZone(id, dir) {
    var ids = data.zones.map(function (z) { return z.id; });
    var i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    guard(api("PUT", "/zones/order", { ids: ids }));
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    var s = data.settings;
    $("#s-whatsapp").value = s.whatsapp || "";
    $("#s-name").value = s.storeName || "";
    $("#s-hours").value = s.hours || "";
    $("#s-instagram").value = s.instagram || "";
    $("#s-facebook").value = s.facebook || "";
    $("#s-maps").value = s.maps || "";
    $("#s-business").value = s.googleBusiness || "";
  }

  // The settings endpoint replaces every field, so we always send the full set.
  function saveSettings(over) {
    return api("PUT", "/settings", Object.assign({}, data.settings, over));
  }

  /* ---------- wiring ---------- */
  function guard(promise, okMsg) {
    return promise.then(function () {
      if (okMsg) toast(okMsg);
      return reload();
    }).catch(function (err) { toast(err.message, true); });
  }

  function init() {
    $("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("#login-btn");
      btn.disabled = true;
      $("#login-error").textContent = "";
      api("POST", "/login", { password: $("#password").value })
        .then(function () { return reload(); })
        .then(showApp)
        .then(function () { return loadOrders(false); })
        .catch(function (err) { $("#login-error").textContent = err.message; })
        .then(function () { btn.disabled = false; });
    });

    $("#logout").addEventListener("click", function () {
      api("POST", "/logout").catch(function () {}).then(function () { showLogin(); });
    });

    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-selected", String(x === t)); });
        ["orders", "products", "categories", "delivery", "settings"].forEach(function (n) { $("#tab-" + n).hidden = n !== t.getAttribute("data-tab"); });
        if (t.getAttribute("data-tab") === "orders") loadOrders(false);
      });
    });

    // orders
    var searchTimer;
    $("#o-search").addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { loadOrders(false); }, 300);
    });
    $("#o-status").addEventListener("change", function () { loadOrders(false); });
    $("#o-more").addEventListener("click", function () { loadOrders(true); });
    $("#o-list").addEventListener("click", function (e) {
      var head = e.target.closest(".order-head");
      if (!head) return;
      var body = head.parentNode.querySelector(".order-body");
      body.hidden = !body.hidden;
      head.setAttribute("aria-expanded", String(!body.hidden));
    });
    $("#o-list").addEventListener("change", function (e) {
      if (!e.target.classList.contains("o-st")) return;
      var row = e.target.closest(".order"), id = row.getAttribute("data-id"), status = e.target.value;
      api("PUT", "/orders/" + id, { status: status })
        .then(function () {
          var label = ORDER_STATUS.filter(function (s) { return s.key === status; })[0].label;
          toast("Statut : " + label);
          row.className = "order st-" + status;
          return loadOrders(false);
        })
        .catch(function (err) { toast(err.message, true); loadOrders(false); });
    });

    // products
    $("#p-search").addEventListener("input", renderProducts);
    $("#p-filter").addEventListener("change", renderProducts);
    $("#p-new").addEventListener("click", function () { openProduct(null); });
    $("#p-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || b.getAttribute("data-act") === "toggle" || b.disabled) return;
      var p = productById(b.closest(".row").getAttribute("data-id"));
      if (!p) return;
      var act = b.getAttribute("data-act");
      if (act === "edit") openProduct(p);
      if (act === "delete" && confirm("Supprimer « " + p.name + " » ? Cette action est définitive.")) {
        guard(api("DELETE", "/products/" + p.id), "Produit supprimé");
      }
      if (act === "up") moveProduct(p, -1);
      if (act === "down") moveProduct(p, 1);
      if (act === "star") guard(api("PUT", "/products/" + p.id, productBody(p, { featured: !p.featured })), p.featured ? "Retiré de la une" : "Mis à la une");
    });
    $("#p-list").addEventListener("change", function (e) {
      if (e.target.getAttribute("data-act") !== "toggle") return;
      var p = productById(e.target.closest(".row").getAttribute("data-id"));
      if (p) guard(api("PUT", "/products/" + p.id, productBody(p, { visible: e.target.checked })), e.target.checked ? "Produit visible" : "Produit caché");
    });

    // product dialog
    $("#p-form").addEventListener("submit", saveProduct);
    $("#p-cancel").addEventListener("click", closeProduct);
    $("#p-cancel-x").addEventListener("click", closeProduct);
    $("#p-photo").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      $("#p-error").textContent = "";
      resizeImage(f).then(function (blob) {
        if (dlg.previewUrl) URL.revokeObjectURL(dlg.previewUrl);
        dlg.blob = blob;
        dlg.previewUrl = URL.createObjectURL(blob);
        dlg.removed = false;
        renderPhotoPreview();
      }).catch(function (err) { $("#p-error").textContent = err.message; });
    });
    $("#p-photo-remove").addEventListener("click", function () {
      dlg.blob = null;
      dlg.removed = true;
      $("#p-photo").value = "";
      renderPhotoPreview();
    });

    // categories
    $("#c-new-form").addEventListener("submit", function (e) {
      e.preventDefault();
      guard(api("POST", "/categories", { label: $("#c-new-label").value, icon: $("#c-new-icon").value }), "Catégorie ajoutée")
        .then(function () { $("#c-new-label").value = ""; });
    });
    $("#c-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var row = b.closest(".cat-row"), id = row.getAttribute("data-id");
      if (b.getAttribute("data-act") === "save-cat") {
        guard(api("PUT", "/categories/" + id, {
          label: row.querySelector('[data-f="label"]').value,
          icon: row.querySelector('[data-f="icon"]').value,
          slug: row.querySelector('[data-f="slug"]').value,
          description: row.querySelector('[data-f="desc"]').value
        }), "Catégorie enregistrée");
      }
      if (b.getAttribute("data-act") === "delete-cat") {
        var c = data.categories.find(function (x) { return x.id === Number(id); });
        var n = data.products.filter(function (p) { return p.category_id === c.id; }).length;
        var msg = "Supprimer la catégorie « " + c.label + " » ?" + (n ? " Ses " + n + " produit(s) n'auront plus de catégorie." : "");
        if (confirm(msg)) guard(api("DELETE", "/categories/" + id), "Catégorie supprimée");
      }
    });

    // delivery
    $("#min-form").addEventListener("submit", function (e) {
      e.preventDefault();
      $("#min-error").textContent = "";
      var v = $("#min-order").value;
      saveSettings({ minOrder: v === "" ? null : v })
        .then(function () { toast("Commande minimum enregistrée"); return reload(); })
        .catch(function (err) { $("#min-error").textContent = err.message; });
    });
    $("#z-new-form").addEventListener("submit", function (e) {
      e.preventDefault();
      $("#z-error").textContent = "";
      var free = $("#z-new-free").value;
      api("POST", "/zones", { label: $("#z-new-label").value, fee: $("#z-new-fee").value, free_from: free === "" ? null : free })
        .then(function () {
          $("#z-new-label").value = ""; $("#z-new-fee").value = ""; $("#z-new-free").value = "";
          toast("Zone ajoutée");
          return reload();
        })
        .catch(function (err) { $("#z-error").textContent = err.message; });
    });
    $("#z-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || b.disabled) return;
      var row = b.closest(".zone-row"), id = Number(row.getAttribute("data-id"));
      var act = b.getAttribute("data-act");
      if (act === "z-up") moveZone(id, -1);
      if (act === "z-down") moveZone(id, 1);
      if (act === "z-save") {
        var free = row.querySelector('[data-f="free"]').value;
        guard(api("PUT", "/zones/" + id, {
          label: row.querySelector('[data-f="label"]').value,
          fee: row.querySelector('[data-f="fee"]').value,
          free_from: free === "" ? null : free
        }), "Zone enregistrée");
      }
      if (act === "z-delete") {
        var z = data.zones.find(function (x) { return x.id === id; });
        if (confirm("Supprimer la zone « " + z.label + " » ?")) guard(api("DELETE", "/zones/" + id), "Zone supprimée");
      }
    });

    // settings
    $("#s-form").addEventListener("submit", function (e) {
      e.preventDefault();
      $("#s-error").textContent = "";
      saveSettings({
        whatsapp: $("#s-whatsapp").value, storeName: $("#s-name").value, hours: $("#s-hours").value,
        instagram: $("#s-instagram").value, facebook: $("#s-facebook").value, maps: $("#s-maps").value, googleBusiness: $("#s-business").value
      })
        .then(function () { toast("Réglages enregistrés"); return reload(); })
        .catch(function (err) { $("#s-error").textContent = err.message; });
    });

    // start
    api("GET", "/me")
      .then(function () { return reload(); })
      .then(showApp)
      .then(function () { return loadOrders(false); })
      .catch(function (err) { showLogin(err.status === 401 ? "" : err.message); });
  }

  init();
})();
