const API_BASE_URL = "https://api.locallens.com/v1";
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500; // Increased base for backoff
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const COORD_PRECISION = 5;
const API_KEY_STORAGE_KEY = "locallens_apiKey"; // Centralized key name

// --- Chrome Storage Helper Functions ---
function getStored(key) {
  return new Promise((resolve, reject) => {
    if (!chrome.storage || !chrome.storage.local) {
      console.warn('LocalLens (apiClient): chrome.storage.local not available.');
      // Depending on strictness, you might reject or resolve with undefined
      return reject(new Error('chrome.storage.local not available.'));
    }
    chrome.storage.local.get(key, (data) => {
      if (chrome.runtime.lastError) {
        console.error(`LocalLens (apiClient): Error getting from storage (key: ${key}):`, chrome.runtime.lastError.message);
        return reject(chrome.runtime.lastError);
      }
      resolve(data ? data[key] : undefined);
    });
  });
}

function setStored(items) {
  return new Promise((resolve, reject) => {
    if (!chrome.storage || !chrome.storage.local) {
      console.warn('LocalLens (apiClient): chrome.storage.local not available.');
      return reject(new Error('chrome.storage.local not available.'));
    }
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        console.error('LocalLens (apiClient): Error setting to storage:', chrome.runtime.lastError.message);
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

function removeStored(keys) {
  return new Promise((resolve, reject) => {
    if (!chrome.storage || !chrome.storage.local) {
      console.warn('LocalLens (apiClient): chrome.storage.local not available.');
      return reject(new Error('chrome.storage.local not available.'));
    }
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        console.error('LocalLens (apiClient): Error removing from storage:', chrome.runtime.lastError.message);
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

class APIClientManager {
  constructor() {
    this._apiKey = null; // Use underscore to indicate internal, managed by loadApiKey
    this._apiKeyPromise = null; // To handle concurrent requests for API key
    console.log('LocalLens (apiClient): APIClientManager instantiated.');
  }

  async loadApiKey() {
    if (this._apiKey !== null) { // Check if already loaded
      return this._apiKey;
    }

    if (this._apiKeyPromise) { // Check if load is already in progress
      return this._apiKeyPromise;
    }

    // Start loading the API key
    this._apiKeyPromise = getStored(API_KEY_STORAGE_KEY)
      .then(storedApiKey => {
        this._apiKey = storedApiKey || ""; // Store empty string if not found
        if (!this._apiKey) {
          console.warn(`LocalLens (apiClient): API key not found in storage (key: ${API_KEY_STORAGE_KEY}). Authenticated API requests may fail.`);
        } else {
          // console.log("LocalLens (apiClient): API key loaded from storage.");
        }
        return this._apiKey;
      })
      .catch(error => {
        console.error(`LocalLens (apiClient): Failed to load API key from storage (key: ${API_KEY_STORAGE_KEY}).`, error);
        this._apiKey = ""; // Default to empty on error
        return this._apiKey; // Resolve with empty string rather than rejecting the whole load process
      })
      .finally(() => {
        this._apiKeyPromise = null; // Clear promise once resolved/rejected
      });

    return this._apiKeyPromise;
  }

  async updateApiKey(newKey) {
    const keyToStore = newKey || "";
    this._apiKey = keyToStore; // Update in-memory cache immediately
    try {
      await setStored({ [API_KEY_STORAGE_KEY]: keyToStore });
      console.log(`LocalLens (apiClient): API key updated and stored (key: ${API_KEY_STORAGE_KEY}).`);
    } catch (error) {
      console.error(`LocalLens (apiClient): Failed to store updated API key (key: ${API_KEY_STORAGE_KEY}).`, error);
      // Optionally re-throw or handle
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request(path, { method = "GET", params = {}, body = null, useAuth = true, retries = 0 } = {}) {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.append(k, String(v));
      }
    });

    const headers = new Headers({
      'Accept': 'application/json',
    });

    if (body !== null) {
      headers.set("Content-Type", "application/json");
    }

    if (useAuth) {
      const key = await this.loadApiKey(); // Ensures API key is loaded
      if (!key) {
        console.warn(`LocalLens (apiClient): API key is missing for authenticated request to ${path}. The request will likely fail.`);
        // Consider if you should throw an error here to prevent the request
        // throw new Error("API key is missing. Please set it in the extension options.");
      }
      headers.set("Authorization", `Bearer ${key}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    // console.log(`LocalLens (apiClient): Requesting ${method} ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : null,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const responseData = await response.json();
        // console.log(`LocalLens (apiClient): Request to ${path} successful.`);
        return responseData;
      }

      // Retry logic
      const shouldRetry = (response.status >= 500 || response.status === 401 || response.status === 429 || response.status === 408);
      if (shouldRetry && retries < MAX_RETRIES) {
        const retryDelay = (2 ** retries) * BACKOFF_BASE_MS + (Math.random() * BACKOFF_BASE_MS * 0.5); // Added jitter
        console.warn(`LocalLens (apiClient): Request to ${path} failed with status ${response.status}. Retrying in ${retryDelay.toFixed(0)}ms (attempt ${retries + 1}/${MAX_RETRIES}).`);
        await this._delay(retryDelay);

        if (response.status === 401 && useAuth) {
          console.log("LocalLens (apiClient): Attempting to reload API key due to 401.");
          this._apiKey = null; // Force reload of API key on next attempt
        }
        return this.request(path, { method, params, body, useAuth, retries: retries + 1 });
      }

      // Handle non-retryable errors or max retries reached
      let errorData;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        errorData = await response.json();
      } else {
        errorData = await response.text();
      }

      console.error(`LocalLens (apiClient): API request to ${path} failed with status ${response.status}:`, errorData);
      const error = new Error(`API request failed: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.data = errorData;
      throw error;

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error(`LocalLens (apiClient): Request to ${path} timed out after ${DEFAULT_TIMEOUT}ms.`);
        const timeoutError = new Error("Request timeout");
        timeoutError.isTimeout = true;
        throw timeoutError;
      }
      // Re-throw other errors (network errors, or errors from non-ok responses not caught by retry)
      // console.error(`LocalLens (apiClient): Network or unexpected error during request to ${path}:`, err);
      throw err; // err already contains status and data if it's an API error
    }
  }

  _normalizeCoord(coord) {
    const num = parseFloat(coord);
    return isNaN(num) ? '0.00000' : num.toFixed(COORD_PRECISION);
  }

  async getRecommendations(latitude, longitude) {
    if (latitude == null || longitude == null) { // More explicit checks
      const errorMsg = "Latitude and/or longitude are missing for getRecommendations.";
      console.error(`LocalLens (apiClient): ${errorMsg}`);
      return Promise.reject(new Error(errorMsg));
    }
    const rLat = this._normalizeCoord(latitude);
    const rLon = this._normalizeCoord(longitude);
    const cacheKey = `ll_rec_${rLat}_${rLon}`; // Prefix cache keys

    try {
      const cached = await getStored(cacheKey);
      if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        // console.log(`LocalLens (apiClient): Returning cached recommendations for lat:${rLat}, lon:${rLon}`);
        return cached.data;
      }

      // console.log(`LocalLens (apiClient): Fetching fresh recommendations for lat:${rLat}, lon:${rLon}`);
      const data = await this.request("/recommendations", {
        params: { lat: rLat, lon: rLon },
        useAuth: true, // Assuming recommendations require authentication
      });
      await setStored({ [cacheKey]: { data, timestamp: Date.now() } });
      return data;
    } catch (error) {
      console.error(`LocalLens (apiClient): Failed to get recommendations for lat:${rLat}, lon:${rLon}.`, error);
      throw error;
    }
  }

  async getInsights(latitude, longitude) {
    if (latitude == null || longitude == null) {
      const errorMsg = "Latitude and/or longitude are missing for getInsights.";
      console.error(`LocalLens (apiClient): ${errorMsg}`);
      return Promise.reject(new Error(errorMsg));
    }
    const rLat = this._normalizeCoord(latitude);
    const rLon = this._normalizeCoord(longitude);
    const cacheKey = `ll_ins_${rLat}_${rLon}`; // Prefix cache keys

    try {
      const cached = await getStored(cacheKey);
      if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        // console.log(`LocalLens (apiClient): Returning cached insights for lat:${rLat}, lon:${rLon}`);
        return cached.data;
      }

      // console.log(`LocalLens (apiClient): Fetching fresh insights for lat:${rLat}, lon:${rLon}`);
      const data = await this.request("/insights", {
        params: { lat: rLat, lon: rLon },
        useAuth: true, // Assuming insights require authentication
      });
      await setStored({ [cacheKey]: { data, timestamp: Date.now() } });
      return data;
    } catch (error) {
      console.error(`LocalLens (apiClient): Failed to get insights for lat:${rLat}, lon:${rLon}.`, error);
      throw error;
    }
  }

  async clearApiCache() {
    try {
      const allItems = await new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (data) => { // Get all items
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(data);
        });
      });
      const keysToRemove = Object.keys(allItems).filter(k => k.startsWith("ll_rec_") || k.startsWith("ll_ins_"));
      if (keysToRemove.length > 0) {
        await removeStored(keysToRemove);
        console.log("LocalLens (apiClient): Cleared API cache.", keysToRemove);
      } else {
        // console.log("LocalLens (apiClient): No API cache items found to clear.");
      }
    } catch (error) {
        console.error("LocalLens (apiClient): Failed to clear API cache.", error);
    }
  }
}

// Export a single instance (Singleton pattern)
const apiClientManager = new APIClientManager();
export default apiClientManager;
