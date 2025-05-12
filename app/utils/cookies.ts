/**
 * Cookie debugging utilities for client-side use
 */

/**
 * Debug and log cookies in the browser
 * 
 * @param prefix Optional logging prefix (default: 'COOKIE')
 * @returns Boolean indicating if auth cookies were found
 */
export function debugClientCookies(prefix: string = 'COOKIE'): boolean {
  try {
    // Only run in browser environment
    if (typeof document === 'undefined') {
      console.warn(`[${prefix}] debugClientCookies called in non-browser environment`);
      return false;
    }

    const cookies = document.cookie.split(';').map(c => c.trim());
    
    // Check for both types of auth cookies used in the system
    const authCookies = cookies.filter(c => 
      c.includes('-auth-token') || c.startsWith('sb-')
    );
    
    console.log(`[${prefix}] Client-side cookies:`, cookies);
    console.log(`[${prefix}] Auth cookies found:`, authCookies.length);
    
    // Log specific auth cookie names for better debugging
    if (authCookies.length > 0) {
      console.log(`[${prefix}] Auth cookie names:`, 
        authCookies.map(c => c.split('=')[0])
      );
    }
    
    return authCookies.length > 0;
  } catch (e) {
    console.error(`[${prefix}] Error checking cookies:`, e);
    return false;
  }
}

/**
 * Get a specific cookie value by name
 * 
 * @param name Cookie name to retrieve
 * @returns Cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${name}=`));
    
    if (!cookie) return null;
    
    return cookie.split('=')[1];
  } catch (e) {
    console.error(`Error getting cookie ${name}:`, e);
    return null;
  }
}

/**
 * Check if auth cookies exist in the browser
 * 
 * @returns Boolean indicating if auth cookies were found
 */
export function hasAuthCookies(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    
    const cookies = document.cookie.split(';').map(c => c.trim());
    return cookies.some(c => 
      c.includes('-auth-token') || c.startsWith('sb-')
    );
  } catch (e) {
    console.error('Error checking auth cookies:', e);
    return false;
  }
}