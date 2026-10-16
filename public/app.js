// app.js - Full Interactive Client Orchestrator for Pachese

(function() {
  const socket = io();

  // State
  let currentRoomId = null;
  let localPlayer = null;
  let currentGameState = null;
  let selectedScoreId = null;
  let selectedCoin = null;

  // DOM Elements
  const lobbyScreen = document.getElementById('lobby-screen');
  const waitingScreen = document.getElementById('waiting-screen');
  const gameScreen = document.getElementById('game-screen');
  const toastBanner = document.getElementById('toast-banner');

  const playerNameInput = document.getElementById('player-name');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const joinRoomCodeInput = document.getElementById('join-room-code');
  const btnQuickBot = document.getElementById('btn-quick-bot');

  const displayRoomCode = document.getElementById('display-room-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const t1Slots = document.getElementById('t1-slots');
  const t2Slots = document.getElementById('t2-slots');
  const btnStartGame = document.getElementById('btn-start-game');

  const hudRoomCode = document.getElementById('hud-room-code');
  const activePlayerName = document.getElementById('active-player-name');
  const homeLockT1 = document.getElementById('home-lock-t1');
  const homeLockT2 = document.getElementById('home-lock-t2');
  const t1HomeCount = document.getElementById('t1-home-count');
  const t2HomeCount = document.getElementById('t2-home-count');
  const t1LeaderName = document.getElementById('t1-leader-name');
  const t2LeaderName = document.getElementById('t2-leader-name');

  const t1Reserve = document.getElementById('t1-reserve');
  const t2Reserve = document.getElementById('t2-reserve');
  const gameLog = document.getElementById('game-log');

  const btnThrowCowries = document.getElementById('btn-throw-cowries');
  const cowrieShellsRow = document.getElementById('cowrie-shells-row');
  const rollResultText = document.getElementById('roll-result-text');
  const shellStatus = document.getElementById('shell-status');
  const scoresPool = document.getElementById('scores-pool');

  const victoryModal = document.getElementById('victory-modal');
  const victoryTitle = document.getElementById('victory-title');
  const victoryDesc = document.getElementById('victory-desc');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');

  // Initialize Canvas Board
  const canvas = document.getElementById('pachese-board');
  const board = new PacheseBoard(canvas, (coin) => handleBoardCoinClick(coin));

  // Switch Screens
  function showScreen(screen) {
    [lobbyScreen, waitingScreen, gameScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    screen.classList.remove('hidden');
  }

  // Toast Notification Banner
  function showToast(msg, duration = 3000) {
    toastBanner.textContent = msg;
    toastBanner.classList.remove('hidden');
    setTimeout(() => toastBanner.classList.add('hidden'), duration);
  }

  // 1. Lobby Actions
  btnCreateRoom.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Player 1';
    const mode = document.querySelector('input[name="match-mode"]:checked').value;
    socket.emit('create_room', { playerName: name, mode });
  });

  btnJoinRoom.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Player 2';
    const code = joinRoomCodeInput.value.trim().toUpperCase();
    if (!code) {
      showToast('Please enter a room code!');
      return;
    }
    socket.emit('join_room', { roomId: code, playerName: name });
  });

  // Solo Play vs Bot
  btnQuickBot.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Champion';
    socket.emit('create_room', { playerName: name, mode: '1v1' });
    setTimeout(() => {
      if (currentRoomId) {
        socket.emit('add_bot', { roomId: currentRoomId, role: 'T2_LEADER' });
        setTimeout(() => {
          socket.emit('start_game', { roomId: currentRoomId });
        }, 300);
      }
    }, 400);
  });

  btnCopyCode.addEventListener('click', () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId);
      showToast(`Copied room code: ${currentRoomId}`);
    }
  });

  btnStartGame.addEventListener('click', () => {
    if (currentRoomId) {
      socket.emit('start_game', { roomId: currentRoomId });
    }
  });

  // 2. Socket Listeners for Room Flow
  socket.on('room_created', ({ roomId, player, gameState }) => {
    currentRoomId = roomId;
    localPlayer = player;
    currentGameState = gameState;
    displayRoomCode.textContent = roomId;
    hudRoomCode.textContent = roomId;
    renderWaitingSlots(gameState);
    showScreen(waitingScreen);
    showToast(`Room ${roomId} created! Share with your friends.`);
  });

  socket.on('room_joined', ({ roomId, player, gameState }) => {
    currentRoomId = roomId;
    localPlayer = player;
    currentGameState = gameState;
    displayRoomCode.textContent = roomId;
    hudRoomCode.textContent = roomId;
    renderWaitingSlots(gameState);
    showScreen(waitingScreen);
    showToast(`Joined room ${roomId} as ${player.name} (${player.role})`);
  });

  socket.on('players_updated', (gameState) => {
    currentGameState = gameState;
    renderWaitingSlots(gameState);
    updateGameUI(gameState);
  });

  socket.on('join_error', ({ message }) => {
    showToast(`⚠️ ${message}`, 4000);
  });

  socket.on('action_error', ({ message }) => {
    showToast(`⚠️ ${message}`, 3000);
  });

  socket.on('game_started', (gameState) => {
    currentGameState = gameState;
    showScreen(gameScreen);
    updateGameUI(gameState);
    showToast('⚔️ The Match has Begun! Toss the cowries!');
  });

  // Render Waiting Room Slots
  function renderWaitingSlots(gameState) {
    t1Slots.innerHTML = '';
    t2Slots.innerHTML = '';

    const isHost = localPlayer && localPlayer.isHost;
    const requiredRoles = gameState.mode === '2v2'
      ? ['T1_LEADER', 'T1_PLAYER2', 'T2_LEADER', 'T2_PLAYER2']
      : ['T1_LEADER', 'T2_LEADER'];

    requiredRoles.forEach(role => {
      const p = gameState.players.find(x => x.role === role);
      const isT1 = role.startsWith('T1');
      const targetList = isT1 ? t1Slots : t2Slots;

      const slotDiv = document.createElement('div');
      slotDiv.className = 'player-slot';

      if (p) {
        slotDiv.innerHTML = `
          <div>
            <strong>${p.name}</strong> ${p.isBot ? '🤖' : ''} ${p.isHost ? '👑' : ''}
            <div class="slot-role">${role.replace('_', ' ')}</div>
          </div>
          <span style="color: #4ade80; font-size: 0.8rem;">Ready</span>
        `;
      } else {
        slotDiv.innerHTML = `
          <div>
            <span style="color: #9ca3af;">Empty Slot</span>
            <div class="slot-role">${role.replace('_', ' ')}</div>
          </div>
          ${isHost ? `<button class="btn btn-secondary btn-sm" onclick="window.addBotSlot('${role}')">+ Add Bot</button>` : '<span style="color: #6b7280; font-size: 0.8rem;">Waiting...</span>'}
        `;
      }
      targetList.appendChild(slotDiv);
    });

    btnStartGame.style.display = isHost ? 'block' : 'none';
  }

  window.addBotSlot = function(role) {
    if (currentRoomId) {
      socket.emit('add_bot', { roomId: currentRoomId, role });
    }
  };

  // 3. Throw Cowries
  btnThrowCowries.addEventListener('click', () => {
    if (!currentRoomId) return;
    socket.emit('throw_cowries', { roomId: currentRoomId });
  });

  // Socket: Cowrie Rolled
  socket.on('cowrie_rolled', ({ thrower, playerName, roll, cancelledThree, continueThrowing, gameState }) => {
    currentGameState = gameState;
    window.sounds.playShellClatter();

    // Animate shells
    const shells = cowrieShellsRow.querySelectorAll('.cowrie-shell');
    shells.forEach((shell, idx) => {
      shell.className = 'cowrie-shell rolling';
      setTimeout(() => {
        shell.className = `cowrie-shell ${roll.shells[idx] === 1 ? 'white' : 'black'}`;
      }, 500 + idx * 50);
    });

    // Display banner text
    setTimeout(() => {
      if (cancelledThree) {
        rollResultText.innerHTML = `💥 <strong>3 CONSECUTIVE SPECIALS!</strong> Throws Cancelled! 1 Fresh Roll Granted!`;
        window.sounds.playRollback();
      } else {
        const canEnterText = roll.canEnter ? ' • 🚀 Can Enter Coin' : '';
        const extraChanceText = roll.extraChance ? ' • 🎲 Bonus Throw!' : '';
        rollResultText.innerHTML = `
          ${playerName || thrower} rolled: <strong>${roll.whites}W ${roll.blacks}B = ${roll.score}</strong>
          ${canEnterText}${extraChanceText}
        `;
      }
      updateGameUI(gameState);
    }, 900);
  });

  // Socket: Coin Moved
  socket.on('coin_moved', ({ moveRes, gameState }) => {
    currentGameState = gameState;
    window.sounds.playPawnMove();

    if (moveRes.captureOccurred) {
      window.sounds.playCapture();
      showToast(`💥 CAPTURE! ${moveRes.capturedCoins.length} opponent coin(s) removed! Bonus throw earned!`, 3500);
    }

    if (moveRes.winner) {
      window.sounds.playVictory();
      victoryTitle.textContent = `TEAM ${moveRes.winner} WINS!`;
      victoryDesc.textContent = `All 8 coins have successfully entered the Charkoni!`;
      victoryModal.classList.remove('hidden');
    }

    clearSelection();
    updateGameUI(gameState);
  });

  // 4. Update Game UI
  function updateGameUI(gameState) {
    if (!gameState) return;
    board.updateState(gameState, localPlayer ? localPlayer.role : null);

    // Turn info
    const turn = gameState.turnState;
    const currentTeam = turn.currentLeader;
    activePlayerName.textContent = `${turn.currentThrower} (${currentTeam})`;

    // Home Counts
    const t1Home = gameState.coins.T1.filter(c => c.stepIndex === 80).length;
    const t2Home = gameState.coins.T2.filter(c => c.stepIndex === 80).length;
    t1HomeCount.textContent = t1Home;
    t2HomeCount.textContent = t2Home;

    // Home Locks
    if (gameState.homeUnlocked.T1) {
      homeLockT1.className = 'lock-pill unlocked';
      homeLockT1.textContent = 'T1: 🔓 Unlocked';
    } else {
      homeLockT1.className = 'lock-pill locked';
      homeLockT1.textContent = 'T1: 🔒 Locked';
    }
    if (gameState.homeUnlocked.T2) {
      homeLockT2.className = 'lock-pill unlocked';
      homeLockT2.textContent = 'T2: 🔓 Unlocked';
    } else {
      homeLockT2.className = 'lock-pill locked';
      homeLockT2.textContent = 'T2: 🔒 Locked';
    }

    // Leaders
    const t1L = gameState.players.find(p => p.role === 'T1_LEADER');
    const t2L = gameState.players.find(p => p.role === 'T2_LEADER');
    t1LeaderName.textContent = t1L ? t1L.name : 'Waiting';
    t2LeaderName.textContent = t2L ? t2L.name : 'Waiting';

    // Throw button active check
    const isMyThrow = (localPlayer && localPlayer.role === turn.currentThrower && turn.phase === 'THROWING');
    btnThrowCowries.disabled = !isMyThrow;
    const hasPriorMoves = turn.collectedScores.some(s => s.used);
    if (turn.phase === 'THROWING' && hasPriorMoves) {
      shellStatus.textContent = isMyThrow ? '🎲 IMMEDIATE BONUS THROW!' : 'Opponent Bonus Throw...';
      shellStatus.style.background = 'rgba(239, 68, 68, 0.4)';
      shellStatus.style.color = '#fca5a5';
    } else {
      shellStatus.textContent = isMyThrow ? 'YOUR TURN TO THROW' : `${turn.currentThrower}'s Turn`;
      shellStatus.style.background = 'rgba(251, 191, 36, 0.2)';
      shellStatus.style.color = 'var(--gold)';
    }

    // Render Reserves
    renderReserve('T1', t1Reserve, gameState);
    renderReserve('T2', t2Reserve, gameState);

    // Render Collected Scores
    renderScoreTray(gameState);

    // Render Chronicle Log
    renderLog(gameState.turnState.historyLog);
  }

  // Render Reserve Coins (Off-board)
  function renderReserve(team, container, gameState) {
    container.innerHTML = '';
    const offBoardCoins = gameState.coins[team].filter(c => c.stepIndex === -1);
    const selectedScore = getSelectedScoreItem();
    const isLeader = isLocalPlayerLeader(team);
    const isMovingPhase = (gameState.turnState.phase === 'MOVING');
    const isCurrentTeam = (gameState.turnState.currentLeader === team);

    // Check if any entry score (10, 25, 30) is available in tray
    const availableEntryScore = gameState.turnState.collectedScores.find(s => !s.used && s.canEnter);
    const canEnterWithScore = (isLeader && isMovingPhase && isCurrentTeam && availableEntryScore);

    offBoardCoins.forEach(coin => {
      const token = document.createElement('div');
      token.className = `reserve-coin-token ${team.toLowerCase()} ${canEnterWithScore ? 'selectable' : ''}`;
      token.textContent = parseInt(coin.id.split('_')[1]) + 1;

      if (selectedCoin && selectedCoin.id === coin.id) {
        token.classList.add('selected');
      }

      token.addEventListener('click', () => {
        if (!isLeader) {
          showToast(`Only the ${team} Leader can move coins!`);
          return;
        }

        if (gameState.turnState.phase === 'THROWING') {
          showToast('🎲 Complete your throws first! Throws are collected before moving.');
          return;
        }

        // Auto-select entry score if not explicitly selected
        let scoreToUse = selectedScore;
        if (!scoreToUse || !scoreToUse.canEnter) {
          scoreToUse = availableEntryScore;
        }

        if (!scoreToUse) {
          showToast('⚠️ You need an entry throw of 10, 25, or 30 to bring coins into the game!');
          return;
        }

        selectedScoreId = scoreToUse.id;
        renderScoreTray(currentGameState);

        // Move coin into play!
        socket.emit('move_coin', {
          roomId: currentRoomId,
          coinId: coin.id,
          scoreId: scoreToUse.id
        });
      });

      container.appendChild(token);
    });
  }

  // Render Scores Tray
  function renderScoreTray(gameState) {
    scoresPool.innerHTML = '';
    const scores = gameState.turnState.collectedScores;

    if (scores.length === 0) {
      scoresPool.innerHTML = '<span class="empty-tray-text">No throws in pool</span>';
      return;
    }

    scores.forEach(s => {
      const chip = document.createElement('div');
      chip.className = `score-chip ${s.used ? 'used' : ''} ${s.id === selectedScoreId ? 'selected' : ''}`;
      chip.textContent = s.score;
      if (s.canEnter) chip.title = 'Can enter a coin';

      chip.addEventListener('click', () => {
        if (s.used) return;
        selectedScoreId = (selectedScoreId === s.id) ? null : s.id;
        renderScoreTray(currentGameState);
        updatePreview();
      });

      scoresPool.appendChild(chip);
    });
  }

  function getSelectedScoreItem() {
    if (!currentGameState || !selectedScoreId) return null;
    return currentGameState.turnState.collectedScores.find(s => s.id === selectedScoreId && !s.used);
  }

  function isLocalPlayerLeader(team) {
    if (!localPlayer) return false;
    return localPlayer.role === `${team}_LEADER`;
  }

  // Board coin clicked
  function handleBoardCoinClick(coin) {
    const team = currentGameState.turnState.currentLeader;
    if (!isLocalPlayerLeader(team)) {
      showToast(`Only the ${team} Leader can execute moves!`);
      return;
    }

    const scoreItem = getSelectedScoreItem();
    if (!scoreItem) {
      // Auto-select first available score if not selected
      const available = currentGameState.turnState.collectedScores.find(s => !s.used);
      if (available) {
        selectedScoreId = available.id;
        renderScoreTray(currentGameState);
      } else {
        showToast('No available scores left to move!');
        return;
      }
    }

    // If already previewing this coin, execute move!
    if (selectedCoin && selectedCoin.id === coin.id) {
      socket.emit('move_coin', {
        roomId: currentRoomId,
        coinId: coin.id,
        scoreId: selectedScoreId
      });
      clearSelection();
    } else {
      // Select coin and show ghost trajectory preview
      selectedCoin = coin;
      updatePreview();
    }
  }

  function updatePreview() {
    if (!selectedCoin || !selectedScoreId) {
      board.clearPreview();
      return;
    }
    const scoreItem = getSelectedScoreItem();
    if (!scoreItem) {
      board.clearPreview();
      return;
    }

    const team = selectedCoin.team;
    const track = (team === 'T1') ? window.PacheseTracks.T1 : window.PacheseTracks.T2;
    const fromStep = selectedCoin.stepIndex === -1 ? 0 : selectedCoin.stepIndex;
    const toStep = selectedCoin.stepIndex === -1 ? scoreItem.score : selectedCoin.stepIndex + scoreItem.score;

    if (toStep <= 80) {
      const coords = [];
      for (let i = fromStep; i <= toStep; i++) {
        if (track[i]) coords.push(track[i]);
      }
      board.setPreview(selectedCoin, coords);
    }
  }

  function clearSelection() {
    selectedCoin = null;
    selectedScoreId = null;
    board.clearPreview();
  }

  // Chronicle Log
  function renderLog(history) {
    gameLog.innerHTML = '';
    (history || []).forEach(item => {
      const div = document.createElement('div');
      div.className = `log-item ${item.type || ''}`;
      div.textContent = item.text;
      gameLog.appendChild(div);
    });
    gameLog.scrollTop = gameLog.scrollHeight;
  }

  // Reactions
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentRoomId) return;
      const emoji = btn.getAttribute('data-emoji');
      socket.emit('send_reaction', {
        roomId: currentRoomId,
        emoji,
        senderName: localPlayer ? localPlayer.name : 'Player'
      });
    });
  });

  socket.on('reaction_received', ({ emoji, senderName }) => {
    showToast(`${senderName}: ${emoji} ${emoji}`, 2500);
  });

  // Sound toggle
  btnSoundToggle.addEventListener('click', () => {
    window.sounds.enabled = !window.sounds.enabled;
    btnSoundToggle.textContent = window.sounds.enabled ? '🔊' : '🔇';
  });

  btnPlayAgain.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    showScreen(lobbyScreen);
  });

})();
