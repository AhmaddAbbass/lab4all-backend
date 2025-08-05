export const generateJoinCode = (): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomChars = Array.from({ length: 2 }, () =>
    letters.charAt(Math.floor(Math.random() * letters.length))
  ).join('');

  const timestamp = Date.now().toString(); // e.g., 1724520412731

  return randomChars + timestamp;
};
