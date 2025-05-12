import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Formats a plain-English system message for the ChatGPT API.
 *
 * @param plainText - The system message in plain English.
 * @returns A ChatGPT message object with the proper structure.
 */
export function formatSystemMessage(plainText: string): ChatCompletionMessageParam {
  let content = (plainText || "").trim();

  return {
    role: "system",
    content,
  };
}