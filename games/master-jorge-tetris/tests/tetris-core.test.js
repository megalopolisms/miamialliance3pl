"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness — pure Node.js, no external deps
// ─────────────────────────────────────────────────────────────────────────────
const assert = require("node:assert");
const path = require("node:path");

const TetrisCore = require(path.resolve(__dirname, "../tetris-core.js"));

const {
  BOARD_COLS,
  BOARD_ROWS,
  PIECE_TYPES,
  SHAPES,
  LINE_SCORE,
  createEmptyBoard,
  cloneMatrix,
  rotateMatrix,
  TetrisEngine,
} = TetrisCore;

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return a deterministic random function cycling through a fixed sequence. */
function deterministicRandom(sequence) {
  let idx = 0;
  return () => {
    const val = sequence[idx % sequence.length];
    idx++;
    return val;
  };
}

/**
 * Build a fresh engine in "running" state with one active piece already
 * spawned. Uses a deterministic random so tests are reproducible.
 */
function freshEngine(options = {}) {
  // Cycle through 0.0..0.9 deterministically so all bag shuffles are stable.
  const seq = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const eng = new TetrisEngine({
    random: deterministicRandom(seq),
    ...options,
  });
  eng.start();
  return eng;
}

/**
 * Fill every cell in a given row on the engine's board with a piece type so
 * that the row will be cleared on the next lockPiece() call.
 */
function fillRow(engine, rowIndex, type = "I") {
  for (let col = 0; col < engine.cols; col++) {
    engine.board[rowIndex][col] = type;
  }
}

/**
 * Fill N rows from the bottom, leaving one empty column so the row is NOT
 * yet full (useful for setting up partial boards).
 */
function fillRowPartial(engine, rowIndex, type = "I", gapCol = 0) {
  for (let col = 0; col < engine.cols; col++) {
    if (col !== gapCol) {
      engine.board[rowIndex][col] = type;
    }
  }
}

/**
 * Fill every row in the board completely — used to trigger game-over on spawn.
 */
