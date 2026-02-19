/* ============================================================================
 *  Master Jorge: Tetris Wars  --  game.js
 *  Star Wars themed Tetris front-end wired to TetrisCore engine.
 *  All audio is procedurally generated via Web Audio API (no external files).
 *  (c) 2026 Miami Alliance 3PL  --  megalopolisms.github.io/miamialliance3pl
 * ============================================================================ */
(function () {
  "use strict";

  /* ────────────────────────── constants ────────────────────────── */
  var COLS = TetrisCore.BOARD_COLS; // 10
  var ROWS = TetrisCore.BOARD_ROWS; // 20
  var COLORS = TetrisCore.COLORS;
  var SHAPES = TetrisCore.SHAPES;
  var BLOCK = 30; // px per cell on the 300x600 canvas
  var NEXT_BLOCK = 22; // px per cell in next-queue canvas
  var HOLD_BLOCK = 24; // px per cell in hold canvas
  var MAX_EVENTS = 8;
  var LEADERBOARD_KEY = "jorge_tetris_leaderboard";
  var HIGH_SCORE_KEY = "jorge_tetris_highscore";
  var STAR_COUNT = 120;
  var MAX_PARTICLES = 300;
  var SCREEN_SHAKE_DECAY = 0.88;

  /* ─────────────────── colour helpers ─────────────────── */
  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  }

  function rgbString(r, g, b, a) {
    if (a !== undefined) return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function lighten(hex, amount) {
    var c = hexToRgb(hex);
    var r = Math.min(255, c.r + amount);
    var g = Math.min(255, c.g + amount);
    var b = Math.min(255, c.b + amount);
    return rgbString(r, g, b);
  }

  function darken(hex, amount) {
    var c = hexToRgb(hex);
    var r = Math.max(0, c.r - amount);
    var g = Math.max(0, c.g - amount);
    var b = Math.max(0, c.b - amount);
    return rgbString(r, g, b);
  }

  /* ─────────────────── DOM refs ─────────────────── */
  var boardCanvas = document.getElementById("board");
  var boardCtx = boardCanvas.getContext("2d");
  var nextCanvas = document.getElementById("next");
  var nextCtx = nextCanvas.getContext("2d");
  var holdCanvas = document.getElementById("hold");
  var holdCtx = holdCanvas.getContext("2d");

  var scoreEl = document.getElementById("score");
  var linesEl = document.getElementById("lines");
  var levelEl = document.getElementById("level");
  var rankEl = document.getElementById("rank");
  var comboEl = document.getElementById("combo");
  var b2bEl = document.getElementById("backToBack");
  var modeEl = document.getElementById("mode");
  var highScoreEl = document.getElementById("highScore");
  var statusEl = document.getElementById("status");
  var forceMeterEl = document.getElementById("forceMeter");
  var forceLabelEl = document.getElementById("forceLabel");
  var forceHintEl = document.getElementById("forceHint");
  var startBtn = document.getElementById("startBtn");
  var pauseBtn = document.getElementById("pauseBtn");
  var modeBtn = document.getElementById("modeBtn");
  var audioBtn = document.getElementById("audioBtn");
  var eventFeed = document.getElementById("eventFeed");
  var missionText = document.getElementById("missionText");
  var announcer = document.getElementById("announcer");

  // Settings panel
  var settingsBtn = document.getElementById("settingsBtn");
  var settingsPanel = document.getElementById("settingsPanel");
  var settingsClose = document.getElementById("settingsClose");
  var settingsBackdrop = document.getElementById("settingsBackdrop");
  var volumeSlider = document.getElementById("volumeSlider");
  var volumeValue = document.getElementById("volumeValue");
  var ghostToggle = document.getElementById("ghostToggle");
  var gridToggle = document.getElementById("gridToggle");
  var particleToggle = document.getElementById("particleToggle");

  // Leaderboard modal
  var leaderboardBtn = document.getElementById("leaderboardBtn");
  var leaderboardModal = document.getElementById("leaderboardModal");
  var leaderboardClose = document.getElementById("leaderboardClose");

  // Game over overlay (HTML-based)
  var gameOverOverlay = document.getElementById("gameOverOverlay");
  var gameOverScore = document.getElementById("gameOverScore");
  var gameOverRank = document.getElementById("gameOverRank");
  var gameOverLines = document.getElementById("gameOverLines");
  var gameOverRestart = document.getElementById("gameOverRestart");
  var gameOverLeaderboard = document.getElementById("gameOverLeaderboard");

  // Tetris/level-up flash elements
  var tetrisText = document.getElementById("tetrisText");
  var levelUpFlash = document.getElementById("levelUpFlash");

  /* ────────────────────────── engine ────────────────────────── */
  var engine = new TetrisCore.TetrisEngine();
  var prevLevel = 1;

  /* ────────────────────────── state ────────────────────────── */
  var animFrame = 0;
  var lastTimestamp = 0;
  var highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
  var screenShakeX = 0;
  var screenShakeY = 0;
  var comboTextTimer = 0;
  var comboTextValue = 0;
  var b2bGlowTimer = 0;
  var levelTransitionTimer = 0;
  var forceBlastTimer = 0;
  var forceBlastRow = -1;
  var flashTimer = 0;
  var gameOverShown = false;

  /* ────────────────────────── settings ────────────────────────── */
  var settings = {
    ghost: true,
    grid: true,
    particles: true,
  };

  /* ══════════════════════════════════════════════════════════════
   *  1. STAR FIELD (background parallax)
   * ══════════════════════════════════════════════════════════════ */
  var stars = [];
  function initStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * boardCanvas.width,
        y: Math.random() * boardCanvas.height,
        size: 0.4 + Math.random() * 1.6,
        speed: 0.08 + Math.random() * 0.25,
        brightness: 0.2 + Math.random() * 0.6,
      });
    }
  }
  initStars();

  function updateStars(dt) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += s.speed * (dt / 16);
      if (s.y > boardCanvas.height) {
        s.y = -2;
        s.x = Math.random() * boardCanvas.width;
      }
    }
  }

  function drawStars(ctx) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var flicker = 0.7 + 0.3 * Math.sin(Date.now() * 0.003 + i);
      ctx.globalAlpha = s.brightness * flicker;
      ctx.fillStyle = "#d0e8ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ══════════════════════════════════════════════════════════════
   *  2. PARTICLE SYSTEM
   * ══════════════════════════════════════════════════════════════ */
  var particles = [];

  function spawnParticle(x, y, vx, vy, life, color, size, type) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      life: life,
      maxLife: life,
      color: color,
      size: size,
      type: type || "spark",
    });
  }

  function spawnLineClearParticles(rows) {
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      for (var x = 0; x < COLS; x++) {
        var px = x * BLOCK + BLOCK / 2;
        var py = row * BLOCK + BLOCK / 2;
        var count = rows.length >= 4 ? 8 : 4;
        for (var p = 0; p < count; p++) {
          var angle = Math.random() * Math.PI * 2;
          var speed = 1.5 + Math.random() * 4;
          var colors = [
            "#6be6ff",
            "#f8cf63",
            "#ff7171",
            "#67e79d",
            "#d38bff",
            "#fff",
          ];
          var col = colors[Math.floor(Math.random() * colors.length)];
          var ptype = Math.random() > 0.5 ? "spark" : "trail";
          spawnParticle(
            px,
            py,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            400 + Math.random() * 600,
            col,
            1.5 + Math.random() * 2.5,
            ptype,
          );
        }
      }
    }
  }

  function spawnForceBlastParticles(row) {
    var py = row * BLOCK + BLOCK / 2;
    for (var i = 0; i < 60; i++) {
      var px = Math.random() * boardCanvas.width;
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      var speed = 2 + Math.random() * 5;
      spawnParticle(
        px,
        py,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        500 + Math.random() * 500,
        "#6be6ff",
        2 + Math.random() * 3,
        "force",
      );
    }
  }

  function spawnHardDropParticles(piece) {
    if (!piece) return;
    for (var r = 0; r < piece.matrix.length; r++) {
      for (var c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        var px = (piece.x + c) * BLOCK + BLOCK / 2;
        var py = (piece.y + r) * BLOCK + BLOCK;
        for (var p = 0; p < 4; p++) {
          spawnParticle(
            px + (Math.random() - 0.5) * BLOCK,
            py,
            (Math.random() - 0.5) * 2,
            1 + Math.random() * 2,
            200 + Math.random() * 300,
            COLORS[piece.type],
            1.5 + Math.random() * 2,
            "spark",
          );
        }
      }
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += 0.05 * (dt / 16);
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles(ctx) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.type === "trail") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * alpha;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      } else if (p.type === "force") {
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ══════════════════════════════════════════════════════════════
   *  3. AUDIO SYSTEM  (Web Audio API -- procedural)
   * ══════════════════════════════════════════════════════════════ */
  var audioCtx = null;
  var masterGain = null;
  var audioEnabled = true;
  var audioVolume = 0.35;

  function ensureAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = audioVolume;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      audioEnabled = false;
    }
  }

  function playTone(freq, duration, type, volume, detune) {
    if (!audioEnabled || !audioCtx) return;
    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime((volume || 0.15) * audioVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playNoise(duration, volume) {
    if (!audioEnabled || !audioCtx) return;
    var now = audioCtx.currentTime;
    var bufferSize = Math.floor(audioCtx.sampleRate * duration);
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    var source = audioCtx.createBufferSource();
    source.buffer = buffer;
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime((volume || 0.1) * audioVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(gain);
    gain.connect(masterGain);
    source.start(now);
  }

  var audio = {
    move: function () {
      playTone(440, 0.06, "square", 0.08);
    },
    rotate: function () {
      playTone(660, 0.07, "sine", 0.1);
      playTone(880, 0.05, "sine", 0.07);
    },
    softDrop: function () {
      playTone(220, 0.04, "triangle", 0.06);
    },
    hardDrop: function () {
      playNoise(0.12, 0.18);
      playTone(110, 0.15, "sawtooth", 0.12);
    },
    lock: function () {
      playTone(180, 0.08, "triangle", 0.08);
    },
    hold: function () {
      playTone(520, 0.08, "sine", 0.09);
      playTone(780, 0.06, "sine", 0.07);
    },
    lineClear: function (count) {
      if (count === 4) {
        audio.tetris();
      } else if (count >= 2) {
        audio.multiLine();
      } else {
        audio.singleLine();
      }
    },
    singleLine: function () {
      playTone(523, 0.1, "square", 0.12);
      playTone(659, 0.1, "square", 0.1);
    },
    multiLine: function () {
      var notes = [523, 659, 784];
      for (var i = 0; i < notes.length; i++) {
        (function (idx) {
          setTimeout(function () {
            playTone(notes[idx], 0.12, "square", 0.12);
          }, idx * 70);
        })(i);
      }
    },
    tetris: function () {
      // Star Wars victory fanfare snippet
      var melody = [
        { f: 392, d: 0.15 },
        { f: 523, d: 0.15 },
        { f: 659, d: 0.15 },
        { f: 784, d: 0.25 },
        { f: 659, d: 0.1 },
        { f: 784, d: 0.35 },
      ];
      for (var i = 0; i < melody.length; i++) {
        (function (idx) {
          var delay = 0;
          for (var j = 0; j < idx; j++) delay += melody[j].d * 600;
          setTimeout(function () {
            playTone(melody[idx].f, melody[idx].d * 1.2, "square", 0.14);
            playTone(
              melody[idx].f * 0.5,
              melody[idx].d * 1.2,
              "triangle",
              0.08,
            );
          }, delay);
        })(i);
      }
    },
    forceBlast: function () {
      playNoise(0.25, 0.2);
      playTone(80, 0.3, "sawtooth", 0.15);
      playTone(200, 0.4, "sine", 0.1);
      setTimeout(function () {
        playTone(120, 0.3, "sawtooth", 0.12);
      }, 100);
    },
    levelUp: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        (function (idx) {
          setTimeout(function () {
            playTone(notes[idx], 0.15, "sine", 0.12);
          }, idx * 100);
        })(i);
      }
    },
    gameOver: function () {
      // Imperial March snippet
      var march = [
        { f: 392, d: 0.35 },
        { f: 392, d: 0.35 },
        { f: 392, d: 0.35 },
        { f: 311, d: 0.25 },
        { f: 466, d: 0.1 },
        { f: 392, d: 0.35 },
        { f: 311, d: 0.25 },
        { f: 466, d: 0.1 },
        { f: 392, d: 0.55 },
      ];
      var time = 0;
      for (var i = 0; i < march.length; i++) {
        (function (idx, t) {
          setTimeout(function () {
            playTone(march[idx].f, march[idx].d * 0.9, "sawtooth", 0.13);
            playTone(march[idx].f * 0.5, march[idx].d * 0.9, "triangle", 0.06);
          }, t);
        })(i, time);
        time += march[i].d * 500;
      }
    },
    combo: function (count) {
      var freq = 400 + count * 60;
      playTone(Math.min(freq, 1200), 0.08, "square", 0.1);
    },
    start: function () {
      playTone(440, 0.12, "sine", 0.1);
      setTimeout(function () {
        playTone(660, 0.12, "sine", 0.1);
      }, 120);
      setTimeout(function () {
        playTone(880, 0.18, "sine", 0.12);
      }, 240);
    },
  };

  function toggleAudio() {
    audioEnabled = !audioEnabled;
    audioBtn.textContent = "Audio: " + (audioEnabled ? "On" : "Off");
    if (mobileAudioBtnEl) {
      mobileAudioBtnEl.innerHTML =
        "&#x1F50A; Audio: " + (audioEnabled ? "On" : "Off");
    }
  }

  /* ══════════════════════════════════════════════════════════════
   *  4. SCREEN SHAKE
   * ══════════════════════════════════════════════════════════════ */
  function triggerShake(intensity) {
    screenShakeX = (Math.random() - 0.5) * intensity;
    screenShakeY = (Math.random() - 0.5) * intensity;
  }

  function updateShake() {
    screenShakeX *= SCREEN_SHAKE_DECAY;
    screenShakeY *= SCREEN_SHAKE_DECAY;
    if (Math.abs(screenShakeX) < 0.2) screenShakeX = 0;
    if (Math.abs(screenShakeY) < 0.2) screenShakeY = 0;
  }

  /* ══════════════════════════════════════════════════════════════
   *  5. BOARD RENDERER
   * ══════════════════════════════════════════════════════════════ */
  function drawBoardBackground(ctx) {
    // Dark space background
    ctx.fillStyle = "#030a18";
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    // Draw stars
    drawStars(ctx);

    // Miami3PL watermark
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.font = "bold 18px 'Exo 2', sans-serif";
    ctx.fillStyle = "#6bc3ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(boardCanvas.width / 2, boardCanvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText("Miami Alliance 3PL", 0, -20);
    ctx.font = "12px 'Exo 2', sans-serif";
    ctx.fillText("Master Jorge Edition", 0, 6);
    ctx.restore();

    // Holographic grid lines
    ctx.strokeStyle = "rgba(100, 180, 255, 0.06)";
    ctx.lineWidth = 0.5;
    for (var x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK, 0);
      ctx.lineTo(x * BLOCK, boardCanvas.height);
      ctx.stroke();
    }
    for (var y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK);
      ctx.lineTo(boardCanvas.width, y * BLOCK);
      ctx.stroke();
    }

    // Holographic scan line effect
    var scanY = (Date.now() * 0.04) % boardCanvas.height;
    ctx.strokeStyle = "rgba(100, 200, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(boardCanvas.width, scanY);
    ctx.stroke();
  }

  function drawBlock(ctx, x, y, color, blockSize, glow, ghostAlpha) {
    var px = x * blockSize;
    var py = y * blockSize;
    var rgb = hexToRgb(color);

    if (ghostAlpha !== undefined) {
      // Ghost piece: semi-transparent outline
      ctx.strokeStyle = rgbString(rgb.r, rgb.g, rgb.b, ghostAlpha);
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, blockSize - 4, blockSize - 4);
      ctx.fillStyle = rgbString(rgb.r, rgb.g, rgb.b, ghostAlpha * 0.2);
      ctx.fillRect(px + 2, py + 2, blockSize - 4, blockSize - 4);
      return;
    }

    // Main fill with gradient
    var grad = ctx.createLinearGradient(px, py, px + blockSize, py + blockSize);
    grad.addColorStop(0, lighten(color, 40));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, darken(color, 50));
    ctx.fillStyle = grad;
    ctx.fillRect(px + 1, py + 1, blockSize - 2, blockSize - 2);

    // Inner highlight (top-left bevel)
    ctx.fillStyle = rgbString(255, 255, 255, 0.18);
    ctx.fillRect(px + 1, py + 1, blockSize - 2, 3);
    ctx.fillRect(px + 1, py + 1, 3, blockSize - 2);

    // Inner shadow (bottom-right bevel)
    ctx.fillStyle = rgbString(0, 0, 0, 0.22);
    ctx.fillRect(px + 1, py + blockSize - 4, blockSize - 2, 3);
    ctx.fillRect(px + blockSize - 4, py + 1, 3, blockSize - 2);

    // Outer border
    ctx.strokeStyle = rgbString(0, 0, 0, 0.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, blockSize - 1, blockSize - 1);

    // Glow effect (lightsaber glow for active pieces)
    if (glow) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = rgbString(rgb.r, rgb.g, rgb.b, 0.15);
      ctx.fillRect(px, py, blockSize, blockSize);
      ctx.restore();
    }
  }

  function drawLockedBoard(ctx, board) {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var cell = board[y][x];
        if (!cell) continue;
        var color = COLORS[cell] || cell;
        drawBlock(ctx, x, y, color, BLOCK, false);
      }
    }
  }

  function drawGhostPiece(ctx, ghost) {
    if (!ghost) return;
    for (var r = 0; r < ghost.matrix.length; r++) {
      for (var c = 0; c < ghost.matrix[r].length; c++) {
        if (!ghost.matrix[r][c]) continue;
        var bx = ghost.x + c;
        var by = ghost.y + r;
        if (by < 0) continue;
        var color = COLORS[ghost.type];
        drawBlock(ctx, bx, by, color, BLOCK, false, 0.35);
      }
    }
  }

  function drawActivePiece(ctx, piece) {
    if (!piece) return;
    // Lightsaber glow aura around the entire piece
    ctx.save();
    var color = COLORS[piece.type];
    var rgb = hexToRgb(color);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + 4 * Math.sin(Date.now() * 0.006);
    for (var r = 0; r < piece.matrix.length; r++) {
      for (var c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        var bx = piece.x + c;
        var by = piece.y + r;
        if (by < 0) continue;
        drawBlock(ctx, bx, by, color, BLOCK, true);
      }
    }
    ctx.restore();
  }

  function drawForceBlastEffect(ctx) {
    if (forceBlastTimer <= 0) return;
    var progress = 1 - forceBlastTimer / 600;
    var cy = forceBlastRow * BLOCK + BLOCK / 2;
    var radius = progress * boardCanvas.width * 1.2;
    var alpha = Math.max(0, 1 - progress);

    // Shockwave ring
    ctx.save();
    ctx.strokeStyle = rgbString(107, 230, 255, alpha * 0.7);
    ctx.lineWidth = 4 * (1 - progress);
    ctx.beginPath();
    ctx.arc(boardCanvas.width / 2, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow
    var grad = ctx.createRadialGradient(
      boardCanvas.width / 2,
      cy,
      0,
      boardCanvas.width / 2,
      cy,
      radius,
    );
    grad.addColorStop(0, rgbString(107, 230, 255, alpha * 0.3));
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(boardCanvas.width / 2, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFlash(ctx) {
    if (flashTimer <= 0) return;
    var alpha = Math.max(0, flashTimer / 300) * 0.35;
    ctx.fillStyle = rgbString(255, 255, 255, alpha);
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  }

  function drawHyperspaceEffect(ctx) {
    if (levelTransitionTimer <= 0) return;
    var progress = 1 - levelTransitionTimer / 1200;
    var cx = boardCanvas.width / 2;
    var cy = boardCanvas.height / 2;
    ctx.save();

    // Streaking star lines radiating from center
    var lineCount = 30;
    for (var i = 0; i < lineCount; i++) {
      var angle = (i / lineCount) * Math.PI * 2;
      var innerR = 20 + progress * 80;
      var outerR = 50 + progress * 400;
      var alpha = Math.max(0, (1 - progress) * 0.6);

      ctx.strokeStyle = rgbString(200, 230, 255, alpha);
      ctx.lineWidth = 1.5 + progress * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.stroke();
    }

    // Central flash
    var flashAlpha =
      progress < 0.3
        ? (progress / 0.3) * 0.4
        : Math.max(0, (1 - progress) * 0.4);
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150);
    grad.addColorStop(0, rgbString(200, 230, 255, flashAlpha));
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 150, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawComboText(ctx) {
    if (comboTextTimer <= 0 || comboTextValue <= 0) return;
    var alpha = Math.max(0, comboTextTimer / 1500);
    var scale = 1 + (1 - comboTextTimer / 1500) * 0.5;
    var yOffset = (1 - comboTextTimer / 1500) * -40;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold " + Math.round(24 * scale) + "px 'Audiowide', cursive";
    ctx.fillStyle = "#f8cf63";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var text = comboTextValue + "x COMBO!";
    var tx = boardCanvas.width / 2;
    var ty = boardCanvas.height / 2 - 60 + yOffset;
    ctx.strokeText(text, tx, ty);
    ctx.fillText(text, tx, ty);
    ctx.restore();
  }

  function drawB2BIndicator(ctx, state) {
    if (!state.backToBack) {
      b2bGlowTimer = 0;
      return;
    }
    b2bGlowTimer += 16;
    var pulse = 0.5 + 0.5 * Math.sin(b2bGlowTimer * 0.005);
    ctx.save();
    ctx.globalAlpha = 0.5 + pulse * 0.4;
    ctx.font = "bold 20px 'Audiowide', cursive";
    ctx.fillStyle = rgbString(107, 230, 255, 0.8 + pulse * 0.2);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    ctx.strokeText("B2B ACTIVE", boardCanvas.width / 2, 24);
    ctx.fillText("B2B ACTIVE", boardCanvas.width / 2, 24);

    // Glow
    ctx.shadowColor = "#6be6ff";
    ctx.shadowBlur = 15 + pulse * 10;
    ctx.fillText("B2B ACTIVE", boardCanvas.width / 2, 24);
    ctx.restore();
  }

  function drawPausedOverlay(ctx) {
    ctx.fillStyle = "rgba(0, 3, 12, 0.72)";
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.font = "bold 28px 'Audiowide', cursive";
    ctx.fillStyle = "#f8cf63";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", boardCanvas.width / 2, boardCanvas.height / 2 - 15);
    ctx.font = "14px 'Exo 2', sans-serif";
    ctx.fillStyle = "#a0c8e8";
    ctx.fillText(
      "Press P to resume",
      boardCanvas.width / 2,
      boardCanvas.height / 2 + 20,
    );
  }

  function drawGameOverOverlay(ctx, state) {
    ctx.fillStyle = "rgba(5, 0, 0, 0.78)";
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.font = "bold 26px 'Audiowide', cursive";
    ctx.fillStyle = "#ff7171";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "MISSION FAILED",
      boardCanvas.width / 2,
      boardCanvas.height / 2 - 50,
    );

    ctx.font = "16px 'Exo 2', sans-serif";
    ctx.fillStyle = "#f8cf63";
    ctx.fillText(
      "Score: " + state.score,
      boardCanvas.width / 2,
      boardCanvas.height / 2 - 15,
    );
    ctx.fillText(
      "Lines: " + state.lines + "  Level: " + state.level,
      boardCanvas.width / 2,
      boardCanvas.height / 2 + 10,
    );
    ctx.fillText(
      "Rank: " + state.rank,
      boardCanvas.width / 2,
      boardCanvas.height / 2 + 35,
    );

    ctx.font = "13px 'Exo 2', sans-serif";
    ctx.fillStyle = "#a0c8e8";
    ctx.fillText(
      "Press Start to retry",
      boardCanvas.width / 2,
      boardCanvas.height / 2 + 65,
    );
  }

  function drawWaitingOverlay(ctx) {
    ctx.fillStyle = "rgba(0, 3, 12, 0.55)";
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.font = "bold 22px 'Audiowide', cursive";
    ctx.fillStyle = "#f8cf63";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "TETRIS WARS",
      boardCanvas.width / 2,
      boardCanvas.height / 2 - 30,
    );
    ctx.font = "14px 'Exo 2', sans-serif";
    ctx.fillStyle = "#c0d8f0";
    ctx.fillText(
      "Press Start Mission",
      boardCanvas.width / 2,
      boardCanvas.height / 2 + 5,
    );
    ctx.font = "12px 'Exo 2', sans-serif";
    ctx.fillStyle = "#7098b8";
    ctx.fillText(
      "May the Force be with you, Jorge.",
      boardCanvas.width / 2,
      boardCanvas.height / 2 + 30,
    );
  }

  /* Full board render */
  function renderBoard(state) {
    var ctx = boardCtx;
    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    drawBoardBackground(ctx);
    drawLockedBoard(ctx, state.board);
    drawGhostPiece(ctx, state.ghost);
    drawActivePiece(ctx, state.active);
    drawForceBlastEffect(ctx);
    drawParticles(ctx);
    drawFlash(ctx);
    drawHyperspaceEffect(ctx);
    drawComboText(ctx);
    drawB2BIndicator(ctx, state);

    if (state.paused && !state.gameOver) {
      drawPausedOverlay(ctx);
    } else if (state.gameOver) {
      drawGameOverOverlay(ctx, state);
    } else if (!state.running) {
      drawWaitingOverlay(ctx);
    }

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════
   *  6. NEXT QUEUE RENDERER (5 pieces in #next 120x330)
   * ══════════════════════════════════════════════════════════════ */
  function drawPieceInCanvas(ctx, type, cx, cy, blockSize) {
    var shape = SHAPES[type];
    var color = COLORS[type];
    var rows = shape.length;
    var cols = shape[0].length;
    var offsetX = cx - (cols * blockSize) / 2;
    var offsetY = cy - (rows * blockSize) / 2;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (!shape[r][c]) continue;
        var px = offsetX + c * blockSize;
        var py = offsetY + r * blockSize;

        var grad = ctx.createLinearGradient(
          px,
          py,
          px + blockSize,
          py + blockSize,
        );
        grad.addColorStop(0, lighten(color, 30));
        grad.addColorStop(1, darken(color, 40));
        ctx.fillStyle = grad;
        ctx.fillRect(px + 1, py + 1, blockSize - 2, blockSize - 2);

        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(px + 0.5, py + 0.5, blockSize - 1, blockSize - 1);

        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(px + 1, py + 1, blockSize - 2, 2);
      }
    }
  }

  function renderNextQueue(queue) {
    var ctx = nextCtx;
    ctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

    // Background
    ctx.fillStyle = "rgba(5, 18, 36, 0.9)";
    ctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    // Subtle grid
    ctx.strokeStyle = "rgba(100, 180, 255, 0.05)";
    ctx.lineWidth = 0.5;
    for (var i = 1; i < 5; i++) {
      var ly = i * 66;
      ctx.beginPath();
      ctx.moveTo(5, ly);
      ctx.lineTo(nextCanvas.width - 5, ly);
      ctx.stroke();
    }

    var slotHeight = nextCanvas.height / 5;
    for (var idx = 0; idx < Math.min(5, queue.length); idx++) {
      var type = queue[idx];
      var cy = slotHeight * idx + slotHeight / 2;
      drawPieceInCanvas(ctx, type, nextCanvas.width / 2, cy, NEXT_BLOCK);
    }
  }

  /* ══════════════════════════════════════════════════════════════
   *  7. HOLD RENDERER (#hold 120x120)
   * ══════════════════════════════════════════════════════════════ */
  function renderHold(holdType, canHold) {
    var ctx = holdCtx;
    ctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

    ctx.fillStyle = "rgba(5, 18, 36, 0.9)";
    ctx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);

    if (!holdType) {
      ctx.font = "11px 'Exo 2', sans-serif";
      ctx.fillStyle = "rgba(150, 190, 220, 0.3)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Empty", holdCanvas.width / 2, holdCanvas.height / 2);
      return;
    }

    if (!canHold) {
      ctx.globalAlpha = 0.4;
    }
    drawPieceInCanvas(
      ctx,
      holdType,
      holdCanvas.width / 2,
      holdCanvas.height / 2,
      HOLD_BLOCK,
    );
    ctx.globalAlpha = 1;

    if (!canHold) {
      // Lock indicator
      ctx.strokeStyle = "rgba(255, 100, 100, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(holdCanvas.width - 10, holdCanvas.height - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(holdCanvas.width - 10, 10);
      ctx.lineTo(10, holdCanvas.height - 10);
      ctx.stroke();
    }
  }

  /* ══════════════════════════════════════════════════════════════
   *  8. HUD UPDATES
   * ══════════════════════════════════════════════════════════════ */
  /* Mobile HUD refs */
  var mScoreEl = document.getElementById("mScore");
  var mLevelEl = document.getElementById("mLevel");
  var mLinesEl = document.getElementById("mLines");
  var mRankEl = document.getElementById("mRank");
  var mForceMeterEl = document.getElementById("mForceMeter");
  var mobileForceBtn = document.getElementById("mobileForceBtn");
  var mobileStartBtnEl = document.getElementById("mobileStartBtn");
  var mobilePauseBtnEl = document.getElementById("mobilePauseBtn");
  var mobileModeBtnEl = document.getElementById("mobileModeBtn");
  var mobileAudioBtnEl = document.getElementById("mobileAudioBtn");

  function updateHUD(state) {
    scoreEl.textContent = String(state.score);
    linesEl.textContent = String(state.lines);
    levelEl.textContent = String(state.level);
    rankEl.textContent = state.rank;
    comboEl.textContent = state.combo > 0 ? String(state.combo) : "0";
    b2bEl.textContent = state.backToBack ? "Yes" : "No";
    modeEl.textContent = state.mode === "empire" ? "Empire" : "Alliance";
    modeBtn.textContent =
      "Mode: " + (state.mode === "empire" ? "Empire" : "Alliance");
    if (mobileModeBtnEl) {
      mobileModeBtnEl.textContent =
        "Mode: " + (state.mode === "empire" ? "Empire" : "Alliance");
    }

    // High score
    if (state.score > highScore) {
      highScore = state.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    }
    highScoreEl.textContent = String(highScore);

    // Status
    if (state.gameOver) {
      statusEl.textContent = "Defeat";
    } else if (state.paused) {
      statusEl.textContent = "Paused";
    } else if (state.running) {
      statusEl.textContent = "In Battle";
    } else {
      statusEl.textContent = "Waiting";
    }

    // Force meter
    forceMeterEl.style.width = Math.round(state.forceMeter) + "%";
    forceLabelEl.textContent = Math.round(state.forceMeter) + "%";
    if (state.forceReady) {
      forceHintEl.textContent = "FORCE READY! Press F to blast!";
      forceHintEl.style.color = "#6be6ff";
      forceMeterEl.style.background =
        "linear-gradient(90deg, #6be6ff, #f8cf63, #6be6ff)";
    } else {
      forceHintEl.textContent = "Charge to 100%, then press F for Force Blast.";
      forceHintEl.style.color = "";
      forceMeterEl.style.background = "";
    }

    // ── Mobile HUD sync ──
    if (mScoreEl) mScoreEl.textContent = String(state.score);
    if (mLevelEl) mLevelEl.textContent = String(state.level);
    if (mLinesEl) mLinesEl.textContent = String(state.lines);
    if (mRankEl) mRankEl.textContent = state.rank;
    if (mForceMeterEl)
      mForceMeterEl.style.width = Math.round(state.forceMeter) + "%";

    // Mobile force button glow
    if (mobileForceBtn) {
      if (state.forceReady) {
        mobileForceBtn.classList.add("force-ready");
      } else {
        mobileForceBtn.classList.remove("force-ready");
      }
    }

    // Mobile start button text
    if (mobileStartBtnEl) {
      if (state.running && !state.gameOver) {
        mobileStartBtnEl.innerHTML = "&#x21BB; Restart";
      } else {
        mobileStartBtnEl.innerHTML = "&#x25B6; Start";
      }
    }

    if (mobilePauseBtnEl) {
      mobilePauseBtnEl.innerHTML = state.paused
        ? "&#x25B6; Resume"
        : "&#x23F8; Pause";
    }

    if (mobileAudioBtnEl) {
      mobileAudioBtnEl.innerHTML =
        "&#x1F50A; Audio: " + (audioEnabled ? "On" : "Off");
    }
  }

  /* ══════════════════════════════════════════════════════════════
   *  9. EVENT FEED
   * ══════════════════════════════════════════════════════════════ */
  function processEvents(events) {
    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      addEventToFeed(evt.message);
    }
  }

  function addEventToFeed(message) {
    var li = document.createElement("li");
    li.textContent = message;
    li.style.opacity = "0";
    li.style.transition = "opacity 0.3s ease";
    eventFeed.appendChild(li);

    // Force reflow then fade in
    void li.offsetWidth;
    li.style.opacity = "1";

    // Trim to MAX_EVENTS
    while (eventFeed.children.length > MAX_EVENTS) {
      eventFeed.removeChild(eventFeed.firstChild);
    }

    // Auto scroll
    eventFeed.scrollTop = eventFeed.scrollHeight;

    // Update announcer for screen readers
    announcer.textContent = message;
  }

  /* ══════════════════════════════════════════════════════════════
   *  10. LEADERBOARD (localStorage top 10)
   * ══════════════════════════════════════════════════════════════ */
  function getLeaderboard() {
    try {
      var data = JSON.parse(localStorage.getItem(LEADERBOARD_KEY));
      if (Array.isArray(data)) return data;
    } catch (e) {
      /* ignore */
    }
    return [];
  }

  function saveToLeaderboard(score, lines, level, rank, mode) {
    var board = getLeaderboard();
    board.push({
      score: score,
      lines: lines,
      level: level,
      rank: rank,
      mode: mode,
      date: new Date().toISOString().slice(0, 10),
    });
    board.sort(function (a, b) {
      return b.score - a.score;
    });
    if (board.length > 10) board.length = 10;
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    return board;
  }

  function showLeaderboardModal(state) {
    var board = saveToLeaderboard(
      state.score,
      state.lines,
      state.level,
      state.rank,
      state.mode === "empire" ? "Empire" : "Alliance",
    );

    // Remove existing modal if any
    var existing = document.getElementById("leaderboardModal");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "leaderboardModal";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(0,3,15,0.88);" +
      "display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;";

    var panel = document.createElement("div");
    panel.style.cssText =
      "background:linear-gradient(135deg,rgba(8,17,33,0.97),rgba(12,30,57,0.97));" +
      "border:1px solid rgba(107,195,255,0.35);border-radius:16px;padding:28px 32px;max-width:460px;" +
      "width:90%;color:#f0f6ff;font-family:'Exo 2',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.7)," +
      "0 0 40px rgba(70,150,224,0.2);";

    var html =
      "<h2 style=\"font-family:'Audiowide',cursive;color:#f8cf63;margin:0 0 6px;font-size:1.3rem;text-align:center;\">Mission Debrief</h2>";
    html +=
      '<p style="text-align:center;color:#a0c8e8;margin:0 0 16px;">Score: <strong style="color:#f8cf63;">' +
      state.score +
      "</strong> | Lines: " +
      state.lines +
      " | Rank: " +
      state.rank +
      "</p>";
    html +=
      '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">';
    html +=
      '<tr style="color:#6bc3ff;border-bottom:1px solid rgba(107,195,255,0.2);">' +
      '<th style="text-align:left;padding:4px 6px;">#</th>' +
      '<th style="text-align:left;padding:4px 6px;">Score</th>' +
      '<th style="text-align:left;padding:4px 6px;">Lines</th>' +
      '<th style="text-align:left;padding:4px 6px;">Rank</th>' +
      '<th style="text-align:left;padding:4px 6px;">Mode</th>' +
      '<th style="text-align:left;padding:4px 6px;">Date</th></tr>';

    for (var i = 0; i < board.length; i++) {
      var entry = board[i];
      var isCurrent =
        entry.score === state.score &&
        entry.date === new Date().toISOString().slice(0, 10);
      var rowColor = isCurrent
        ? "color:#f8cf63;background:rgba(248,207,99,0.08);"
        : "color:#c0d8f0;";
      html +=
        '<tr style="' +
        rowColor +
        'border-bottom:1px solid rgba(107,195,255,0.08);">' +
        '<td style="padding:4px 6px;">' +
        (i + 1) +
        "</td>" +
        '<td style="padding:4px 6px;">' +
        entry.score +
        "</td>" +
        '<td style="padding:4px 6px;">' +
        entry.lines +
        "</td>" +
        '<td style="padding:4px 6px;">' +
        entry.rank +
        "</td>" +
        '<td style="padding:4px 6px;">' +
        entry.mode +
        "</td>" +
        '<td style="padding:4px 6px;">' +
        entry.date +
        "</td></tr>";
    }

    html += "</table>";
    html +=
      '<div style="text-align:center;margin-top:18px;">' +
      '<button id="closeLeaderboard" type="button" style="font-family:\'Audiowide\',cursive;' +
      "font-size:0.9rem;padding:10px 28px;border-radius:10px;border:1px solid rgba(248,207,99,0.5);" +
      "background:linear-gradient(135deg,rgba(126,83,9,0.9),rgba(209,141,25,0.9));color:#fff2cd;" +
      'cursor:pointer;">Continue</button></div>';

    panel.innerHTML = html;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Click handlers to close
    document
      .getElementById("closeLeaderboard")
      .addEventListener("click", function () {
        overlay.remove();
      });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  /* ══════════════════════════════════════════════════════════════
   *  11. KEYBOARD CONTROLS
   * ══════════════════════════════════════════════════════════════ */
  var keyMap = {};

  document.addEventListener("keydown", function (e) {
    if (keyMap[e.code]) return; // debounce for held keys on non-repeat actions
    keyMap[e.code] = true;

    ensureAudio();

    var state = engine.getPublicState();

    switch (e.code) {
      case "ArrowLeft":
        if (engine.move(-1)) audio.move();
        break;
      case "ArrowRight":
        if (engine.move(1)) audio.move();
        break;
      case "ArrowDown":
        e.preventDefault();
        var sd = engine.softDrop();
        if (sd.moved) audio.softDrop();
        if (sd.locked) handleLock(sd);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (engine.rotate(1)) audio.rotate();
        break;
      case "KeyZ":
        if (engine.rotate(-1)) audio.rotate();
        break;
      case "Space":
        e.preventDefault();
        if (!state.running || state.gameOver) {
          startGame();
        } else {
          var hd = engine.hardDrop();
          if (hd.locked) {
            audio.hardDrop();
            spawnHardDropParticles(state.active);
            triggerShake(6);
            handleLock(hd);
          }
        }
        break;
      case "KeyC":
        if (engine.holdPiece()) audio.hold();
        break;
      case "KeyF":
        activateForceBlast();
        break;
      case "KeyM":
        toggleMode();
        break;
      case "KeyP":
        engine.togglePause();
        break;
    }
  });

  document.addEventListener("keyup", function (e) {
    keyMap[e.code] = false;
  });

  // Allow repeat for movement keys
  document.addEventListener("keydown", function (e) {
    if (!e.repeat) return;
    switch (e.code) {
      case "ArrowLeft":
        engine.move(-1);
        break;
      case "ArrowRight":
        engine.move(1);
        break;
      case "ArrowDown":
        e.preventDefault();
        var sd = engine.softDrop();
        if (sd.locked) handleLock(sd);
        break;
    }
  });

  /* ══════════════════════════════════════════════════════════════
   *  12. MOBILE CONTROLS (touch + pointer, with DAS auto-repeat)
   * ══════════════════════════════════════════════════════════════ */
  var DAS_DELAY = 170; // ms before auto-repeat starts
  var DAS_RATE = 45; // ms between repeats
  var dasTimers = {};
  var SUPPORTS_POINTER = typeof window !== "undefined" && !!window.PointerEvent;

  function startDAS(action) {
    stopDAS(action);
    var repeat = function () {
      switch (action) {
        case "left":
          engine.move(-1);
          break;
        case "right":
          engine.move(1);
          break;
        case "down":
          var sd = engine.softDrop();
          if (sd.locked) handleLock(sd);
          break;
      }
    };
    dasTimers[action] = {
      delay: setTimeout(function () {
        dasTimers[action].interval = setInterval(repeat, DAS_RATE);
      }, DAS_DELAY),
    };
  }

  function stopDAS(action) {
    if (dasTimers[action]) {
      clearTimeout(dasTimers[action].delay);
      clearInterval(dasTimers[action].interval);
      delete dasTimers[action];
    }
  }

  function stopAllDAS() {
    for (var key in dasTimers) {
      stopDAS(key);
    }
  }

  function vibrateShort() {
    if (navigator.vibrate) navigator.vibrate(12);
  }

  var mobileButtons = document.querySelectorAll("[data-action]");
  for (var i = 0; i < mobileButtons.length; i++) {
    (function (btn) {
      var action = btn.getAttribute("data-action");
      var isDAS = btn.hasAttribute("data-das");

      var doAction = function () {
        ensureAudio();
        vibrateShort();

        switch (action) {
          case "left":
            if (engine.move(-1)) audio.move();
            break;
          case "right":
            if (engine.move(1)) audio.move();
            break;
          case "rotate":
            if (engine.rotate(1)) audio.rotate();
            break;
          case "down":
            var sd = engine.softDrop();
            if (sd.moved) audio.softDrop();
            if (sd.locked) handleLock(sd);
            break;
          case "drop":
            var st = engine.getPublicState();
            var hd = engine.hardDrop();
            if (hd.locked) {
              audio.hardDrop();
              spawnHardDropParticles(st.active);
              triggerShake(6);
              handleLock(hd);
            }
            break;
          case "hold":
            if (engine.holdPiece()) audio.hold();
            break;
          case "force":
            activateForceBlast();
            break;
          case "mode":
            toggleMode();
            break;
          case "audio":
            toggleAudio();
            break;
          case "pause":
            engine.togglePause();
            break;
          case "start":
            startGame();
            break;
        }
      };

      if (SUPPORTS_POINTER) {
        btn.addEventListener(
          "pointerdown",
          function (e) {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            doAction();
            if (isDAS) startDAS(action);
            if (btn.setPointerCapture) {
              try {
                btn.setPointerCapture(e.pointerId);
              } catch (err) {
                /* ignore capture errors */
              }
            }
          },
          { passive: false },
        );

        btn.addEventListener("pointerup", function () {
          if (isDAS) stopDAS(action);
        });

        btn.addEventListener("pointercancel", function () {
          if (isDAS) stopDAS(action);
        });

        btn.addEventListener("pointerleave", function () {
          if (isDAS) stopDAS(action);
        });
      } else {
        // Touch events with DAS support
        btn.addEventListener(
          "touchstart",
          function (e) {
            e.preventDefault();
            e.stopPropagation();
            doAction();
            if (isDAS) startDAS(action);
          },
          { passive: false },
        );

        btn.addEventListener(
          "touchend",
          function (e) {
            e.preventDefault();
            if (isDAS) stopDAS(action);
          },
          { passive: false },
        );

        btn.addEventListener("touchcancel", function () {
          if (isDAS) stopDAS(action);
        });

        // Mouse fallback (desktop testing)
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          doAction();
          if (isDAS) startDAS(action);
        });

        btn.addEventListener("mouseup", function () {
          if (isDAS) stopDAS(action);
        });

        btn.addEventListener("mouseleave", function () {
          if (isDAS) stopDAS(action);
        });
      }

      // Avoid delayed click handlers re-firing after pointer/touch action.
      btn.addEventListener("click", function (e) {
        e.preventDefault();
      });
    })(mobileButtons[i]);
  }

  /* ══════════════════════════════════════════════════════════════
   *  12b. TOUCH DRAG-AND-DROP + TAP/CLICK-TO-ROTATE (Mobile+Desktop)
   *  Piece follows finger position directly (column-mapped).
   *  Tap/click on board = rotate. Drag down = soft drop. Swipe up = hard drop.
   * ══════════════════════════════════════════════════════════════ */
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTime = 0;
  var gestureIntentMoved = false;
  var gestureInputType = "touch";
  var tapMaxDist = 22; // max px for tap detection
  var tapMaxTimeTouch = 280; // max ms for touch tap detection
  var tapMaxTimeMouse = 700; // allow a slower click press-and-release
  var dragIntentThreshold = 8; // px before a gesture is treated as a drag
  var boardWrapEl = document.getElementById("boardWrap");
  var gestureActive = false;
  var gestureHintEl = document.getElementById("gestureHint");
  var gestureHintShown = false;
  var suppressSyntheticClickUntil = 0;
  var lastGestureEndAt = 0;

  // Drag-and-drop state
  var dragAnchorOffset = 0; // finger-column offset from piece.x at touch start
  var softDropAccum = 0; // how many soft drops already triggered this gesture
  var lastDragX = -999; // last target X to avoid redundant moves

  function hideGestureHint() {
    if (gestureHintEl && !gestureHintShown) {
      gestureHintShown = true;
      gestureHintEl.classList.add("hidden");
    }
  }

  // Convert a clientX pixel to a fractional board column
  function clientXToCol(clientX) {
    var rect = boardCanvas.getBoundingClientRect();
    return (clientX - rect.left) / (rect.width / COLS);
  }

  // Get rendered cell height for soft drop mapping
  function getRenderedCellH() {
    var rect = boardCanvas.getBoundingClientRect();
    return rect.height / ROWS;
  }

  function beginGesture(clientX, clientY, inputType) {
    touchStartX = clientX;
    touchStartY = clientY;
    touchStartTime = Date.now();
    gestureIntentMoved = false;
    gestureInputType = inputType || "touch";
    gestureActive = true;
    softDropAccum = 0;
    lastDragX = -999;

    // Calculate anchor offset: difference between finger column and piece X
    var state = engine.getPublicState();
    if (state.active && state.running && !state.paused && !state.gameOver) {
      var fingerCol = clientXToCol(clientX);
      dragAnchorOffset = fingerCol - state.active.x;
    } else {
      dragAnchorOffset = 0;
    }
    return true;
  }

  function moveGesture(clientX, clientY) {
    var state = engine.getPublicState();
    if (!state.running || state.paused || state.gameOver || !state.active)
      return;

    var totalDx = Math.abs(clientX - touchStartX);
    var totalDy = Math.abs(clientY - touchStartY);
    if (totalDx >= dragIntentThreshold || totalDy >= dragIntentThreshold) {
      gestureIntentMoved = true;
    }

    /* ── Horizontal: Direct drag-and-drop (piece follows finger column) ── */
    var fingerCol = clientXToCol(clientX);
    var targetX = Math.round(fingerCol - dragAnchorOffset);
    var currentX = state.active.x;

    if (targetX !== currentX && targetX !== lastDragX) {
      ensureAudio();
      var dir = targetX > currentX ? 1 : -1;
      var steps = Math.abs(targetX - currentX);
      for (var i = 0; i < steps; i++) {
        if (!engine.move(dir)) break;
      }
      lastDragX = targetX;
      hideGestureHint();
    }

    /* ── Vertical: Drag down = soft drop (mapped to cell height) ── */
    var dy = clientY - touchStartY;
    if (dy > 0) {
      var cellH = getRenderedCellH();
      var dropsNeeded = Math.floor(dy / cellH);
      while (softDropAccum < dropsNeeded) {
        ensureAudio();
        var sd = engine.softDrop();
        if (sd.moved) audio.softDrop();
        softDropAccum++;
        if (sd.locked) {
          handleLock(sd);
          break;
        }
      }
      if (dropsNeeded > 0) {
        hideGestureHint();
      }
    }
  }

  function handleBoardTapAction() {
    ensureAudio();

    var state = engine.getPublicState();

    // If game over or not running, start/restart game
    if (!state.running || state.gameOver) {
      startGame();
      hideGestureHint();
      return;
    }

    // If paused, resume
    if (state.paused) {
      engine.togglePause();
      return;
    }

    // Tap/click = rotate clockwise
    if (engine.rotate(1)) {
      audio.rotate();
      vibrateShort();
    }
    hideGestureHint();
  }

  function endGesture(clientX, clientY) {
    if (!gestureActive) return;

    var dx = clientX - touchStartX;
    var dy = clientY - touchStartY;
    var dt = Date.now() - touchStartTime;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);
    gestureActive = false;
    lastGestureEndAt = Date.now();
    var maxTapTime =
      gestureInputType === "mouse" ? tapMaxTimeMouse : tapMaxTimeTouch;

    // ── TAP/CLICK DETECTION: tap/click = rotate ──
    if (
      !gestureIntentMoved &&
      dt < maxTapTime &&
      absDx < tapMaxDist &&
      absDy < tapMaxDist
    ) {
      handleBoardTapAction();
      return;
    }

    // Only process end-swipes if game is active
    var state = engine.getPublicState();
    if (!state.running || state.paused || state.gameOver) return;

    // ── SWIPE UP = HARD DROP ──
    if (dy < -40 && absDy > absDx && dt < 450) {
      var hd = engine.hardDrop();
      if (hd.locked) {
        audio.hardDrop();
        spawnHardDropParticles(state.active);
        triggerShake(6);
        handleLock(hd);
        vibrateShort();
      }
      hideGestureHint();
    }
  }

  // Prevent iOS context menu / callout on long-press over the board
  if (boardWrapEl) {
    boardWrapEl.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  // Board gesture handlers — use TOUCH EVENTS as primary (best iPhone compat)
  // Pointer Events as secondary for desktop mouse testing.
  // iOS Safari 13+ supports PointerEvent but touch events are more reliable
  // for drag-and-drop on real devices.
  if (boardWrapEl) {
    // ── TOUCH EVENTS (primary — iPhone / Android) ──
    boardWrapEl.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1) return;
        if (!beginGesture(e.touches[0].clientX, e.touches[0].clientY, "touch"))
          return;
        e.preventDefault();
      },
      { passive: false },
    );

    boardWrapEl.addEventListener(
      "touchmove",
      function (e) {
        if (!gestureActive) return;
        e.preventDefault();
        if (e.touches.length !== 1) return;
        moveGesture(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false },
    );

    boardWrapEl.addEventListener(
      "touchend",
      function (e) {
        if (!gestureActive || !e.changedTouches.length) return;
        suppressSyntheticClickUntil = Date.now() + 450;
        e.preventDefault();
        endGesture(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      },
      { passive: false },
    );

    boardWrapEl.addEventListener("touchcancel", function () {
      gestureActive = false;
      suppressSyntheticClickUntil = Date.now() + 450;
    });

    // ── MOUSE EVENTS (desktop fallback for testing) ──
    boardWrapEl.addEventListener(
      "mousedown",
      function (e) {
        if (e.button !== 0) return;
        if (!beginGesture(e.clientX, e.clientY, "mouse")) return;
        e.preventDefault();
      },
      { passive: false },
    );

    boardWrapEl.addEventListener(
      "mousemove",
      function (e) {
        if (!gestureActive) return;
        e.preventDefault();
        moveGesture(e.clientX, e.clientY);
      },
      { passive: false },
    );

    boardWrapEl.addEventListener("mouseup", function (e) {
      if (!gestureActive) return;
      endGesture(e.clientX, e.clientY);
    });

    boardWrapEl.addEventListener("mouseleave", function () {
      if (gestureActive) {
        gestureActive = false;
      }
    });

    // Click fallback: guarantees rotate/start/resume when a plain click lands
    // without a completed drag sequence. Synthetic iOS clicks are ignored.
    boardWrapEl.addEventListener("click", function (e) {
      if (Date.now() < suppressSyntheticClickUntil) {
        e.preventDefault();
        return;
      }
      if (Date.now() - lastGestureEndAt < 220) return;
      if (e.button !== undefined && e.button !== 0) return;
      handleBoardTapAction();
    });
  }

  /* ══════════════════════════════════════════════════════════════
   *  12c. PREVENT PAGE SCROLL DURING GAMEPLAY  (FULL LOCKDOWN)
   *
   *  Root-cause fix:  On mobile, ANY touchmove on the page was
   *  scrolling the viewport instead of moving the Tetris piece.
   *  The old handler only blocked scroll when the touch target was
   *  inside boardWrapEl or mobileControlsEl — touches on the hero,
   *  HUD, game-shell, or body itself still scrolled the page.
   *
   *  Fix: During active gameplay, block ALL touchmove events on
   *  both <body> AND <html>.  Touches on the board are already
   *  handled by the boardWrap gesture system.  Touches elsewhere
   *  should simply be swallowed (no game action, no scroll).
   *
   *  When the game is NOT running / is paused / is game-over, we
   *  allow normal scroll so the user can navigate the page.
   * ══════════════════════════════════════════════════════════════ */
  var mobileControlsEl = document.getElementById("mobileControls");
  var gameShellEl = document.getElementById("gameShell");

  function isGameplayActive() {
    var state = engine.getPublicState();
    return state.running && !state.paused && !state.gameOver;
  }

  /* ── NUCLEAR SCROLL LOCK ──
   * iOS Safari initiates scroll gestures at the DOCUMENT level before
   * element-level handlers fire.  Using { capture: true } ensures our
   * preventDefault() runs first (capture phase → top-down).
   *
   * Previous bug: body/html listeners used bubble phase only, and
   * .game-shell had overflow-y:auto + -webkit-overflow-scrolling:touch,
   * creating an internal scrollable container that iOS happily scrolled
   * even though body was position:fixed.
   *
   * Fix: capture phase on DOCUMENT for both touchstart and touchmove,
   * plus element-level handlers as backup.
   * ──────────────────────────────────────────────────────────────── */

  // CAPTURE PHASE: Block touchmove at the very top of the event chain
  document.addEventListener(
    "touchmove",
    function (e) {
      if (isGameplayActive()) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true },
  );

  // CAPTURE PHASE: Block touchstart on non-interactive elements
  // This prevents iOS from even BEGINNING a scroll gesture
  document.addEventListener(
    "touchstart",
    function (e) {
      if (isGameplayActive()) {
        var tag = e.target.tagName;
        if (
          tag !== "BUTTON" &&
          tag !== "INPUT" &&
          tag !== "A" &&
          tag !== "LABEL" &&
          tag !== "SELECT" &&
          tag !== "SUMMARY"
        ) {
          e.preventDefault();
        }
      }
    },
    { passive: false, capture: true },
  );

  // BUBBLE PHASE BACKUP: body
  document.body.addEventListener(
    "touchmove",
    function (e) {
      if (isGameplayActive()) {
        e.preventDefault();
      }
    },
    { passive: false },
  );

  // BUBBLE PHASE BACKUP: <html>
  document.documentElement.addEventListener(
    "touchmove",
    function (e) {
      if (isGameplayActive()) {
        e.preventDefault();
      }
    },
    { passive: false },
  );

  // game-shell specific handlers (belt-and-suspenders)
  if (gameShellEl) {
    gameShellEl.addEventListener(
      "touchstart",
      function (e) {
        if (isGameplayActive()) {
          var tag = e.target.tagName;
          if (tag !== "BUTTON" && tag !== "INPUT" && tag !== "A") {
            e.preventDefault();
          }
        }
      },
      { passive: false },
    );

    gameShellEl.addEventListener(
      "touchmove",
      function (e) {
        if (isGameplayActive()) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }

  // Stop all DAS when game ends or pauses
  window.addEventListener("blur", stopAllDAS);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopAllDAS();
  });

  /* ══════════════════════════════════════════════════════════════
   *  13. GAME ACTIONS
   * ══════════════════════════════════════════════════════════════ */
  function startGame() {
    ensureAudio();
    hideGameOverOverlay();
    var state = engine.getPublicState();
    var mode = state.mode;
    engine.start(mode);
    prevLevel = 1;
    gameOverShown = false;
    comboTextTimer = 0;
    comboTextValue = 0;
    b2bGlowTimer = 0;
    levelTransitionTimer = 0;
    forceBlastTimer = 0;
    flashTimer = 0;
    particles = [];

    startBtn.textContent = "Restart Mission";
    missionText.textContent = "The trench run has begun. Stack with precision.";
    eventFeed.innerHTML = "";

    audio.start();

    addEventToFeed(
      "Mission initiated. " +
        (mode === "empire" ? "Empire Assault" : "Alliance Standard") +
        " mode.",
    );
  }

  function toggleMode() {
    var state = engine.getPublicState();
    var newMode = state.mode === "empire" ? "standard" : "empire";
    engine.setMode(newMode);
    modeBtn.textContent =
      "Mode: " + (newMode === "empire" ? "Empire" : "Alliance");
  }

  function activateForceBlast() {
    var beforeState = engine.getPublicState();
    var result = engine.activateForce();
    if (result.used) {
      audio.forceBlast();
      if (result.clearedRow >= 0) {
        forceBlastTimer = 600;
        forceBlastRow = result.clearedRow;
        spawnForceBlastParticles(result.clearedRow);
        triggerShake(10);
        flashTimer = 200;
      }
    }
  }

  function handleLock(result) {
    audio.lock();
    if (result.clearedCount > 0) {
      audio.lineClear(result.clearedCount);
      spawnLineClearParticles(result.clearedRows);

      if (result.clearedCount === 4) {
        triggerShake(12);
        flashTimer = 300;
        // TETRIS text flash (CSS animation)
        if (tetrisText) {
          tetrisText.classList.remove("flash");
          void tetrisText.offsetWidth; // reflow to restart animation
          tetrisText.classList.add("flash");
          setTimeout(function () {
            tetrisText.classList.remove("flash");
          }, 1200);
        }
      } else if (result.clearedCount >= 2) {
        triggerShake(4);
      }
    }

    // Check combo from engine state
    var st = engine.getPublicState();
    if (st.combo > 0) {
      comboTextValue = st.combo;
      comboTextTimer = 1500;
      audio.combo(st.combo);
    }
  }

  /* ══════════════════════════════════════════════════════════════
   *  14. BUTTON WIRING
   * ══════════════════════════════════════════════════════════════ */
  startBtn.addEventListener("click", function () {
    startGame();
  });

  pauseBtn.addEventListener("click", function () {
    ensureAudio();
    engine.togglePause();
  });

  modeBtn.addEventListener("click", function () {
    ensureAudio();
    toggleMode();
  });

  audioBtn.addEventListener("click", function () {
    ensureAudio();
    toggleAudio();
  });

  /* ══════════════════════════════════════════════════════════════
   *  14b. SETTINGS PANEL, LEADERBOARD MODAL, GAME OVER OVERLAY
   * ══════════════════════════════════════════════════════════════ */

  // Settings panel toggle
  function openSettings() {
    if (settingsPanel) settingsPanel.classList.add("open");
    if (settingsBackdrop) settingsBackdrop.classList.add("visible");
  }

  function closeSettings() {
    if (settingsPanel) settingsPanel.classList.remove("open");
    if (settingsBackdrop) settingsBackdrop.classList.remove("visible");
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", function () {
      ensureAudio();
      openSettings();
    });
  }

  if (settingsClose) {
    settingsClose.addEventListener("click", closeSettings);
  }

  if (settingsBackdrop) {
    settingsBackdrop.addEventListener("click", closeSettings);
  }

  // Settings controls
  if (volumeSlider) {
    volumeSlider.value = Math.round(audioVolume * 100);
    volumeSlider.addEventListener("input", function () {
      audioVolume = parseInt(this.value, 10) / 100;
      if (masterGain) masterGain.gain.value = audioVolume;
      if (volumeValue) volumeValue.textContent = this.value + "%";
    });
  }

  if (ghostToggle) {
    ghostToggle.checked = settings.ghost;
    ghostToggle.addEventListener("change", function () {
      settings.ghost = this.checked;
    });
  }

  if (gridToggle) {
    gridToggle.checked = settings.grid;
    gridToggle.addEventListener("change", function () {
      settings.grid = this.checked;
    });
  }

  if (particleToggle) {
    particleToggle.checked = settings.particles;
    particleToggle.addEventListener("change", function () {
      settings.particles = this.checked;
    });
  }

  // Leaderboard modal toggle
  function openLeaderboard() {
    if (leaderboardModal) leaderboardModal.classList.add("visible");
  }

  function closeLeaderboard() {
    if (leaderboardModal) leaderboardModal.classList.remove("visible");
  }

  if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", function () {
      openLeaderboard();
    });
  }

  if (leaderboardClose) {
    leaderboardClose.addEventListener("click", closeLeaderboard);
  }

  // Game over overlay (HTML-based)
  function showGameOverOverlay(state) {
    if (!gameOverOverlay) return;
    if (gameOverScore) gameOverScore.textContent = String(state.score);
    if (gameOverRank) gameOverRank.textContent = state.rank;
    if (gameOverLines)
      gameOverLines.textContent = state.lines + "  |  Level: " + state.level;
    gameOverOverlay.classList.add("visible");
  }

  function hideGameOverOverlay() {
    if (gameOverOverlay) gameOverOverlay.classList.remove("visible");
  }

  if (gameOverRestart) {
    gameOverRestart.addEventListener("click", function () {
      hideGameOverOverlay();
      startGame();
    });
  }

  if (gameOverLeaderboard) {
    gameOverLeaderboard.addEventListener("click", function () {
      hideGameOverOverlay();
      openLeaderboard();
    });
  }

  // 'L' key toggles leaderboard
  document.addEventListener("keydown", function (e) {
    if (e.code === "KeyL") {
      if (leaderboardModal && leaderboardModal.classList.contains("visible")) {
        closeLeaderboard();
      } else {
        openLeaderboard();
      }
    }
  });

  /* ══════════════════════════════════════════════════════════════
   *  15. MAIN GAME LOOP
   * ══════════════════════════════════════════════════════════════ */
  function gameLoop(timestamp) {
    animFrame = requestAnimationFrame(gameLoop);
    var dt = timestamp - lastTimestamp;
    if (dt > 200) dt = 200; // clamp after tab-away
    lastTimestamp = timestamp;

    // Tick engine
    var tickResult = engine.tick(dt);
    if (tickResult.locked) {
      handleLock(tickResult);
    }

    // Get state
    var state = engine.getPublicState();

    // Process events from engine
    var events = engine.pullEvents();
    if (events.length > 0) {
      processEvents(events);
    }

    // Level transition detection
    if (state.level !== prevLevel && state.running && !state.gameOver) {
      if (state.level > prevLevel) {
        levelTransitionTimer = 1200;
        audio.levelUp();
        addEventToFeed("Level " + state.level + " reached! Hyperspace jump!");
        missionText.textContent =
          "Level " + state.level + " - " + getMissionBrief(state.level);
        // Level up CSS flash
        if (levelUpFlash) {
          levelUpFlash.classList.remove("flash");
          void levelUpFlash.offsetWidth;
          levelUpFlash.classList.add("flash");
          setTimeout(function () {
            levelUpFlash.classList.remove("flash");
          }, 1500);
        }
      }
      prevLevel = state.level;
    }

    // Game over detection
    if (state.gameOver && !gameOverShown) {
      gameOverShown = true;
      audio.gameOver();
      missionText.textContent = "The fleet has fallen. Your legacy endures.";
      // Show HTML game over overlay
      setTimeout(function () {
        showGameOverOverlay(state);
      }, 800);
      setTimeout(function () {
        showLeaderboardModal(state);
      }, 2500);
    }

    // Update timers
    if (comboTextTimer > 0) comboTextTimer -= dt;
    if (levelTransitionTimer > 0) levelTransitionTimer -= dt;
    if (forceBlastTimer > 0) forceBlastTimer -= dt;
    if (flashTimer > 0) flashTimer -= dt;

    updateStars(dt);
    updateParticles(dt);
    updateShake();

    // Render
    renderBoard(state);
    renderNextQueue(state.queue);
    renderHold(state.holdType, state.canHold);
    updateHUD(state);
  }

  function getMissionBrief(level) {
    var briefs = [
      "",
      "Padawan training begins.",
      "Asteroid fields ahead.",
      "Enemy patrols detected.",
      "Entering the Outer Rim.",
      "Shield generators online.",
      "Approaching the trench.",
      "Heavy turbolaser fire!",
      "Deploy all squadrons.",
      "The Force grows stronger.",
      "Imperial fleet incoming!",
      "Deflector shields maximum!",
      "Targeting the reactor core.",
      "Use the Force, Jorge.",
      "Enemy reinforcements!",
      "Final approach vector.",
      "This is the end run.",
      "Full power to engines!",
      "One last chance.",
      "The Death Star awaits.",
      "Grand Master challenge!",
    ];
    return briefs[level] || "Unknown sector. Stay alert.";
  }

  /* ══════════════════════════════════════════════════════════════
   *  16. INITIALIZATION
   * ══════════════════════════════════════════════════════════════ */
  function init() {
    // Draw initial state
    highScoreEl.textContent = String(highScore);

    // Initial render of empty state
    var state = engine.getPublicState();
    renderBoard(state);
    renderNextQueue(state.queue);
    renderHold(null, true);
    updateHUD(state);

    missionText.textContent = "Press Start Mission to begin the trench run.";
    statusEl.textContent = "Waiting";

    // Start game loop
    lastTimestamp = performance.now();
    animFrame = requestAnimationFrame(gameLoop);
  }

  init();
})();
