(function () {
  "use strict";

  var ICON_LABELS = { visage: "Face", corps: "Body & hair", bebe: "Baby & mom", complements: "Supplements", hygiene: "Hygiene", soins: "First aid", bag: "Generic" };
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
  var TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  var EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';

  var data = { settings: {}, categories: [], products: [] };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return Number(n).toLocaleString("fr-FR") + " MAD"; }
  function catLabel(id) {
    var c = data.categories.find(function (x) { return x.id === id; });
    return c ? c.label : "Uncategorised";
  }

  /* ---------- api ---------- */
  function api(method, path, body, raw) {
    var opts = { method: method, headers: {}, credentials: "same-origin" };
    if (raw) { opts.body = raw.blob; opts.headers["Content-Type"] = raw.type; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
    return fetch("/api/admin" + path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.status === 401 && path !== "/login" && path !== "/me") {
          showLogin("Your session expired. Please sign in again.");
        }
        if (!r.ok) {
          var err = new Error((j && j.error) || "Error " + r.status);
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
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
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
    renderSettings();
  }

  /* ---------- products ---------- */
  function renderFilter() {
    var sel = $("#p-filter"), cur = sel.value || "all";
    sel.innerHTML = '<option value="all">All categories</option>' +
      data.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("") +
      '<option value="none">Uncategorised</option>';
    sel.value = Array.prototype.some.call(sel.options, function (o) { return o.value === cur; }) ? cur : "all";
  }

  function renderProducts() {
    var q = $("#p-search").value.trim().toLowerCase(), f = $("#p-filter").value;
    var list = data.products.filter(function (p) {
      if (f === "none" && p.category_id !== null) return false;
      if (f !== "all" && f !== "none" && String(p.category_id) !== f) return false;
      return !q || (p.name + " " + p.brand).toLowerCase().indexOf(q) !== -1;
    });
    $("#p-count").textContent = data.products.length + " product" + (data.products.length === 1 ? "" : "s") +
      (list.length !== data.products.length ? " · " + list.length + " shown" : "");

    if (!list.length) {
      $("#p-list").innerHTML = '<div class="empty-list">' + (data.products.length ? "No product matches." : "No products yet. Click “New product” to add your first one.") + "</div>";
      return;
    }
    $("#p-list").innerHTML = list.map(function (p) {
      var c = data.categories.find(function (x) { return x.id === p.category_id; });
      return '<div class="row' + (p.visible ? "" : " off") + '" data-id="' + p.id + '">' +
        '<div class="thumb">' + (p.image_key ? '<img src="/img/' + esc(p.image_key) + '" alt="">' : icon(c ? c.icon : "bag")) + "</div>" +
        '<div class="row-info"><b>' + esc(p.name) + "</b><small>" + esc(p.brand ? p.brand + " · " : "") + esc(catLabel(p.category_id)) + (p.visible ? "" : " · hidden") + "</small></div>" +
        '<div class="row-price">' + money(p.price) + "</div>" +
        '<div class="row-actions">' +
          '<label class="switch" title="Visible on the website"><input type="checkbox" data-act="toggle"' + (p.visible ? " checked" : "") + ' aria-label="Visible on the website"><i></i></label>' +
          '<button class="icon-btn" data-act="edit" aria-label="Edit ' + esc(p.name) + '">' + EDIT + "</button>" +
          '<button class="icon-btn danger" data-act="delete" aria-label="Delete ' + esc(p.name) + '">' + TRASH + "</button>" +
        "</div></div>";
    }).join("");
  }

  function productById(id) {
    return data.products.find(function (p) { return p.id === Number(id); });
  }
  function productBody(p, visible) {
    return { name: p.name, brand: p.brand, category_id: p.category_id, price: p.price, description: p.description, visible: visible };
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
        c.toBlob(function (b) { b ? res(b) : rej(new Error("Could not process this image")); }, "image/jpeg", 0.85);
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
    $("#p-dialog-title").textContent = p ? "Edit product" : "New product";
    $("#p-category").innerHTML = '<option value="">Uncategorised</option>' +
      data.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("");
    $("#p-name").value = p ? p.name : "";
    $("#p-brand").value = p ? p.brand : "";
    $("#p-price").value = p ? p.price : "";
    $("#p-desc").value = p ? p.description : "";
    $("#p-category").value = p && p.category_id !== null ? String(p.category_id) : "";
    $("#p-visible").checked = p ? p.visible : true;
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
      category_id: $("#p-category").value === "" ? null : Number($("#p-category").value),
      description: $("#p-desc").value,
      visible: $("#p-visible").checked
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
      toast(wasNew ? "Product added" : "Product saved");
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
      $("#c-list").innerHTML = '<div class="empty-list">No categories yet.</div>';
      return;
    }
    $("#c-list").innerHTML = data.categories.map(function (c) {
      var n = data.products.filter(function (p) { return p.category_id === c.id; }).length;
      return '<div class="cat-row" data-id="' + c.id + '">' +
        '<input type="text" value="' + esc(c.label) + '" maxlength="40" aria-label="Category name">' +
        '<select aria-label="Icon">' + iconOptions(c.icon) + "</select>" +
        '<div class="row-actions"><small class="muted">' + n + " product" + (n === 1 ? "" : "s") + "</small>" +
          '<button class="btn btn-ghost sm" data-act="save-cat">Save</button>' +
          '<button class="icon-btn danger" data-act="delete-cat" aria-label="Delete ' + esc(c.label) + '">' + TRASH + "</button></div></div>";
    }).join("");
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    $("#s-whatsapp").value = data.settings.whatsapp || "";
    $("#s-name").value = data.settings.storeName || "";
    $("#s-hours").value = data.settings.hours || "";
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
        .catch(function (err) { $("#login-error").textContent = err.message; })
        .then(function () { btn.disabled = false; });
    });

    $("#logout").addEventListener("click", function () {
      api("POST", "/logout").catch(function () {}).then(function () { showLogin(); });
    });

    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-selected", String(x === t)); });
        ["products", "categories", "settings"].forEach(function (n) { $("#tab-" + n).hidden = n !== t.getAttribute("data-tab"); });
      });
    });

    // products
    $("#p-search").addEventListener("input", renderProducts);
    $("#p-filter").addEventListener("change", renderProducts);
    $("#p-new").addEventListener("click", function () { openProduct(null); });
    $("#p-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || b.getAttribute("data-act") === "toggle") return;
      var p = productById(b.closest(".row").getAttribute("data-id"));
      if (!p) return;
      if (b.getAttribute("data-act") === "edit") openProduct(p);
      if (b.getAttribute("data-act") === "delete" && confirm("Delete “" + p.name + "”? This cannot be undone.")) {
        guard(api("DELETE", "/products/" + p.id), "Product deleted");
      }
    });
    $("#p-list").addEventListener("change", function (e) {
      if (e.target.getAttribute("data-act") !== "toggle") return;
      var p = productById(e.target.closest(".row").getAttribute("data-id"));
      if (p) guard(api("PUT", "/products/" + p.id, productBody(p, e.target.checked)), e.target.checked ? "Now visible" : "Now hidden");
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
      guard(api("POST", "/categories", { label: $("#c-new-label").value, icon: $("#c-new-icon").value }), "Category added")
        .then(function () { $("#c-new-label").value = ""; });
    });
    $("#c-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var row = b.closest(".cat-row"), id = row.getAttribute("data-id");
      if (b.getAttribute("data-act") === "save-cat") {
        guard(api("PUT", "/categories/" + id, { label: row.querySelector("input").value, icon: row.querySelector("select").value }), "Category saved");
      }
      if (b.getAttribute("data-act") === "delete-cat") {
        var c = data.categories.find(function (x) { return x.id === Number(id); });
        var n = data.products.filter(function (p) { return p.category_id === c.id; }).length;
        var msg = "Delete category “" + c.label + "”?" + (n ? " Its " + n + " product(s) will become uncategorised." : "");
        if (confirm(msg)) guard(api("DELETE", "/categories/" + id), "Category deleted");
      }
    });

    // settings
    $("#s-form").addEventListener("submit", function (e) {
      e.preventDefault();
      $("#s-error").textContent = "";
      api("PUT", "/settings", { whatsapp: $("#s-whatsapp").value, storeName: $("#s-name").value, hours: $("#s-hours").value })
        .then(function () { toast("Settings saved"); return reload(); })
        .catch(function (err) { $("#s-error").textContent = err.message; });
    });

    // start
    api("GET", "/me")
      .then(function () { return reload(); })
      .then(showApp)
      .catch(function (err) { showLogin(err.status === 401 ? "" : err.message); });
  }

  init();
})();
