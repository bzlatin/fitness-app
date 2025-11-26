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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIProvider = void 0;
const OpenAIProvider_1 = require("./OpenAIProvider");
/**
 * Factory function to get the AI provider instance
 * Currently returns OpenAI provider, but can be easily swapped for other providers
 */
const getAIProvider = () => {
    // In the future, this could check environment variables to select provider
    // e.g., if (process.env.AI_PROVIDER === 'anthropic') return new AnthropicProvider();
    return new OpenAIProvider_1.OpenAIProvider();
};
exports.getAIProvider = getAIProvider;
// Re-export types for convenience
__exportStar(require("./AIProvider.interface"), exports);
