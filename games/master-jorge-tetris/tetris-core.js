(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    globalScope.TetrisCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const BOARD_COLS = 10;
  const BOARD_ROWS = 20;

  const COLORS = {
    I: "#6be6ff",
    J: "#6c8dff",
    L: "#ff9f43",
    O: "#fce96a",
    S: "#67e79d",
    T: "#d38bff",
    Z: "#ff7171",
  };

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  };

  const PIECE_TYPES = Object.keys(SHAPES);
  const LINE_SCORE = {
    1: 100,
    2: 300,
    3: 500,
    4: 800,
  };

  // SRS Wall Kick Data — offsets to test for each rotation transition.
  // Keys: "fromState>toState", values: array of [dx, dy] kick offsets.
  // JLSTZ pieces (all except I and O)
  const WALL_KICKS_JLSTZ = {
    "0>1": [
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, 2],
      [-1, 2],
    ],
    "1>0": [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, -2],
      [1, -2],
    ],
    "1>2": [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, -2],
      [1, -2],
    ],
    "2>1": [
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, 2],
      [-1, 2],
    ],
    "2>3": [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 2],
      [1, 2],
    ],
    "3>2": [
      [0, 0],
      [-1, 0],
      [-1, 1],
      [0, -2],
      [-1, -2],
    ],
    "3>0": [
      [0, 0],
      [-1, 0],
      [-1, 1],
      [0, -2],
      [-1, -2],
    ],
    "0>3": [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 2],
      [1, 2],
    ],
  };

  // I-piece specific wall kick data
  const WALL_KICKS_I = {
    "0>1": [
      [0, 0],
      [-2, 0],
      [1, 0],
      [-2, 1],
      [1, -2],
    ],
    "1>0": [
      [0, 0],
      [2, 0],
      [-1, 0],
      [2, -1],
      [-1, 2],
    ],
    "1>2": [
      [0, 0],
      [-1, 0],
      [2, 0],
      [-1, -2],
      [2, 1],
    ],
    "2>1": [
      [0, 0],
      [1, 0],
      [-2, 0],
      [1, 2],
      [-2, -1],
    ],
    "2>3": [
      [0, 0],
      [2, 0],
      [-1, 0],
      [2, -1],
      [-1, 2],
    ],
    "3>2": [
      [0, 0],
      [-2, 0],
      [1, 0],
      [-2, 1],
      [1, -2],
    ],
    "3>0": [
      [0, 0],
      [1, 0],
      [-2, 0],
      [1, 2],
      [-2, -1],
    ],
    "0>3": [
      [0, 0],
      [-1, 0],
      [2, 0],
      [-1, -2],
      [2, 1],
    ],
  };

  // NES-style speed curve (milliseconds per drop)
  const SPEED_CURVE = [
    800, // Level 1
    717, // Level 2
    633, // Level 3
    550, // Level 4
    467, // Level 5
    383, // Level 6
    300, // Level 7
    217, // Level 8
    133, // Level 9
    100, // Level 10
    83, // Level 11
    83, // Level 12
    83, // Level 13
    67, // Level 14
    67, // Level 15
    67, // Level 16
    50, // Level 17
    50, // Level 18
    33, // Level 19
    33, // Level 20
  ];

  // Lock delay constants
  const LOCK_DELAY_MS = 500;
  const LOCK_DELAY_MAX_RESETS = 15;

  function createEmptyBoard(rows = BOARD_ROWS, cols = BOARD_COLS) {
    return Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function rotateMatrix(matrix, direction = 1) {
    const height = matrix.length;
    const width = matrix[0].length;
    const rotated = Array.from({ length: width }, () => Array(height).fill(0));

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (direction > 0) {
          rotated[x][height - 1 - y] = matrix[y][x];
        } else {
          rotated[width - 1 - x][y] = matrix[y][x];
        }
      }
    }

    return rotated;
  }

  function shuffleBag(items, randomFn) {
    const bag = items.slice();
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomFn() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    return bag;
  }

  class TetrisEngine {
    constructor(options = {}) {
      this.cols = options.cols || BOARD_COLS;
      this.rows = options.rows || BOARD_ROWS;
      this.random =
        typeof options.random === "function" ? options.random : Math.random;
      this.mode = options.mode === "empire" ? "empire" : "standard";
      this.reset();
    }

    reset() {
      this.board = createEmptyBoard(this.rows, this.cols);
      this.queue = [];
      this.bag = [];
      this.active = null;
      this.holdType = null;
      this.canHold = true;

      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.combo = -1;
      this.backToBack = false;
      this.lastClear = 0;
      this.lastComboBonus = 0;
      this.lastBackToBackBonus = 0;
      this.totalClearedLines = 0;

      this.forceMeter = 0;
      this.forceReady = false;
      this.forceUses = 0;

      // Lock delay state
      this.lockDelayActive = false;
      this.lockDelayTimer = 0;
      this.lockDelayMoveResets = 0;

      // T-spin state
      this.tSpinType = null;
      this.lastActionWasRotation = false;

      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.status = "waiting";
      this.gravityMs = 0;
      this.events = [];
      this.dirty = true;

      this.ensureQueue(5);
    }

    start(mode) {
      if (mode) {
        this.mode = mode === "empire" ? "empire" : "standard";
      }

      this.reset();
      this.running = true;
      this.status = "running";
      this.spawnPiece();
      this.emit(
        this.mode === "empire"
          ? "Empire Assault mode engaged. Fast lanes and no mercy."
          : "Alliance Standard mode online. Precision wins this battle.",
      );
      return this.getPublicState();
    }

    setMode(mode) {
      this.mode = mode === "empire" ? "empire" : "standard";
      this.emit(
        this.mode === "empire"
          ? "Next mission mode: Empire Assault"
          : "Next mission mode: Alliance Standard",
      );
      this.dirty = true;
      return this.mode;
    }

    ensureQueue(size = 5) {
      while (this.queue.length < size) {
        if (this.bag.length === 0) {
          this.bag = shuffleBag(PIECE_TYPES, this.random);
        }
        this.queue.push(this.bag.pop());
      }
    }

    nextType() {
      this.ensureQueue(1);
      const type = this.queue.shift();
      this.ensureQueue(5);
      return type;
    }

    createPiece(type) {
      const matrix = cloneMatrix(SHAPES[type]);
      const topPadding = this.getTopPadding(matrix);
      return {
        type,
        matrix,
        x: Math.floor((this.cols - matrix[0].length) / 2),
        y: -topPadding,
        rotationState: 0,
      };
    }

    getTopPadding(matrix) {
      let top = 0;
      while (top < matrix.length && matrix[top].every((cell) => !cell)) {
        top += 1;
      }
      return top;
    }

    spawnPiece(type = this.nextType()) {
      this.active = this.createPiece(type);
      this.lockDelayActive = false;
      this.lockDelayTimer = 0;
      this.lockDelayMoveResets = 0;
      this.lastActionWasRotation = false;
      this.dirty = true;

      if (this.collides(this.active)) {
        this.running = false;
        this.gameOver = true;
        this.status = "defeat";
        this.emit("Mission failed. The fleet was overrun.");
        return false;
      }

      return true;
    }

    collides(
      piece,
      matrix = piece.matrix,
      x = piece.x,
      y = piece.y,
      board = this.board,
    ) {
      for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < matrix[row].length; col += 1) {
          if (!matrix[row][col]) {
            continue;
          }

          const boardX = x + col;
          const boardY = y + row;

          if (boardX < 0 || boardX >= this.cols || boardY >= this.rows) {
            return true;
          }

          if (boardY >= 0 && board[boardY][boardX]) {
            return true;
          }
        }
      }

      return false;
    }

    canAct() {
      return this.running && !this.paused && !this.gameOver && !!this.active;
    }

    move(dx) {
      if (!this.canAct()) {
        return false;
      }

      this.active.x += dx;
      if (this.collides(this.active)) {
        this.active.x -= dx;
        return false;
      }

      this.lastActionWasRotation = false;
      this.dirty = true;

      // Reset lock delay if active
      if (
        this.lockDelayActive &&
        this.lockDelayMoveResets < LOCK_DELAY_MAX_RESETS
      ) {
        this.lockDelayTimer = LOCK_DELAY_MS;
        this.lockDelayMoveResets += 1;
      }

      return true;
    }

    softDrop() {
      if (!this.canAct()) {
        return { moved: false, locked: false };
      }

      this.active.y += 1;
      if (this.collides(this.active)) {
        this.active.y -= 1;
        // Activate lock delay instead of locking immediately
        if (!this.lockDelayActive) {
          this.lockDelayActive = true;
          this.lockDelayTimer = LOCK_DELAY_MS;
          this.lockDelayMoveResets = 0;
        }
        return { moved: false, locked: false };
      }

      this.lastActionWasRotation = false;
      // If piece moved down, it's no longer on a surface — deactivate lock delay
      this.lockDelayActive = false;
      this.lockDelayTimer = 0;
      this.lockDelayMoveResets = 0;

      this.score += 1;
      this.addForce(0.5);
      this.gravityMs = 0;
      this.dirty = true;
      return { moved: true, locked: false };
    }

    hardDrop() {
      if (!this.canAct()) {
        return { distance: 0, locked: false };
      }

      let distance = 0;
      while (true) {
        this.active.y += 1;
        if (this.collides(this.active)) {
          this.active.y -= 1;
          break;
        }
        distance += 1;
      }

      if (distance > 0) {
        this.score += distance * 2;
        this.addForce(distance * 0.9);
      }

      const lockResult = this.lockPiece();
      return { distance, locked: true, ...lockResult };
    }

    rotate(direction = 1) {
      if (!this.canAct()) {
        return false;
      }

      const pieceType = this.active.type;

      // O-piece doesn't rotate
      if (pieceType === "O") {
        return false;
      }

      const originalMatrix = this.active.matrix;
      const rotated = rotateMatrix(originalMatrix, direction);
      const fromState = this.active.rotationState;
      const toState = (fromState + (direction > 0 ? 1 : 3)) % 4;
      const kickKey = fromState + ">" + toState;

      // Select kick table based on piece type
      let kickTable;
      if (pieceType === "I") {
        kickTable = WALL_KICKS_I[kickKey];
      } else {
        kickTable = WALL_KICKS_JLSTZ[kickKey];
      }

      // Fallback to simple kicks if key not found (shouldn't happen)
      if (!kickTable) {
        kickTable = [
          [0, 0],
          [-1, 0],
          [1, 0],
          [-2, 0],
          [2, 0],
        ];
      }

      for (const kick of kickTable) {
        const nextX = this.active.x + kick[0];
        const nextY = this.active.y - kick[1]; // SRS y-axis is inverted from board coords
        if (!this.collides(this.active, rotated, nextX, nextY)) {
          this.active.matrix = rotated;
          this.active.x = nextX;
          this.active.y = nextY;
          this.active.rotationState = toState;
          this.lastActionWasRotation = true;
          this.dirty = true;

          // Reset lock delay if active
          if (
            this.lockDelayActive &&
            this.lockDelayMoveResets < LOCK_DELAY_MAX_RESETS
          ) {
            this.lockDelayTimer = LOCK_DELAY_MS;
            this.lockDelayMoveResets += 1;
          }

          return true;
        }
      }

      return false;
    }

    holdPiece() {
      if (!this.canAct() || !this.canHold) {
        return false;
      }

      const currentType = this.active.type;

      if (!this.holdType) {
        this.holdType = currentType;
        this.spawnPiece();
      } else {
        const swapType = this.holdType;
        this.holdType = currentType;
        this.active = this.createPiece(swapType);

        // Reset lock delay and tracking for the swapped piece
        this.lockDelayActive = false;
        this.lockDelayTimer = 0;
        this.lockDelayMoveResets = 0;
        this.lastActionWasRotation = false;

        if (this.collides(this.active)) {
          this.running = false;
          this.gameOver = true;
          this.status = "defeat";
          this.emit("Hold dock overloaded. Mission failed.");
        }
      }

      this.canHold = false;
      this.dirty = true;
      return true;
    }

    mergeActive() {
      for (let row = 0; row < this.active.matrix.length; row += 1) {
        for (let col = 0; col < this.active.matrix[row].length; col += 1) {
          if (!this.active.matrix[row][col]) {
            continue;
          }

          const boardX = this.active.x + col;
          const boardY = this.active.y + row;
          if (boardY >= 0) {
            this.board[boardY][boardX] = this.active.type;
          }
        }
      }
    }

    clearLines() {
      const clearedRows = [];

      for (let y = this.rows - 1; y >= 0; y -= 1) {
        const filled = this.board[y].every((cell) => !!cell);
        if (!filled) {
          continue;
        }

        clearedRows.push(y);
        this.board.splice(y, 1);
        this.board.unshift(Array(this.cols).fill(null));
        y += 1;
      }

      return clearedRows;
    }

    applyLineClear(clearedCount) {
      this.lastClear = clearedCount;
      this.lastComboBonus = 0;
      this.lastBackToBackBonus = 0;

      const hasTSpin = this.tSpinType !== null;

      // T-Spin Mini with no lines still awards points
      if (!clearedCount && hasTSpin) {
        const tSpinBonus = 100 * this.level; // T-Spin Mini (no lines)
        this.score += tSpinBonus;
        this.combo = -1;
        this.emit(`T-SPIN MINI! +${tSpinBonus} points.`);
        return;
      }

      if (!clearedCount) {
        this.combo = -1;
        return;
      }

      const isTetris = clearedCount === 4;
      // Determine if this is a "difficult" clear (qualifies for back-to-back)
      const isDifficult = isTetris || hasTSpin;

      let gained;
      if (hasTSpin) {
        // T-Spin scoring overrides normal line scoring
        const tSpinScores = {
          1: 800, // T-Spin Single
          2: 1200, // T-Spin Double
          3: 1600, // T-Spin Triple
        };
        gained = (tSpinScores[clearedCount] || clearedCount * 400) * this.level;
      } else {
        const base =
          (LINE_SCORE[clearedCount] || clearedCount * 250) * this.level;
        gained = base;
      }

      this.combo += 1;

      if (isDifficult && this.backToBack) {
        const bonus = Math.round(gained * 0.5);
        this.lastBackToBackBonus = bonus;
        gained += bonus;
      }

      if (this.combo > 0) {
        const comboBonus = this.combo * 50 * this.level;
        this.lastComboBonus = comboBonus;
        gained += comboBonus;
      }

      this.score += gained;
      this.lines += clearedCount;
      this.totalClearedLines += clearedCount;
      this.level = Math.min(20, 1 + Math.floor(this.lines / 10));
      this.backToBack = isDifficult;

      this.addForce(
        12 +
          clearedCount * 16 +
          (isTetris ? 10 : 0) +
          (hasTSpin ? 8 : 0) +
          this.combo * 4,
      );
      this.emit(this.formatClearEvent(clearedCount, gained));
    }

    formatClearEvent(clearedCount, gained) {
      const hasTSpin = this.tSpinType !== null;

      const names = {
        1: hasTSpin ? "T-SPIN SINGLE!" : "Single line secured.",
        2: hasTSpin ? "T-SPIN DOUBLE!" : "Double strike achieved.",
        3: hasTSpin ? "T-SPIN TRIPLE!" : "Triple barrage successful.",
        4: "TETRIS complete. Fleet formation perfect.",
      };

      const parts = [names[clearedCount] || "Battlefield stabilized."];
      parts.push(`+${gained} points.`);

      if (this.lastComboBonus > 0) {
        parts.push(`Combo bonus +${this.lastComboBonus}.`);
      }

      if (this.lastBackToBackBonus > 0) {
        parts.push(`Back-to-back bonus +${this.lastBackToBackBonus}.`);
      }

      return parts.join(" ");
    }

    lockPiece() {
      // Detect T-spin BEFORE merging — check corners on the board (without piece cells)
      // This is more accurate since the board doesn't have the T cells yet,
      // and we check what was already there (walls/blocks).
      this.tSpinType = this._detectTSpinPreMerge();

      this.mergeActive();
      const clearedRows = this.clearLines();
      const clearedCount = clearedRows.length;

      // Refine T-spin type based on lines cleared
      if (this.tSpinType !== null) {
        if (clearedCount === 0) this.tSpinType = "mini";
        else if (clearedCount === 1) this.tSpinType = "single";
        else if (clearedCount === 2) this.tSpinType = "double";
        else if (clearedCount === 3) this.tSpinType = "triple";
      }

      this.applyLineClear(clearedCount);

      // Reset lock delay state
      this.lockDelayActive = false;
      this.lockDelayTimer = 0;
      this.lockDelayMoveResets = 0;

      this.canHold = true;
      this.active = null;
      this.gravityMs = 0;

      const spawned = this.spawnPiece();
      this.dirty = true;
      return {
        clearedCount,
        clearedRows,
        spawned,
        tSpinType: this.tSpinType,
      };
    }

    _detectTSpinPreMerge() {
      // Called before mergeActive — checks corners on the board without
      // the T-piece cells. Returns a truthy marker if T-spin conditions
      // are met; the actual type (mini/single/double/triple) is refined
      // after line clearing based on cleared count.
      if (!this.active || this.active.type !== "T") {
        return null;
      }

      if (!this.lastActionWasRotation) {
        return null;
      }

      // T-piece center is always at (x+1, y+1) in its 3x3 bounding box
      const cx = this.active.x + 1;
      const cy = this.active.y + 1;
      const corners = [
        [cx - 1, cy - 1],
        [cx + 1, cy - 1],
        [cx - 1, cy + 1],
        [cx + 1, cy + 1],
      ];

      let filledCorners = 0;
      for (const corner of corners) {
        const bx = corner[0];
        const by = corner[1];
        if (bx < 0 || bx >= this.cols || by < 0 || by >= this.rows) {
          filledCorners += 1; // walls/floor count as filled
        } else if (this.board[by] && this.board[by][bx]) {
          filledCorners += 1;
        }
      }

      // 3 or more filled corners = T-spin detected
      if (filledCorners >= 3) {
        return "pending"; // will be refined to mini/single/double/triple
      }

      return null;
    }

    addForce(amount) {
      if (amount <= 0) {
        return;
      }

      this.forceMeter = Math.min(100, this.forceMeter + amount);
      if (this.forceMeter >= 100) {
        if (!this.forceReady) {
          this.emit("Force ability charged. Press F to blast a hostile lane.");
        }
        this.forceReady = true;
      }
      this.dirty = true;
    }

    activateForce() {
      if (!this.forceReady || this.gameOver) {
        return { used: false, clearedRow: -1, scoreBonus: 0 };
      }

      let targetRow = -1;
      let bestFill = 0;

      for (let y = 0; y < this.rows; y += 1) {
        let fill = 0;
        for (let x = 0; x < this.cols; x += 1) {
          if (this.board[y][x]) {
            fill += 1;
          }
        }

        if (fill > bestFill) {
          bestFill = fill;
          targetRow = y;
        }
      }

      let scoreBonus = 0;
      if (targetRow >= 0 && bestFill > 0) {
        this.board.splice(targetRow, 1);
        this.board.unshift(Array(this.cols).fill(null));

        this.lines += 1;
        this.totalClearedLines += 1;
        this.level = Math.min(20, 1 + Math.floor(this.lines / 10));

        scoreBonus = 220 + this.level * 30;
        this.score += scoreBonus;
        this.emit("Force blast successful. Enemy lane erased.");
      } else {
        this.emit("Force pulse discharged. No hostile lane found.");
      }

      this.forceMeter = 0;
      this.forceReady = false;
      this.forceUses += 1;
      this.combo = -1;
      this.backToBack = false;
      this.dirty = true;

      return { used: true, clearedRow: targetRow, scoreBonus };
    }

    getDropInterval() {
      const idx = Math.min(this.level, SPEED_CURVE.length) - 1;
      const base = SPEED_CURVE[idx] !== undefined ? SPEED_CURVE[idx] : 33;
      return this.mode === "empire"
        ? Math.max(28, Math.round(base * 0.82))
        : base;
    }

    tick(deltaMs) {
      if (!this.canAct()) {
        return { moved: false, locked: false };
      }

      // Handle lock delay countdown
      if (this.lockDelayActive) {
        this.lockDelayTimer -= deltaMs;
        // Check if piece is still on a surface
        const onSurface = this.collides(
          this.active,
          this.active.matrix,
          this.active.x,
          this.active.y + 1,
        );
        if (!onSurface) {
          // Piece is no longer on a surface (e.g., line cleared beneath)
          this.lockDelayActive = false;
          this.lockDelayTimer = 0;
          this.lockDelayMoveResets = 0;
        } else if (
          this.lockDelayTimer <= 0 ||
          this.lockDelayMoveResets >= LOCK_DELAY_MAX_RESETS
        ) {
          // Lock delay expired or max resets reached — force lock
          const lockResult = this.lockPiece();
          return { moved: false, locked: true, ...lockResult };
        }
        // During lock delay, don't apply gravity
        this.dirty = true;
        return { moved: false, locked: false };
      }

      this.gravityMs += deltaMs;
      const interval = this.getDropInterval();
      let moved = false;

      while (this.gravityMs >= interval) {
        this.gravityMs -= interval;
        this.active.y += 1;

        if (this.collides(this.active)) {
          this.active.y -= 1;
          // Start lock delay instead of locking immediately
          this.lockDelayActive = true;
          this.lockDelayTimer = LOCK_DELAY_MS;
          this.lockDelayMoveResets = 0;
          this.dirty = true;
          return { moved, locked: false };
        }

        // Piece moved down successfully — reset lock delay state
        this.lockDelayActive = false;
        this.lockDelayTimer = 0;
        this.lockDelayMoveResets = 0;
        moved = true;
      }

      if (moved) {
        this.dirty = true;
      }

      return { moved, locked: false };
    }

    togglePause() {
      if (!this.running || this.gameOver) {
        return this.paused;
      }

      this.paused = !this.paused;
      this.status = this.paused ? "paused" : "running";
      this.emit(this.paused ? "Mission paused." : "Mission resumed.");
      this.dirty = true;
      return this.paused;
    }

    stop() {
      this.running = false;
      this.status = this.gameOver ? "defeat" : "waiting";
      this.dirty = true;
    }

    getGhostPiece() {
      if (!this.active) {
        return null;
      }

      let ghostY = this.active.y;
      while (
        !this.collides(
          this.active,
          this.active.matrix,
          this.active.x,
          ghostY + 1,
        )
      ) {
        ghostY += 1;
      }

      return {
        type: this.active.type,
        matrix: cloneMatrix(this.active.matrix),
        x: this.active.x,
        y: ghostY,
      };
    }

    getRank() {
      if (this.score >= 22000 || this.lines >= 160) {
        return "Grand Master";
      }
      if (this.score >= 13000 || this.lines >= 95) {
        return "Jedi Knight";
      }
      if (this.score >= 8000 || this.lines >= 60) {
        return "Commander";
      }
      if (this.score >= 4200 || this.lines >= 30) {
        return "Squad Lead";
      }
      if (this.score >= 1700 || this.lines >= 14) {
        return "Pilot";
      }
      return "Padawan";
    }

    emit(message) {
      this.events.push({
        timestamp: Date.now(),
        message,
      });

      if (this.events.length > 40) {
        this.events.shift();
      }
    }

    pullEvents() {
      if (!this.events.length) {
        return [];
      }

      const copied = this.events.slice();
      this.events = [];
      return copied;
    }

    getPublicState() {
      return {
        board: this.board.map((row) => row.slice()),
        active: this.active
          ? {
              type: this.active.type,
              matrix: cloneMatrix(this.active.matrix),
              x: this.active.x,
              y: this.active.y,
            }
          : null,
        ghost: this.getGhostPiece(),
        queue: this.queue.slice(0, 5),
        holdType: this.holdType,
        canHold: this.canHold,
        score: this.score,
        lines: this.lines,
        level: this.level,
        combo: this.combo,
        backToBack: this.backToBack,
        forceMeter: this.forceMeter,
        forceReady: this.forceReady,
        forceUses: this.forceUses,
        rank: this.getRank(),
        mode: this.mode,
        running: this.running,
        paused: this.paused,
        gameOver: this.gameOver,
        status: this.status,
        dropInterval: this.getDropInterval(),
        tSpinType: this.tSpinType,
        lockDelay: {
          active: this.lockDelayActive,
          timer: this.lockDelayTimer,
          moveResets: this.lockDelayMoveResets,
        },
      };
    }
  }

  return {
    BOARD_COLS,
    BOARD_ROWS,
    PIECE_TYPES,
    COLORS,
    SHAPES,
    LINE_SCORE,
    createEmptyBoard,
    cloneMatrix,
    rotateMatrix,
    TetrisEngine,
  };
});
