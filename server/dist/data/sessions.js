"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSession = exports.sessions = void 0;
exports.sessions = [];
const findSession = (id, userId) => exports.sessions.find((session) => session.id === id && session.userId === userId);
exports.findSession = findSession;
