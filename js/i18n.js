/**
 * Miami Alliance 3PL — Internationalization Engine
 * Lightweight, zero-dependency i18n with language switcher
 * Supports: English (en) + Spanish (es) + Portuguese (pt-br) + Chinese (zh)
 * Built by Symbio for Master Jorge
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ma3pl_lang";
  var DEFAULT_LANG = "en";
  var SUPPORTED = ["en", "es", "pt-br", "zh"];

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
    "pt-br":
      '<svg viewBox="0 0 60 30" width="24" height="12" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="60" height="30" fill="#009c3b"/>' +
      '<polygon points="30,2 58,15 30,28 2,15" fill="#ffdf00"/>' +
      '<circle cx="30" cy="15" r="7" fill="#002776"/>' +
      '<path d="M23,15 Q30,10 37,15" stroke="#fff" stroke-width="0.8" fill="none"/>' +
      "</svg>",
    zh:
      '<svg viewBox="0 0 60 30" width="24" height="12" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="60" height="30" fill="#DE2910"/>' +
      '<g fill="#FFDE00" transform="translate(7,5)">' +
      '<polygon points="5,0 6.5,3 10,3.5 7.5,6 8,9.5 5,8 2,9.5 2.5,6 0,3.5 3.5,3"/>' +
      '<polygon points="14,1 14.6,2.5 16,2 15,3.3 15.8,4.5 14.3,4 13.5,5.3 13.5,3.8 12,3.3 13.5,2.8" transform="rotate(23,14,3)"/>' +
      '<polygon points="17,4 17.6,5.5 19,5 18,6.3 18.8,7.5 17.3,7 16.5,8.3 16.5,6.8 15,6.3 16.5,5.8" transform="rotate(46,17,6)"/>' +
      '<polygon points="17,9 17.6,10.5 19,10 18,11.3 18.8,12.5 17.3,12 16.5,13.3 16.5,11.8 15,11.3 16.5,10.8" transform="rotate(24,17,11)"/>' +
      '<polygon points="14,13 14.6,14.5 16,14 15,15.3 15.8,16.5 14.3,16 13.5,17.3 13.5,15.8 12,15.3 13.5,14.8" transform="rotate(-10,14,15)"/>' +
      "</g></svg>",
  };

  // ── Detect initial language ─────────────────────────────────────────
  // Rule: check user preferred browser language first.
  // Spanish gets es, Portuguese gets pt-br. Everything else falls back to English.
  function getBrowserPreferredLang() {
    var preferred = "";
    if (navigator.languages && navigator.languages.length > 0) {
      preferred = navigator.languages[0];
    } else {
      preferred = navigator.language || navigator.userLanguage || "";
    }

    preferred = String(preferred).toLowerCase();
    if (preferred.indexOf("es") === 0) return "es";
    if (preferred.indexOf("pt") === 0) return "pt-br";
    if (preferred.indexOf("zh") === 0) return "zh";
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

  // ── Toggle dual-content blocks (.lang-en / .lang-es / .lang-pt-br) ──
  function toggleLangContent(lang) {
    var enBlocks = document.querySelectorAll(".lang-en");
    var esBlocks = document.querySelectorAll(".lang-es");
    var ptBlocks = document.querySelectorAll(".lang-pt-br");
    for (var i = 0; i < enBlocks.length; i++) {
      enBlocks[i].style.display = lang === "en" ? "" : "none";
    }
    for (var j = 0; j < esBlocks.length; j++) {
      esBlocks[j].style.display = lang === "es" ? "" : "none";
    }
    for (var k = 0; k < ptBlocks.length; k++) {
      ptBlocks[k].style.display = lang === "pt-br" ? "" : "none";
    }
    var zhBlocks = document.querySelectorAll(".lang-zh");
    for (var l = 0; l < zhBlocks.length; l++) {
      zhBlocks[l].style.display = lang === "zh" ? "" : "none";
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

    // data-i18n → textContent (auto-detects HTML and uses innerHTML when needed)
    var HTML_TAG_RE = /<[a-z][\s\S]*?>/i;
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute("data-i18n");
      if (dict[key]) {
        // Store original as innerHTML so we preserve any embedded HTML
        if (!els[i].hasAttribute("data-i18n-original")) {
          els[i].setAttribute("data-i18n-original", els[i].innerHTML);
        }
        // Auto-detect HTML tags in translation value
        if (HTML_TAG_RE.test(dict[key])) {
          els[i].innerHTML = dict[key];
        } else {
          els[i].textContent = dict[key];
        }
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
      // Restore using innerHTML since originals may contain HTML
      els[i].innerHTML = els[i].getAttribute("data-i18n-original");
    }

    var htmlEls = document.querySelectorAll("[data-i18n-original-html]");
    for (var j = 0; j < htmlEls.length; j++) {
      htmlEls[j].innerHTML = htmlEls[j].getAttribute("data-i18n-original-html");
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
      '<span class="lang-divider">|</span>' +
      '<button class="lang-btn' +
      (currentLang === "pt-br" ? " active" : "") +
      '" data-lang="pt-br" title="Português" aria-label="Mudar para Português">' +
      FLAGS["pt-br"] +
      '<span class="lang-label">PT</span>' +
      "</button>" +
      '<span class="lang-divider">|</span>' +
      '<button class="lang-btn' +
      (currentLang === "zh" ? " active" : "") +
      '" data-lang="zh" title="中文" aria-label="切换到中文">' +
      FLAGS.zh +
      '<span class="lang-label">中文</span>' +
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
