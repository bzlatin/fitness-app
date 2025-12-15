import crypto from "crypto";

export const createIdGenerator = (alphabet: string, size: number) => {
  if (!alphabet || alphabet.length < 2) {
    throw new Error("Alphabet must include at least 2 characters.");
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Size must be a positive number.");
  }

  return () => {
    let id = "";
    for (let i = 0; i < size; i += 1) {
      id += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return id;
  };
};

const DEFAULT_ID_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";
const DEFAULT_ID_SIZE = 21;

export const generateId = createIdGenerator(DEFAULT_ID_ALPHABET, DEFAULT_ID_SIZE);
