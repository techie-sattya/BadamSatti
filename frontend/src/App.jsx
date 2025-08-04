import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { canPlayCard } from './utils/cards';
import './App.css';
import WelcomePage from "./components/welcome";
import { FaEdit } from 'react-icons/fa'; // icon package
const socket = io("https://badamsatti-rnmm.onrender.com/");
// const socket = io("http://localhost:3000/");

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [inputId, setInputId] = useState("");
  const [players, setPlayers] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [myTurn, setMyTurn] = useState(false);
  const [playedCards, setPlayedCards] = useState({});
   const [newName, setNewName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [room, setRoom] = useState(null);
  // Inside App.jsx (or your main component)
const [name, setName] = useState('');
const [submitted, setSubmitted] = useState(false);
const [rankings, setRankings] = useState([]);
const [turnPlayerId, setTurnPlayerId] = useState(null);

useEffect(() => {
  socket.on("player-finished", ({ id, name, rank }) => {
    setRankings(prev => [...prev, { id, name, rank }]);
  });

  return () => {
    socket.off("player-finished");
  };
}, []);
  useEffect(() => {
    socket.on("players-update", (updatedPlayers) => setPlayers(updatedPlayers));

    socket.on("game-started", ({ cards }) => {
      const myId = socket.id;
      setMyCards(cards[myId]);
    });

    socket.on("turn-update", (currentPlayerId) => {
      console.log("Turn update received for:", currentPlayerId, "My ID:", socket.id);
      setTurnPlayerId(currentPlayerId);
      setMyTurn(currentPlayerId === socket.id);
    });
    socket.on("card-played", ({ card, playerId, playedCards }) => {
      console.log(`${playerId} played ${card.value} of ${card.suit}`);
      setPlayedCards(playedCards);
    });


    socket.on("update-played-cards", (playedCards) => {
      setPlayedCards(playedCards);
    });
    socket.on("turn-update", (currentPlayerId) => {
      setMyTurn(currentPlayerId === socket.id);
    });
    socket.on("pass-turn", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;

      // Skip to next player's turn
      room.turnIndex = (room.turnIndex + 1) % room.players.length;

      const nextPlayer = room.players[room.turnIndex];
      io.to(roomId).emit("turn-update", nextPlayer.id);
    });
    return () => {
      socket.off("players-update");
      socket.off("game-started");
      socket.off("turn-update");
      socket.off("card-played");
      socket.off("update-played-cards");
    };
  }, []);

  const createRoom = () => {
    socket.emit("create-room", (id) => {
      setRoomId(id);
      setJoined(true);
    });
  };

  const joinRoom = () => {
    socket.emit("join-room", inputId, (response) => {
      if (response.success) {
        setRoomId(inputId);
        setJoined(true);
      } else {
        alert(response.message);
      }
    });
  };

  function getValidMoves(hand, playedCards) {
    const validMoves = [];

    hand.forEach(card => {
      const [value, suit] = [card.value, card.suit];
      const suitCards = playedCards[suit] || [];

      if (value === 7) {
        validMoves.push(card);
      } else if (suitCards.includes(value - 1) || suitCards.includes(value + 1)) {
        validMoves.push(card);
      }
    });

    return validMoves;
  }


  const validMoves = getValidMoves(myCards, playedCards);
  const canPass = validMoves.length === 0;

const isCardPlayable = (card, playedCards) => {
  const values = playedCards[card.suit] || [];
  const numValue = parseInt(card.value);

  if (!values.includes(7)) return numValue === 7;
  return values.includes(numValue - 1) || values.includes(numValue + 1);
};

const hasValidMove = myCards.some(card => isCardPlayable(card, playedCards));

  const splitCards = (values) => {
    const above = values.filter(v => v < 7).sort((a, b) => b - a);
    const below = values.filter(v => v > 7).sort((a, b) => a - b);
    return { above, below };
  };

  function handlePass() {
    socket.emit("pass-turn", { roomId }, (response) => {
      if (!response.success) {
        alert(response.message);
      }
    });
  }
const getCardDisplayValue = (val) => {
  const faceMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  return faceMap[val] || val;
};

  const suitIcons = {
    hearts: "❤️",
    diamonds: "♦️",
    spades: "♠️",
    clubs: "♣️",
  };
  const hasUnplayedSeven = validMoves.some(
    card => card.value === 7 && !playedCards[card.suit]?.includes(7)
  );
