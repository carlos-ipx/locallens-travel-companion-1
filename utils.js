const API_BASE_URL = "https://api.locallens.com/v1";
const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 300;
const CACHE_TTL_MS = 5 * 60 * 1000;
const COORD_PRECISION = 5;

function getStored(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, data => resolve(data[key]));
  });
}

function setStored(items) {
  return new Promise(resolve => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function removeStored(keys) {
  return new Promise(resolve => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

class APIClientManager {
  constructor() {
    this.apiKey = null;
  }

  async loadApiKey() {
    if (this.apiKey == null) {
      this.apiKey = await getStored("apiKey") || "";
    }
    return this.apiKey;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request(path, { method = "GET", params = {}, body = null, useAuth = true, retries = 0 } = {}) {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.append(k, v);
    });
    const headers = new Headers();
    if (body != null) {
      headers.set("Content-Type", "application/json");
    }
    if (useAuth) {
      const key = await this.loadApiKey();
      if (!key) throw new Error("API key is missing");
      headers.set("Authorization", `Bearer ${key}`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) {
        return await response.json();
      }
      if (response.status >= 500 && retries < MAX_RETRIES) {
        await this.delay((2 ** retries) * BACKOFF_BASE_MS);
        return this.request(path, { method, params, body, useAuth, retries: retries + 1 });
      }
      if (response.status === 401 && useAuth) {
        this.apiKey = null;
        if (retries < MAX_RETRIES) {
          await this.delay((2 ** retries) * BACKOFF_BASE_MS);
          return this.request(path, { method, params, body, useAuth, retries: retries + 1 });
        }
      }
      const text = await response.text();
      throw new Error(`Request failed ${response.status}: ${text}`);
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") throw new Error("Request timeout");
      throw err;
    }
  }

  _normalizeCoord(coord) {
    return parseFloat(coord).toFixed(COORD_PRECISION);
  }

  async getRecommendations(lat, lon) {
    const rLat = this._normalizeCoord(lat);
    const rLon = this._normalizeCoord(lon);
    const key = `rec_${rLat}_${rLon}`;
    const cached = await getStored(key) || {};
    const now = Date.now();
    if (cached.timestamp && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await this.request("/recommendations", {
      params: { lat: rLat, lon: rLon }
    });
    await setStored({ [key]: { data, timestamp: now } });
    return data;
  }

  async getInsights(lat, lon) {
    const rLat = this._normalizeCoord(lat);
    const rLon = this._normalizeCoord(lon);
    const key = `ins_${rLat}_${rLon}`;
    const cached = await getStored(key) || {};
    const now = Date.now();
    if (cached.timestamp && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await this.request("/insights", {
      params: { lat: rLat, lon: rLon }
    });
    await setStored({ [key]: { data, timestamp: now } });
    return data;
  }

  async clearCache() {
    const allItems = await new Promise(resolve => {
      chrome.storage.local.get(null, data => resolve(data));
    });
    const keysToRemove = Object.keys(allItems).filter(k => k.startsWith("rec_") || k.startsWith("ins_"));
    if (keysToRemove.length > 0) {
      await removeStored(keysToRemove);
    }
  }
}

// Make the instance available for import
export const apiClientManager = new APIClientManager();