function fillBoard(engine) {
  for (let row = 0; row < engine.rows; row++) {
    for (let col = 0; col < engine.cols; col++) {
      engine.board[row][col] = "I";
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARD TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Board Tests");

test("1. createEmptyBoard returns correct row count", () => {
  const board = createEmptyBoard();
  assert.strictEqual(board.length, BOARD_ROWS);
});

test("2. createEmptyBoard returns correct column count per row", () => {
  const board = createEmptyBoard();
  for (const row of board) {
    assert.strictEqual(row.length, BOARD_COLS);
  }
});

test("3. Board cells initialized to null", () => {
  const board = createEmptyBoard();
  for (const row of board) {
    for (const cell of row) {
      assert.strictEqual(cell, null);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PIECE TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Piece Tests");

test("4. All 7 piece types exist (I, J, L, O, S, T, Z)", () => {
  const expected = ["I", "J", "L", "O", "S", "T", "Z"];
  for (const t of expected) {
    assert.ok(PIECE_TYPES.includes(t), `Missing piece type: ${t}`);
  }
  assert.strictEqual(PIECE_TYPES.length, 7);
});

test("5. Each piece has a valid shape matrix (non-empty 2-D array)", () => {
  for (const type of PIECE_TYPES) {
    const shape = SHAPES[type];
    assert.ok(
      Array.isArray(shape) && shape.length > 0,
      `${type}: shape is not a non-empty array`,
    );
    for (const row of shape) {
      assert.ok(
        Array.isArray(row) && row.length > 0,
        `${type}: row is not a non-empty array`,
      );
    }
  }
});

test("6. cloneMatrix creates independent copy", () => {
  const original = [
    [1, 0],
    [0, 1],
  ];
  const clone = cloneMatrix(original);

  // Values match
  assert.deepStrictEqual(clone, original);

  // Mutation of clone does not affect original
  clone[0][0] = 99;
  assert.strictEqual(original[0][0], 1, "Original was mutated by clone change");
});

test("7. rotateMatrix CW produces correct result for a 3×3", () => {
  // [[1,2,3],[4,5,6],[7,8,9]] rotated CW once:
  //   col 0 bottom-to-top → new row 0: 7,4,1
  //   col 1 bottom-to-top → new row 1: 8,5,2
  //   col 2 bottom-to-top → new row 2: 9,6,3
  const m = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  const rotated = rotateMatrix(m, 1);
  assert.deepStrictEqual(rotated, [
    [7, 4, 1],
    [8, 5, 2],
    [9, 6, 3],
  ]);
});

test("8. rotateMatrix CCW produces correct result for a 3×3", () => {
  // [[1,2,3],[4,5,6],[7,8,9]] rotated CCW once:
  //   col 2 top-to-bottom → new row 0: 3,6,9
  //   col 1 top-to-bottom → new row 1: 2,5,8
  //   col 0 top-to-bottom → new row 2: 1,4,7
  const m = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  const rotated = rotateMatrix(m, -1);
  assert.deepStrictEqual(rotated, [
    [3, 6, 9],
    [2, 5, 8],
    [1, 4, 7],
  ]);
});

test("9. rotateMatrix CW 4 times returns original", () => {
  const m = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  let result = m;
  for (let i = 0; i < 4; i++) {
    result = rotateMatrix(result, 1);
  }
  assert.deepStrictEqual(result, m);
});

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE INITIALIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Engine Initialization Tests");

test("10. New engine starts in waiting state", () => {
  const eng = new TetrisEngine();
  assert.strictEqual(eng.status, "waiting");
  assert.strictEqual(eng.running, false);
});

test("11. start() sets running to true", () => {
  const eng = new TetrisEngine();
  eng.start();
  assert.strictEqual(eng.running, true);
  assert.strictEqual(eng.status, "running");
});

test("12. start() spawns an active piece", () => {
  const eng = new TetrisEngine();
  eng.start();
  assert.ok(
    eng.active !== null,
    "active piece should not be null after start()",
  );
  assert.ok(typeof eng.active.type === "string");
  assert.ok(Array.isArray(eng.active.matrix));
});

test("13. reset() clears score, lines, level back to defaults", () => {
  const eng = freshEngine();
  // Artificially inflate stats
  eng.score = 9999;
  eng.lines = 50;
  eng.level = 6;

  eng.reset();

  assert.strictEqual(eng.score, 0);
  assert.strictEqual(eng.lines, 0);
  assert.strictEqual(eng.level, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// MOVEMENT TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Movement Tests");

test("14. move(-1) moves piece left by 1", () => {
  const eng = freshEngine();
  const before = eng.active.x;
  const result = eng.move(-1);
  assert.strictEqual(result, true);
  assert.strictEqual(eng.active.x, before - 1);
});

test("15. move(1) moves piece right by 1", () => {
  const eng = freshEngine();
  const before = eng.active.x;
  const result = eng.move(1);
  assert.strictEqual(result, true);
  assert.strictEqual(eng.active.x, before + 1);
});

test("16. move blocked by left wall — x stays the same", () => {
  const eng = freshEngine();
  // Push piece all the way to the left wall
  for (let i = 0; i < 20; i++) {
    eng.move(-1);
  }
  const atWall = eng.active.x;
  const result = eng.move(-1);
  assert.strictEqual(
    result,
    false,
    "move(-1) should return false at left wall",
  );
  assert.strictEqual(
    eng.active.x,
    atWall,
    "x should not change when blocked by left wall",
  );
});

test("17. move blocked by right wall — x stays the same", () => {
  const eng = freshEngine();
  // Push piece all the way to the right wall
  for (let i = 0; i < 20; i++) {
    eng.move(1);
  }
  const atWall = eng.active.x;
  const result = eng.move(1);
  assert.strictEqual(
    result,
    false,
    "move(1) should return false at right wall",
  );
  assert.strictEqual(
    eng.active.x,
    atWall,
    "x should not change when blocked by right wall",
  );
});

test("18. softDrop moves piece down by 1 when space is available", () => {
  const eng = freshEngine();
  const beforeY = eng.active.y;
  const result = eng.softDrop();
  // softDrop returns { moved: true, locked: false } when able to drop
  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.locked, false);
  assert.strictEqual(eng.active.y, beforeY + 1);
});

test("19. hardDrop drops piece to bottom (returns locked: true)", () => {
  const eng = freshEngine();
  const result = eng.hardDrop();
  assert.strictEqual(result.locked, true);
  assert.ok(result.distance >= 0, "distance should be non-negative");
  // After hard drop a new piece is spawned (active could be new piece or null if game over)
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Rotation Tests");

test("20. rotate(1) clockwise changes the piece matrix", () => {
  const eng = freshEngine();
  const before = eng.active.matrix.map((r) => r.slice());
  eng.rotate(1);
  const after = eng.active.matrix;
  // For pieces that are not rotationally symmetric (not O), the matrix should change
  // O-piece rotation returns a "rotated" matrix that is deepEqual — skip that case
  const originalDeep = JSON.stringify(before);
  const afterDeep = JSON.stringify(after);
  if (eng.active.type !== "O") {
    assert.notStrictEqual(
      originalDeep,
      afterDeep,
      "Matrix should change after CW rotation",
    );
  }
  // For O-piece the test is that rotate() returned a truthy value (it succeeds)
});

test("21. rotate(-1) counter-clockwise changes the piece matrix", () => {
  const eng = freshEngine();
  const before = eng.active.matrix.map((r) => r.slice());
  eng.rotate(-1);
  const after = eng.active.matrix;
  if (eng.active.type !== "O") {
    assert.notStrictEqual(JSON.stringify(before), JSON.stringify(after));
  }
});

test("22. rotate blocked when no space — returns false when jammed", () => {
  // Pack the piece against both walls so all kick offsets fail.
  // Use an I-piece (4-wide), position it so the 4-wide rotated form (4-tall) cannot fit.
  const eng = new TetrisEngine({ random: () => 0 });
  // Force-seed with an I piece by overriding queue and bag
  eng.start();

  // Force active to be I-piece at a position where rotation is blocked
  // Place it at x=0 and fill columns 2..9 on the rows above so kicks fail
  // Simpler: fill the board so that every kick offset is blocked

  // Give the engine a vertical I-piece (rotated once) pressed against the left wall
  // then fill the board cells that would absorb the rotations
  // Actually just verify that rotate returns false in some contrived case.
  // The safest approach: set up a specific piece & board state.
  eng.active = {
    type: "I",
    matrix: [[1], [1], [1], [1]], // vertical I-piece
    x: 0,
    y: 0,
  };
  // Block every column that horizontal rotation would need (cols 0-3 at rows 0-3)
  for (let row = 0; row < 4; row++) {
    for (let col = 1; col < 5; col++) {
      eng.board[row][col] = "J";
    }
  }
  // Try rotating — all kick offsets [0,-1,1,-2,2] should be blocked
  const result = eng.rotate(1);
  assert.strictEqual(
    result,
    false,
    "rotate() should return false when all kicks are blocked",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE CLEAR TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Line Clear Tests");

test("23. Full row gets cleared", () => {
  const eng = freshEngine();
  // Fill rows 18 and 19 completely except we need to clear them via lockPiece
  // Simplest: fill rows and call clearLines directly
  fillRow(eng, 19);
  const clearedRows = eng.clearLines();
  assert.strictEqual(clearedRows.length, 1, "One full row should be cleared");
});

test("24. Score increases on line clear", () => {
  const eng = freshEngine();
  const beforeScore = eng.score;

  // Fill 9 rows leaving a gap in each (partial), then fill the last row fully
  // But simpler: call applyLineClear directly
  eng.applyLineClear(1);
  assert.ok(
    eng.score > beforeScore,
    "Score should increase after single line clear",
  );
});

test("25. Level increases every 10 lines", () => {
  const eng = freshEngine();
  assert.strictEqual(eng.level, 1);

  // Simulate 10 line clears
  eng.applyLineClear(1); // lines: 1
  eng.applyLineClear(1); // 2
  eng.applyLineClear(1); // 3
  eng.applyLineClear(1); // 4
  eng.applyLineClear(1); // 5
  eng.applyLineClear(1); // 6
  eng.applyLineClear(1); // 7
  eng.applyLineClear(1); // 8
  eng.applyLineClear(1); // 9
  assert.strictEqual(eng.level, 1, "Level should still be 1 at 9 lines");
  eng.applyLineClear(1); // 10
  assert.strictEqual(eng.level, 2, "Level should be 2 after 10 lines");
});

test("26. Double line clear (2 lines) scores correctly at level 1", () => {
  const eng = freshEngine();
  eng.applyLineClear(2);
  // LINE_SCORE[2] = 300, level = 1, no combo yet
  assert.strictEqual(
    eng.score,
    LINE_SCORE[2] * 1,
    "Double clear should add 300 points at level 1",
  );
});

test("27. Tetris (4 lines) scores correctly at level 1", () => {
  const eng = freshEngine();
  eng.applyLineClear(4);
  // LINE_SCORE[4] = 800, level = 1, no combo
  assert.strictEqual(
    eng.score,
    LINE_SCORE[4] * 1,
    "Tetris should add 800 points at level 1",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HOLD TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Hold Tests");

test("28. holdPiece stores current piece into holdType", () => {
  const eng = freshEngine();
  const activeType = eng.active.type;
  eng.holdPiece();
  assert.strictEqual(
    eng.holdType,
    activeType,
    "holdType should be the piece that was active",
  );
});

test("29. holdPiece swaps with held piece on second call", () => {
  const eng = freshEngine();
  const firstType = eng.active.type;

  // First hold: stash firstType, spawn next from queue
  eng.holdPiece();
  const secondType = eng.active.type;

  // Re-enable hold (normally re-enabled on lock, but we set it manually for test)
  eng.canHold = true;

  // Second hold: swap secondType into hold, get firstType back as active
  eng.holdPiece();
  assert.strictEqual(
    eng.active.type,
    firstType,
    "Active should be the first held piece after swap",
  );
  assert.strictEqual(
    eng.holdType,
    secondType,
    "Hold slot should now contain the second piece",
  );
});

test("30. Cannot hold twice without placing (canHold is false after hold)", () => {
  const eng = freshEngine();
  eng.holdPiece();
  // canHold should now be false
  assert.strictEqual(
    eng.canHold,
    false,
    "canHold should be false after one hold",
  );

  // Second hold attempt should return false
  const result = eng.holdPiece();
  assert.strictEqual(
    result,
    false,
    "holdPiece() should return false when canHold is false",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMBO TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Combo Tests");

test("31. Consecutive clears increase combo counter", () => {
  const eng = freshEngine();
  // combo starts at -1; first clear brings it to 0, second to 1, etc.
  assert.strictEqual(eng.combo, -1);
  eng.applyLineClear(1); // combo → 0
  assert.strictEqual(eng.combo, 0);
  eng.applyLineClear(1); // combo → 1
  assert.strictEqual(eng.combo, 1);
  eng.applyLineClear(1); // combo → 2
  assert.strictEqual(eng.combo, 2);
});

test("32. Missing a clear (0 lines) resets combo to -1", () => {
  const eng = freshEngine();
  eng.applyLineClear(1); // combo → 0
  eng.applyLineClear(1); // combo → 1
  eng.applyLineClear(0); // no clear — combo resets
  assert.strictEqual(
    eng.combo,
    -1,
    "Combo should reset to -1 when no lines cleared",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FORCE BLAST TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Force Blast Tests");

test("33. Force meter starts at 0", () => {
  const eng = freshEngine();
  assert.strictEqual(eng.forceMeter, 0);
  assert.strictEqual(eng.forceReady, false);
});

test("34. Force meter charges on line clear (addForce called)", () => {
  const eng = freshEngine();
  eng.applyLineClear(1); // triggers addForce internally
  assert.ok(eng.forceMeter > 0, "Force meter should be > 0 after a line clear");
});

test("35. Force activates when meter is at 100 (forceReady = true)", () => {
  const eng = freshEngine();
  eng.forceMeter = 0;
  eng.forceReady = false;
  eng.addForce(100);
  assert.strictEqual(eng.forceMeter, 100);
  assert.strictEqual(eng.forceReady, true);
});

test("36. activateForce returns used: false when meter below 100", () => {
  const eng = freshEngine();
  eng.forceMeter = 50;
  eng.forceReady = false;
  const result = eng.activateForce();
  assert.strictEqual(
    result.used,
    false,
    "Force should not activate when not ready",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MODE TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Mode Tests");

test("37. Default mode is standard", () => {
  const eng = new TetrisEngine();
  assert.strictEqual(eng.mode, "standard");
});

test("38. setMode('empire') changes mode to empire", () => {
  const eng = new TetrisEngine();
  eng.setMode("empire");
  assert.strictEqual(eng.mode, "empire");
});

test("39. Empire mode has faster (lower) drop interval than standard", () => {
  const engStd = new TetrisEngine({ mode: "standard" });
  engStd.start();
  const engEmp = new TetrisEngine({ mode: "empire" });
  engEmp.start();

  const stdInterval = engStd.getDropInterval();
  const empInterval = engEmp.getDropInterval();
  assert.ok(
    empInterval < stdInterval,
    `Empire interval (${empInterval}) should be less than standard (${stdInterval})`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 7-BAG RANDOMIZER TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("7-Bag Randomizer Tests");

test("40. All 7 piece types appear before any repeat in the queue", () => {
  // Use a fresh engine WITHOUT calling start() so that no piece has been
  // consumed from the first bag yet.  reset() (called inside the constructor)
  // calls ensureQueue(5) which draws from bag 1.  We then call nextType()
  // exactly 7 times to drain all of bag 1 — every type must appear exactly once.
  const eng = new TetrisEngine();
  // At this point the constructor called reset() → ensureQueue(5).
  // The queue holds 5 items from bag 1; bag still has the remaining 2 of bag 1.

  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const type = eng.nextType();
    seen.add(type);
  }
  assert.strictEqual(
    seen.size,
    7,
    `All 7 piece types should appear in first bag, got: ${[...seen].join(",")}`,
  );
});

test("41. Queue always has at least 5 pieces after ensureQueue", () => {
  const eng = new TetrisEngine();
  eng.ensureQueue(5);
  assert.ok(
    eng.queue.length >= 5,
    `Queue length should be >= 5, got ${eng.queue.length}`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GAME OVER TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Game Over Tests");

test("42. Game over when piece cannot spawn (board full)", () => {
  const eng = freshEngine();

  // Fill the board so the next spawn will collide
  fillBoard(eng);

  // Null out active and attempt spawn
  eng.active = null;
  const spawned = eng.spawnPiece();

  assert.strictEqual(
    spawned,
    false,
    "spawnPiece should return false on filled board",
  );
  assert.strictEqual(eng.gameOver, true, "gameOver should be true");
  assert.strictEqual(eng.status, "defeat", "status should be defeat");
  assert.strictEqual(
    eng.running,
    false,
    "running should be false after game over",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC STATE TESTS
// ─────────────────────────────────────────────────────────────────────────────
section("Public State Tests");

test("43. getPublicState returns all expected fields", () => {
  const eng = freshEngine();
  const state = eng.getPublicState();

  const expectedFields = [
    "board",
    "active",
    "ghost",
    "queue",
    "holdType",
    "canHold",
    "score",
    "lines",
    "level",
    "combo",
    "backToBack",
    "forceMeter",
    "forceReady",
    "forceUses",
    "rank",
    "mode",
    "running",
    "paused",
    "gameOver",
    "status",
    "dropInterval",
  ];

  for (const field of expectedFields) {
    assert.ok(field in state, `getPublicState() missing field: ${field}`);
  }
});

test("44. State board is a copy, not the same reference", () => {
  const eng = freshEngine();
  const state = eng.getPublicState();

  // Mutate the returned board
  state.board[0][0] = "Z";

  // The engine's internal board should not be affected
  assert.strictEqual(
    eng.board[0][0],
    null,
    "Mutating returned board should not affect internal board",
  );
});

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
  console.log("\nAll tests passed.");
  process.exit(0);
}
