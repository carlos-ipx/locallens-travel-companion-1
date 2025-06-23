// API Keys and direct API URLs are removed. All calls go through WORKER_URL.
const WORKER_URL = "https://your-worker-name.your-account.workers.dev"; // USER: Replace with your actual worker URL

const DEFAULT_RADIUS_METERS = 5000;
const DEFAULT_TIMEOUT = 10000; // Timeout for fetch requests to the worker
// const MAX_RETRIES = 3; // Not used by current fetch implementations
// const BACKOFF_BASE_MS = 300; // Not used by current fetch implementations
const CACHE_TTL_MS = 5 * 60 * 1000; // Retained for potential future caching logic for worker responses
const COORD_PRECISION = 5; // Retained for _normalizeCoord

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
    // this.apiKey remains for loadApiKey, though not used by proxied calls
    this.apiKey = null;
  }

  // This method is for loading a user-configured API key from storage.
  // Currently, Geoapify and OpenAI keys are expected to be managed by the Cloudflare Worker.
  // This method is kept for potential future use or if other non-proxied APIs were added.
  async loadApiKey() {
    if (this.apiKey == null) {
      this.apiKey = await getStored("apiKey") || "";
    }
    return this.apiKey;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _normalizeCoord(coord) {
    // Ensure coord is a number before calling toFixed
    const num = parseFloat(coord);
    if (isNaN(num)) {
        console.warn(`_normalizeCoord received non-numeric value: ${coord}`);
        return null; // Or throw error, or return as is, depending on desired strictness
    }
    return num.toFixed(COORD_PRECISION);
  }

  async geocode(locationText) {
    if (!locationText || locationText.trim() === "") {
      console.error("APIClientManager: geocode called with empty locationText.");
      throw new Error("Location text cannot be empty for geocoding.");
    }
    console.log(`APIClientManager: Geocoding location via worker: "${locationText}"`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(`${WORKER_URL}/geoapify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "/v1/geocode/search",
          query_params: {
            text: locationText,
            limit: 1
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = (errorData.error && (errorData.error.message || errorData.error)) || errorData.message || errorMsg;
        } catch (e) { /* ignore if response isn't json */ }
        console.error("Worker /geoapify (geocode) request failed:", response.status, errorMsg);
        throw new Error(`Geocoding via proxy failed: ${errorMsg}`);
      }

      const geocodeData = await response.json();

      if (geocodeData && geocodeData.features && Array.isArray(geocodeData.features) && geocodeData.features.length > 0) {
        const firstResult = geocodeData.features[0];
        if (firstResult.geometry && firstResult.geometry.coordinates) {
          const [lon, lat] = firstResult.geometry.coordinates;
          console.log(`APIClientManager: Geocoded "${locationText}" via worker to Lat: ${lat}, Lon: ${lon}`);
          return { lat, lon, fullAddress: firstResult.properties.formatted };
        }
      }
      console.warn(`APIClientManager: Could not geocode location via worker (no valid coordinates): "${locationText}"`, geocodeData);
      throw new Error(`Could not find valid coordinates for location: "${locationText}".`);
    } catch (error) {
      console.error(`APIClientManager: Error during geocode process for "${locationText}":`, error);
      if (error instanceof Error &&
          (error.message.startsWith("Geocoding via proxy failed:") ||
           error.message.startsWith("Could not find valid coordinates for location:") ||
           error.message.startsWith("Location text cannot be empty for geocoding."))) {
        throw error;
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Geocoding request timed out for "${locationText}".`);
        }
        throw new Error(`Geocoding error for "${locationText}": ${error.message}`);
      } else {
        throw new Error(`Geocoding error for "${locationText}": ${String(error)}`);
      }
    }
  }

  async getOpenAISummary(placeName, locationName) {
    const prompt = `For the place named "${placeName}" located in "${locationName}", provide a short, engaging summary (around 2-3 sentences, max 70 words). This summary should highlight why it might be considered an authentic or "off-the-beaten-path" experience for a traveler, focusing on its unique local appeal rather than typical tourist descriptions.`;
    console.log(`APIClientManager: Requesting OpenAI summary via worker for "${placeName}" in "${locationName}"`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(`${WORKER_URL}/openai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful travel assistant that specializes in finding authentic, local experiences." },
            { role: "user", content: prompt }
          ],
          // temperature: 0.7, // Assuming worker handles or defaults
          // max_tokens: 100
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = (errorData.error && (errorData.error.message || errorData.error)) || errorData.message || errorMsg;
        } catch (e) { /* ignore */ }
        console.error("Worker /openai request failed:", response.status, errorMsg);
        throw new Error(`OpenAI summary via proxy failed: ${errorMsg}`);
      }

      const data = await response.json();
      if (data && data.summary) {
        console.log(`APIClientManager: OpenAI summary received from worker for "${placeName}"`);
        return data.summary.trim();
      } else if (data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        console.log(`APIClientManager: OpenAI summary (raw) received from worker for "${placeName}"`);
        return data.choices[0].message.content.trim();
      } else {
        console.error("Worker /openai response did not contain expected content:", data);
        throw new Error("OpenAI summary response from proxy was not in the expected format.");
      }
    } catch (error) {
      console.error(`APIClientManager: Proxy error for OpenAI API call for "${placeName}":`, error);
      if (error instanceof Error && error.message.startsWith("OpenAI summary via proxy failed:")) {
        throw error;
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`OpenAI summary request timed out for "${placeName}".`);
        }
        throw new Error(`OpenAI summary proxy error for "${placeName}": ${error.message}`);
      } else {
        throw new Error(`OpenAI summary proxy error for "${placeName}": ${String(error)}`);
      }
      // Fallback summary can be handled by the caller in background.js if needed
    }
  }

  _getCategoriesForPlaceType(placeTypeQuery) {
    const lowerQuery = placeTypeQuery ? placeTypeQuery.toLowerCase().trim() : "";
    const thingsToDoCategories = [
      "tourism.sights", "tourism.attraction", "heritage", "natural",
      "natural.mountain.peak", "natural.water.spring", "natural.sand.dune",
      "leisure.park", "leisure.playground", "leisure.park.nature_reserve",
      "activity", "entertainment.culture", "entertainment.museum", "sport",
      "catering.cafe", "catering.restaurant", "commercial.marketplace"
    ].join(',');
    const defaultBroadCategories = "accommodation,catering,entertainment,tourism,leisure,commercial,activity,sport,natural,service,public_transport";

    if (!lowerQuery) {
      return thingsToDoCategories;
    }
    const categoryMap = {
      "restaurants": "catering.restaurant", "restaurant": "catering.restaurant", "food": "catering",
      "hotels": "accommodation.hotel", "hotel": "accommodation.hotel", "lodging": "accommodation",
      "attractions": "tourism.attraction,tourism.sights", "attraction": "tourism.attraction,tourism.sights",
      "sights": "tourism.sights", "museums": "entertainment.museum", // Corrected from tourism.sights.museum
      "cafes": "catering.cafe", "cafe": "catering.cafe",
      "bars": "catering.bar", "bar": "catering.bar", "pubs": "catering.pub", "pub": "catering.pub",
      "shopping": "commercial.shopping_mall,commercial.department_store,commercial.market",
      "mall": "commercial.shopping_mall",
      "groceries": "commercial.supermarket,commercial.convenience", "supermarket": "commercial.supermarket",
      "pharmacy": "healthcare.pharmacy", "hospital": "healthcare.hospital",
      "parking": "parking", "airport": "airport", "gas station": "service.vehicle.fuel",
      "things to do": thingsToDoCategories,
    };
    return categoryMap[lowerQuery] || defaultBroadCategories;
  }

  async searchByQuery(placeTypeQuery, lat, lon, radius = DEFAULT_RADIUS_METERS, limit = 50) {
    const actualLimit = (!placeTypeQuery || placeTypeQuery.toLowerCase().trim() === "") ? 15 : limit;
    console.log("APIClientManager: Entering searchByQuery (via worker).");
    console.log(`  placeTypeQuery: "${placeTypeQuery}"`);
    console.log(`  lat: ${lat}, lon: ${lon}, radius: ${radius}, limit: ${actualLimit}`);

    if (typeof lat !== 'number' || typeof lon !== 'number' || typeof radius !== 'number') {
      console.error("APIClientManager: Invalid lat, lon, or radius for searchByQuery.", {lat, lon, radius});
      throw new Error("Invalid coordinates or radius for place search.");
    }

    const categories = this._getCategoriesForPlaceType(placeTypeQuery);
    console.log(`  Mapped categories for worker: "${categories}"`);

    const queryParamsForWorker = {
      categories: categories,
      filter: `circle:${lon},${lat},${radius}`,
      limit: actualLimit
    };
    console.log("  Geoapify /v2/places query_params for worker:", JSON.stringify(queryParamsForWorker, null, 2));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(`${WORKER_URL}/geoapify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "/v2/places",
          query_params: queryParamsForWorker
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = (errorData.error && (errorData.error.message || errorData.error)) || errorData.message || errorMsg;
        } catch (e) { /* ignore */ }
        console.error("Worker /geoapify (places) request failed:", response.status, errorMsg);
        throw new Error(`Place search via proxy failed: ${errorMsg}`);
      }

      const geoapifyData = await response.json();
      console.log("  Received data from worker for /geoapify (places):", JSON.stringify(geoapifyData, null, 2).substring(0, 500) + "...");

      if (geoapifyData && geoapifyData.features && Array.isArray(geoapifyData.features)) {
        console.log(`  Mapping ${geoapifyData.features.length} features from worker response.`);
        return geoapifyData.features.map(feature => {
          const props = feature.properties;
          let address = [props.address_line1, props.address_line2].filter(Boolean).join(', ');
          if (!address && props.street && props.city) {
              address = `${props.street}, ${props.city}`;
          } else if (!address && props.formatted) {
              address = props.formatted;
          }
          return {
            name: props.name || props.street || "Unknown place",
            address: address || "Address not available",
            categories: props.categories ? props.categories.join(', ') : 'N/A',
            distance: props.distance ? `${props.distance}m` : null,
          };
        });
      }
      console.log("  No features found or unexpected structure in /geoapify (places) response from worker.");
      return [];
    } catch (error) {
      console.error(`APIClientManager: Proxy error for /v2/places API call for type "${placeTypeQuery}":`, error);
      if (error instanceof Error && error.message.startsWith("Place search via proxy failed:")) {
        throw error;
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Place search request timed out for type "${placeTypeQuery}".`);
        }
        throw new Error(`Place search proxy error for type "${placeTypeQuery}": ${error.message}`);
      } else {
        throw new Error(`Place search proxy error for type "${placeTypeQuery}": ${String(error)}`);
      }
    }
  }

  async getPlaceDetails(placeId) {
    if (!placeId) {
      console.error("APIClientManager: getPlaceDetails called with no placeId.");
      return null;
    }
    console.log(`APIClientManager: Fetching details for placeId via worker: ${placeId}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(`${WORKER_URL}/geoapify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "/v2/place-details",
          query_params: { id: placeId }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = (errorData.error && (errorData.error.message || errorData.error)) || errorData.message || errorMsg;
        } catch (e) { /* ignore */ }
        console.error("Worker /geoapify (place-details) request failed:", response.status, errorMsg);
        throw new Error(`Place details via proxy failed: ${errorMsg}`);
      }

      const geoapifyData = await response.json();

    if (geoapifyData && geoapifyData.features && Array.isArray(geoapifyData.features) && geoapifyData.features.length > 0) {
      return geoapifyData.features[0].properties;
    } else if (geoapifyData && geoapifyData.properties) {
        return geoapifyData.properties;
    } else if (geoapifyData) {
        return geoapifyData;
    }

    console.warn(`APIClientManager: No details found or unexpected structure for placeId via worker: ${placeId}`);
    return null; // Or throw new Error (`No details found for placeId ${placeId}`);

    } catch (error) {
      console.error(`APIClientManager: Proxy error for getPlaceDetails for placeId "${placeId}":`, error);
      if (error instanceof Error && error.message.startsWith("Place details via proxy failed:")) {
        throw error;
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Place details request timed out for placeId "${placeId}".`);
        }
        throw new Error(`Place details proxy error for placeId "${placeId}": ${error.message}`);
      } else {
        throw new Error(`Place details proxy error for placeId "${placeId}": ${String(error)}`);
      }
    }
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