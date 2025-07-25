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
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms[roomId] = {
      players: [],
      gameStarted: false,
      cards: {},
      turnIndex: 0,
      playedCards: { hearts: [7], diamonds: [], clubs: [], spades: [] }
    };
    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id });
    callback(roomId);
    io.to(roomId).emit("players-update", rooms[roomId].players);
  });

  socket.on("join-room", (roomId, callback) => {
    const room = rooms[roomId];
    if (room && room.players.length < 4) {
      socket.join(roomId);
      room.players.push({ id: socket.id });
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

  // Convert face cards to numbers for logic
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

  // Play card
  suitPlayed.push(numericValue);
  suitPlayed.sort((a, b) => a - b);
  room.playedCards[card.suit] = suitPlayed;

  playerCards.splice(index, 1);

  io.to(roomId).emit("card-played", {
    card,
    playerId: socket.id,
    playedCards: room.playedCards
  });

  // Next turn
  room.turnIndex = (room.turnIndex + 1) % 4;
  io.to(roomId).emit("turn-update", room.players[room.turnIndex].id);
  
  //after valid move
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



});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
