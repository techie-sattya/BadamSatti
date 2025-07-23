import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { canPlayCard } from './utils/cards';

const socket = io("http://localhost:3000");

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [inputId, setInputId] = useState("");
  const [players, setPlayers] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [myTurn, setMyTurn] = useState(false);
  const [playedCards, setPlayedCards] = useState({});
  const [room, setRoom] = useState(null);


  useEffect(() => {
    socket.on("players-update", (updatedPlayers) => setPlayers(updatedPlayers));

    socket.on("game-started", ({ cards }) => {
      const myId = socket.id;
      setMyCards(cards[myId]);
    });

    socket.on("turn-update", (currentPlayerId) => {
      console.log("Turn update received for:", currentPlayerId, "My ID:", socket.id);
      setMyTurn(currentPlayerId === socket.id);
    });
    socket.on("card-played", ({ card, playerId, playedCards }) => {
      console.log(`${playerId} played ${card.value} of ${card.suit}`);
      setPlayedCards(playedCards);

      // // 👇 If you played this card, remove it from your hand
      // if (playerId === socket.id) {
      //   setMyCards(prev =>
      //     prev.filter(c => !(c.value === card.value && c.suit === card.suit))
      //   );
      // }
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
  console.log("Valid Moves:", validMoves);
  console.log('Mycards', myCards);
  console.log('Mycards', myCards);
  console.log('playedcards', playedCards);
  const canPass = validMoves.length === 0;

  // const handlePass = () => {
  //   socket.emit("pass-turn", { roomId }, (response) => {
  //     if (!response.success) alert(response.message);
  //   });
  // };

  const splitCards = (values) => {
    const above = values.filter(v => v < 7).sort((a, b) => b - a);
    const below = values.filter(v => v > 7).sort((a, b) => a - b);
    return { above, below };
  };

  // const renderSuit = (suit, values) => {
  //   const { above, below } = splitCards(values);
  //   return (
  //     <div key={suit} style={{ margin: '20px', textAlign: 'center' }}>
  //       <div>
  //         {above.map(v => (
  //           <div key={v}>{v} of {suit}</div>
  //         ))}
  //       </div>
  //       <div style={{ fontWeight: 'bold', margin: '5px 0' }}>
  //         7 of {suit}
  //       </div>
  //       <div>
  //         {below.map(v => (
  //           <div key={v}>{v} of {suit}</div>
  //         ))}
  //       </div>
  //     </div>
  //   );
  // };
  function handlePass() {
    socket.emit("pass-turn", { roomId }, (response) => {
      if (!response.success) {
        alert(response.message);
      }
    });
  }

  const suitIcons = {
  hearts: "❤️",
  diamonds: "♦️",
  spades: "♠️",
  clubs: "♣️",
};

const renderSuit = (suit, values) => {
  const { above, below } = splitCards(values);

  return (
    <div key={suit} style={{ margin: '20px', textAlign: 'center', minWidth: '50px' }}>
      {/* Above 7 */}
      {[...above].reverse().map(v => (
        <div key={v}>{v} {suitIcons[suit]}</div>
      ))}

      {/* 7 with suit icon */}
      <div style={{ fontWeight: 'bold', margin: '5px 0' }}>
        7 {suitIcons[suit]}
      </div>

      {/* Below 7 */}
      {below.map(v => (
        <div key={v}>{v} {suitIcons[suit]}</div>
      ))}
    </div>
  );
};



  return (
    <div style={{ padding: "2rem" }}>
      <h2>Start Game</h2>
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
          <h2>Joined Room: {roomId}</h2>
          <h3>Players: {players.length}/4</h3>
          <ul>
            {players.map(p => (
              <li key={p.id}>{p.id === socket.id ? "You" : p.id}</li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {myCards.map((card, index) => {
              const validMoves = getValidMoves(myCards, playedCards);
              const isCardPlayable = myTurn && validMoves.some(
                c => c.suit === card.suit && c.value === card.value
              );

              const isPlayed = playedCards[card.suit]?.includes(parseInt(card.value));
              console.log('card',card);
              console.log('isPlayed',isPlayed);
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (!myTurn) return alert("Not your turn!");
                    socket.emit("play-card", { roomId, card }, (res) => {
                      if (!res.success) alert(res.message);
                    });
                  }}
                  style={{
                    border: "1px solid black",
                    padding: "10px",
                    margin: "5px",
                    width: "60px",
                    textAlign: "center",
                    cursor: myTurn ? isPlayed ? "not-allowed" : "pointer" : "not-allowed",
                    backgroundColor: myTurn ? isPlayed ? "gray" : "lightgreen" : "gray"
                    // isPlayed
                    //   ? "gray"
                    //   : isCardPlayable
                    //   ? "lightgreen"
                    //   : "#eee"
                  }}
                >
                  {card.value} <br />  {suitIcons[card.suit]}
                </div>
              );
            })}

          </div>

          {myTurn && validMoves.length === 0 && (
            <button
              onClick={handlePass}
              style={{ marginTop: "20px", padding: "10px", backgroundColor: "#ccc" }}
            >
              Pass
            </button>
          )}
          {myTurn ? (
            <div style={{ color: "green", fontWeight: "bold" }}>Your Turn</div>
          ) : (
            <div style={{ color: "gray" }}>Waiting for other players...</div>
          )}
          <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', marginTop: '40px' }}>
            {Object.entries(playedCards).map(([suit, values]) => (
              values.includes(7) && renderSuit(suit, values)
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
