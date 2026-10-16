// pacheseRules.js - Authoritative Pachese Game Logic Engine

// 19x19 Coordinate Grid:
// Center Charkoni is (9,9) surrounded by (8..10, 8..10)
// Safe squares on outer perimeter (8 squares total):
const SAFE_SQUARES = new Set([
  '16,8', '16,10', // Right arm (T1)
  '10,2', '8,2',   // Top arm
  '2,8',  '2,10',  // Left arm (T2)
  '8,16', '10,16'  // Bottom arm
]);

// Build 80-step track for Team 1 (starts Right Arm / East)
function generateT1Track() {
  const track = [];
  // 0..7: Outbound middle lane of Right arm (East) from innermost (11,9) to tip (18,9)
  for (let x = 11; x <= 18; x++) track.push({ x, y: 9 });
  // 8..15: Top column of Right arm heading West towards center: (18,8) to (11,8)
  for (let x = 18; x >= 11; x--) track.push({ x, y: 8 });
  // 16..23: Top arm right column heading North to tip: (10,7) to (10,0)
  for (let y = 7; y >= 0; y--) track.push({ x: 10, y });
  // 24..31: Top arm left column heading South towards center: (8,0) to (8,7)
  for (let y = 0; y <= 7; y++) track.push({ x: 8, y });
  // 32..39: Left arm top column heading West to tip: (7,8) to (0,8)
  for (let x = 7; x >= 0; x--) track.push({ x, y: 8 });
  // 40..47: Left arm bottom column heading East towards center: (0,10) to (7,10)
  for (let x = 0; x <= 7; x++) track.push({ x, y: 10 });
  // 48..55: Bottom arm left column heading South to tip: (8,11) to (8,18)
  for (let y = 11; y <= 18; y++) track.push({ x: 8, y });
  // 56..63: Bottom arm right column heading North towards center: (10,18) to (10,11)
  for (let y = 18; y >= 11; y--) track.push({ x: 10, y });
  // 64..71: Right arm bottom column heading East to tip: (11,10) to (18,10)
  for (let x = 11; x <= 18; x++) track.push({ x, y: 10 });
  // 72..78: Inbound middle lane of Right arm heading West towards Center: (18,9) down to (12,9)
  for (let x = 18; x >= 12; x--) track.push({ x, y: 9 });
  // 79: Start Block (11,9) - FORBIDDEN TO LAND ON!
  track.push({ x: 11, y: 9, isStartBlock: true });
  // 80: Home Center (9,9)
  track.push({ x: 9, y: 9, isHome: true });
  return track;
}

// Build 80-step track for Team 2 (starts Left Arm / West, 180 deg rotated)
function generateT2Track(t1Track) {
  return t1Track.map(coord => {
    if (coord.isHome) return { x: 9, y: 9, isHome: true };
    return {
      x: 18 - coord.x,
      y: 18 - coord.y,
      isStartBlock: !!coord.isStartBlock
    };
  });
}

const TRACKS = {
  T1: generateT1Track(),
  T2: generateT2Track(generateT1Track())
};

// Cowrie scoring definitions
const SCORING_TABLE = {
  0: { score: 7, extraChance: true, canEnter: false },
  1: { score: 10, extraChance: true, canEnter: true },
  2: { score: 2, extraChance: false, canEnter: false },
  3: { score: 3, extraChance: false, canEnter: false },
  4: { score: 4, extraChance: false, canEnter: false },
  5: { score: 25, extraChance: true, canEnter: true },
  6: { score: 30, extraChance: true, canEnter: true },
  7: { score: 14, extraChance: true, canEnter: false }
};

function rollCowrieShells() {
  const shells = [];
  let whites = 0;
  for (let i = 0; i < 7; i++) {
    const isWhite = Math.random() < 0.5;
    shells.push(isWhite ? 1 : 0);
    if (isWhite) whites++;
  }
  const blacks = 7 - whites;
  const rule = SCORING_TABLE[whites];
  return {
    shells,
    whites,
    blacks,
    score: rule.score,
    extraChance: rule.extraChance,
    canEnter: rule.canEnter
  };
}

