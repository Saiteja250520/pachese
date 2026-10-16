// board.js - High-Fidelity Canvas Board Renderer for Pachese

const SAFE_SQUARES_SET = new Set([
  '16,8', '16,10', // Right arm
  '10,2', '8,2',   // Top arm
  '2,8',  '2,10',  // Left arm
  '8,16', '10,16'  // Bottom arm
]);

// Decorative middle lane X's to match photo
const DECORATIVE_X_SET = new Set([
  '15,9', '17,9', // Right arm middle
  '9,1',  '9,3',  // Top arm middle
  '1,9',  '3,9',  // Left arm middle
  '9,15', '9,17'  // Bottom arm middle
]);

class PacheseBoard {
  constructor(canvas, onCoinClick) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onCoinClick = onCoinClick;

    this.gridSize = 19;
    this.cellSize = 36;
    this.selectedCoin = null;
    this.previewPath = null;
    this.gameState = null;
    this.localPlayerRole = null;

    this.initCanvas();
    this.bindEvents();
  }

  initCanvas() {
    // Set internal resolution
    const size = 760;
    this.canvas.width = size;
    this.canvas.height = size;
    this.cellSize = size / this.gridSize;
  }

  bindEvents() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
  }

  updateState(gameState, localPlayerRole) {
    this.gameState = gameState;
    this.localPlayerRole = localPlayerRole;
    this.render();
  }

  setPreview(coin, pathCoordinates) {
    this.selectedCoin = coin;
    this.previewPath = pathCoordinates;
    this.render();
  }

  clearPreview() {
    this.selectedCoin = null;
    this.previewPath = null;
    this.render();
  }

  // Coordinate check for valid arm cell
  isPlayableCell(x, y) {
    // Center Charkoni (8..10, 8..10)
    if (x >= 8 && x <= 10 && y >= 8 && y <= 10) return true;
    // Top arm (x: 8..10, y: 0..7)
    if (x >= 8 && x <= 10 && y >= 0 && y <= 7) return true;
    // Bottom arm (x: 8..10, y: 11..18)
    if (x >= 8 && x <= 10 && y >= 11 && y <= 18) return true;
    // Left arm (x: 0..7, y: 8..10)
    if (x >= 0 && x <= 7 && y >= 8 && y <= 10) return true;
    // Right arm (x: 11..18, y: 8..10)
    if (x >= 11 && x <= 18 && y >= 8 && y <= 10) return true;
    return false;
  }

  render() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Background Marble/Cloth
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width/2);
    bgGrad.addColorStop(0, '#1c0f0a');
    bgGrad.addColorStop(1, '#0e0604');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render Grid Cells
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        if (!this.isPlayableCell(x, y)) continue;

        // Skip center charkoni (rendered separately)
        if (x >= 8 && x <= 10 && y >= 8 && y <= 10) continue;

        const px = x * cs;
        const py = y * cs;

        // Cell background: textured maroon
        ctx.fillStyle = '#3a1215';
        ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);

        // Inner bevel
        ctx.strokeStyle = '#5a1d22';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);

        // Beaded green border dots
        this.drawBeadBorders(px, py, cs);

        // Pink 'X' Marks
        const key = `${x},${y}`;
        if (SAFE_SQUARES_SET.has(key)) {
          this.drawSafeX(px + cs/2, py + cs/2, cs * 0.35, true);
        } else if (DECORATIVE_X_SET.has(key)) {
          this.drawSafeX(px + cs/2, py + cs/2, cs * 0.35, false);
        }

        // T1 Start Block (11, 9)
        if (x === 11 && y === 9) {
          this.drawStartDot(px + cs/2, py + cs/2, '#ef4444', 'T1');
        }

        // T2 Start Block (7, 9)
        if (x === 7 && y === 9) {
          this.drawStartDot(px + cs/2, py + cs/2, '#3b82f6', 'T2');
        }
      }
    }

    // 3. Central Charkoni (Center 3x3)
    this.drawCharkoni(8 * cs, 8 * cs, 3 * cs);

    // 4. Directional Triangles
    this.drawCenterTriangles(cs);

    // 5. Ghost Trajectory Preview
    if (this.previewPath && this.previewPath.length > 0) {
      this.drawTrajectory(this.previewPath);
    }

    // 6. Coins
    if (this.gameState) {
      this.drawCoins();
    }
  }

  // Draw beaded green border around a cell
  drawBeadBorders(px, py, cs) {
    const ctx = this.ctx;
    ctx.fillStyle = '#4ade80'; // vibrant light green bead
    const dotR = 1.4;

    // Draw small green beads along the 4 edges
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const offset = (i / steps) * cs;
      // top
      ctx.beginPath(); ctx.arc(px + offset, py, dotR, 0, Math.PI*2); ctx.fill();
      // bottom
      ctx.beginPath(); ctx.arc(px + offset, py + cs, dotR, 0, Math.PI*2); ctx.fill();
      // left
      ctx.beginPath(); ctx.arc(px, py + offset, dotR, 0, Math.PI*2); ctx.fill();
      // right
      ctx.beginPath(); ctx.arc(px + cs, py + offset, dotR, 0, Math.PI*2); ctx.fill();
    }
  }

  // Draw pink X safe mark
  drawSafeX(cx, cy, r, isActiveSafe) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = isActiveSafe ? 3.5 : 2;
    ctx.strokeStyle = isActiveSafe ? '#f472b6' : '#ec489988';
    if (isActiveSafe) {
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Start Dot
  drawStartDot(cx, cy, color, label) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }

  // Draw Central Charkoni with Concentric Diamonds
  drawCharkoni(x, y, size) {
    const ctx = this.ctx;
    const cx = x + size/2;
    const cy = y + size/2;

    // Beige/Cream background
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x, y, size, size);

    // Beaded boundary
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // Concentric diamonds (matching the photo)
    const layers = [
      { r: size * 0.42, color: '#ec4899', width: 4 }, // pink
      { r: size * 0.35, color: '#22c55e', width: 4 }, // green
      { r: size * 0.28, color: '#eab308', width: 4 }, // yellow
      { r: size * 0.21, color: '#f97316', width: 3 }, // orange
      { r: size * 0.14, color: '#ef4444', fill: true } // red center
    ];

    layers.forEach(layer => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - layer.r);
      ctx.lineTo(cx + layer.r, cy);
      ctx.lineTo(cx, cy + layer.r);
      ctx.lineTo(cx - layer.r, cy);
      ctx.closePath();

      if (layer.fill) {
        ctx.fillStyle = layer.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.stroke();
      }
    });

    // "HOME" text in center
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText('HOME', cx, cy);
    ctx.shadowBlur = 0;
  }

  // Draw Entrance Triangles (Red top, Green right, Yellow bottom, Blue left)
  drawCenterTriangles(cs) {
    const ctx = this.ctx;
    const r = 8; // triangle size

    // Top: Red triangle pointing down
    this.drawTriangle(9.5 * cs, 8 * cs - 4, '#ef4444', 'DOWN');
    // Right: Green triangle pointing left
    this.drawTriangle(11 * cs + 4, 9.5 * cs, '#22c55e', 'LEFT');
    // Bottom: Yellow triangle pointing up
    this.drawTriangle(9.5 * cs, 11 * cs + 4, '#eab308', 'UP');
    // Left: Blue triangle pointing right
    this.drawTriangle(8 * cs - 4, 9.5 * cs, '#3b82f6', 'RIGHT');
  }

  drawTriangle(cx, cy, color, dir) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = 6;
    if (dir === 'DOWN') {
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy - s);
      ctx.lineTo(cx, cy + s);
    } else if (dir === 'UP') {
      ctx.moveTo(cx - s, cy + s);
      ctx.lineTo(cx + s, cy + s);
      ctx.lineTo(cx, cy - s);
    } else if (dir === 'LEFT') {
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.lineTo(cx - s, cy);
    } else if (dir === 'RIGHT') {
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.lineTo(cx + s, cy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw Ghost Path
  drawTrajectory(pathCoords) {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.save();
    ctx.strokeStyle = '#fbbf24'; // glowing gold
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    pathCoords.forEach((pt, idx) => {
      const cx = (pt.x + 0.5) * cs;
      const cy = (pt.y + 0.5) * cs;
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Pulse target landing square
    if (pathCoords.length > 0) {
      const target = pathCoords[pathCoords.length - 1];
      const tcx = (target.x + 0.5) * cs;
      const tcy = (target.y + 0.5) * cs;

      ctx.setLineDash([]);
      ctx.fillStyle = '#fbbf2444';
      ctx.beginPath();
      ctx.arc(tcx, tcy, cs * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tcx, tcy, cs * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw Coins
  drawCoins() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    // Group coins by coordinate
    const coordMap = new Map();

    ['T1', 'T2'].forEach(team => {
      this.gameState.coins[team].forEach(coin => {
        if (coin.stepIndex >= 0 && coin.stepIndex < 80) {
          // Track position
          const track = (team === 'T1') ? window.PacheseTracks.T1 : window.PacheseTracks.T2;
          const coord = track[coin.stepIndex];
          if (coord) {
            const key = `${coord.x},${coord.y}`;
            if (!coordMap.has(key)) coordMap.set(key, []);
            coordMap.get(key).push(coin);
          }
        }
      });
    });

    // Render grouped coins
    coordMap.forEach((coins, key) => {
      const [x, y] = key.split(',').map(Number);
      const cx = (x + 0.5) * cs;
      const cy = (y + 0.5) * cs;

      const isSafe = SAFE_SQUARES_SET.has(key);
      const isQuadrupleStack = (coins.length === 4 && coins.every(c => c.team === coins[0].team));

      if (isQuadrupleStack && isSafe) {
        // Fire alert aura around quadruple stack!
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.48, 0, Math.PI * 2);
        ctx.fillStyle = '#dc262644';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }

      if (coins.length === 1) {
        this.drawSingleCoin(cx, cy, coins[0]);
      } else {
        // Stacked coins: draw top coin with count badge
        this.drawSingleCoin(cx, cy, coins[0]);
        this.drawStackBadge(cx + cs * 0.25, cy - cs * 0.25, coins.length, isQuadrupleStack);
      }
    });
  }

  drawSingleCoin(cx, cy, coin) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const r = cs * 0.35;
    const isT1 = (coin.team === 'T1');

    ctx.save();
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Outer Rim (Gold / Silver)
    const rimGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rimGrad.addColorStop(0, isT1 ? '#f59e0b' : '#93c5fd');
    rimGrad.addColorStop(1, isT1 ? '#b45309' : '#1e40af');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner Body (Ruby Red for T1, Sapphire Blue for T2)
    const bodyGrad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, 2, cx, cy, r*0.8);
    if (isT1) {
      bodyGrad.addColorStop(0, '#f87171');
      bodyGrad.addColorStop(0.5, '#dc2626');
      bodyGrad.addColorStop(1, '#7f1d1d');
    } else {
      bodyGrad.addColorStop(0, '#60a5fa');
      bodyGrad.addColorStop(0.5, '#2563eb');
      bodyGrad.addColorStop(1, '#1e3a8a');
    }
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Selected highlight pulse
    if (this.selectedCoin && this.selectedCoin.id === coin.id) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Number / ID
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    const num = parseInt(coin.id.split('_')[1]) + 1;
    ctx.fillText(num, cx, cy);

    ctx.restore();
  }

  drawStackBadge(bx, by, count, isVulnerable) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = isVulnerable ? '#ef4444' : '#1f2937';
    ctx.fill();
    ctx.strokeStyle = isVulnerable ? '#fca5a5' : '#e5e7eb';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${count}`, bx, by);
    ctx.restore();
  }

  handleClick(e) {
    if (!this.gameState) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;

    const gx = Math.floor(mx / this.cellSize);
    const gy = Math.floor(my / this.cellSize);

    // Find if a coin was clicked
    let clickedCoin = null;
    const team = this.gameState.turnState.currentLeader;

    // Check on-board coins of current leader
    this.gameState.coins[team].forEach(coin => {
      if (coin.stepIndex >= 0 && coin.stepIndex < 80) {
        const track = (team === 'T1') ? window.PacheseTracks.T1 : window.PacheseTracks.T2;
        const coord = track[coin.stepIndex];
        if (coord && coord.x === gx && coord.y === gy) {
          clickedCoin = coin;
        }
      }
    });

    if (clickedCoin && this.onCoinClick) {
      this.onCoinClick(clickedCoin);
    }
  }

  handleHover(e) {
    // Optional tooltip or hover indicator
  }
}

window.PacheseBoard = PacheseBoard;
