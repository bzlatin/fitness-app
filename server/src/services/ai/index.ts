import { OpenAIProvider } from "./OpenAIProvider";
import { AIProvider } from "./AIProvider.interface";

/**
 * Factory function to get the AI provider instance
 * Currently returns OpenAI provider, but can be easily swapped for other providers
 */
export const getAIProvider = (): AIProvider => {
  // In the future, this could check environment variables to select provider
  // e.g., if (process.env.AI_PROVIDER === 'anthropic') return new AnthropicProvider();
  return new OpenAIProvider();
};

// Re-export types for convenience
export * from "./AIProvider.interface";
