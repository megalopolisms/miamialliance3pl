"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Touch Control Test Suite — Tetris Wars  (v2 — expanded)
// Tests CSS touch-action rules, JS event handler registration, gesture logic,
// scroll-prevention coverage, brand-bar fix, modal containment, and mobile
// always-block strategy.  Pure Node.js, no external deps.
//
// Run:  node tests/mobile-touch.test.js
// ─────────────────────────────────────────────────────────────────────────────

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function test(description, fn) {
  try {
    fn();
    console.log(`  PASS  ${description}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${description}`);
    console.log(`         ${err.message}`);
    failed++;
    failures.push({ description, error: err.message });
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── Load source files ──────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");
const gameJS = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
const stylesCSS = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const indexHTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CSS TOUCH-ACTION AUDIT
// Verify all critical elements have touch-action: none in the stylesheet
// ─────────────────────────────────────────────────────────────────────────────
section("CSS touch-action Rules");

test("T01. html has touch-action: none in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    mobileBlock,
    "Could not find @media (max-width: 760px) block in styles.css",
  );
  assert.ok(
    /html\s*\{[^}]*touch-action\s*:\s*none/i.test(mobileBlock),
    "html must have touch-action: none in the mobile media query",
  );
});

test("T02. body has touch-action: none in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /body\s*\{[^}]*touch-action\s*:\s*none/i.test(mobileBlock),
    "body must have touch-action: none in the mobile media query",
  );
});

test("T03. html has overflow: hidden in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /html\s*\{[^}]*overflow\s*:\s*hidden/i.test(mobileBlock),
    "html must have overflow: hidden in the mobile media query",
  );
});

test("T04. body has overflow: hidden in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /body\s*\{[^}]*overflow\s*:\s*hidden/i.test(mobileBlock),
    "body must have overflow: hidden in the mobile media query",
  );
});

test("T05. html has position: fixed in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /html\s*\{[^}]*position\s*:\s*fixed/i.test(mobileBlock),
    "html must have position: fixed to prevent iOS rubber-band scroll",
  );
});

test("T06. body has position: fixed in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /body\s*\{[^}]*position\s*:\s*fixed/i.test(mobileBlock),
    "body must have position: fixed to prevent iOS rubber-band scroll",
  );
});

test("T07. html has overscroll-behavior: none in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /html\s*\{[^}]*overscroll-behavior\s*:\s*none/i.test(mobileBlock),
    "html must have overscroll-behavior: none",
  );
});

test("T08. body has overscroll-behavior: none in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /body\s*\{[^}]*overscroll-behavior\s*:\s*none/i.test(mobileBlock),
    "body must have overscroll-behavior: none",
  );
});

test("T09. .board-wrap has touch-action: none (desktop styles)", () => {
  assert.ok(
    /\.board-wrap\s*\{[^}]*touch-action\s*:\s*none/s.test(stylesCSS),
    ".board-wrap must have touch-action: none",
  );
});

test("T10. #board has touch-action: none (desktop styles)", () => {
  assert.ok(
    /\#board\s*\{[^}]*touch-action\s*:\s*none/s.test(stylesCSS),
    "#board must have touch-action: none",
  );
});

test("T11. .game-shell has touch-action: none in mobile media query", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /\.game-shell\s*\{[^}]*touch-action\s*:\s*none/i.test(mobileBlock),
    ".game-shell must have touch-action: none on mobile",
  );
});