class PacheseGame {
  constructor(roomId, mode = '1v1') {
    this.roomId = roomId;
    this.mode = mode; // '1v1' or '2v2'
    this.status = 'WAITING'; // WAITING, PLAYING, FINISHED

    // Players: { socketId, team: 'T1'|'T2', role: 'LEADER'|'PLAYER2', name }
    this.players = [];

    // Coins: 8 for T1, 8 for T2
    // stepIndex: -1 = in reserve (off-board)
    // 0 = at start block (entered)
    // 1..79 = on track
    // 80 = HOME
    this.coins = {
      T1: Array.from({ length: 8 }, (_, i) => ({ id: `T1_${i}`, team: 'T1', stepIndex: -1 })),
      T2: Array.from({ length: 8 }, (_, i) => ({ id: `T2_${i}`, team: 'T2', stepIndex: -1 }))
    };

    // Unlock status for home entry (must make at least 1 capture)
    this.homeUnlocked = {
      T1: false,
      T2: false
    };

    // Turn flow
    // In 1v1: T1 -> T2
    // In 2v2: T1_L -> T2_L -> T1_P2 -> T2_P2
    this.turnOrder = mode === '2v2' 
      ? ['T1_LEADER', 'T2_LEADER', 'T1_PLAYER2', 'T2_PLAYER2']
      : ['T1_LEADER', 'T2_LEADER'];
    this.currentTurnIndex = 0;

    // Current turn state
    this.turnState = {
      phase: 'THROWING', // 'THROWING' or 'MOVING'
      currentThrower: this.turnOrder[0],
      currentLeader: 'T1', // which team leader moves coins
      collectedScores: [], // [{ id, score, canEnter, used: false }]
      consecutiveSpecialCount: 0,
      boardSnapshot: null, // snapshot before moves begin for rollback
      lastRoll: null,
      historyLog: []
    };

    this.winner = null;
  }

  getCurrentTeam() {
    return this.turnState.currentThrower.startsWith('T1') ? 'T1' : 'T2';
  }

  getOpponentTeam(team) {
    return team === 'T1' ? 'T2' : 'T1';
  }

  getCoordForStep(team, stepIndex) {
    if (stepIndex < 0 || stepIndex > 80) return null;
    return TRACKS[team][stepIndex];
  }

  takeSnapshot() {
    return {
      coins: JSON.parse(JSON.stringify(this.coins)),
      homeUnlocked: { ...this.homeUnlocked }
    };
  }

  restoreSnapshot(snapshot) {
    this.coins = JSON.parse(JSON.stringify(snapshot.coins));
    this.homeUnlocked = { ...snapshot.homeUnlocked };
  }

  // Check if target step has safe block
  isStepSafe(team, stepIndex) {
    if (stepIndex <= 7 || stepIndex >= 72) return false; // middle lanes are private, not safe blocks
    const coord = this.getCoordForStep(team, stepIndex);
    if (!coord) return false;
    return SAFE_SQUARES.has(`${coord.x},${coord.y}`);
  }

  // Get coins occupying a specific coordinate
  getCoinsAtCoord(x, y) {
    const list = [];
    ['T1', 'T2'].forEach(t => {
      this.coins[t].forEach(coin => {
        if (coin.stepIndex >= 0 && coin.stepIndex < 80) {
          const coord = this.getCoordForStep(t, coin.stepIndex);
          if (coord && coord.x === x && coord.y === y) {
            list.push(coin);
          }
        }
      });
    });
    return list;
  }

  // Validate if a coin can legally move with a given score
  canCoinMove(team, coin, scoreItem) {
    const { score, canEnter } = scoreItem;

    // 1. Off-board coin
    if (coin.stepIndex === -1) {
      if (!canEnter) return false;
      // Option B: Enters on start block (step 0), and can move by `score` steps!
      const targetStep = score; // from 0 + score
      return this.validateTargetStep(team, coin, targetStep);
    }

    // 2. Already at Home
    if (coin.stepIndex === 80) return false;

    // 3. Normal move on track
    const targetStep = coin.stepIndex + score;
    return this.validateTargetStep(team, coin, targetStep);
  }

