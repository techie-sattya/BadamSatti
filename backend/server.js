const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === "http://localhost:5173" ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});


app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      origin === "http://localhost:5173" ||
      origin.endsWith(".vercel.app")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
}));

const PORT = 3000;


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

// Configure your email transport (update with your credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'realizertrello@gmail.com', // replace with your email
    pass: 'wgyj lwwf cssr ypvv'   // replace with your password or app password
  }
});

function sendErrorEmail(errorMessage, subject = 'Badam Satti Server Exception') {
  const mailOptions = {
    from: 'realizertrello@gmail.com',
    to: 'realizertrello@gmail.com', // replace with destination email
    subject: subject,
    text: errorMessage
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending exception email:', error);
    } else {
      console.log('Exception email sent:', info.response);
    }
  });
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  sendErrorEmail(`User connected: ${socket.id}`,'New User Connected');
  socket.on("create-room", ({ playerLimit }, callback) => {
  try {
    const roomId = Math.random().toString(36).substring(2, 8);
    const playerName = users[socket.id]?.name || "Player1";

    rooms[roomId] = {
      players: [],
      gameStarted: false,
      cards: {},
      turnIndex: 0,
      playedCards: { hearts: [7], diamonds: [], clubs: [], spades: [] },
      finishedPlayers: [],
      playerLimit: playerLimit || 4 // default to 4 if not provided
    };

    socket.join(roomId);

    const newPlayer = { id: socket.id, name: playerName };
    rooms[roomId].players.push(newPlayer);

    callback(roomId);
    io.to(roomId).emit("players-update", rooms[roomId].players);

    // Optional: Start game automatically when limit is reached
    if (rooms[roomId].players.length === rooms[roomId].playerLimit) {
      startGame(roomId); // You should define this function to shuffle and deal
    }

    console.log('Room created:', rooms[roomId]);
  } catch (err) {
    sendErrorEmail(`create-room: ${err.stack}`);
    callback(null);
  }
});


  socket.on("join-room", (roomId, callback) => {
    try {
      const room = rooms[roomId];
  

      if (room && room.players.length < rooms[roomId].playerLimit) {
        socket.join(roomId);

        const playerName = users[socket.id]?.name || `Player${room.players.length + 1}`;
        room.players.push({ id: socket.id, name: playerName });

        callback({ success: true });
        io.to(roomId).emit("players-update", room.players);

        if (room.players.length === rooms[roomId].playerLimit && !room.gameStarted) {
          room.gameStarted = true;

          const deck = shuffleDeck();
          const roomPlayers = room.players.length;
          const cardsPerPlayer = Math.floor(deck.length / roomPlayers); // For a 52-card deck
          // for (let i = 0; i < rooms[roomId].playerLimit; i++) {
          //   room.cards[room.players[i].id] = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
          // }
          let start = 0;
          for (let i = 0; i < roomPlayers; i++) {
            const playerId = room.players[i].id;
            const end = start + cardsPerPlayer + (i < deck.length % roomPlayers ? 1 : 0);
            const playerCards = deck.slice(start, end);
            room.cards[playerId] = playerCards; // Store player cards in the room object
            room.players[i].cards = playerCards; // Also store cards in the player object inside the room
            start = end;
          }

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

          room.turnIndex = firstTurnIndex;
          room.playedCards = { hearts: [], diamonds: [], clubs: [], spades: [] };

          io.to(roomId).emit("game-started", {
            players: room.players,
            cards: room.cards
          });

          io.to(roomId).emit("turn-update", room.players[firstTurnIndex].id);
        }
        console.log('join room',room)
      } else {
        callback({ success: false, message: "Room full or does not exist" });
      }
    } catch (err) {
      sendErrorEmail(`join-room: ${err.stack}`);
      callback({ success: false, message: "Server error" });
    }
  });

  socket.on("disconnect", () => {
    try {
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
    } catch (err) {
      sendErrorEmail(`disconnect: ${err.stack}`);
    }
  });

  socket.on("play-card", ({ roomId, card }, callback) => {
    try {
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

      suitPlayed.push(numericValue);
      suitPlayed.sort((a, b) => a - b);
      room.playedCards[card.suit] = suitPlayed;

      playerCards.splice(index, 1);

      io.to(roomId).emit("card-played", {
        card,
        playerId: socket.id,
        playedCards: room.playedCards
      });

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

      io.to(roomId).emit("turn-update", room.players[room.turnIndex].id);
      io.to(roomId).emit("update-played-cards", room.playedCards);

      callback({ success: true });
    } catch (err) {
      sendErrorEmail(`play-card: ${err.stack}`);
      callback({ success: false, message: "Server error" });
    }
  });

  socket.on("pass-turn", ({ roomId }, callback) => {
    try {
      const room = rooms[roomId];
      if (!room) return callback({ success: false, message: "Room not found" });

      const currentPlayer = room.players[room.turnIndex];

      if (currentPlayer.id !== socket.id) {
        return callback({ success: false, message: "Not your turn" });
      }

      room.turnIndex = (room.turnIndex + 1) % room.players.length;

      const nextPlayer = room.players[room.turnIndex];
      io.to(roomId).emit("turn-update", nextPlayer.id);

      callback({ success: true });
    } catch (err) {
      sendErrorEmail(`pass-turn: ${err.stack}`);
      callback({ success: false, message: "Server error" });
    }
  });

  socket.on('setName', (name) => {
    try {
      console.log('setName', name, socket.id);
      users[socket.id] = { name };
    } catch (err) {
      sendErrorEmail(`setName: ${err.stack}`);
    }
  });

  socket.on("get-room-info", (roomId, callback) => {
    try {
      const room = rooms[roomId];
      if (!room) {
        return callback({ success: false, message: "Room not found" });
      }
      callback({
        success: true,
        room: {
          players: room.players,
          gameStarted: room.gameStarted,
          playedCards: room.playedCards,
          finishedPlayers: room.finishedPlayers,
          playerLimit: room.playerLimit,
          turnIndex: room.turnIndex
        }
      });
    } catch (err) {
      sendErrorEmail(`get-room-info: ${err.stack}`);
      callback({ success: false, message: "Server error" });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