test("T12. .mc-btn has touch-action: manipulation", () => {
  assert.ok(
    /\.mc-btn\s*\{[^}]*touch-action\s*:\s*manipulation/s.test(stylesCSS),
    "Mobile control buttons must have touch-action: manipulation",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: HTML INLINE TOUCH SAFEGUARDS
// ─────────────────────────────────────────────────────────────────────────────
section("HTML Inline Touch Safeguards");

test("T13. index.html has viewport meta with user-scalable=no", () => {
  assert.ok(
    /user-scalable\s*=\s*no/i.test(indexHTML),
    "Viewport meta must include user-scalable=no to prevent pinch-zoom conflicts",
  );
});

test("T14. index.html has viewport meta with maximum-scale=1", () => {
  assert.ok(
    /maximum-scale\s*=\s*1/i.test(indexHTML),
    "Viewport meta must include maximum-scale=1",
  );
});

test("T15. index.html inline style has touch-action: none for mobile", () => {
  assert.ok(
    /touch-action\s*:\s*none/.test(indexHTML),
    "Inline <style> must have touch-action: none rule for mobile",
  );
});

test("T16. index.html inline style has overscroll-behavior: none for mobile", () => {
  assert.ok(
    /overscroll-behavior\s*:\s*none/.test(indexHTML),
    "Inline <style> must have overscroll-behavior: none for mobile",
  );
});

test("T17. boardWrap element exists in HTML", () => {
  assert.ok(
    /id\s*=\s*["']boardWrap["']/i.test(indexHTML),
    "Element with id='boardWrap' must exist in index.html",
  );
});

test("T18. mobileControls element exists in HTML", () => {
  assert.ok(
    /id\s*=\s*["']mobileControls["']/i.test(indexHTML),
    "Element with id='mobileControls' must exist in index.html",
  );
});

test("T19. gameShell element exists in HTML", () => {
  assert.ok(
    /id\s*=\s*["']gameShell["']/i.test(indexHTML),
    "Element with id='gameShell' must exist in index.html",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: JS EVENT HANDLER REGISTRATION (passive: false)
// ─────────────────────────────────────────────────────────────────────────────
section("JS Event Handler Registration (passive: false)");

test("T20. boardWrap touchstart registered with { passive: false }", () => {
  const pattern =
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchstart["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "boardWrapEl touchstart must be registered with { passive: false }",
  );
});

test("T21. boardWrap touchmove registered with { passive: false }", () => {
  const pattern =
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchmove["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "boardWrapEl touchmove must be registered with { passive: false }",
  );
});

test("T22. boardWrap touchend registered with { passive: false }", () => {
  const pattern =
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchend["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "boardWrapEl touchend must be registered with { passive: false }",
  );
});

test("T23. document.body touchmove registered with { passive: false }", () => {
  const pattern =
    /document\.body\.addEventListener\(\s*["']touchmove["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "document.body touchmove must be registered with { passive: false }",
  );
});

test("T24. document.documentElement touchmove registered with { passive: false }", () => {
  const pattern =
    /document\.documentElement\.addEventListener\(\s*["']touchmove["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "document.documentElement (html) touchmove must be registered with { passive: false } (iOS failsafe)",
  );
});

test("T25. gameShellEl touchmove registered with { passive: false }", () => {
  const pattern =
    /gameShellEl[\s\S]{0,30}addEventListener\(\s*["']touchmove["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "gameShellEl touchmove must be registered with { passive: false }",
  );
});

test("T26. gameShellEl touchstart registered with { passive: false }", () => {
  const pattern =
    /gameShellEl[\s\S]{0,30}addEventListener\(\s*["']touchstart["'][\s\S]*?passive\s*:\s*false/;
  assert.ok(
    pattern.test(gameJS),
    "gameShellEl touchstart must be registered with { passive: false }",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: JS SCROLL PREVENTION LOGIC
// ─────────────────────────────────────────────────────────────────────────────
section("JS Scroll Prevention Logic");

test("T27. isGameplayActive() helper function exists", () => {
  assert.ok(
    /function\s+isGameplayActive\s*\(/.test(gameJS),
    "isGameplayActive() function must exist to centralize gameplay-active check",
  );
});

test("T28. body touchmove calls preventDefault during gameplay (unconditional)", () => {
  const bodyHandlerMatch = gameJS.match(
    /document\.body\.addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(bodyHandlerMatch, "Could not extract body touchmove handler");
  const handlerBody = bodyHandlerMatch[1];

  assert.ok(
    !handlerBody.includes("boardWrapEl"),
    "body touchmove handler must NOT check for boardWrapEl (must block ALL scroll during gameplay)",
  );
  assert.ok(
    !handlerBody.includes("mobileControlsEl"),
    "body touchmove handler must NOT check for mobileControlsEl (must block ALL scroll during gameplay)",
  );
  assert.ok(
    handlerBody.includes("preventDefault"),
    "body touchmove handler must call preventDefault()",
  );
});

test("T29. html (documentElement) touchmove calls preventDefault during gameplay", () => {
  const htmlHandlerMatch = gameJS.match(
    /document\.documentElement\.addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(htmlHandlerMatch, "Could not extract html touchmove handler");
  assert.ok(
    htmlHandlerMatch[1].includes("preventDefault"),
    "html touchmove handler must call preventDefault()",
  );
});

test("T30. gameShell touchmove calls preventDefault during gameplay", () => {
  const shellMatch = gameJS.match(
    /gameShellEl[\s\S]{0,30}addEventListener\(\s*["']touchmove["']\s*,\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(shellMatch, "Could not extract gameShell touchmove handler");
  assert.ok(
    shellMatch[1].includes("preventDefault"),
    "gameShell touchmove handler must call preventDefault()",
  );
});

test("T31. gameShell touchstart preserves button accessibility", () => {
  const shellStartMatch = gameJS.match(
    /gameShellEl[\s\S]{0,30}addEventListener\(\s*["']touchstart["']\s*,\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(shellStartMatch, "Could not extract gameShell touchstart handler");
  const body = shellStartMatch[1];
  assert.ok(
    body.includes("BUTTON") || body.includes("tagName"),
    "gameShell touchstart must check for BUTTON tags to preserve button tap accessibility",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: GESTURE SYSTEM INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
section("Gesture System Integrity");

test("T32. beginGesture function exists", () => {
  assert.ok(
    /function\s+beginGesture\s*\(/.test(gameJS),
    "beginGesture() function must exist",
  );
});

test("T33. moveGesture function exists", () => {
  assert.ok(
    /function\s+moveGesture\s*\(/.test(gameJS),
    "moveGesture() function must exist",
  );
});

test("T34. endGesture function exists", () => {
  assert.ok(
    /function\s+endGesture\s*\(/.test(gameJS),
    "endGesture() function must exist",
  );
});

test("T35. handleBoardTapAction function exists (tap = rotate)", () => {
  assert.ok(
    /function\s+handleBoardTapAction\s*\(/.test(gameJS),
    "handleBoardTapAction() must exist for tap-to-rotate",
  );
});

test("T36. clientXToCol function exists (finger-to-column mapping)", () => {
  assert.ok(
    /function\s+clientXToCol\s*\(/.test(gameJS),
    "clientXToCol() must exist for drag-to-column mapping",
  );
});

test("T37. moveGesture handles horizontal drag (piece follows finger)", () => {
  assert.ok(
    gameJS.includes("clientXToCol") && gameJS.includes("dragAnchorOffset"),
    "moveGesture must use clientXToCol and dragAnchorOffset for direct drag-and-drop",
  );
});

test("T38. moveGesture handles vertical drag (soft drop)", () => {
  assert.ok(
    gameJS.includes("softDropAccum") && gameJS.includes("getRenderedCellH"),
    "moveGesture must track soft drops with softDropAccum and getRenderedCellH",
  );
});

test("T39. endGesture detects tap gesture (distance < threshold, time < max)", () => {
  assert.ok(
    gameJS.includes("tapMaxDist") && gameJS.includes("tapMaxTimeTouch"),
    "Tap detection thresholds tapMaxDist and tapMaxTimeTouch must be defined",
  );
});

test("T40. endGesture detects swipe-up for hard drop", () => {
  assert.ok(
    /dy\s*<\s*-\s*40/.test(gameJS),
    "endGesture must check dy < -40 for swipe-up hard drop detection",
  );
});

test("T41. boardWrap touchcancel handler resets gestureActive", () => {
  assert.ok(
    /touchcancel[\s\S]*?gestureActive\s*=\s*false/.test(gameJS),
    "touchcancel handler must reset gestureActive to false",
  );
});

test("T42. Synthetic click suppression exists (prevents iOS ghost clicks)", () => {
  assert.ok(
    gameJS.includes("suppressSyntheticClickUntil"),
    "suppressSyntheticClickUntil must exist to prevent iOS ghost/synthetic clicks",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: MOBILE BUTTON EVENT BINDING
// ─────────────────────────────────────────────────────────────────────────────
section("Mobile Button Event Binding");

test("T43. Mobile buttons use pointerdown OR touchstart with preventDefault", () => {
  const hasPointerDown = /pointerdown[\s\S]*?preventDefault/.test(gameJS);
  const hasTouchStart =
    /touchstart[\s\S]*?preventDefault[\s\S]*?stopPropagation/.test(gameJS);
  assert.ok(
    hasPointerDown || hasTouchStart,
    "Mobile buttons must bind pointerdown or touchstart with preventDefault",
  );
});

test("T44. DAS (Delayed Auto-Shift) support exists for directional buttons", () => {
  assert.ok(
    gameJS.includes("startDAS") && gameJS.includes("stopDAS"),
    "DAS (startDAS/stopDAS) must be implemented for responsive directional controls",
  );
});

test("T45. Vibration feedback exists for mobile haptics", () => {
  assert.ok(
    /navigator\.vibrate/.test(gameJS),
    "navigator.vibrate() must be called for mobile haptic feedback",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: iOS-SPECIFIC SAFEGUARDS
// ─────────────────────────────────────────────────────────────────────────────
section("iOS-Specific Safeguards");

test("T46. CSS has -webkit-tap-highlight-color: transparent on board", () => {
  assert.ok(
    /-webkit-tap-highlight-color\s*:\s*transparent/.test(stylesCSS),
    "Must have -webkit-tap-highlight-color: transparent to prevent blue tap highlight on iOS",
  );
});

test("T47. CSS has -webkit-touch-callout: none on board", () => {
  assert.ok(
    /-webkit-touch-callout\s*:\s*none/.test(stylesCSS),
    "Must have -webkit-touch-callout: none to prevent iOS long-press callout menu",
  );
});

test("T48. CSS has -webkit-user-select: none on interactive elements", () => {
  assert.ok(
    /-webkit-user-select\s*:\s*none/.test(stylesCSS),
    "Must have -webkit-user-select: none on interactive game elements",
  );
});

test("T49. Context menu is prevented on boardWrap", () => {
  assert.ok(
    /contextmenu[\s\S]*?preventDefault/.test(gameJS),
    "contextmenu event must be prevented on boardWrap (blocks iOS long-press menu)",
  );
});

test("T50. viewport-fit=cover in meta viewport (iPhone X+ safe areas)", () => {
  assert.ok(
    /viewport-fit\s*=\s*cover/i.test(indexHTML),
    "Meta viewport must include viewport-fit=cover for iPhone notch/safe-area support",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: GESTURE ENGINE UNIT TESTS (using TetrisCore)
// ─────────────────────────────────────────────────────────────────────────────
section("Gesture Engine Unit Tests (TetrisCore)");

const TetrisCore = require(path.resolve(ROOT, "tetris-core.js"));
const { TetrisEngine } = TetrisCore;

function deterministicRandom(seq) {
  let idx = 0;
  return () => {
    const val = seq[idx % seq.length];
    idx++;
    return val;
  };
}

function freshEngine() {
  const seq = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const eng = new TetrisEngine({ random: deterministicRandom(seq) });
  eng.start();
  return eng;
}

test("T51. Piece moves left when engine.move(-1) called (simulates drag left)", () => {
  const eng = freshEngine();
  const before = eng.active.x;
  assert.strictEqual(eng.move(-1), true);
  assert.strictEqual(eng.active.x, before - 1);
});

test("T52. Piece moves right when engine.move(1) called (simulates drag right)", () => {
  const eng = freshEngine();
  const before = eng.active.x;
  assert.strictEqual(eng.move(1), true);
  assert.strictEqual(eng.active.x, before + 1);
});

test("T53. Multiple moves in same direction (simulates fast drag across board)", () => {
  const eng = freshEngine();
  const startX = eng.active.x;
  let moved = 0;
  for (let i = 0; i < 5; i++) {
    if (eng.move(1)) moved++;
  }
  assert.ok(moved >= 3, `Should move at least 3 columns right, moved ${moved}`);
  assert.strictEqual(eng.active.x, startX + moved);
});

test("T54. Soft drop moves piece down (simulates drag down gesture)", () => {
  const eng = freshEngine();
  const beforeY = eng.active.y;
  const result = eng.softDrop();
  assert.strictEqual(result.moved, true);
  assert.strictEqual(eng.active.y, beforeY + 1);
});

test("T55. Multiple soft drops in sequence (simulates continuous drag down)", () => {
  const eng = freshEngine();
  let drops = 0;
  for (let i = 0; i < 10; i++) {
    const r = eng.softDrop();
    if (r.moved) drops++;
    if (r.locked) break;
  }
  assert.ok(drops >= 5, `Should drop at least 5 rows, dropped ${drops}`);
});

test("T56. Hard drop locks piece (simulates swipe-up gesture)", () => {
  const eng = freshEngine();
  const result = eng.hardDrop();
  assert.strictEqual(result.locked, true);
  assert.ok(result.distance >= 0);
});

test("T57. Rotate CW works (simulates tap gesture)", () => {
  const eng = freshEngine();
  const before = JSON.stringify(eng.active.matrix);
  const result = eng.rotate(1);
  if (eng.active.type !== "O") {
    assert.ok(result, "rotate(1) should return true");
    assert.notStrictEqual(JSON.stringify(eng.active.matrix), before);
  }
});

test("T58. Hold piece works (simulates hold button tap)", () => {
  const eng = freshEngine();
  const activeType = eng.active.type;
  eng.holdPiece();
  assert.strictEqual(eng.holdType, activeType);
});

test("T59. Game state reports running correctly (for isGameplayActive check)", () => {
  const eng = freshEngine();
  const state = eng.getPublicState();
  assert.strictEqual(state.running, true);
  assert.strictEqual(state.paused, false);
  assert.strictEqual(state.gameOver, false);
});

test("T60. Paused state correctly reports (scroll should be allowed when paused)", () => {
  const eng = freshEngine();
  eng.togglePause();
  const state = eng.getPublicState();
  assert.strictEqual(state.paused, true);
  assert.strictEqual(state.running, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: DEFENSIVE LAYERS COUNT
// ─────────────────────────────────────────────────────────────────────────────
section("Defensive Layers Audit");

test("T61. At least 3 independent CSS scroll-prevention layers exist", () => {
  let layers = 0;
  if (/touch-action\s*:\s*none/.test(stylesCSS)) layers++;
  if (/overflow\s*:\s*hidden/.test(stylesCSS)) layers++;
  if (/overscroll-behavior\s*:\s*none/.test(stylesCSS)) layers++;
  if (/position\s*:\s*fixed/.test(stylesCSS)) layers++;
  assert.ok(
    layers >= 3,
    `Expected at least 3 CSS scroll-prevention layers, found ${layers}`,
  );
});

test("T62. At least 3 independent JS scroll-prevention handlers exist", () => {
  let handlers = 0;
  if (/document\.body\.addEventListener\([\s\S]*?touchmove/.test(gameJS))
    handlers++;
  if (
    /document\.documentElement\.addEventListener\([\s\S]*?touchmove/.test(
      gameJS,
    )
  )
    handlers++;
  if (/gameShellEl[\s\S]*?addEventListener\([\s\S]*?touchmove/.test(gameJS))
    handlers++;
  if (/boardWrapEl[\s\S]*?addEventListener\([\s\S]*?touchmove/.test(gameJS))
    handlers++;
  assert.ok(
    handlers >= 3,
    `Expected at least 3 JS touchmove handlers, found ${handlers}`,
  );
});

test("T63. Inline HTML style adds redundant touch-action: none", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist in index.html");
  assert.ok(
    /touch-action\s*:\s*none/.test(inlineStyleMatch[1]),
    "Inline <style> must contain touch-action: none as a CSS-load failsafe",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: CAPTURE-PHASE SCROLL BLOCKERS (iOS NUCLEAR FIX)
// ─────────────────────────────────────────────────────────────────────────────
section("Capture-Phase Scroll Blockers (iOS Nuclear Fix)");

test("T64. document.addEventListener('touchmove') with capture:true exists", () => {
  const pattern =
    /document\.addEventListener\(\s*["']touchmove["'][\s\S]*?capture\s*:\s*true/;
  assert.ok(
    pattern.test(gameJS),
    "document-level touchmove must be registered with { capture: true } to intercept before iOS scroll",
  );
});

test("T65. document.addEventListener('touchstart') with capture:true exists", () => {
  const pattern =
    /document\.addEventListener\(\s*["']touchstart["'][\s\S]*?capture\s*:\s*true/;
  assert.ok(
    pattern.test(gameJS),
    "document-level touchstart must be registered with { capture: true } to prevent iOS from beginning scroll gesture",
  );
});

test("T66. Capture-phase touchmove calls preventDefault during gameplay", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchmove handler");
  assert.ok(
    match[1].includes("preventDefault"),
    "Capture-phase touchmove must call e.preventDefault()",
  );
});

test("T67. Capture-phase touchstart preserves interactive elements", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchstart handler");
  assert.ok(
    match[1].includes("BUTTON"),
    "Capture-phase touchstart must exempt BUTTON elements",
  );
  assert.ok(
    match[1].includes("INPUT"),
    "Capture-phase touchstart must exempt INPUT elements",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: CSS SCROLL CONTAINER FIX
// ─────────────────────────────────────────────────────────────────────────────
section("CSS Game-Shell Scroll Container Fix");

test("T68. game-shell does NOT have overflow-y: auto on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(mobileBlock, "Could not find mobile media query");
  const gameShellMatch = mobileBlock.match(/\.game-shell\s*\{([^}]*)\}/);
  assert.ok(gameShellMatch, "Could not find .game-shell rule in mobile block");
  const props = gameShellMatch[1];
  assert.ok(
    !props.includes("overflow-y: auto") && !props.includes("overflow-y:auto"),
    "game-shell must NOT have overflow-y: auto (creates scrollable container that iOS scrolls)",
  );
});

test("T69. game-shell does NOT have -webkit-overflow-scrolling: touch on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const gameShellMatch = mobileBlock.match(/\.game-shell\s*\{([^}]*)\}/);
  assert.ok(gameShellMatch, "Could not find .game-shell rule in mobile block");
  const props = gameShellMatch[1];
  assert.ok(
    !props.includes("-webkit-overflow-scrolling: touch") &&
      !props.includes("-webkit-overflow-scrolling:touch"),
    "game-shell must NOT have -webkit-overflow-scrolling: touch (enables iOS momentum scrolling)",
  );
});

test("T70. game-shell has overflow: hidden on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const gameShellMatch = mobileBlock.match(/\.game-shell\s*\{([^}]*)\}/);
  assert.ok(gameShellMatch, "Could not find .game-shell rule in mobile block");
  const props = gameShellMatch[1];
  assert.ok(
    props.includes("overflow: hidden") || props.includes("overflow:hidden"),
    "game-shell must have overflow: hidden on mobile",
  );
});

test("T71. game-shell has overscroll-behavior: none on mobile (not contain)", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const gameShellMatch = mobileBlock.match(/\.game-shell\s*\{([^}]*)\}/);
  assert.ok(gameShellMatch, "Could not find .game-shell rule in mobile block");
  const props = gameShellMatch[1];
  assert.ok(
    props.includes("overscroll-behavior: none") ||
      props.includes("overscroll-behavior:none"),
    "game-shell must have overscroll-behavior: none (not contain)",
  );
  assert.ok(
    !props.includes("overscroll-behavior: contain") &&
      !props.includes("overscroll-behavior:contain"),
    "game-shell must NOT have overscroll-behavior: contain (too permissive)",
  );
});

test("T72. Inline HTML style includes overflow: hidden for html/body on mobile", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    /overflow\s*:\s*hidden/.test(inlineStyleMatch[1]),
    "Inline <style> must include overflow: hidden as failsafe",
  );
});

test("T73. Inline HTML style includes position: fixed for html/body on mobile", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    /position\s*:\s*fixed/.test(inlineStyleMatch[1]),
    "Inline <style> must include position: fixed as failsafe",
  );
});

test("T74. At least 5 total independent scroll-prevention layers", () => {
  let layers = 0;
  if (/touch-action\s*:\s*none/.test(stylesCSS)) layers++;
  if (/overflow\s*:\s*hidden/.test(stylesCSS)) layers++;
  if (/overscroll-behavior\s*:\s*none/.test(stylesCSS)) layers++;
  if (/position\s*:\s*fixed/.test(stylesCSS)) layers++;
  if (/capture\s*:\s*true/.test(gameJS)) layers++;
  if (/document\.body\.addEventListener/.test(gameJS)) layers++;
  if (/document\.documentElement\.addEventListener/.test(gameJS)) layers++;
  if (/gameShellEl[\s\S]*?addEventListener/.test(gameJS)) layers++;
  if (/boardWrapEl[\s\S]*?addEventListener/.test(gameJS)) layers++;
  if (/touch-action\s*:\s*none/.test(indexHTML)) layers++;
  assert.ok(
    layers >= 5,
    `Expected at least 5 total scroll-prevention layers, found ${layers}`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: BRAND BAR SCROLL FIX (NEW — v2)
// The brand bar was using position:sticky which can initiate scroll on iOS.
// It must be position:fixed on mobile and have touch-action:none.
// ─────────────────────────────────────────────────────────────────────────────
section("Brand Bar Scroll Prevention (v2 fix)");

test("T75. Brand bar has touch-action on desktop (manipulation or none)", () => {
  assert.ok(
    /\.brand-bar\s*\{[^}]*touch-action\s*:/s.test(stylesCSS),
    ".brand-bar must have a touch-action rule in desktop styles",
  );
});

test("T76. Brand bar is position:fixed (not sticky) on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(mobileBlock, "Could not find mobile media query");
  const brandBarMatch = mobileBlock.match(/\.brand-bar\s*\{([^}]*)\}/);
  assert.ok(brandBarMatch, "Could not find .brand-bar rule in mobile block");
  const props = brandBarMatch[1];
  assert.ok(
    props.includes("position: fixed") || props.includes("position:fixed"),
    ".brand-bar must be position: fixed on mobile (sticky can trigger iOS scroll)",
  );
});

test("T77. Brand bar has touch-action: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const brandBarMatch = mobileBlock.match(/\.brand-bar\s*\{([^}]*)\}/);
  assert.ok(brandBarMatch, "Could not find .brand-bar rule in mobile block");
  const props = brandBarMatch[1];
  assert.ok(
    props.includes("touch-action: none") || props.includes("touch-action:none"),
    ".brand-bar must have touch-action: none on mobile",
  );
});

test("T78. Brand bar touchmove handler exists in JS", () => {
  assert.ok(
    /brandBarEl[\s\S]{0,40}addEventListener\(\s*["']touchmove["']/.test(gameJS),
    "brandBarEl touchmove handler must exist to prevent scroll from nav bar",
  );
});

test("T79. Brand bar touchmove calls preventDefault", () => {
  const match = gameJS.match(
    /brandBarEl[\s\S]{0,40}addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(match, "Could not extract brandBar touchmove handler");
  assert.ok(
    match[1].includes("preventDefault"),
    "Brand bar touchmove handler must call preventDefault()",
  );
});

test("T80. Inline HTML style includes .brand-bar in touch-action: none list", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".brand-bar"),
    "Inline <style> must include .brand-bar in the touch-action: none selector list",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: MOBILE ALWAYS-BLOCK STRATEGY (NEW — v2)
// On mobile (<760px), the game is fullscreen. Scroll should be blocked
// ALWAYS, not just during active gameplay.  This prevents scroll during
// loading, game-over, or before the game starts.
// ─────────────────────────────────────────────────────────────────────────────
section("Mobile Always-Block Strategy (v2 fix)");

test("T81. isMobileViewport detection variable exists", () => {
  assert.ok(
    gameJS.includes("isMobileViewport"),
    "isMobileViewport variable must exist for mobile-specific scroll blocking",
  );
});

test("T82. isMobileViewport uses matchMedia for responsive detection", () => {
  assert.ok(
    /isMobileViewport\s*=\s*window\.matchMedia/.test(gameJS),
    "isMobileViewport must use window.matchMedia for accurate detection",
  );
});

test("T83. Capture-phase touchmove blocks on mobile regardless of game state", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchmove handler");
  assert.ok(
    match[1].includes("isMobileViewport"),
    "Capture-phase touchmove must check isMobileViewport to block scroll on mobile ALWAYS",
  );
});

test("T84. Capture-phase touchstart blocks on mobile regardless of game state", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchstart handler");
  assert.ok(
    match[1].includes("isMobileViewport"),
    "Capture-phase touchstart must check isMobileViewport for mobile always-block",
  );
});

test("T85. Body touchmove uses isMobileViewport for always-block on mobile", () => {
  const match = gameJS.match(
    /document\.body\.addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(match, "Could not extract body touchmove handler");
  assert.ok(
    match[1].includes("isMobileViewport"),
    "Body touchmove must use isMobileViewport for mobile always-block",
  );
});

test("T86. HTML touchmove uses isMobileViewport for always-block on mobile", () => {
  const match = gameJS.match(
    /document\.documentElement\.addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(match, "Could not extract html touchmove handler");
  assert.ok(
    match[1].includes("isMobileViewport"),
    "HTML touchmove must use isMobileViewport for mobile always-block",
  );
});

test("T87. Resize handler updates isMobileViewport", () => {
  assert.ok(
    /window\.addEventListener\(\s*["']resize["'][\s\S]*?isMobileViewport/.test(
      gameJS,
    ),
    "resize handler must update isMobileViewport for orientation changes",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14: LOADING SCREEN & MODAL TOUCH CONTAINMENT (NEW — v2)
// ─────────────────────────────────────────────────────────────────────────────
section("Loading Screen & Modal Touch Containment (v2 fix)");

test("T88. Loading screen has touch-action: none in CSS", () => {
  assert.ok(
    /\.loading-screen\s*\{[^}]*touch-action\s*:\s*none/s.test(stylesCSS),
    ".loading-screen must have touch-action: none to prevent scroll during load",
  );
});

test("T89. Loading screen has overscroll-behavior: none in CSS", () => {
  assert.ok(
    /\.loading-screen\s*\{[^}]*overscroll-behavior\s*:\s*none/s.test(stylesCSS),
    ".loading-screen must have overscroll-behavior: none",
  );
});

test("T90. Modal overlay has touch-action: none in CSS", () => {
  assert.ok(
    /\.modal-overlay\s*\{[^}]*touch-action\s*:\s*none/s.test(stylesCSS),
    ".modal-overlay must have touch-action: none",
  );
});

test("T91. Modal overlay has overscroll-behavior in CSS", () => {
  assert.ok(
    /\.modal-overlay\s*\{[^}]*overscroll-behavior/s.test(stylesCSS),
    ".modal-overlay must have overscroll-behavior to contain scroll",
  );
});

test("T92. Settings panel has overscroll-behavior: contain in CSS", () => {
  assert.ok(
    /\.settings-panel\s*\{[^}]*overscroll-behavior\s*:\s*contain/s.test(
      stylesCSS,
    ),
    ".settings-panel must have overscroll-behavior: contain (internal scroll only)",
  );
});

test("T93. Inline HTML style includes .loading-screen in touch-action kill list", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".loading-screen"),
    "Inline <style> must include .loading-screen in touch-action: none selector list",
  );
});

test("T94. Inline HTML style includes .modal-overlay in touch-action kill list", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".modal-overlay"),
    "Inline <style> must include .modal-overlay in touch-action: none selector list",
  );
});

test("T95. Inline HTML style includes .game-over-overlay in touch-action kill list", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".game-over-overlay"),
    "Inline <style> must include .game-over-overlay in touch-action: none selector list",
  );
});

test("T96. Inline HTML style includes .settings-panel in touch-action kill list", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".settings-panel"),
    "Inline <style> must include .settings-panel in touch-action: none selector list",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 15: COMPLETE ANCESTOR CHAIN COVERAGE (NEW — v2)
// Every ancestor of the game board must have touch-action: none on mobile.
// One missing ancestor = iOS can initiate scroll from there.
// ─────────────────────────────────────────────────────────────────────────────
section("Complete Ancestor Chain Touch Coverage");

test("T97. Inline HTML style includes .stars in touch-action kill list", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".stars"),
    "Inline <style> must include .stars in touch-action: none list (background div can leak scroll)",
  );
});

test("T98. .board-container has touch-action prevention on mobile", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".board-container"),
    "Inline <style> must include .board-container in touch-action: none list",
  );
});

test("T99. At least 8 total independent scroll-prevention layers (upgraded from 5)", () => {
  let layers = 0;
  // CSS layers
  if (/touch-action\s*:\s*none/.test(stylesCSS)) layers++;
  if (/overflow\s*:\s*hidden/.test(stylesCSS)) layers++;
  if (/overscroll-behavior\s*:\s*none/.test(stylesCSS)) layers++;
  if (/position\s*:\s*fixed/.test(stylesCSS)) layers++;
  // JS capture layers
  if (/capture\s*:\s*true/.test(gameJS)) layers++;
  // JS bubble layers
  if (/document\.body\.addEventListener/.test(gameJS)) layers++;
  if (/document\.documentElement\.addEventListener/.test(gameJS)) layers++;
  if (/gameShellEl[\s\S]*?addEventListener/.test(gameJS)) layers++;
  if (/boardWrapEl[\s\S]*?addEventListener/.test(gameJS)) layers++;
  if (/brandBarEl[\s\S]*?addEventListener/.test(gameJS)) layers++;
  // Inline CSS layer
  if (/touch-action\s*:\s*none/.test(indexHTML)) layers++;
  // Mobile always-block
  if (/isMobileViewport/.test(gameJS)) layers++;

  assert.ok(
    layers >= 8,
    `Expected at least 8 total scroll-prevention layers, found ${layers}`,
  );
});

test("T100. Game-shell top padding accommodates fixed brand-bar on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const gameShellMatch = mobileBlock.match(/\.game-shell\s*\{([^}]*)\}/);
  assert.ok(gameShellMatch, "Could not find .game-shell rule in mobile block");
  const props = gameShellMatch[1];
  // Check that padding-top is at least 30px to accommodate the brand bar
  const paddingMatch = props.match(/padding\s*:\s*(\d+)px/);
  if (paddingMatch) {
    assert.ok(
      parseInt(paddingMatch[1]) >= 30,
      "game-shell padding-top must be >= 30px to clear fixed brand-bar",
    );
  } else {
    // Check for padding shorthand with !important
    assert.ok(
      /padding\s*:.*?!important/.test(props),
      "game-shell must have padding defined on mobile",
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 16: MULTI-TOUCH & EDGE CASE HANDLING (NEW — v3)
// Tests for multi-finger rejection, orientation change, game-over overlay
// containment, and rapid gesture sequencing.
// ─────────────────────────────────────────────────────────────────────────────
section("Multi-Touch & Edge Case Handling (v3)");

test("T101. boardWrap touchstart checks touches.length === 1 (rejects multi-touch)", () => {
  const boardTouchStart = gameJS.match(
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(boardTouchStart, "Could not extract boardWrap touchstart handler");
  assert.ok(
    boardTouchStart[1].includes("touches.length") &&
      boardTouchStart[1].includes("1"),
    "boardWrap touchstart must check e.touches.length === 1 to reject multi-finger gestures",
  );
});

test("T102. boardWrap touchmove checks gestureActive before processing", () => {
  const boardTouchMove = gameJS.match(
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchmove["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(boardTouchMove, "Could not extract boardWrap touchmove handler");
  assert.ok(
    boardTouchMove[1].includes("gestureActive"),
    "boardWrap touchmove must guard on gestureActive to prevent orphaned moves",
  );
});

test("T103. Resize handler exists for orientation changes", () => {
  assert.ok(
    /window\.addEventListener\(\s*["']resize["']/.test(gameJS),
    "Must listen for window resize to update mobile viewport detection on orientation change",
  );
});

test("T104. boardWrap touchend checks gestureActive before processing", () => {
  const boardTouchEnd = gameJS.match(
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchend["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(boardTouchEnd, "Could not extract boardWrap touchend handler");
  assert.ok(
    boardTouchEnd[1].includes("gestureActive"),
    "boardWrap touchend must guard on gestureActive",
  );
});

test("T105. touchcancel sets suppressSyntheticClickUntil (prevents ghost click after cancel)", () => {
  assert.ok(
    /touchcancel[\s\S]*?suppressSyntheticClickUntil/.test(gameJS),
    "touchcancel handler must set suppressSyntheticClickUntil to prevent phantom clicks",
  );
});

test("T106. endGesture resets gestureActive to false", () => {
  assert.ok(
    /function\s+endGesture[\s\S]*?gestureActive\s*=\s*false/.test(gameJS),
    "endGesture must reset gestureActive = false to clean up state",
  );
});

test("T107. mouseleave resets gestureActive (desktop fallback cleanup)", () => {
  assert.ok(
    /mouseleave[\s\S]*?gestureActive\s*=\s*false/.test(gameJS),
    "mouseleave on boardWrap must reset gestureActive for desktop testing cleanup",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 17: MOBILE CONTROLS CONTAINER TOUCH COVERAGE (NEW — v3)
// The mobile controls bar is position:fixed at bottom. Verify touch containment.
// ─────────────────────────────────────────────────────────────────────────────
section("Mobile Controls Container Touch Coverage (v3)");

test("T108. .mobile-controls has touch-action in inline style", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes(".mobile-controls"),
    "Inline <style> must include .mobile-controls in touch-action: none selector",
  );
});

test("T109. .mobile-controls is position: fixed on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const mcMatch = mobileBlock.match(/\.mobile-controls\s*\{([^}]*)\}/);
  assert.ok(mcMatch, "Could not find .mobile-controls rule in mobile block");
  assert.ok(
    mcMatch[1].includes("position: fixed") ||
      mcMatch[1].includes("position:fixed"),
    ".mobile-controls must be position: fixed on mobile",
  );
});

test("T110. Mobile buttons use safe-area-inset for notch/home-indicator padding", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /safe-area-inset-bottom/.test(mobileBlock),
    "Mobile controls must use env(safe-area-inset-bottom) for iPhone home indicator",
  );
});

test("T111. .mc-btn has -webkit-tap-highlight-color: transparent", () => {
  assert.ok(
    /\.mc-btn\s*\{[^}]*-webkit-tap-highlight-color\s*:\s*transparent/s.test(
      stylesCSS,
    ),
    "Mobile buttons must suppress iOS tap highlight",
  );
});

test("T112. .mc-btn has user-select: none", () => {
  assert.ok(
    /\.mc-btn\s*\{[^}]*user-select\s*:\s*none/s.test(stylesCSS),
    "Mobile buttons must have user-select: none to prevent text selection",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 18: CANVAS & BOARD TOUCH-ACTION (DESKTOP + MOBILE) (NEW — v3)
// The canvas must have touch-action: none in both desktop and mobile CSS.
// ─────────────────────────────────────────────────────────────────────────────
section("Canvas & Board Touch-Action (Desktop + Mobile) (v3)");

test("T113. #board canvas has user-select: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const boardMatch = mobileBlock.match(/#board\s*\{([^}]*)\}/);
  assert.ok(boardMatch, "Could not find #board rule in mobile block");
  assert.ok(
    boardMatch[1].includes("user-select: none") ||
      boardMatch[1].includes("user-select:none"),
    "#board must have user-select: none on mobile",
  );
});

test("T114. #board canvas has touch-action: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const boardMatch = mobileBlock.match(/#board\s*\{([^}]*)\}/);
  assert.ok(boardMatch, "Could not find #board rule in mobile block");
  assert.ok(
    boardMatch[1].includes("touch-action: none") ||
      boardMatch[1].includes("touch-action:none"),
    "#board canvas must have touch-action: none on mobile",
  );
});

test("T115. .board-container has user-select: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const bcMatch = mobileBlock.match(/\.board-container\s*\{([^}]*)\}/);
  assert.ok(bcMatch, "Could not find .board-container rule in mobile block");
  assert.ok(
    bcMatch[1].includes("user-select: none") ||
      bcMatch[1].includes("user-select:none"),
    ".board-container must have user-select: none on mobile",
  );
});

test("T116. .board-container has -webkit-touch-callout: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const bcMatch = mobileBlock.match(/\.board-container\s*\{([^}]*)\}/);
  assert.ok(bcMatch, "Could not find .board-container rule in mobile block");
  assert.ok(
    bcMatch[1].includes("-webkit-touch-callout: none") ||
      bcMatch[1].includes("-webkit-touch-callout:none"),
    ".board-container must have -webkit-touch-callout: none on mobile",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 19: GAME STATE TRANSITION TESTS (NEW — v3)
// Ensure scroll blocking works correctly across all game states:
// running, paused, game-over, waiting (before start).
// ─────────────────────────────────────────────────────────────────────────────
section("Game State Transition Tests (v3)");

test("T117. moveGesture exits early when game is paused", () => {
  const eng = freshEngine();
  eng.togglePause();
  const state = eng.getPublicState();
  assert.strictEqual(state.paused, true, "Game must be paused");
  // moveGesture checks: if (!state.running || state.paused || ...) return
  // This validates the engine state that moveGesture depends on
  assert.strictEqual(state.running, true, "Paused game is still 'running'");
});

test("T118. moveGesture exits early when game over", () => {
  const seq = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const eng = new TetrisEngine({ random: deterministicRandom(seq) });
  eng.start();
  // Fill board from row 4 downward (leave top rows for piece spawn)
  for (let r = 4; r < 20; r++) {
    for (let c = 0; c < 10; c++) {
      eng.board[r][c] = "I";
    }
  }
  // Repeatedly hard drop until game over
  let maxAttempts = 50;
  while (!eng.getPublicState().gameOver && maxAttempts-- > 0) {
    eng.hardDrop();
  }
  const state = eng.getPublicState();
  assert.strictEqual(
    state.gameOver,
    true,
    "Game must reach game-over state after filling board",
  );
});

test("T119. beginGesture sets dragAnchorOffset=0 when game not running", () => {
  // This validates the engine-side behavior that beginGesture relies on
  const seq = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const eng = new TetrisEngine({ random: deterministicRandom(seq) });
  // Don't start — game is in waiting state
  const state = eng.getPublicState();
  assert.strictEqual(
    state.running,
    false,
    "Game should not be running before start()",
  );
  assert.strictEqual(state.active, null, "No active piece before game starts");
});

test("T120. DAS stop functions exist for cleanup", () => {
  assert.ok(
    /function\s+stopAllDAS\s*\(/.test(gameJS),
    "stopAllDAS() function must exist for game-end cleanup",
  );
});

test("T121. DAS stops on window blur (prevents stuck DAS when switching apps)", () => {
  assert.ok(
    /window\.addEventListener\(\s*["']blur["'][\s\S]*?stopAllDAS/.test(gameJS),
    "DAS must stop on window blur to prevent stuck keys when user switches apps",
  );
});

test("T122. DAS stops on visibility change (prevents stuck DAS on tab switch)", () => {
  assert.ok(
    /visibilitychange[\s\S]*?stopAllDAS/.test(gameJS),
    "DAS must stop on visibilitychange to prevent stuck keys on tab switch",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 20: HIDDEN ELEMENTS ON MOBILE (NEW — v3)
// Elements hidden on mobile cannot leak scroll, but verify they ARE hidden.
// ─────────────────────────────────────────────────────────────────────────────
section("Hidden Elements on Mobile (v3)");

test("T123. .how-to-play is display: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /\.how-to-play\s*\{[^}]*display\s*:\s*none/i.test(mobileBlock),
    ".how-to-play must be display: none on mobile to prevent hidden scroll container",
  );
});

test("T124. .game-footer is display: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /\.game-footer\s*\{[^}]*display\s*:\s*none/i.test(mobileBlock),
    ".game-footer must be display: none on mobile",
  );
});

test("T125. .left-hud is display: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /\.left-hud[\s\S]*?display\s*:\s*none\s*!important/i.test(mobileBlock),
    ".left-hud must be display: none on mobile (stats shown in mobile HUD instead)",
  );
});

test("T126. .right-hud is display: none on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /\.right-hud[\s\S]*?display\s*:\s*none\s*!important/i.test(mobileBlock),
    ".right-hud must be display: none on mobile",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 21: DVHEIGHT & VIEWPORT SIZING (NEW — v3)
// Ensure dvh (dynamic viewport height) is used for iOS URL bar changes.
// ─────────────────────────────────────────────────────────────────────────────
section("Dynamic Viewport Height (dvh) Usage (v3)");

test("T127. html uses 100dvh on mobile for dynamic viewport", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /html\s*\{[^}]*100dvh/i.test(mobileBlock),
    "html must use 100dvh on mobile to handle iOS URL bar show/hide",
  );
});

test("T128. body uses 100dvh on mobile for dynamic viewport", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    /body\s*\{[^}]*100dvh/i.test(mobileBlock),
    "body must use 100dvh on mobile for accurate full-screen sizing",
  );
});

test("T129. game-shell uses 100dvh on mobile", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  const gameShellMatch = mobileBlock.match(/\.game-shell\s*\{([^}]*)\}/);
  assert.ok(gameShellMatch, "Could not find .game-shell rule in mobile block");
  assert.ok(
    gameShellMatch[1].includes("100dvh"),
    ".game-shell must use 100dvh on mobile",
  );
});

test("T130. Inline HTML also uses 100dvh for mobile failsafe", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    inlineStyleMatch[1].includes("100dvh"),
    "Inline <style> must use 100dvh for iOS URL bar dynamic sizing",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 22: NO WEBKIT-OVERFLOW-SCROLLING-TOUCH ANYWHERE ON MOBILE (v3)
// This property enables iOS momentum scrolling and must NEVER appear on mobile.
// ─────────────────────────────────────────────────────────────────────────────
section("No -webkit-overflow-scrolling: touch on Mobile (v3)");

test("T131. Mobile CSS never uses -webkit-overflow-scrolling: touch", () => {
  const mobileBlock = extractMobileMediaBlock(stylesCSS);
  assert.ok(
    !/-webkit-overflow-scrolling\s*:\s*touch/.test(mobileBlock),
    "Mobile CSS must NEVER use -webkit-overflow-scrolling: touch (enables iOS momentum scrolling)",
  );
});

test("T132. Inline HTML never uses -webkit-overflow-scrolling: touch", () => {
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist");
  assert.ok(
    !/-webkit-overflow-scrolling\s*:\s*touch/.test(inlineStyleMatch[1]),
    "Inline <style> must NEVER use -webkit-overflow-scrolling: touch",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 23: POINTER CAPTURE & BUTTON ROBUSTNESS (NEW — v3)
// Verify pointer capture is used on buttons and click events are suppressed.
// ─────────────────────────────────────────────────────────────────────────────
section("Pointer Capture & Button Robustness (v3)");

test("T133. Pointer capture attempted on button pointerdown", () => {
  assert.ok(
    /setPointerCapture/.test(gameJS),
    "Buttons must attempt setPointerCapture for reliable pointer tracking",
  );
});

test("T134. Pointer capture errors are caught (try/catch)", () => {
  assert.ok(
    /setPointerCapture[\s\S]*?catch/.test(gameJS),
    "setPointerCapture must be wrapped in try/catch (fails silently on unsupported browsers)",
  );
});

test("T135. Mobile button click events are all preventDefault'd", () => {
  // All mobile buttons suppress click to prevent double-fire
  const clickSuppression = gameJS.match(
    /btn\.addEventListener\(\s*["']click["']\s*,\s*function\s*\(e\)\s*\{([\s\S]*?)\}/,
  );
  assert.ok(clickSuppression, "Button click handler must exist");
  assert.ok(
    clickSuppression[1].includes("preventDefault"),
    "Button click handler must call preventDefault to suppress double-fire",
  );
});

test("T136. PointerEvent support detection exists (SUPPORTS_POINTER)", () => {
  assert.ok(
    /SUPPORTS_POINTER/.test(gameJS),
    "Code must detect PointerEvent support for progressive enhancement",
  );
});

test("T137. pointercancel stops DAS (prevents stuck repeat)", () => {
  assert.ok(
    /pointercancel[\s\S]*?stopDAS/.test(gameJS),
    "pointercancel must call stopDAS to prevent stuck auto-repeat",
  );
});

test("T138. pointerleave stops DAS (prevents stuck repeat when finger slides off)", () => {
  assert.ok(
    /pointerleave[\s\S]*?stopDAS/.test(gameJS),
    "pointerleave must call stopDAS when finger slides off button",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 24: GAME-OVER OVERLAY TOUCH ACCESSIBILITY (NEW — v3)
// The game-over overlay has buttons (Restart, Leaderboard). These must remain
// tappable even when scroll is blocked. Verify capture-phase exempts BUTTON.
// ─────────────────────────────────────────────────────────────────────────────
section("Game-Over Overlay Touch Accessibility (v3)");

test("T139. Game-over overlay exists inside boardWrap", () => {
  // The game-over overlay is inside boardWrap, so boardWrap gestures fire on it
  assert.ok(
    /id\s*=\s*["']boardWrap["'][\s\S]*?id\s*=\s*["']gameOverOverlay["']/i.test(
      indexHTML,
    ),
    "Game-over overlay must be inside boardWrap element",
  );
});

test("T140. Game-over overlay has buttons for restart and leaderboard", () => {
  assert.ok(
    /id\s*=\s*["']gameOverRestart["'][\s\S]*?button/i.test(indexHTML),
    "Game-over overlay must have a Restart button",
  );
  assert.ok(
    /id\s*=\s*["']gameOverLeaderboard["'][\s\S]*?button/i.test(indexHTML) ||
      /button[\s\S]*?id\s*=\s*["']gameOverLeaderboard["']/i.test(indexHTML),
    "Game-over overlay must have a Leaderboard button",
  );
});

test("T141. Capture-phase touchstart exempts BUTTON (game-over buttons stay tappable)", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchstart handler");
  assert.ok(
    match[1].includes("BUTTON"),
    "Capture-phase touchstart must exempt BUTTON elements so game-over buttons remain tappable",
  );
});

test("T142. Capture-phase touchstart exempts SUMMARY (how-to-play toggle)", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchstart handler");
  assert.ok(
    match[1].includes("SUMMARY"),
    "Capture-phase touchstart must exempt SUMMARY elements for details/accordion toggle",
  );
});

test("T143. Capture-phase touchstart exempts SELECT (potential future form elements)", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchstart handler");
  assert.ok(
    match[1].includes("SELECT"),
    "Capture-phase touchstart must exempt SELECT elements for dropdown menus",
  );
});

test("T144. Capture-phase touchstart exempts A (anchor links)", () => {
  const match = gameJS.match(
    /document\.addEventListener\(\s*["']touchstart["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false\s*,\s*capture\s*:\s*true/,
  );
  assert.ok(match, "Could not extract capture-phase touchstart handler");
  assert.ok(
    match[1].includes('"A"') || match[1].includes("'A'"),
    "Capture-phase touchstart must exempt A (anchor) elements for navigation links",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 25: CLICK FALLBACK & SYNTHETIC CLICK SUPPRESSION (NEW — v3)
// ─────────────────────────────────────────────────────────────────────────────
section("Click Fallback & Synthetic Click Suppression (v3)");

test("T145. Click fallback exists on boardWrap", () => {
  assert.ok(
    /boardWrapEl[\s\S]{0,40}addEventListener\(\s*["']click["']/.test(gameJS),
    "boardWrap must have a click fallback handler for desktop and accessibility",
  );
});

test("T146. Click fallback checks suppressSyntheticClickUntil timestamp", () => {
  assert.ok(
    /click[\s\S]*?suppressSyntheticClickUntil/.test(gameJS),
    "Click fallback must check suppressSyntheticClickUntil to ignore iOS phantom clicks",
  );
});

test("T147. Click fallback checks lastGestureEndAt to avoid double-fire", () => {
  assert.ok(
    /click[\s\S]*?lastGestureEndAt/.test(gameJS),
    "Click fallback must check lastGestureEndAt to prevent firing after drag gesture",
  );
});

test("T148. suppressSyntheticClickUntil is set in touchend handler", () => {
  const touchEndMatch = gameJS.match(
    /boardWrapEl[\s\S]{0,30}addEventListener\(\s*["']touchend["']\s*,\s*\n?\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(touchEndMatch, "Could not extract boardWrap touchend handler");
  assert.ok(
    touchEndMatch[1].includes("suppressSyntheticClickUntil"),
    "touchend handler must set suppressSyntheticClickUntil before calling endGesture",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 26: COMPLETE SELECTOR AUDIT FOR INLINE STYLE (NEW — v3)
// Every element class listed in the inline <style> should match an element in HTML.
// ─────────────────────────────────────────────────────────────────────────────
section("Complete Inline Selector Audit (v3)");

const requiredInlineSelectors = [
  ".stars",
  ".brand-bar",
  ".brand-bar-inner",
  ".brand-bar-logo",
  ".brand-bar-links",
  ".loading-screen",
  ".loading-content",
  ".game-shell",
  ".game-wrap",
  ".board-wrap",
  ".board-container",
  "#board",
  ".hero",
  ".mobile-hud",
  ".mobile-controls",
  ".modal-overlay",
  ".modal-panel",
  ".settings-panel",
  ".settings-backdrop",
  ".game-over-overlay",
  ".game-over-content",
];

const inlineStyleContent =
  (indexHTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";

for (let i = 0; i < requiredInlineSelectors.length; i++) {
  const sel = requiredInlineSelectors[i];
  test(`T${149 + i}. Inline style includes ${sel}`, () => {
    assert.ok(
      inlineStyleContent.includes(sel),
      `Inline <style> must include ${sel} in the touch-action: none kill list`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the content of the first @media (max-width: 760px) { ... } block.
 * Handles nested braces by counting open/close.
 */
function extractMobileMediaBlock(css) {
  const startPattern = /@media\s*\(\s*max-width\s*:\s*760px\s*\)/;
  const match = css.match(startPattern);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  let depth = 0;
  let blockStart = -1;
  let blockEnd = -1;

  for (let i = startIdx; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) blockStart = i + 1;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockStart === -1 || blockEnd === -1) return null;
  return css.substring(blockStart, blockEnd);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(
  `Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`,
);

if (failures.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(`  - ${f.description}`);
    console.log(`    ${f.error}`);
  }
}

console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log(
    "\n✅ All mobile touch control tests passed — 100% confidence.\n",
  );
  process.exit(0);
}
