export function canPlayCard(card, playedCards) {
  const [value, suit] = parseCard(card);
  const values = playedCards[suit];

  if (value === 7 && values.length === 0) return true;
  if (values.includes(value - 1) || values.includes(value + 1)) return true;

  return false;
}

function parseCard(card) {
  const suitNames = {
    H: 'hearts',
    D: 'diamonds',
    C: 'clubs',
    S: 'spades',
  };

  const match = card.match(/^(\d+)([HDCS])$/);
  const value = parseInt(match[1], 10);
  const suit = suitNames[match[2]];

  return [value, suit];
}
