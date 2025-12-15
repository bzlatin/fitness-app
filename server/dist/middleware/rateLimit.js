"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackReportLimiter = exports.feedbackCreateLimiter = exports.waitlistLimiter = exports.subscriptionWriteLimiter = exports.aiRecommendLimiter = exports.aiSwapLimiter = exports.aiGenerateLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;
const userOrIpKeyGenerator = (req, res) => {
    const userId = res.locals.userId;
    if (hasValue(userId))
        return `user:${userId}`;
    // Express sets `req.ip`, but its types allow `undefined` in some setups.
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return `ip:${(0, express_rate_limit_1.ipKeyGenerator)(ip)}`;
};
const createLimiter = ({ windowMs, max, message }) => (0, express_rate_limit_1.default)({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userOrIpKeyGenerator,
    handler: (_req, res) => {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message,
        });
    },
});
exports.aiGenerateLimiter = createLimiter({
    windowMs: 60000,
    max: 10,
    message: 'Too many workout generation requests. Please wait a minute and try again.',
});
exports.aiSwapLimiter = createLimiter({
    windowMs: 60000,
    max: 20,
    message: 'Too many swap requests. Please wait a minute and try again.',
});
exports.aiRecommendLimiter = createLimiter({
    windowMs: 60000,
    max: 30,
    message: 'Too many recommendation requests. Please wait a minute and try again.',
});
exports.subscriptionWriteLimiter = createLimiter({
    windowMs: 60000,
    max: 10,
    message: 'Too many subscription requests. Please try again shortly.',
});
exports.waitlistLimiter = createLimiter({
    windowMs: 60 * 60000,
    max: 20,
    message: 'Too many waitlist signup attempts. Please try again later.',
});
exports.feedbackCreateLimiter = createLimiter({
    windowMs: 60 * 60000,
    max: (_req, res) => (res.locals.isAdmin ? 30 : 5),
    message: "You've submitted too many feedback items. Please try again in an hour.",
});
exports.feedbackReportLimiter = createLimiter({
    windowMs: 60 * 60000,
    max: 20,
    message: "You've reported too many items. Please try again later.",
});
