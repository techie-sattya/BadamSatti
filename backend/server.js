const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

const PORT = 3000;

app.use(cors());

const rooms = {}; // { roomId: { players: [], gameStarted: false, cards: {} } }
const users = {};
function shuffleDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  suits.forEach(suit => {
    values.forEach(value => {
      deck.push({ suit, value });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  
  socket.on("create-room", (callback) => {
  console.log('users',users);
  const roomId = Math.random().toString(36).substring(2, 8);
  const playerName = users[socket.id]?.name || "Player1";

  rooms[roomId] = {
    players: [],
    gameStarted: false,
    cards: {},
    turnIndex: 0,
    playedCards: { hearts: [7], diamonds: [], clubs: [], spades: [] },
    finishedPlayers: [] // New
  };

  socket.join(roomId);

  rooms[roomId].players.push({ id: socket.id, name: playerName });

  callback(roomId);
  io.to(roomId).emit("players-update", rooms[roomId].players);
});

 socket.on("join-room", (roomId, callback) => {
  console.log('rooms', rooms);
  const room = rooms[roomId];
  console.log('room', room);
  if (room && room.players.length < 4) {
    socket.join(roomId);

    const playerName = users[socket.id]?.name || `Player${room.players.length + 1}`;
    room.players.push({ id: socket.id, name: playerName });

    callback({ success: true });
    io.to(roomId).emit("players-update", room.players);

    // Start game when 4 players have joined
    if (room.players.length === 4 && !room.gameStarted) {
      room.gameStarted = true;

      const deck = shuffleDeck();

      // Distribute 13 cards each
      for (let i = 0; i < 4; i++) {
        room.cards[room.players[i].id] = deck.slice(i * 13, (i + 1) * 13);
      }

      // Find the player who has 7 of hearts
      const sevenOfHearts = { suit: "hearts", value: "7" };
      let firstTurnIndex = 0;

      for (let i = 0; i < room.players.length; i++) {
        const pid = room.players[i].id;
        const has7Hearts = room.cards[pid].some(card =>
          card.suit === sevenOfHearts.suit && card.value === sevenOfHearts.value
        );
        if (has7Hearts) {
          firstTurnIndex = i;
          break;
        }
      }

      // Set turn to the player with 7♥
      room.turnIndex = firstTurnIndex;

      // Set 7♥ as already played
      room.playedCards = { hearts: [], diamonds: [], clubs: [], spades: [] };

      // Broadcast game start
      io.to(roomId).emit("game-started", {
        players: room.players,
        cards: room.cards
      });

      // Tell everyone whose turn it is
      io.to(roomId).emit("turn-update", room.players[firstTurnIndex].id);
    }

  } else {
    callback({ success: false, message: "Room full or does not exist" });
  }
});

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    delete users[socket.id];
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomId).emit("players-update", room.players);
        break;
      }
    }
  });

socket.on("play-card", ({ roomId, card }, callback) => {
  const room = rooms[roomId];

  if (!room) {
    return callback({ success: false, message: "Room not found." });
  }

  const player = room.players[room.turnIndex];

  if (!player) {
    return callback({ success: false, message: "Player not found." });
  }

  if (socket.id !== player.id) {
    return callback({ success: false, message: "Not your turn" });
  }

  const playerCards = room.cards[socket.id];
  const index = playerCards.findIndex(c => c.suit === card.suit && c.value === card.value);
  if (index === -1) {
    return callback({ success: false, message: "Card not found" });
  }

  // Convert face cards to numbers
  const valueMap = { A: 1, J: 11, Q: 12, K: 13 };
  const numericValue = isNaN(card.value) ? valueMap[card.value] : parseInt(card.value);

  const suitPlayed = room.playedCards[card.suit] || [];

  if (suitPlayed.length === 0 && numericValue !== 7) {
    return callback({ success: false, message: "Must play 7 to start a suit" });
  }

  if (
    suitPlayed.length > 0 &&
    !suitPlayed.includes(numericValue - 1) &&
    !suitPlayed.includes(numericValue + 1)
  ) {
    return callback({ success: false, message: "Card not adjacent to existing cards" });
  }

  // Valid card play
  suitPlayed.push(numericValue);
  suitPlayed.sort((a, b) => a - b);
  room.playedCards[card.suit] = suitPlayed;

  // Remove from hand
  playerCards.splice(index, 1);

  // Broadcast played card
  io.to(roomId).emit("card-played", {
    card,
    playerId: socket.id,
    playedCards: room.playedCards
  });

  // ✅ Check if player has finished
  if (playerCards.length === 0) {
    room.finishedPlayers = room.finishedPlayers || [];

    if (!room.finishedPlayers.find(p => p.id === socket.id)) {
      const playerData = room.players.find(p => p.id === socket.id);
      const name = playerData?.name || "Player";

      room.finishedPlayers.push({ id: socket.id, name });

      io.to(roomId).emit("player-finished", {
        id: socket.id,
        name,
        rank: room.finishedPlayers.length
      });
    }
  }

  // ✅ Advance turn (skip finished players)
  const totalPlayers = room.players.length;
  for (let i = 1; i <= totalPlayers; i++) {
    const nextIndex = (room.turnIndex + i) % totalPlayers;
    const nextPlayer = room.players[nextIndex];
    const isFinished = room.finishedPlayers?.some(p => p.id === nextPlayer.id);
    if (!isFinished) {
      room.turnIndex = nextIndex;
      break;
    }
  }

  // Send next turn update
  io.to(roomId).emit("turn-update", room.players[room.turnIndex].id);

  // Update everyone with played cards
  io.to(roomId).emit("update-played-cards", room.playedCards);

  callback({ success: true });
});


  socket.on("pass-turn", ({ roomId }, callback) => {
    const room = rooms[roomId];
    if (!room) return callback({ success: false, message: "Room not found" });

    const currentPlayer = room.players[room.turnIndex];

    if (currentPlayer.id !== socket.id) {
      return callback({ success: false, message: "Not your turn" });
    }

    // Move to next player
    room.turnIndex = (room.turnIndex + 1) % room.players.length;

    // Notify all clients whose turn it is now
    const nextPlayer = room.players[room.turnIndex];
    io.to(roomId).emit("turn-update", nextPlayer.id);

    callback({ success: true });
  });
  socket.on('setName', (name) => {
    users[socket.id] = { name };
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
