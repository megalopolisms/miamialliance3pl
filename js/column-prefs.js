/**
 * Column Preferences Manager for Miami Alliance 3PL
 * ──────────────────────────────────────────────────
 * Enables drag-and-drop column reordering with localStorage persistence.
 * Integrates a gear-icon settings panel with reorder + visibility toggles.
 * Admin-only column rename feature (double-click or pencil icon).
 * Auto-applies column order to dynamically rendered rows (MutationObserver).
 *
 * Usage:
 *   new ColumnPrefs({ table: '.data-table', tableId: 'shipments' });
 *
 * Options:
 *   table            - CSS selector string or DOM element
 *   tableId          - unique key for persistence (per-table)
 *   saveToCloud      - async (prefs) => {} optional Firestore save
 *   loadFromCloud    - async () => prefs  optional Firestore load
 *   canRename        - boolean, if true show rename UI (admin only)
 *   loadGlobalLabels - async () => { "0": "Name", ... } load global column labels
 *   saveGlobalLabels - async (labels) => {} save global column labels
 */
(function () {
  "use strict";

  var STORAGE_PREFIX = "m3pl_cols_";

  // ── Inject Styles ────────────────────────────────────────────────────
  var css = document.createElement("style");
  css.textContent = [
    ".col-prefs-container{position:relative;display:flex;justify-content:flex-end;margin-bottom:8px}",
    ".col-prefs-btn{background:var(--color-gray-100,#f1f5f9);border:1px solid var(--color-gray-300,#cbd5e1);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:.813rem;font-weight:500;color:var(--color-gray-600,#475569);display:inline-flex;align-items:center;gap:4px;transition:all .15s;font-family:inherit}",
    ".col-prefs-btn:hover{background:var(--color-gray-200,#e2e8f0);color:var(--color-gray-800,#1e293b)}",
    ".col-prefs-panel{position:absolute;right:0;top:calc(100% + 4px);z-index:1000;background:#fff;border:1px solid var(--color-gray-200,#e2e8f0);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.12),0 4px 8px rgba(0,0,0,.06);padding:16px;min-width:270px;max-height:420px;overflow-y:auto}",
    ".col-prefs-panel-title{font-weight:600;font-size:.875rem;margin-bottom:4px;color:var(--color-gray-900,#0f172a);display:flex;justify-content:space-between;align-items:center}",
    ".col-prefs-panel-hint{font-size:.75rem;color:var(--color-gray-500,#64748b);margin-bottom:12px}",
    ".col-prefs-reset{background:none;border:1px solid var(--color-gray-300,#cbd5e1);border-radius:4px;padding:2px 10px;cursor:pointer;font-size:.75rem;color:var(--color-gray-500,#64748b);font-family:inherit;transition:all .15s}",
    ".col-prefs-reset:hover{background:var(--color-gray-100,#f1f5f9);color:var(--color-gray-700,#334155)}",
    ".col-prefs-item{display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:4px;background:var(--color-gray-50,#f8fafc);border:1px solid var(--color-gray-200,#e2e8f0);border-radius:6px;cursor:grab;font-size:.85rem;transition:all .15s;user-select:none;-webkit-user-select:none}",
    ".col-prefs-item:hover{background:#fff;border-color:var(--color-gray-300,#cbd5e1);box-shadow:0 1px 3px rgba(0,0,0,.06)}",
    ".col-prefs-item:active{cursor:grabbing}",
    ".col-prefs-item.drag-over{border-color:var(--color-accent,#10b981);background:#ecfdf5}",
    ".col-prefs-item .handle{color:var(--color-gray-400,#94a3b8);font-size:.875rem;line-height:1;flex-shrink:0}",
    ".col-prefs-item .col-label{flex:1;color:var(--color-gray-700,#334155)}",
    ".col-prefs-item .col-toggle{cursor:pointer;width:16px;height:16px;accent-color:var(--color-accent,#10b981);flex-shrink:0}",
    ".col-prefs-item .col-arrows{display:flex;flex-direction:column;gap:0;flex-shrink:0}",
    ".col-prefs-item .col-arrow{background:none;border:none;cursor:pointer;padding:0 2px;font-size:.65rem;line-height:1;color:var(--color-gray-400,#94a3b8);transition:color .1s}",
    ".col-prefs-item .col-arrow:hover{color:var(--color-gray-700,#334155)}",
    'th[draggable="true"]{cursor:grab;user-select:none;-webkit-user-select:none;transition:opacity .15s}',
    'th[draggable="true"]:active{cursor:grabbing}',
    "th.col-drag-over{box-shadow:inset -3px 0 0 var(--color-accent,#10b981)}",
    "th.col-dragging{opacity:.4}",
    // Rename feature styles
    ".col-rename-btn{background:none;border:none;cursor:pointer;padding:2px 4px;font-size:1rem;line-height:1;opacity:.85;transition:all .15s;flex-shrink:0;border-radius:3px}",
    ".col-rename-btn:hover{opacity:1;background:rgba(16,185,129,.1)}",
    ".col-label-input{flex:1;border:1px solid var(--color-accent,#10b981);border-radius:4px;padding:2px 6px;font-size:.85rem;font-family:inherit;outline:none;background:#fff;color:var(--color-gray-700,#334155);min-width:0}",
    ".col-label-input:focus{box-shadow:0 0 0 2px rgba(16,185,129,.2)}",
    ".col-label.renamed{font-style:italic;color:var(--color-accent,#10b981)}",
    // Standalone rename button (visible next to Columns gear)
    ".col-rename-standalone{background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:.813rem;font-weight:600;color:#fff;display:inline-flex;align-items:center;gap:5px;transition:all .15s;font-family:inherit;margin-right:6px;box-shadow:0 1px 3px rgba(16,185,129,.3)}",
    ".col-rename-standalone:hover{background:linear-gradient(135deg,#059669,#047857);box-shadow:0 2px 6px rgba(16,185,129,.4);transform:translateY(-1px)}",
    // Header rename indicator (for direct header dblclick)
    "th.col-renameable{position:relative}",
    "th.col-renameable::after{content:'✏️';position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:.7rem;opacity:0;transition:opacity .2s;pointer-events:none}",
    "th.col-renameable:hover::after{opacity:.7}",
    // Header inline rename input
    ".col-header-input{border:2px solid var(--color-accent,#10b981);border-radius:4px;padding:4px 8px;font-size:inherit;font-weight:inherit;font-family:inherit;outline:none;background:#fff;color:var(--color-gray-700,#334155);width:100%;box-sizing:border-box;box-shadow:0 0 0 3px rgba(16,185,129,.15)}",
  ].join("\n");
  document.head.appendChild(css);

  // ── ColumnPrefs Class ────────────────────────────────────────────────
  function ColumnPrefs(opts) {
    this.table =
      typeof opts.table === "string"
        ? document.querySelector(opts.table)
        : opts.table;
    if (!this.table) return;

    this.tableId = opts.tableId || "default";
    this.saveToCloud = opts.saveToCloud || null;
    this.loadFromCloud = opts.loadFromCloud || null;

    // Rename feature (admin-only)
    this.canRename = opts.canRename || false;
    this.customLabels = {}; // { "origIdx": "Custom Name" }
    this.loadGlobalLabels = opts.loadGlobalLabels || null;
    this.saveGlobalLabels = opts.saveGlobalLabels || null;

    this.thead = this.table.querySelector("thead");
    this.headerRow = this.thead ? this.thead.querySelector("tr") : null;
    this.tbody = this.table.querySelector("tbody");
    if (!this.headerRow || !this.tbody) return;

    this.numCols = this.headerRow.children.length;
    this.columnOrder = null; // null = default, or int[]
    this.hiddenCols = {}; // { origIdx: true }
    this._dragSrcEl = null;
    this._panelDragSrc = null;
    this._panel = null;
    this._anchor = null;
    this._closeHandler = null;

    this._tagHeaders();
    this._loadPrefs();
    if (this.columnOrder) this._applyHeaderOrder();
    this._setupHeaderDrag();
    this._addGearButton();
    this._observeTbody();

    // Optional cloud load (overrides localStorage if newer)
    var self = this;
    if (this.loadFromCloud) {
      this.loadFromCloud()
        .then(function (prefs) {
          if (prefs && prefs.order) {
            self.columnOrder = self._validate(prefs.order);
            if (prefs.hidden) {
              self.hiddenCols = {};
              prefs.hidden.forEach(function (i) {
                self.hiddenCols[i] = true;
              });
            }
            self.apply();
          }
        })
        .catch(function () {});
    }

    // Load global column labels (visible to ALL users)
    if (this.loadGlobalLabels) {
      this.loadGlobalLabels()
        .then(function (labels) {
          if (labels && typeof labels === "object") {
            self.customLabels = labels;
            self._applyCustomLabels();
          }
        })
        .catch(function () {});
    }
  }

  // ── Tag headers with original index ──────────────────────────────────
  ColumnPrefs.prototype._tagHeaders = function () {
    var children = this.headerRow.children;
    for (var i = 0; i < children.length; i++) {
      children[i].dataset.colIdx = String(i);
      children[i].dataset.colLabel = children[i].textContent.trim();
      children[i].dataset.origLabel = children[i].textContent.trim();
    }
  };

  // ── Apply custom labels to header cells ─────────────────────────────
  ColumnPrefs.prototype._applyCustomLabels = function () {
    var self = this;
    var children = this.headerRow.children;
    for (var i = 0; i < children.length; i++) {
      var origIdx = children[i].dataset.colIdx;
      if (self.customLabels[origIdx]) {
        children[i].textContent = self.customLabels[origIdx];
        children[i].dataset.colLabel = self.customLabels[origIdx];
      }
    }
  };

  // ── Validate saved order against actual column count ─────────────────
  ColumnPrefs.prototype._validate = function (order) {
    if (!order || !Array.isArray(order)) return null;
    var n = this.numCols;
    order = order.filter(function (i) {
      return typeof i === "number" && i >= 0 && i < n;
    });
    for (var i = 0; i < n; i++) {
      if (order.indexOf(i) === -1) order.push(i);
    }
    return order.length === n ? order : null;
  };

  // ── Load from localStorage ───────────────────────────────────────────
  ColumnPrefs.prototype._loadPrefs = function () {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + this.tableId);
      if (!raw) return;
      var prefs = JSON.parse(raw);
      if (prefs.order) this.columnOrder = this._validate(prefs.order);
      if (prefs.hidden && Array.isArray(prefs.hidden)) {
        var self = this;
        self.hiddenCols = {};
        prefs.hidden.forEach(function (i) {
          if (i >= 0 && i < self.numCols) self.hiddenCols[i] = true;
        });
      }
    } catch (e) {
      /* ignore */
    }
  };

  // ── Save to localStorage + cloud ─────────────────────────────────────
  ColumnPrefs.prototype._savePrefs = function () {
    var hidden = [];
    for (var k in this.hiddenCols) {
      if (this.hiddenCols[k]) hidden.push(parseInt(k));
    }
    var prefs = { order: this.columnOrder, hidden: hidden, ts: Date.now() };
    try {
      localStorage.setItem(
        STORAGE_PREFIX + this.tableId,
        JSON.stringify(prefs),
      );
    } catch (e) {}
    if (this.saveToCloud) this.saveToCloud(prefs).catch(function () {});
  };

  // ── Get current order (saved or default) ─────────────────────────────
  ColumnPrefs.prototype._getOrder = function () {
    if (this.columnOrder) return this.columnOrder.slice();
    var arr = [];
    for (var i = 0; i < this.numCols; i++) arr.push(i);
    return arr;
  };

  // ── Apply order to header cells ──────────────────────────────────────
  ColumnPrefs.prototype._applyHeaderOrder = function () {
    if (!this.columnOrder) return;
    var cells = Array.prototype.slice.call(this.headerRow.children);
    var map = {};
    cells.forEach(function (th) {
      map[th.dataset.colIdx] = th;
    });
    while (this.headerRow.firstChild)
      this.headerRow.removeChild(this.headerRow.firstChild);
    var self = this;
    this.columnOrder.forEach(function (idx) {
      var cell = map[idx];
      if (cell) {
        cell.style.display = self.hiddenCols[idx] ? "none" : "";
        self.headerRow.appendChild(cell);
      }
    });
  };

  // ── Apply order to body rows ─────────────────────────────────────────
  ColumnPrefs.prototype.applyToBody = function () {
    if (!this.columnOrder) return;
    var order = this.columnOrder;
    var numCols = this.numCols;
    var hidden = this.hiddenCols;
    var rows = this.tbody.rows;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cells = Array.prototype.slice.call(row.children);
      // Skip colspan rows (loading/empty messages)
      if (cells.length === 1 && cells[0].colSpan > 1) continue;
      // Only reorder if cell count matches header count
      if (cells.length !== numCols) continue;
      var frag = document.createDocumentFragment();
      for (var c = 0; c < order.length; c++) {
        var cell = cells[order[c]];
        if (cell) {
          cell.style.display = hidden[order[c]] ? "none" : "";
          frag.appendChild(cell);
        }
      }
      while (row.firstChild) row.removeChild(row.firstChild);
      row.appendChild(frag);
    }
  };

  // ── Apply both header + body ─────────────────────────────────────────
  ColumnPrefs.prototype.apply = function () {
    this._applyHeaderOrder();
    this.applyToBody();
  };

  // ── Setup drag & drop on header <th> cells ───────────────────────────
  ColumnPrefs.prototype._setupHeaderDrag = function () {
    var self = this;
    var ths = Array.prototype.slice.call(this.headerRow.children);
    ths.forEach(function (th) {
      th.setAttribute("draggable", "true");

      th.addEventListener("dragstart", function (e) {
        self._dragSrcEl = th;
        th.classList.add("col-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", th.dataset.colIdx);
      });

      th.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        var target =
          e.target.tagName === "TH" ? e.target : e.target.closest("th");
        if (target && target !== self._dragSrcEl) {
          Array.prototype.slice
            .call(self.headerRow.children)
            .forEach(function (h) {
              h.classList.remove("col-drag-over");
            });
          target.classList.add("col-drag-over");
        }
      });

      th.addEventListener("dragleave", function () {
        th.classList.remove("col-drag-over");
      });

      th.addEventListener("drop", function (e) {
        e.preventDefault();
        var target =
          e.target.tagName === "TH" ? e.target : e.target.closest("th");
        if (!target || target === self._dragSrcEl) return;
        target.classList.remove("col-drag-over");

        var order = self._getOrder();
        var srcIdx = parseInt(self._dragSrcEl.dataset.colIdx);
        var tgtIdx = parseInt(target.dataset.colIdx);
        var srcPos = order.indexOf(srcIdx);
        var tgtPos = order.indexOf(tgtIdx);

        order.splice(srcPos, 1);
        var newTgtPos = order.indexOf(tgtIdx);
        order.splice(srcPos < tgtPos ? newTgtPos + 1 : newTgtPos, 0, srcIdx);

        self.columnOrder = order;
        self._savePrefs();
        self.apply();
        self._refreshPanel();
      });

      th.addEventListener("dragend", function () {
        th.classList.remove("col-dragging");
        Array.prototype.slice
          .call(self.headerRow.children)
          .forEach(function (h) {
            h.classList.remove("col-drag-over");
          });
      });
    });
  };

  // ── Gear button ──────────────────────────────────────────────────────
  ColumnPrefs.prototype._addGearButton = function () {
    var wrapper =
      this.table.closest(".table-wrapper") || this.table.parentElement;
    var container = document.createElement("div");
    container.className = "col-prefs-container";

    // Add standalone "Rename Columns" button for admin (Jorge) — high visibility
    if (this.canRename) {
      var renameStandalone = document.createElement("button");
      renameStandalone.className = "col-rename-standalone";
      renameStandalone.innerHTML = "✏️ Rename Columns";
      renameStandalone.title =
        "Click to open column settings and rename any column";
      var self2 = this;
      renameStandalone.addEventListener("click", function (e) {
        e.stopPropagation();
        // Open the panel if not already open
        if (!self2._panel) {
          self2._createPanel(container);
        }
      });
      container.appendChild(renameStandalone);
    }

    var btn = document.createElement("button");
    btn.className = "col-prefs-btn";
    btn.innerHTML = '<span style="font-size:1rem">&#9881;</span> Columns';
    btn.title = "Arrange columns";

    var self = this;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      self._togglePanel(container);
    });

    container.appendChild(btn);
    wrapper.insertBefore(container, wrapper.firstChild);
    this._anchor = container;

    // Add double-click rename directly on table headers (admin only)
    if (this.canRename) {
      this._setupHeaderRename();
    }
  };

  // ── Panel toggle ─────────────────────────────────────────────────────
  ColumnPrefs.prototype._togglePanel = function (anchor) {
    if (this._panel) {
      this._destroyPanel();
    } else {
      this._createPanel(anchor);
    }
  };

  ColumnPrefs.prototype._destroyPanel = function () {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
    if (this._closeHandler) {
      document.removeEventListener("mousedown", this._closeHandler);
      this._closeHandler = null;
    }
  };

  ColumnPrefs.prototype._refreshPanel = function () {
    if (this._panel && this._anchor) {
      this._destroyPanel();
      this._createPanel(this._anchor);
    }
  };

  // ── Build the settings panel ─────────────────────────────────────────
  ColumnPrefs.prototype._createPanel = function (anchor) {
    var self = this;
    var panel = document.createElement("div");
    panel.className = "col-prefs-panel";

    // Title
    var titleRow = document.createElement("div");
    titleRow.className = "col-prefs-panel-title";
    var titleText = document.createElement("span");
    titleText.textContent = "Column Order";
    titleRow.appendChild(titleText);

    var resetBtn = document.createElement("button");
    resetBtn.className = "col-prefs-reset";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", function () {
      self._resetOrder();
    });
    titleRow.appendChild(resetBtn);
    panel.appendChild(titleRow);

    // Hint
    var hint = document.createElement("div");
    hint.className = "col-prefs-panel-hint";
    var hintText = "Drag to reorder \u2022 Toggle to show/hide";
    if (self.canRename) {
      hintText += " \u2022 \u270F\uFE0F to rename";
    }
    hint.textContent = hintText;
    panel.appendChild(hint);

    // Sortable list
    var list = document.createElement("div");
    list.className = "col-prefs-list";

    var order = self._getOrder();
    order.forEach(function (origIdx, pos) {
      var th = self._findHeader(origIdx);
      if (!th) return;
      var defaultLabel =
        th.dataset.origLabel || th.dataset.colLabel || "Column " + origIdx;
      var currentLabel = self.customLabels[origIdx] || defaultLabel;

      var item = document.createElement("div");
      item.className = "col-prefs-item";
      item.dataset.origIdx = origIdx;
      item.draggable = true;

      // Handle
      var handle = document.createElement("span");
      handle.className = "handle";
      handle.textContent = "\u2630";
      item.appendChild(handle);

      // Label
      var label = document.createElement("span");
      label.className = "col-label";
      if (self.customLabels[origIdx]) {
        label.classList.add("renamed");
      }
      label.textContent = currentLabel;
      item.appendChild(label);

      // Rename button (admin only)
      if (self.canRename) {
        var renameBtn = document.createElement("button");
        renameBtn.className = "col-rename-btn";
        renameBtn.innerHTML = "&#9998;";
        renameBtn.title = "Rename column";
        renameBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          self._startRename(label, origIdx, item);
        });
        item.appendChild(renameBtn);

        // Also allow double-click to rename
        label.addEventListener("dblclick", function (e) {
          e.stopPropagation();
          self._startRename(label, origIdx, item);
        });
        label.style.cursor = "pointer";
        label.title = "Double-click to rename";
      }

      // Up/Down arrows (mobile-friendly alternative to drag)
      var arrows = document.createElement("span");
      arrows.className = "col-arrows";

      var upBtn = document.createElement("button");
      upBtn.className = "col-arrow";
      upBtn.textContent = "\u25B2";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._moveItem(list, item, -1);
      });

      var downBtn = document.createElement("button");
      downBtn.className = "col-arrow";
      downBtn.textContent = "\u25BC";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._moveItem(list, item, 1);
      });

      arrows.appendChild(upBtn);
      arrows.appendChild(downBtn);
      item.appendChild(arrows);

      // Visibility toggle
      var toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "col-toggle";
      toggle.checked = !self.hiddenCols[origIdx];
      toggle.addEventListener("change", function () {
        if (toggle.checked) {
          delete self.hiddenCols[origIdx];
        } else {
          self.hiddenCols[origIdx] = true;
        }
        self._savePrefs();
        self.apply();
      });
      item.appendChild(toggle);

      // Panel drag events
      item.addEventListener("dragstart", function (e) {
        self._panelDragSrc = item;
        item.style.opacity = "0.4";
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(origIdx));
      });
      item.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (self._panelDragSrc && self._panelDragSrc !== item) {
          item.classList.add("drag-over");
        }
      });
      item.addEventListener("dragleave", function () {
        item.classList.remove("drag-over");
      });
      item.addEventListener("drop", function (e) {
        e.preventDefault();
        item.classList.remove("drag-over");
        if (!self._panelDragSrc || self._panelDragSrc === item) return;
        var items = Array.prototype.slice.call(list.children);
        var srcP = items.indexOf(self._panelDragSrc);
        var tgtP = items.indexOf(item);
        if (srcP < tgtP) {
          list.insertBefore(self._panelDragSrc, item.nextSibling);
        } else {
          list.insertBefore(self._panelDragSrc, item);
        }
        self._syncOrderFromPanel(list);
      });
      item.addEventListener("dragend", function () {
        item.style.opacity = "1";
        self._panelDragSrc = null;
        Array.prototype.slice.call(list.children).forEach(function (el) {
          el.classList.remove("drag-over");
        });
      });

      list.appendChild(item);
    });

    panel.appendChild(list);
    anchor.appendChild(panel);
    this._panel = panel;

    // Close on click outside
    this._closeHandler = function (e) {
      if (!anchor.contains(e.target)) {
        self._destroyPanel();
      }
    };
    setTimeout(function () {
      document.addEventListener("mousedown", self._closeHandler);
    }, 0);
  };

  // ── Start inline rename (admin only) ───────────────────────────────
  ColumnPrefs.prototype._startRename = function (labelEl, origIdx, itemEl) {
    var self = this;
    var currentName = labelEl.textContent;
    var origLabel = self._findHeader(origIdx)
      ? self._findHeader(origIdx).dataset.origLabel || currentName
      : currentName;

    // Prevent double-init
    if (itemEl.querySelector(".col-label-input")) return;

    var input = document.createElement("input");
    input.type = "text";
    input.className = "col-label-input";
    input.value = currentName;
    input.placeholder = origLabel;

    labelEl.style.display = "none";
    // Hide rename button during edit
    var renameBtn = itemEl.querySelector(".col-rename-btn");
    if (renameBtn) renameBtn.style.display = "none";

    itemEl.insertBefore(input, labelEl.nextSibling);
    input.focus();
    input.select();

    var committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      var newName = input.value.trim();

      if (newName && newName !== currentName) {
        // If set back to original, remove the custom label
        if (newName === origLabel) {
          delete self.customLabels[String(origIdx)];
          labelEl.classList.remove("renamed");
        } else {
          self.customLabels[String(origIdx)] = newName;
          labelEl.classList.add("renamed");
        }
        labelEl.textContent = newName;

        // Apply to actual header <th>
        var th = self._findHeader(origIdx);
        if (th) {
          th.textContent = newName;
          th.dataset.colLabel = newName;
        }

        // Save global labels to Firestore
        if (self.saveGlobalLabels) {
          self.saveGlobalLabels(self.customLabels).catch(function (e) {
            console.error("[ColumnPrefs] Failed to save labels:", e);
          });
        }
      }

      input.remove();
      labelEl.style.display = "";
      if (renameBtn) renameBtn.style.display = "";
    }

    function cancel() {
      if (committed) return;
      committed = true;
      input.remove();
      labelEl.style.display = "";
      if (renameBtn) renameBtn.style.display = "";
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", function () {
      // Small delay to allow Enter to fire first
      setTimeout(commit, 100);
    });
  };

  // ── Direct header rename (double-click on <th> — admin only) ────────
  ColumnPrefs.prototype._setupHeaderRename = function () {
    var self = this;
    var ths = Array.prototype.slice.call(this.headerRow.children);
    ths.forEach(function (th) {
      th.classList.add("col-renameable");
      th.addEventListener("dblclick", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (th.querySelector(".col-header-input")) return; // Already editing

        var origIdx = th.dataset.colIdx;
        var currentText = th.textContent.trim();
        var origLabel = th.dataset.origLabel || currentText;

        // Save original content and clear
        var originalHTML = th.innerHTML;
        th.innerHTML = "";

        var input = document.createElement("input");
        input.type = "text";
        input.className = "col-header-input";
        input.value = currentText;
        input.placeholder = origLabel;
        th.appendChild(input);
        input.focus();
        input.select();

        var committed = false;
        function commit() {
          if (committed) return;
          committed = true;
          var newName = input.value.trim();

          if (newName && newName !== currentText) {
            if (newName === origLabel) {
              delete self.customLabels[String(origIdx)];
            } else {
              self.customLabels[String(origIdx)] = newName;
            }
            th.textContent = newName;
            th.dataset.colLabel = newName;

            if (self.saveGlobalLabels) {
              self.saveGlobalLabels(self.customLabels).catch(function (err) {
                console.error("[ColumnPrefs] Failed to save labels:", err);
              });
            }
          } else {
            th.innerHTML = originalHTML;
          }
        }

        function cancel() {
          if (committed) return;
          committed = true;
          th.innerHTML = originalHTML;
        }

        input.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            commit();
          }
          if (ev.key === "Escape") {
            ev.preventDefault();
            cancel();
          }
        });
        input.addEventListener("blur", function () {
          setTimeout(commit, 100);
        });
      });
    });
  };

  // ── Move item up/down in panel (for mobile / button use) ─────────────
  ColumnPrefs.prototype._moveItem = function (list, item, direction) {
    var items = Array.prototype.slice.call(list.children);
    var pos = items.indexOf(item);
    var newPos = pos + direction;
    if (newPos < 0 || newPos >= items.length) return;

    if (direction === -1) {
      list.insertBefore(item, items[newPos]);
    } else {
      list.insertBefore(item, items[newPos].nextSibling);
    }
    this._syncOrderFromPanel(list);
  };

  // ── Sync column order from panel DOM order ───────────────────────────
  ColumnPrefs.prototype._syncOrderFromPanel = function (list) {
    var items = Array.prototype.slice.call(list.children);
    this.columnOrder = items.map(function (el) {
      return parseInt(el.dataset.origIdx);
    });
    this._savePrefs();
    this.apply();
  };

  // ── Find header by original index ────────────────────────────────────
  ColumnPrefs.prototype._findHeader = function (idx) {
    var children = this.headerRow.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i].dataset.colIdx === String(idx)) return children[i];
    }
    return null;
  };

  // ── Reset to default order ───────────────────────────────────────────
  ColumnPrefs.prototype._resetOrder = function () {
    this.columnOrder = null;
    this.hiddenCols = {};
    this.customLabels = {};
    try {
      localStorage.removeItem(STORAGE_PREFIX + this.tableId);
    } catch (e) {}
    if (this.saveToCloud) this.saveToCloud(null).catch(function () {});
    // Clear global labels if admin
    if (this.canRename && this.saveGlobalLabels) {
      this.saveGlobalLabels(null).catch(function () {});
    }
    this._destroyPanel();
    // Clean reload to restore default column order
    window.location.reload();
  };

  // ── MutationObserver on tbody ────────────────────────────────────────
  ColumnPrefs.prototype._observeTbody = function () {
    if (!this.tbody || !window.MutationObserver) return;
    var self = this;
    var timer = null;
    var observer = new MutationObserver(function () {
      if (!self.columnOrder) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        self.applyToBody();
      }, 80);
    });
    observer.observe(this.tbody, { childList: true });
  };

  // ── Static helper: create Firestore label callbacks ─────────────────
  /**
   * Creates load/save callbacks for global column labels stored in Firestore.
   * Usage:
   *   var fns = ColumnPrefs.firestoreLabels({ doc, getDoc, setDoc, db }, 'shipments');
   *   new ColumnPrefs({ ..., loadGlobalLabels: fns.load, saveGlobalLabels: fns.save });
   */
  ColumnPrefs.firestoreLabels = function (deps, tableId) {
    var docFn = deps.doc;
    var getDocFn = deps.getDoc;
    var setDocFn = deps.setDoc;
    var dbRef = deps.db;
    var docPath = "column_labels";

    return {
      load: function () {
        return getDocFn(docFn(dbRef, "settings", docPath))
          .then(function (snap) {
            if (snap.exists()) {
              var data = snap.data();
              return data[tableId] || null;
            }
            return null;
          })
          .catch(function () {
            return null;
          });
      },
      save: function (labels) {
        return getDocFn(docFn(dbRef, "settings", docPath))
          .then(function (snap) {
            var existing = snap.exists() ? snap.data() : {};
            if (labels === null || labels === undefined) {
              delete existing[tableId];
            } else {
              existing[tableId] = labels;
            }
            existing.updatedAt = new Date().toISOString();
            return setDocFn(docFn(dbRef, "settings", docPath), existing);
          })
          .catch(function (e) {
            console.error("[ColumnPrefs] Failed to save labels:", e);
          });
      },
    };
  };

  // ── Expose globally ──────────────────────────────────────────────────
  window.ColumnPrefs = ColumnPrefs;
})();
