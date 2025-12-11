"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitFeedback = exports.validateProfanity = exports.containsProfanity = void 0;
/**
 * Profanity word list - common inappropriate words to filter
 * This is a basic list and should be expanded based on moderation needs
 */
const PROFANITY_LIST = [
    // Strong profanity
    "fuck",
    "shit",
    "bitch",
    "ass",
    "asshole",
    "bastard",
    "damn",
    "crap",
    "piss",
    "dick",
    "cock",
    "pussy",
    "cunt",
    "whore",
    "slut",
    "fag",
    "nigger",
    "nigga",
    "retard",
    "retarded",
    // Variations and common bypasses
    "f*ck",
    "sh*t",
    "b*tch",
    "a**",
    "fuk",
    "fuq",
    "shyt",
    "azz",
    "biatch",
];
/**
 * Check if text contains profanity
 * Uses word boundaries to avoid false positives (e.g., "classic" shouldn't trigger "ass")
 */
const containsProfanity = (text) => {
    if (!text)
        return false;
    const normalized = text.toLowerCase();
    return PROFANITY_LIST.some((word) => {
        // Escape special regex characters in the word
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use word boundaries to match whole words only
        const regex = new RegExp(`\\b${escapedWord}\\b`, "i");
        return regex.test(normalized);
    });
};
exports.containsProfanity = containsProfanity;
/**
 * Middleware to validate request body fields for profanity
 * @param fields - Array of field names to check for profanity
 */
const validateProfanity = (fields) => {
    return (req, res, next) => {
        for (const field of fields) {
            const value = req.body[field];
            if (typeof value === "string" && (0, exports.containsProfanity)(value)) {
                return res.status(400).json({
                    error: `Please keep your ${field} professional and respectful. Profanity is not allowed.`,
                });
            }
        }
        next();
    };
};
exports.validateProfanity = validateProfanity;
/**
 * Rate limiting for feedback submissions
 * Prevents spam by limiting users to 5 submissions per hour (30 for admins)
 */
const submissionTracking = new Map();
const rateLimitFeedback = async (req, res, next) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    // Check if user is admin (admins get higher limit for testing)
    const isAdmin = res.locals.isAdmin ?? false;
    const limit = isAdmin ? 30 : 5;
    const now = Date.now();
    const userTracking = submissionTracking.get(userId);
    // Reset if hour has passed
    if (!userTracking || now > userTracking.resetAt) {
        submissionTracking.set(userId, {
            count: 1,
            resetAt: now + 60 * 60 * 1000, // 1 hour from now
        });
        return next();
    }
    // Check if under limit
    if (userTracking.count < limit) {
        userTracking.count += 1;
        return next();
    }
    return res.status(429).json({
        error: `You've submitted too many feedback items. Please try again in an hour.`,
    });
};
exports.rateLimitFeedback = rateLimitFeedback;