  validateTargetStep(team, coin, targetStep) {
    // Cannot overshoot Home (80)
    if (targetStep > 80) return false;

    // Home entry lock check:
    // Safe block immediately before home route is step 69
    // If not unlocked, coin cannot proceed past step 69!
    if (!this.homeUnlocked[team] && targetStep > 69) {
      // If currently before 69, can it land on 69? Yes, but not past 69!
      if (coin.stepIndex < 69 && targetStep > 69) return false;
      if (coin.stepIndex === 69) return false; // stuck until team captures
    }

    // Returning coin landing check:
    // Step 79 is the Start Block on the return path!
    // "if the home coming coin end up at that start position it is not valid"
    if (targetStep === 79) return false;

    // If target is Home (80), it's always legal
    if (targetStep === 80) return true;

    // Target coordinate
    const targetCoord = this.getCoordForStep(team, targetStep);
    if (!targetCoord) return false;

    // Check who is on targetCoord
    const occupants = this.getCoinsAtCoord(targetCoord.x, targetCoord.y);
    const oppTeam = this.getOpponentTeam(team);
    const oppOccupants = occupants.filter(c => c.team === oppTeam);
    const friendlyOccupants = occupants.filter(c => c.team === team);

    const isSafe = this.isStepSafe(team, targetStep);

    if (isSafe) {
      // Safe block rules:
      // 1-3 enemy coins: opponent is blocked from landing!
      if (oppOccupants.length >= 1 && oppOccupants.length <= 3) {
        return false;
      }
      // 4 enemy coins: vulnerable! Enemy CAN land and capture all 4!
      if (oppOccupants.length === 4) {
        return true;
      }
      // Max 4 friendly coins on a safe square
      if (friendlyOccupants.length >= 4) {
        return false;
      }
    } else {
      // Ordinary track square (not safe):
      // Friendly coins cannot stack indefinitely on ordinary squares? (max 1 or shared?)
      // Standard Pachese allows sharing friendly coins or moving past.
    }

    return true;
  }

  // Get all legal moves available with remaining scores
  getAvailableMoves() {
    const team = this.turnState.currentLeader;
    const unusedScores = this.turnState.collectedScores.filter(s => !s.used);
    const moves = [];

    unusedScores.forEach(scoreItem => {
      this.coins[team].forEach(coin => {
        if (this.canCoinMove(team, coin, scoreItem)) {
          moves.push({
            coinId: coin.id,
            scoreId: scoreItem.id,
            score: scoreItem.score,
            canEnter: scoreItem.canEnter,
            fromStep: coin.stepIndex,
            toStep: coin.stepIndex === -1 ? scoreItem.score : coin.stepIndex + scoreItem.score
          });
        }
      });
    });

    return moves;
  }

