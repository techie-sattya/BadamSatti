import React, { useState } from 'react';
import './welcome.css';
const WelcomePage = ({ onJoin }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const validateName = (input) => {
    const trimmed = input.trim();

    // Allow only alphabets and spaces
    const nameRegex = /^[A-Za-z\s]+$/;

    if (!trimmed) {
      return "Name cannot be empty.";
    } else if (!nameRegex.test(trimmed)) {
      return "Name must contain only letters and spaces.";
    }

    return "";
  };

  const handleJoin = () => {
    const validationMessage = validateName(name);
    if (validationMessage) {
      setError(validationMessage);
    } else {
      setError("");
      onJoin(name.trim());
    }
  };

  return (
    <div className="welcome-page">
      <div className="welcome-box">
        <div className="card-emoji">🃏</div>
        
        <h1 className="game-title">Welcome to Badam Satti</h1>
        <p className="game-description">
          Enter your name to join the table and start playing with friends.
        </p>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="name-input"
        />
        <button onClick={handleJoin} className="join-button">
          Join Game
        </button>
        {error && <p style={{ color: "Black", marginTop: "8px" }}>{error}</p>}
      </div>
    </div>
  );
};

export default WelcomePage;
