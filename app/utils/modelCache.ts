import { getModelFromSettings } from './getModelFromSettings';

let cachedModel: string | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5000; // 5 seconds

export async function getCurrentModel(): Promise<string> {
  const now = Date.now();
  
  // If we have a cached model and it's not expired, return it
  if (cachedModel && (now - lastFetchTime) < CACHE_TTL) {
    return cachedModel;
  }

  // Otherwise fetch the current model
  try {
    const model = await getModelFromSettings();
    cachedModel = model;
    lastFetchTime = now;
    return model;
  } catch (error) {
    console.error('Error fetching current model:', error);
    // If we have a stale cache, better to use it than fail
    if (cachedModel) {
      return cachedModel;
    }
    throw error;
  }
}

export function invalidateModelCache() {
  cachedModel = null;
  lastFetchTime = 0;
} 