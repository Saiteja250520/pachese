// server.js - Real-time Pachese Multiplayer Game Server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { PacheseGame, TRACKS, SAFE_SQUARES } = require('./pacheseRules');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory room store: roomId -> PacheseGame instance
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Bot AI logic
function handleBotTurn(game, roomId) {
  if (game.status !== 'PLAYING') return;

  const currentRole = game.turnState.currentThrower;
  const player = game.players.find(p => p.role === currentRole);

  // Only act if this player slot is marked as a BOT
  if (!player || !player.isBot) return;

  if (game.turnState.phase === 'THROWING') {
    setTimeout(() => {
      if (game.status !== 'PLAYING') return;
      const res = game.throwDice(currentRole);
      io.to(roomId).emit('cowrie_rolled', {
        thrower: currentRole,
        roll: res.roll,
        cancelledThree: res.cancelledThree,
        continueThrowing: res.continueThrowing,
        gameState: game.getPublicState()
      });

      // Continue bot turn
      handleBotTurn(game, roomId);
    }, 1400);
  } else if (game.turnState.phase === 'MOVING') {
    setTimeout(() => {
      if (game.status !== 'PLAYING' || game.turnState.phase !== 'MOVING') return;

      const availableMoves = game.getAvailableMoves();
      if (availableMoves.length === 0) {
        // Rollback or advance already handled in game rules
        io.to(roomId).emit('game_updated', game.getPublicState());
        handleBotTurn(game, roomId);
        return;
      }

      // Bot move heuristic:
      // 1. Look for captures
      // 2. Look for entering coins (canEnter)
      // 3. Move closest to home or furthest on track
      let chosenMove = availableMoves[0];
      // Check capture potential
      const team = game.turnState.currentLeader;
      const oppTeam = game.getOpponentTeam(team);

      for (const move of availableMoves) {
        if (move.toStep < 80) {
          const coord = game.getCoordForStep(team, move.toStep);
          const oppOccupants = game.coins[oppTeam].filter(c => {
            if (c.stepIndex < 0 || c.stepIndex >= 80) return false;
            const cCoord = game.getCoordForStep(oppTeam, c.stepIndex);
            return cCoord && cCoord.x === coord.x && cCoord.y === coord.y;
          });
          if (oppOccupants.length > 0) {
            chosenMove = move;
            break;
          }
        }
      }

      const moveRes = game.executeMove(chosenMove.coinId, chosenMove.scoreId);
      io.to(roomId).emit('coin_moved', {
        moveRes,
        gameState: game.getPublicState()
      });

      // Continue bot moving if more scores exist
      handleBotTurn(game, roomId);
    }, 1600);
  }
}

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ${socket.id}`);

  // Create a new room
  socket.on('create_room', ({ playerName, mode }) => {
    const roomId = generateRoomCode();
    const game = new PacheseGame(roomId, mode || '1v1');

    // Host takes slot 0: T1_LEADER
    const hostPlayer = {
      socketId: socket.id,
      name: playerName || 'Player 1',
      team: 'T1',
      role: 'T1_LEADER',
      isHost: true,
      isBot: false
    };
    game.players.push(hostPlayer);
    rooms.set(roomId, game);

    socket.join(roomId);
    socket.emit('room_created', {
      roomId,
      player: hostPlayer,
      gameState: game.getPublicState()
    });
  });

  // Join existing room
  socket.on('join_room', ({ roomId, playerName }) => {
    roomId = (roomId || '').trim().toUpperCase();
    const game = rooms.get(roomId);

    if (!game) {
      socket.emit('join_error', { message: 'Room not found! Check the room code.' });
      return;
    }

    if (game.status === 'FINISHED') {
      socket.emit('join_error', { message: 'This game has already ended.' });
      return;
    }

    // Determine available roles
    const requiredRoles = game.turnOrder;
    const takenRoles = new Set(game.players.filter(p => !p.isBot).map(p => p.role));
    const nextAvailableRole = requiredRoles.find(r => !takenRoles.has(r));

    if (!nextAvailableRole && game.status === 'PLAYING') {
      // Join as spectator
      socket.join(roomId);
      socket.emit('joined_spectator', {
        roomId,
        gameState: game.getPublicState()
      });
      return;
    }

    // Assign slot
    const assignedRole = nextAvailableRole || 'SPECTATOR';
    const assignedTeam = assignedRole.startsWith('T1') ? 'T1' : assignedRole.startsWith('T2') ? 'T2' : 'SPECTATOR';

    const player = {
      socketId: socket.id,
      name: playerName || `Player ${game.players.length + 1}`,
      team: assignedTeam,
      role: assignedRole,
      isHost: false,
      isBot: false
    };

    // Remove any placeholder bot in this role if present
    game.players = game.players.filter(p => p.role !== assignedRole);
    game.players.push(player);

    socket.join(roomId);
    socket.emit('room_joined', {
      roomId,
      player,
      gameState: game.getPublicState()
    });

    io.to(roomId).emit('players_updated', game.getPublicState());
  });

  // Add bot to fill an empty role
  socket.on('add_bot', ({ roomId, role }) => {
    const game = rooms.get(roomId);
    if (!game) return;

    const botNames = ['Arjuna (Bot)', 'Karna (Bot)', 'Bhishma (Bot)', 'Drona (Bot)'];
    const bot = {
      socketId: `bot_${Date.now()}`,
      name: botNames[Math.floor(Math.random() * botNames.length)],
      team: role.startsWith('T1') ? 'T1' : 'T2',
      role,
      isHost: false,
      isBot: true
    };

    game.players = game.players.filter(p => p.role !== role);
    game.players.push(bot);

    io.to(roomId).emit('players_updated', game.getPublicState());
  });

  // Start game
  socket.on('start_game', ({ roomId }) => {
    const game = rooms.get(roomId);
    if (!game) return;

    // Fill remaining required slots with bots if not full
    game.turnOrder.forEach(role => {
      const exists = game.players.some(p => p.role === role);
      if (!exists) {
        const team = role.startsWith('T1') ? 'T1' : 'T2';
        game.players.push({
          socketId: `bot_${role}`,
          name: `${team} Guard (Bot)`,
          team,
          role,
          isHost: false,
          isBot: true
        });
      }
    });

    game.status = 'PLAYING';
    io.to(roomId).emit('game_started', game.getPublicState());

    // Check if initial player is a bot
    handleBotTurn(game, roomId);
  });

  // Throw cowries
  socket.on('throw_cowries', ({ roomId }) => {
    const game = rooms.get(roomId);
    if (!game || game.status !== 'PLAYING') return;

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const res = game.throwDice(player.role);
    if (res.error) {
      socket.emit('action_error', { message: res.error });
      return;
    }

    io.to(roomId).emit('cowrie_rolled', {
      thrower: player.role,
      playerName: player.name,
      roll: res.roll,
      cancelledThree: res.cancelledThree,
      continueThrowing: res.continueThrowing,
      gameState: game.getPublicState()
    });

    // Check if next action is bot
    handleBotTurn(game, roomId);
  });

  // Move coin
  socket.on('move_coin', ({ roomId, coinId, scoreId }) => {
    const game = rooms.get(roomId);
    if (!game || game.status !== 'PLAYING') return;

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;

    // Only Leader of the current team can move
    const currentTeam = game.turnState.currentLeader;
    const isLeader = (player.role === `${currentTeam}_LEADER`);
    if (!isLeader) {
      socket.emit('action_error', { message: `Only the ${currentTeam} Leader can execute moves!` });
      return;
    }

    const moveRes = game.executeMove(coinId, scoreId);
    if (moveRes.error) {
      socket.emit('action_error', { message: moveRes.error });
      return;
    }

    io.to(roomId).emit('coin_moved', {
      moveRes,
      gameState: game.getPublicState()
    });

    // Check if next action is bot
    handleBotTurn(game, roomId);
  });

  // Reaction / Emojis
  socket.on('send_reaction', ({ roomId, emoji, senderName }) => {
    io.to(roomId).emit('reaction_received', { emoji, senderName });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  PACHESE Multiplayer Game Server Running!     `);
  console.log(`  Port: ${PORT}                                `);
  console.log(`  Local URL: http://localhost:${PORT}          `);
  console.log(`===============================================`);
});
