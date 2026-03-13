/**
 * Miami Alliance 3PL — Internationalization Engine
 * Lightweight, zero-dependency i18n with language switcher
 * Supports: English (en) + Spanish (es)
 * Built by Symbio for Master Jorge
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ma3pl_lang";
  var DEFAULT_LANG = "en";
  var SUPPORTED = ["en", "es"];

  // ── Flag SVGs (inline, no external deps) ────────────────────────────
  var FLAGS = {
    en:
      '<svg viewBox="0 0 60 30" width="24" height="12" xmlns="http://www.w3.org/2000/svg">' +
      '<clipPath id="us"><rect width="60" height="30"/></clipPath>' +
      '<g clip-path="url(#us)">' +
      '<rect width="60" height="30" fill="#B22234"/>' +
      '<g fill="#fff">' +
      '<rect y="2.31" width="60" height="2.31"/>' +
      '<rect y="6.92" width="60" height="2.31"/>' +
      '<rect y="11.54" width="60" height="2.31"/>' +
      '<rect y="16.15" width="60" height="2.31"/>' +
      '<rect y="20.77" width="60" height="2.31"/>' +
      '<rect y="25.38" width="60" height="2.31"/>' +
      "</g>" +
      '<rect width="24" height="16.15" fill="#3C3B6E"/>' +
      '<g fill="#fff" font-size="2.5" font-family="serif">' +
      '<text x="12" y="9" text-anchor="middle">★ ★ ★</text>' +
      "</g>" +
      "</g></svg>",
    es:
      '<svg viewBox="0 0 60 30" width="24" height="12" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="60" height="30" fill="#c60b1e"/>' +
      '<rect y="7.5" width="60" height="15" fill="#ffc400"/>' +
      "</svg>",
  };

  // ── Detect initial language ─────────────────────────────────────────
  // Rule: check user preferred browser language first; only Spanish gets es.
  // Every non-Spanish language falls back to English.
  function getBrowserPreferredLang() {
    var preferred = "";
    if (navigator.languages && navigator.languages.length > 0) {
      preferred = navigator.languages[0];
    } else {
      preferred = navigator.language || navigator.userLanguage || "";
    }

    preferred = String(preferred).toLowerCase();
    if (preferred.indexOf("es") === 0) return "es";
    return DEFAULT_LANG;
  }

  function getInitialLang() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    return getBrowserPreferredLang();
  }

  // ── Toggle dual-content blocks (.lang-en / .lang-es) ────────────────
  function toggleLangContent(lang) {
    var enBlocks = document.querySelectorAll(".lang-en");
    var esBlocks = document.querySelectorAll(".lang-es");
    for (var i = 0; i < enBlocks.length; i++) {
      enBlocks[i].style.display = lang === "en" ? "" : "none";
    }
    for (var j = 0; j < esBlocks.length; j++) {
      esBlocks[j].style.display = lang === "es" ? "" : "none";
    }
  }

  // ── Apply translations ──────────────────────────────────────────────
  function applyTranslations(lang) {
    var dict =
      window.MA3PL_TRANSLATIONS && window.MA3PL_TRANSLATIONS[lang]
        ? window.MA3PL_TRANSLATIONS[lang]
        : null;

    // Toggle dual-content blocks (blog articles, etc.)
    toggleLangContent(lang);

    // If English, restore originals
    if (lang === "en" || !dict) {
      restoreOriginals();
      document.documentElement.lang = "en";
      return;
    }

    // Apply Spanish (or any non-en language)
    document.documentElement.lang = lang;

    // data-i18n → textContent
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute("data-i18n");
      if (dict[key]) {
        // Store original if not already stored
        if (!els[i].hasAttribute("data-i18n-original")) {
          els[i].setAttribute("data-i18n-original", els[i].textContent);
        }
        els[i].textContent = dict[key];
      }
    }

    // data-i18n-html → innerHTML
    var htmlEls = document.querySelectorAll("[data-i18n-html]");
    for (var j = 0; j < htmlEls.length; j++) {
      var hkey = htmlEls[j].getAttribute("data-i18n-html");
      if (dict[hkey]) {
        if (!htmlEls[j].hasAttribute("data-i18n-original-html")) {
          htmlEls[j].setAttribute(
            "data-i18n-original-html",
            htmlEls[j].innerHTML,
          );
        }
        htmlEls[j].innerHTML = dict[hkey];
      }
    }

    // data-i18n-placeholder → placeholder attribute
    var phEls = document.querySelectorAll("[data-i18n-placeholder]");
    for (var k = 0; k < phEls.length; k++) {
      var pkey = phEls[k].getAttribute("data-i18n-placeholder");
      if (dict[pkey]) {
        if (!phEls[k].hasAttribute("data-i18n-original-ph")) {
          phEls[k].setAttribute(
            "data-i18n-original-ph",
            phEls[k].getAttribute("placeholder") || "",
          );
        }
        phEls[k].setAttribute("placeholder", dict[pkey]);
      }
    }

    // data-i18n-aria → aria-label attribute
    var ariaEls = document.querySelectorAll("[data-i18n-aria]");
    for (var m = 0; m < ariaEls.length; m++) {
      var akey = ariaEls[m].getAttribute("data-i18n-aria");
      if (dict[akey]) {
        if (!ariaEls[m].hasAttribute("data-i18n-original-aria")) {
          ariaEls[m].setAttribute(
            "data-i18n-original-aria",
            ariaEls[m].getAttribute("aria-label") || "",
          );
        }
        ariaEls[m].setAttribute("aria-label", dict[akey]);
      }
    }
  }

  // ── Restore originals (switch back to English) ──────────────────────
  function restoreOriginals() {
    document.documentElement.lang = "en";
    toggleLangContent("en");

    var els = document.querySelectorAll("[data-i18n-original]");
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = els[i].getAttribute("data-i18n-original");
    }

    var htmlEls = document.querySelectorAll("[data-i18n-original-html]");
    for (var j = 0; j < htmlEls.length; j++) {
      htmlEls[j].innerHTML = htmlEls[j].getAttribute(
        "data-i18n-original-html",
      );
    }

    var phEls = document.querySelectorAll("[data-i18n-original-ph]");
    for (var k = 0; k < phEls.length; k++) {
      phEls[k].setAttribute(
        "placeholder",
        phEls[k].getAttribute("data-i18n-original-ph"),
      );
    }

    var ariaEls = document.querySelectorAll("[data-i18n-original-aria]");
    for (var m = 0; m < ariaEls.length; m++) {
      ariaEls[m].setAttribute(
        "aria-label",
        ariaEls[m].getAttribute("data-i18n-original-aria"),
      );
    }
  }

  // ── Create & inject language switcher ───────────────────────────────
  function injectSwitcher() {
    var nav = document.querySelector(".nav-menu");
    if (!nav) return;

    var currentLang = getInitialLang();

    var switcher = document.createElement("li");
    switcher.className = "lang-switcher";
    switcher.innerHTML =
      '<div class="lang-switcher-wrap">' +
      '<button class="lang-btn' +
      (currentLang === "en" ? " active" : "") +
      '" data-lang="en" title="English" aria-label="Switch to English">' +
      FLAGS.en +
      '<span class="lang-label">EN</span>' +
      "</button>" +
      '<span class="lang-divider">|</span>' +
      '<button class="lang-btn' +
      (currentLang === "es" ? " active" : "") +
      '" data-lang="es" title="Español" aria-label="Cambiar a Español">' +
      FLAGS.es +
      '<span class="lang-label">ES</span>' +
      "</button>" +
      "</div>";

    // Insert as first item in nav
    nav.insertBefore(switcher, nav.firstChild);

    // Bind events
    var buttons = switcher.querySelectorAll(".lang-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        var lang = this.getAttribute("data-lang");
        setLanguage(lang);
      });
    }
  }

  // ── Set language ────────────────────────────────────────────────────
  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}

    // Update active button state
    var buttons = document.querySelectorAll(".lang-btn");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute("data-lang") === lang) {
        buttons[i].classList.add("active");
      } else {
        buttons[i].classList.remove("active");
      }
    }

    applyTranslations(lang);

    // Dispatch custom event for other scripts to listen
    var event;
    try {
      event = new CustomEvent("ma3pl:langchange", { detail: { lang: lang } });
    } catch (e) {
      event = document.createEvent("CustomEvent");
      event.initCustomEvent("ma3pl:langchange", true, true, { lang: lang });
    }
    document.dispatchEvent(event);
  }

  // ── Initialize ──────────────────────────────────────────────────────
  function init() {
    injectSwitcher();
    var lang = getInitialLang();
    if (lang !== DEFAULT_LANG) {
      applyTranslations(lang);
    }
  }

  // ── Run on DOM ready ────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.MA3PL_i18n = {
    setLanguage: setLanguage,
    getLanguage: function () {
      return getInitialLang();
    },
    applyTranslations: applyTranslations,
  };
})();
