import { Request, Response, NextFunction } from "express";

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
export const containsProfanity = (text: string): boolean => {
  if (!text) return false;

  const normalized = text.toLowerCase();

  return PROFANITY_LIST.some((word) => {
    // Escape special regex characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundaries to match whole words only
    const regex = new RegExp(`\\b${escapedWord}\\b`, "i");
    return regex.test(normalized);
  });
};

/**
 * Middleware to validate request body fields for profanity
 * @param fields - Array of field names to check for profanity
 */
export const validateProfanity = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      const value = req.body[field];

      if (typeof value === "string" && containsProfanity(value)) {
        return res.status(400).json({
          error: `Please keep your ${field} professional and respectful. Profanity is not allowed.`,
        });
      }
    }

    next();
  };
};
