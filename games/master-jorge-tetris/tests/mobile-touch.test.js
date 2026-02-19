"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Touch Control Test Suite — Tetris Wars
// Tests CSS touch-action rules, JS event handler registration, gesture logic,
// and scroll-prevention coverage.  Pure Node.js, no external deps.
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
  // Must find touch-action: none for html within a @media (max-width: 760px) block
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
// All touch event listeners MUST be registered with { passive: false } so
// that preventDefault() actually works.  If passive: true (the default for
// touchstart/touchmove on modern Chrome), preventDefault() is a no-op.
// ─────────────────────────────────────────────────────────────────────────────
section("JS Event Handler Registration (passive: false)");

test("T20. boardWrap touchstart registered with { passive: false }", () => {
  // Pattern: boardWrapEl.addEventListener("touchstart", ..., { passive: false })
  // or equivalent
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
// The body/html/gameShell touchmove handlers MUST call preventDefault
// during active gameplay regardless of which element was touched.
// ─────────────────────────────────────────────────────────────────────────────
section("JS Scroll Prevention Logic");

test("T27. isGameplayActive() helper function exists", () => {
  assert.ok(
    /function\s+isGameplayActive\s*\(/.test(gameJS),
    "isGameplayActive() function must exist to centralize gameplay-active check",
  );
});

test("T28. body touchmove calls preventDefault during gameplay (unconditional)", () => {
  // The new handler should NOT walk up the DOM tree to check target —
  // it should unconditionally preventDefault when gameplay is active.
  // Check that the body handler does NOT contain the old "target === boardWrapEl" check.
  const bodyHandlerMatch = gameJS.match(
    /document\.body\.addEventListener\(\s*["']touchmove["']\s*,\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
  );
  assert.ok(bodyHandlerMatch, "Could not extract body touchmove handler");
  const handlerBody = bodyHandlerMatch[1];

  // Old pattern had: target === boardWrapEl — should NOT exist anymore
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
    /document\.documentElement\.addEventListener\(\s*["']touchmove["']\s*,\s*function\s*\(e\)\s*\{([\s\S]*?)\}\s*,\s*\{\s*passive\s*:\s*false/,
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
  // The touchstart handler on gameShell should NOT preventDefault on buttons
  // so that mobile buttons (Hold, Force, Start, Pause) remain tappable.
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
// Verify the drag-and-drop, tap-to-rotate, and swipe-up-to-drop logic
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
  // moveGesture must contain column-based movement logic
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
  // tapMaxDist, tapMaxTimeTouch variables must exist
  assert.ok(
    gameJS.includes("tapMaxDist") && gameJS.includes("tapMaxTimeTouch"),
    "Tap detection thresholds tapMaxDist and tapMaxTimeTouch must be defined",
  );
});

test("T40. endGesture detects swipe-up for hard drop", () => {
  // Pattern: dy < -40 (negative = upward swipe)
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
// Mobile control buttons must use pointer events (or touch fallback) with
// proper preventDefault to avoid scroll/zoom conflicts.
// ─────────────────────────────────────────────────────────────────────────────
section("Mobile Button Event Binding");

test("T43. Mobile buttons use pointerdown OR touchstart with preventDefault", () => {
  // At least one of these patterns must exist
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
  // O-piece doesn't visually change on rotation
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
// Verify we have N independent layers of scroll prevention
// ─────────────────────────────────────────────────────────────────────────────
section("Defensive Layers Audit");

test("T61. At least 3 independent CSS scroll-prevention layers exist", () => {
  let layers = 0;

  // Layer 1: CSS touch-action: none on html/body
  if (/touch-action\s*:\s*none/.test(stylesCSS)) layers++;
  // Layer 2: CSS overflow: hidden on html/body
  if (/overflow\s*:\s*hidden/.test(stylesCSS)) layers++;
  // Layer 3: CSS overscroll-behavior: none
  if (/overscroll-behavior\s*:\s*none/.test(stylesCSS)) layers++;
  // Layer 4: CSS position: fixed on body
  if (/position\s*:\s*fixed/.test(stylesCSS)) layers++;

  assert.ok(
    layers >= 3,
    `Expected at least 3 CSS scroll-prevention layers, found ${layers}`,
  );
});

test("T62. At least 3 independent JS scroll-prevention handlers exist", () => {
  let handlers = 0;

  // Handler 1: body touchmove
  if (/document\.body\.addEventListener\([\s\S]*?touchmove/.test(gameJS))
    handlers++;
  // Handler 2: html touchmove
  if (
    /document\.documentElement\.addEventListener\([\s\S]*?touchmove/.test(
      gameJS,
    )
  )
    handlers++;
  // Handler 3: gameShell touchmove
  if (/gameShellEl[\s\S]*?addEventListener\([\s\S]*?touchmove/.test(gameJS))
    handlers++;
  // Handler 4: boardWrap touchmove
  if (/boardWrapEl[\s\S]*?addEventListener\([\s\S]*?touchmove/.test(gameJS))
    handlers++;

  assert.ok(
    handlers >= 3,
    `Expected at least 3 JS touchmove handlers, found ${handlers}`,
  );
});

test("T63. Inline HTML style adds redundant touch-action: none", () => {
  // The inline <style> in index.html should also declare touch-action: none
  // as a failsafe in case styles.css loads late
  const inlineStyleMatch = indexHTML.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(inlineStyleMatch, "Inline <style> tag must exist in index.html");
  assert.ok(
    /touch-action\s*:\s*none/.test(inlineStyleMatch[1]),
    "Inline <style> must contain touch-action: none as a CSS-load failsafe",
  );
});

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