// if (!submitted) {
//   return (
//     <div className="name-entry">
//       <h2>Enter your name to join:</h2>
//       <input
//         type="text"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         placeholder="Your name"
//       />
//       <button onClick={() => {
//         if (name.trim()) {
//           socket.emit('setName', name.trim());
//           setSubmitted(true);
//         }
//       }}>
//         Join Game
//       </button>
//     </div>
//   );
// }
useEffect(() => {
  const storedName = localStorage.getItem('username');
  if (storedName) {
    setName(storedName);
    setSubmitted(true);
    socket.emit('setName', storedName.trim());
  }
}, []);

  const handleJoin = (name) => {
    if(newName!=''){
      name=newName;
    }
    console.log('name',name)
    socket.emit('setName', name.trim());
    setName(name);
    localStorage.setItem('username', name.trim());
    setSubmitted(true);
    setNewName('');
    setIsModalOpen(false)
  };
  return (
<div>
    {!name ? (
        <WelcomePage onJoin={handleJoin} />
      ) : (      
    <div style={{ padding: "2rem" }}>
      <h2>Start Game</h2>
       {name && (
          <div className="player-info">
            Playing as: <strong>{name}</strong>
            <FaEdit className="edit-icon" onClick={() => setIsModalOpen(true)} />
          </div>
        )}

        {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Change Username</h3>
            <input
              id='updateNameInput'
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
            />
            <div className="modal-buttons">
              <button onClick={handleJoin}>Save</button>
              <button onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {!joined ? (
        <>
          <button onClick={createRoom}>Create Room</button>
          <br /><br />
          <input
            placeholder="Enter Room ID"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </>
      ) : (
        <>
       
          <h2 className="room-title">Room ID: {roomId}</h2>
          <h3 className="player-count">Players Joined: {players.length}/4</h3>
          <div className="player-list">
          {players.map((p, index) => (
            <div
              key={p.id}
              className={`player-card 
                ${p.id === socket.id ? 'you' : ''} 
                ${p.id === turnPlayerId ? 'active-turn' : ''}`}
            >
              <span className="player-name">
                {p.id === socket.id ? "You" : p.name || `Player ${index + 1}`}
                {rankings.find(r => r.id === socket.id)}
              </span>
            </div>
          ))}
        </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {myCards.map((card, index) => {
              const validMoves = getValidMoves(myCards, playedCards);
              const isPlayed = playedCards[card.suit]?.includes(parseInt(card.value));
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (!myTurn) return alert("Not your turn!");
                    socket.emit("play-card", { roomId, card }, (res) => {
                      // if (!res.success) alert(res.message);
                      if (res.success) {
                        setMyCards(prev => prev.filter(c => !(c.suit === card.suit && c.value === card.value)));
                      } else {
                        alert(res.message || "Invalid move.");
                      }
                    });
                  }}
                  className={`card ${myTurn
                      ? isPlayed ? 'grey' : 'green' : 'grey'
                    // : playedCards[card.suit]?.includes(card.value)
                    // ? 'grey'
                    // : ''
                    }`}
                >
                  {card.value} <br /> {suitIcons[card.suit]}
                </div>
              );
            })}

          </div>

          {!hasValidMove &&
          myTurn &&
          //&& (validMoves.length === 0 || !hasUnplayedSeven) && 
          (
            <button
              class="button-29" role="button"
              onClick={handlePass}
            >
              Pass
            </button>
          )}
          {myTurn ? (
            <div style={{ color: "green", fontWeight: "bold" }}>Your Turn</div>
          ) : (
            <div id="wrap">
              Waiting to turn
            </div>
          )}

          <div className="played-board">
            {Object.entries(playedCards).map(([suit, values]) =>
              values.includes(7) ? (
                <div className="suit-stack" key={suit}>
                  {[...splitCards(values).above].reverse().map((val, i) => (
                    <div
                      key={val}
                      className={`played-card ${['hearts', 'diamonds'].includes(suit) ? 'red' : 'black'}`}
                      style={{ top: `${i * 20}px` }}
                    >
                      <div className="card-top-left">
                        {getCardDisplayValue(val)} {suitIcons[suit]}
                      </div>
                      <div className="card-center">{val}</div>
                    </div>
                  ))}

                  {/* 7 goes in the middle */}
                  <div
                    className={`played-card ${['hearts', 'diamonds'].includes(suit) ? 'red' : 'black'}`}
                    style={{ top: `${splitCards(values).above.length * 20}px` }}
                  >
                    <div className="card-top-left">
                      7 {suitIcons[suit]}
                    </div>
                    <div className="card-center">7</div>
                  </div>

                  {/* Below 7 */}
                  {splitCards(values).below.map((val, i) => (
                    <div
                      key={val}
                      className={`played-card ${['hearts', 'diamonds'].includes(suit) ? 'red' : 'black'}`}
                      style={{ top: `${(splitCards(values).above.length + 1 + i) * 20}px` }}
                    >
                      <div className="card-top-left">
                        {getCardDisplayValue(val)} {suitIcons[suit]}
                      </div>
                      <div className="card-center">{val}</div>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>

<ul>
  {players.map(p => {
    const rank = rankings.find(r => r.id === p.id);
    return (
      <li key={p.id}>
        {p.name || p.id} {rank ? ` - 🏆 ${rank.rank}${rank.rank === 1 ? 'st' : rank.rank === 2 ? 'nd' : rank.rank === 3 ? 'rd' : 'th'} Place` : ""}
      </li>
    );
  })}
</ul>

{rankings.length > 0 && rankings[0].id === socket.id && (
  <h2 style={{ color: "green" }}>🎉 You are the Winner! 🥇</h2>
)}
{rankings.length > 0 && rankings.some(r => r.id === socket.id) && (
  <h3>You finished at {rankings.find(r => r.id === socket.id).rank} place</h3>
)}
        </>
      )}
    </div>
)}
</div>
  );
}

export default App;
