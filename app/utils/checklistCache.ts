'use client';

import { FollowUpItem } from './fetchFollowUps';

// Interface for the cached checklist data
interface CachedChecklist {
  patientId: string;
  noteId: string;
  items: FollowUpItem[];
  timestamp: number;
}

// Prefix for localStorage keys
const CACHE_PREFIX = 'checklist_cache_';

/**
 * Generates a unique cache key for a patient and note
 */
export function getChecklistCacheKey(patientId: string, noteId: string): string {
  return `${CACHE_PREFIX}${patientId}_${noteId}`;
}

/**
 * Saves a checklist to localStorage
 */
export function saveChecklistToCache(
  patientId: string,
  noteId: string,
  items: FollowUpItem[]
): void {
  try {
    const cacheKey = getChecklistCacheKey(patientId, noteId);
    const cacheData: CachedChecklist = {
      patientId,
      noteId,
      items,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    
    // Also save as the most recent checklist for this patient
    localStorage.setItem(`${CACHE_PREFIX}${patientId}_latest`, cacheKey);
    
    // Clean up old caches (keep only the 5 most recent per patient)
    cleanupOldCaches(patientId);
  } catch (error) {
    console.error('Error saving checklist to cache:', error);
  }
}

/**
 * Retrieves a checklist from localStorage
 */
export function getChecklistFromCache(
  patientId: string,
  noteId: string
): FollowUpItem[] | null {
  try {
    const cacheKey = getChecklistCacheKey(patientId, noteId);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const parsedData: CachedChecklist = JSON.parse(cachedData);
    return parsedData.items;
  } catch (error) {
    console.error('Error retrieving checklist from cache:', error);
    return null;
  }
}

/**
 * Gets the most recent checklist for a patient
 */
export function getMostRecentChecklist(patientId: string): FollowUpItem[] | null {
  try {
    // Get the key of the most recent checklist
    const latestKey = localStorage.getItem(`${CACHE_PREFIX}${patientId}_latest`);
    
    if (!latestKey) return null;
    
    // Get the actual checklist data
    const cachedData = localStorage.getItem(latestKey);
    
    if (!cachedData) return null;
    
    const parsedData: CachedChecklist = JSON.parse(cachedData);
    return parsedData.items;
  } catch (error) {
    console.error('Error retrieving most recent checklist:', error);
    return null;
  }
}

/**
 * Cleans up old caches, keeping only the 5 most recent per patient
 */
function cleanupOldCaches(patientId: string): void {
  try {
    const patientCachePrefix = `${CACHE_PREFIX}${patientId}_`;
    const cacheKeys: string[] = [];
    
    // Collect all cache keys for this patient
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(patientCachePrefix) && !key.endsWith('_latest')) {
        cacheKeys.push(key);
      }
    }
    
    // Sort by timestamp (newest first)
    const sortedKeys = cacheKeys.sort((a, b) => {
      const aData = JSON.parse(localStorage.getItem(a) || '{}');
      const bData = JSON.parse(localStorage.getItem(b) || '{}');
      return (bData.timestamp || 0) - (aData.timestamp || 0);
    });
    
    // Remove all but the 5 most recent
    if (sortedKeys.length > 5) {
      sortedKeys.slice(5).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  } catch (error) {
    console.error('Error cleaning up old caches:', error);
  }
}

/**
 * Clears all checklist caches
 */
export function clearAllChecklistCaches(): void {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing checklist caches:', error);
  }
}
