/**
 * Safely converts a value to a valid Date object
 * @param value - The value to convert to a Date (string, Date, or any other value)
 * @returns A valid Date object or null if the value cannot be converted to a valid date
 */
export function toValidDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's already a Date object, validate it
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // If it's a string or number, try to create a new Date
  try {
    const date = new Date(value as string | number);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Error converting to date:', error);
    return null;
  }
}

/**
 * Safely converts a value to an ISO string
 * @param value - The value to convert to an ISO string (string, Date, or any other value)
 * @returns An ISO string or the original value if it cannot be converted
 */
export function toSafeISOString(value: unknown): string {
  const date = toValidDate(value);
  if (date) {
    return date.toISOString();
  }
  
  // If it's already a string, return it
  if (typeof value === 'string') {
    return value;
  }
  
  // Otherwise return an empty string
  return '';
}

/**
 * Formats a date for display
 * @param date - The date to format (string or Date)
 * @returns A formatted date string or empty string if the date is invalid
 */
export function formatDate(date: string | Date | null | undefined): string {
  const validDate = toValidDate(date);
  if (!validDate) {
    return '';
  }
  
  return validDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
}
