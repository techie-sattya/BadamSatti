import React from 'react';
import './cardintro.css';

const cards= ["jack_of_spades.png", "queen_of_clubs.png", "king_of_diamonds.png", "ace_of_hearts.png"];

const CardIntro = () => {

    return (
        <div className="intro-container">
            {cards.map((card, index) => (
                <img
                key={card}
                src={`../src/cardimages/${card}`}
                alt={`card-${index}`}
                className={`card-intro card${index + 1}`}
                />
            ))}
        </div>
    );
}

export default CardIntro;