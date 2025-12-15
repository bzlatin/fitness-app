"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = exports.createIdGenerator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const createIdGenerator = (alphabet, size) => {
    if (!alphabet || alphabet.length < 2) {
        throw new Error("Alphabet must include at least 2 characters.");
    }
    if (!Number.isFinite(size) || size <= 0) {
        throw new Error("Size must be a positive number.");
    }
    return () => {
        let id = "";
        for (let i = 0; i < size; i += 1) {
            id += alphabet[crypto_1.default.randomInt(0, alphabet.length)];
        }
        return id;
    };
};
exports.createIdGenerator = createIdGenerator;
const DEFAULT_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";
const DEFAULT_ID_SIZE = 21;
exports.generateId = (0, exports.createIdGenerator)(DEFAULT_ID_ALPHABET, DEFAULT_ID_SIZE);