  // Execute a throw
  throwDice(playerRole) {
    if (this.turnState.phase !== 'THROWING') {
      return { error: 'Not in throwing phase' };
    }
    if (this.turnState.currentThrower !== playerRole) {
      return { error: 'Not your turn to throw' };
    }

    const roll = rollCowrieShells();
    this.turnState.lastRoll = roll;

    // Check consecutive specials (10, 25, 30)
    const isSpecial10_25_30 = (roll.score === 10 || roll.score === 25 || roll.score === 30);
    if (isSpecial10_25_30) {
      if (this.turnState.consecutiveSpecialCount === 0) {
        // Snapshot the board before the special streak starts so newly entered coins can be moved back out
        this.turnState.specialStreakSnapshot = this.takeSnapshot();
      }
      this.turnState.consecutiveSpecialCount++;
    } else {
      // 7, 14, or normal roll breaks the consecutive sequence
      this.turnState.consecutiveSpecialCount = 0;
      this.turnState.specialStreakSnapshot = null;
    }

    if (this.turnState.consecutiveSpecialCount === 3) {
      // 3 consecutive specials -> CANCEL ALL 3 and move newly entered coins back out to reserve!
      if (this.turnState.specialStreakSnapshot) {
        this.restoreSnapshot(this.turnState.specialStreakSnapshot);
      }
      this.turnState.collectedScores = this.turnState.collectedScores.filter(s => !s.isSpecial10_25_30);
      this.turnState.consecutiveSpecialCount = 0;
      this.turnState.specialStreakSnapshot = null;
      this.turnState.historyLog.push({
        type: 'PENALTY',
        text: `💥 3 consecutive special throws (10/25/30)! All 3 cancelled and coins moved back out to reserve. 1 fresh chance granted.`
      });
      return {
        roll,
        cancelledThree: true,
        continueThrowing: true,
        collectedScores: this.turnState.collectedScores
      };
    }

    // Option B: When rolling 10, 25, or 30, a coin from reserve enters on the home start block (step 0)!
    if (roll.canEnter) {
      const team = this.turnState.currentLeader;
      const reserveCoin = this.coins[team].find(c => c.stepIndex === -1);
      if (reserveCoin) {
        reserveCoin.stepIndex = 0; // Enters on Start Block (red dot)
        this.turnState.historyLog.push({
          type: 'ENTRY',
          text: `🚀 Coin #${parseInt(reserveCoin.id.split('_')[1]) + 1} entered on the Home Start Block (Red Dot)!`
        });
      }
    }

    // Add score to collected pool
    const scoreItem = {
      id: `score_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      score: roll.score,
      canEnter: roll.canEnter,
      isSpecial10_25_30,
      used: false
    };
    this.turnState.collectedScores.push(scoreItem);

    if (roll.extraChance) {
      this.turnState.historyLog.push({
        type: 'ROLL',
        text: `${this.turnState.currentThrower} rolled ${roll.whites}W ${roll.blacks}B = ${roll.score}! Bonus throw earned!`
      });
      return {
        roll,
        continueThrowing: true,
        collectedScores: this.turnState.collectedScores
      };
    } else {
      // Normal throw -> Throwing phase ends, Moving phase begins!
      this.turnState.phase = 'MOVING';
      this.turnState.boardSnapshot = this.takeSnapshot();
      this.turnState.historyLog.push({
        type: 'ROLL',
        text: `${this.turnState.currentThrower} rolled ${roll.whites}W ${roll.blacks}B = ${roll.score}. Throwing ended. Leader may move.`
      });

      // Check if any legal move is possible at all
      this.checkAndHandleDeadlockOrRollback();

      return {
        roll,
        continueThrowing: false,
        collectedScores: this.turnState.collectedScores
      };
    }
  }

  // Execute a coin move by Leader
  executeMove(coinId, scoreId) {
    if (this.turnState.phase !== 'MOVING') {
      return { error: 'Not in moving phase' };
    }

    const team = this.turnState.currentLeader;
    const coin = this.coins[team].find(c => c.id === coinId);
    const scoreItem = this.turnState.collectedScores.find(s => s.id === scoreId && !s.used);

    if (!coin || !scoreItem) {
      return { error: 'Invalid coin or score' };
    }

    if (!this.canCoinMove(team, coin, scoreItem)) {
      return { error: 'Illegal move for this coin' };
    }

    // Apply move
    const wasInReserve = (coin.stepIndex === -1);
    const fromStep = coin.stepIndex;
    const toStep = wasInReserve ? scoreItem.score : coin.stepIndex + scoreItem.score;

    coin.stepIndex = toStep;
    scoreItem.used = true;

    let captureOccurred = false;
    let capturedCoins = [];

    // Check for captures on landing square (if not Home)
    if (toStep < 80) {
      const coord = this.getCoordForStep(team, toStep);
      const oppTeam = this.getOpponentTeam(team);
      const oppCoinsOnSquare = this.coins[oppTeam].filter(c => {
        if (c.stepIndex < 0 || c.stepIndex >= 80) return false;
        const cCoord = this.getCoordForStep(oppTeam, c.stepIndex);
        return cCoord && cCoord.x === coord.x && cCoord.y === coord.y;
      });

      if (oppCoinsOnSquare.length > 0) {
        // Capture! Send them to reserve
        captureOccurred = true;
        oppCoinsOnSquare.forEach(c => {
          c.stepIndex = -1;
          capturedCoins.push(c.id);
        });

        // Unlock home for this team!
        this.homeUnlocked[team] = true;

        this.turnState.historyLog.push({
          type: 'CAPTURE',
          text: `🎉 Team ${team} captured ${oppCoinsOnSquare.length} opponent coin(s)! Home entry unlocked! Immediate bonus throw granted!`
        });

        // Capture immediately grants an additional throw!
        // The team MUST throw immediately!
        this.turnState.phase = 'THROWING';
        this.turnState.historyLog.push({
          type: 'BONUS_THROW_READY',
          text: `💥 CAPTURE! Immediate bonus throw granted! Toss the cowrie shells now!`
        });
      }
    }

    // Check Win Condition
    if (this.checkWin()) {
      return {
        success: true,
        winner: this.winner,
        coinId,
        fromStep,
        toStep,
        captureOccurred,
        capturedCoins
      };
    }

    // If a capture occurred, the phase is now THROWING (player must throw immediately).
    // Do not advance turn or check deadlock until throwing completes.
    if (captureOccurred) {
      return {
        success: true,
        coinId,
        fromStep,
        toStep,
        captureOccurred,
        capturedCoins,
        mustThrowNow: true,
        remainingScores: this.turnState.collectedScores.filter(s => !s.used),
        turnPhase: this.turnState.phase
      };
    }

    // Check if turn should continue or finish
    const remainingScores = this.turnState.collectedScores.filter(s => !s.used);
    if (remainingScores.length === 0) {
      // Turn complete!
      this.advanceTurn();
    } else {
      // Still scores left: check if any legal move is possible
      this.checkAndHandleDeadlockOrRollback();
    }

    return {
      success: true,
      coinId,
      fromStep,
      toStep,
      captureOccurred,
      capturedCoins,
      remainingScores: this.turnState.collectedScores.filter(s => !s.used),
      turnPhase: this.turnState.phase
    };
  }

  // Check if current unused scores can be completed legally. If impossible -> ROLLBACK!
  checkAndHandleDeadlockOrRollback() {
    const remainingScores = this.turnState.collectedScores.filter(s => !s.used);
    if (remainingScores.length === 0) return;

    // Check if there is ANY combination/sequence of moves that can legally use all remaining scores
    const team = this.turnState.currentLeader;
    const canCompleteAll = this.hasAnyLegalPlaySequence(team, remainingScores);

    if (!canCompleteAll) {
      // FULL TURN ROLLBACK TRIGGERED!
      this.turnState.historyLog.push({
        type: 'ROLLBACK',
        text: `⚠️ Incomplete play! Remaining scores cannot be legally played. FULL TURN ROLLED BACK! Turn passes.`
      });

      if (this.turnState.boardSnapshot) {
        this.restoreSnapshot(this.turnState.boardSnapshot);
      }

      this.advanceTurn();
    }
  }

  // Recursive search to see if a valid sequence exists to use all scores
  hasAnyLegalPlaySequence(team, scores) {
    if (scores.length === 0) return true;

    for (let i = 0; i < scores.length; i++) {
      const scoreItem = scores[i];
      for (const coin of this.coins[team]) {
        if (this.canCoinMove(team, coin, scoreItem)) {
          // Simulate move
          const prevStep = coin.stepIndex;
          coin.stepIndex = (coin.stepIndex === -1) ? scoreItem.score : coin.stepIndex + scoreItem.score;
          const nextScores = scores.filter((_, idx) => idx !== i);

          const possible = this.hasAnyLegalPlaySequence(team, nextScores);

          // Undo simulation
          coin.stepIndex = prevStep;

          if (possible) return true;
        }
      }
    }
    return false;
  }

  advanceTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    const nextThrower = this.turnOrder[this.currentTurnIndex];
    const nextLeader = nextThrower.startsWith('T1') ? 'T1' : 'T2';

    this.turnState = {
      phase: 'THROWING',
      currentThrower: nextThrower,
      currentLeader: nextLeader,
      collectedScores: [],
      consecutiveSpecialCount: 0,
      boardSnapshot: null,
      lastRoll: null,
      historyLog: this.turnState.historyLog
    };
  }

  checkWin() {
    const t1Home = this.coins.T1.filter(c => c.stepIndex === 80).length;
    const t2Home = this.coins.T2.filter(c => c.stepIndex === 80).length;

    if (t1Home === 8) {
      this.winner = 'T1';
      this.status = 'FINISHED';
      return true;
    }
    if (t2Home === 8) {
      this.winner = 'T2';
      this.status = 'FINISHED';
      return true;
    }
    return false;
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      mode: this.mode,
      status: this.status,
      players: this.players,
      coins: this.coins,
      homeUnlocked: this.homeUnlocked,
      turnState: {
        phase: this.turnState.phase,
        currentThrower: this.turnState.currentThrower,
        currentLeader: this.turnState.currentLeader,
        collectedScores: this.turnState.collectedScores,
        lastRoll: this.turnState.lastRoll,
        historyLog: this.turnState.historyLog.slice(-20)
      },
      winner: this.winner
    };
  }
}

module.exports = {
  PacheseGame,
  TRACKS,
  SAFE_SQUARES,
  SCORING_TABLE,
  rollCowrieShells
};
