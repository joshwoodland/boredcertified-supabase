/**
 * Safely parses a JSON string and handles potential errors.
 * 
 * @param jsonString - The JSON string to parse
 * @param fallback - Optional fallback value to return if parsing fails
 * @returns The parsed object or the fallback value
 */
export function safeJsonParse<T>(jsonString: string, fallback: T | null = null): T | null {
  if (!jsonString) return fallback;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('JSON parsing error:', error);
    
    // Try to clean up common JSON parsing issues
    try {
      // Try to find a complete JSON object and ignore extra characters
      const objectRegex = /({[\s\S]*})/; // Using [\s\S] instead of dot with 's' flag
      const matches = jsonString.match(objectRegex);
      if (matches && matches[1]) {
        const cleanedJson = matches[1];
        console.log('Attempting to parse cleaned JSON:', cleanedJson.substring(0, 50) + '...');
        return JSON.parse(cleanedJson) as T;
      }
    } catch (cleanupError) {
      console.error('JSON cleanup failed:', cleanupError);
    }
    
    return fallback;
  }
}

/**
 * Safely extracts content from a potential JSON string or object.
 * 
 * @param input - Either a JSON string or an object that might contain a content field
 * @returns The extracted content as a string
 */
export function extractContent(input: string | any): string {
  // If input is null or undefined, return empty string
  if (input == null) return '';
  
  // If input is already a string, try to parse it as JSON
  if (typeof input === 'string') {
    // If it doesn't look like JSON, return it directly
    if (!input.trim().startsWith('{') && !input.trim().startsWith('[')) {
      return input;
    }
    
    // Try to parse it as JSON
    const parsed = safeJsonParse<any>(input);
    if (!parsed) return input; // If parsing failed, return original string
    
    // If parsing succeeded, extract content from the parsed object
    return extractContent(parsed);
  }
  
  // If input is an object, try to extract content
  if (typeof input === 'object') {
    // If it has a content field that's a string, return that
    if (input.content && typeof input.content === 'string') {
      return input.content;
    }
    
    // If content is not a string, stringify it
    if (input.content) {
      return typeof input.content === 'object' 
        ? JSON.stringify(input.content, null, 2) 
        : String(input.content);
    }
    
    // If no content field, stringify the whole object
    return JSON.stringify(input, null, 2);
  }
  
  // For any other type, convert to string
  return String(input);
} 