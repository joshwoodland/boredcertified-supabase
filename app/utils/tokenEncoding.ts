/**
 * Utility functions for token encoding and estimation
 * 
 * Since tiktoken is not directly available, we'll use an approximation
 * approach for token counting.
 */

/**
 * Estimates the number of tokens in a text using character count approximation
 * Note: This is a rough approximation - OpenAI models typically average ~4 chars/token
 * 
 * @param text The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Determines if a text might exceed a token limit based on character estimation
 * 
 * @param text The text to check
 * @param limit The token limit to check against
 * @returns True if the text might exceed the limit
 */
export function mightExceedTokenLimit(text: string, limit: number): boolean {
  return estimateTokenCount(text) > limit;
}
