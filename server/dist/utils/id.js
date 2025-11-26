"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = void 0;
const nanoid_1 = require("nanoid");
const generateId = () => (0, nanoid_1.nanoid)();
exports.generateId = generateId;
