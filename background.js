// LocalLens Background Service Worker
// This script will handle extension lifecycle events,
// API call orchestration, message routing, and caching.

// Assuming utils.js and apiRouterInstaller.js are ES modules
// and background service worker supports module imports.
import { apiClientManager } from './utils.js';
import { installApiRouter } from './apiRouterInstaller.js';

// OFFSCREEN_DOCUMENT_PATH and getGeolocationViaOffscreen function removed.
// Geolocation will be replaced by geocoding user-typed locations.

console.log("LocalLens Background Service Worker starting...");

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(details => {
  console.log("LocalLens installed:", details.reason);
  // Perform initial setup, like setting default preferences
  // if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
  //   // Initialize default settings from preferencesValidator.js if needed
  // }
});

// Define API routes and handlers
const routes = {
  PROCESS_POPUP_INPUT: async (payload, sender) => {
    console.log("Background: Received PROCESS_POPUP_INPUT", payload);
    // Removed the old erroneous check for !payload.query that was throwing the error.
    // The logic now correctly proceeds to the Promise that handles locationQuery.

    // The Promise-based logic starts here:
    return new Promise(async (resolve) => {
      // This first check within the promise for payload.query was also part of the old/mixed logic.
      // It should solely rely on payload.locationQuery as per the message structure.
      // if (!payload || !payload.query) { // This line is effectively superseded by the check below
      //   resolve({ message: "Query is missing.", items: [] });
      //   return;
      // }

      // Correct logic starts here, expecting payload.locationQuery
      try {
        if (!payload || !payload.locationQuery) { // Check for payload itself and locationQuery
          resolve({ message: "Location query is missing.", items: [] });
          return;
        }
        const geocodedLocation = await apiClientManager.geocode(payload.locationQuery);
        console.log(`Background: Geocoded "${payload.locationQuery}" to Lat: ${geocodedLocation.lat}, Lon: ${geocodedLocation.lon}`);

        // payload.placeTypeQuery is "" for PROCESS_POPUP_INPUT.
        // searchByQuery with empty placeTypeQuery now fetches a candidate list (limit 15) for "things to do".
        const candidatePlaces = await apiClientManager.searchByQuery(
          payload.placeTypeQuery, // This will be ""
          geocodedLocation.lat,
          geocodedLocation.lon
        );

        if (candidatePlaces && candidatePlaces.length > 0) {
          const topCandidates = candidatePlaces.slice(0, 5);
          const itemsWithSummaries = await Promise.all(
            topCandidates.map(async (place) => {
              try {
                const summary = await apiClientManager.getOpenAISummary(place.name, geocodedLocation.fullAddress || payload.locationQuery);
                return {
                  name: place.name,
                  address: place.address, // Keep address if available
                  categories: place.categories, // Keep categories if available
                  authentic_summary: summary
                };
              } catch (summaryError) {
                console.error(`Error getting OpenAI summary for ${place.name}:`, summaryError);
                return {
                  name: place.name,
                  address: place.address,
                  categories: place.categories,
                  authentic_summary: "Could not load an authentic summary for this place. It is a known point of interest." // Fallback summary
                };
              }
            })
          );
          resolve({ items: itemsWithSummaries });
        } else {
          resolve({ message: `Could not find specific things to do in "${payload.locationQuery}". Try a broader search or check spelling.`, items: [] });
        }
      } catch (error) { // Catches errors from geocode or searchByQuery
        console.error("Error in PROCESS_POPUP_INPUT handler:", error);
        resolve({ message: `Error processing your request: ${error.message}`, items: [] });
      }
    });
  },
  searchPlaces: async (payload, sender) => { // For quick buttons
    console.log("Background: Received searchPlaces", payload);
    return new Promise(async (resolve) => {
      // Payload for searchPlaces is { placeTypeQuery: "type", locationQuery: "text" }
      if (!payload.locationQuery) {
        resolve({ status: 'error', message: 'Location query is missing for quick search.' });
        return;
      }
      if (!payload.placeTypeQuery) { // Should not happen if buttons are configured
        resolve({ status: 'error', message: 'Place type query is missing for quick search.' });
        return;
      }

      try {
        const geocodedLocation = await apiClientManager.geocode(payload.locationQuery);
        console.log(`Background: Geocoded "${payload.locationQuery}" to Lat: ${geocodedLocation.lat}, Lon: ${geocodedLocation.lon} for quick search type "${payload.placeTypeQuery}"`);

        const results = await apiClientManager.searchByQuery(payload.placeTypeQuery, geocodedLocation.lat, geocodedLocation.lon);

        if (results && results.length > 0) {
          resolve({ status: 'success', data: results });
        } else {
          resolve({ status: 'success', data: [], message: `No ${payload.placeTypeQuery} found in "${payload.locationQuery}".` });
        }
      } catch (error) { // Catches errors from geocode or searchByQuery
        console.error("Error in searchPlaces handler:", error);
        resolve({ status: 'error', message: `Error: ${error.message}` });
      }
    });
  },
  pageNavigated: async (payload, sender) => {
    console.log("Background: Received pageNavigated", payload);
    // Potentially trigger sidebar updates or checks based on the new URL
    // Example: chrome.tabs.sendMessage(sender.tab.id, { type: 'updateSidebar', payload: { html: `Navigated to ${payload.url}` } });
    return { status: "Page navigation noted." };
  },
  RECOMMENDATION_SELECTED: async (payload, sender) => {
    console.log("Background: Received RECOMMENDATION_SELECTED", payload);
    // Handle what happens when a recommendation is selected in the sidebar
    return { status: "Recommendation selection noted." };
  },
  // Add other routes like SEARCH_DESTINATION, FETCH_NEARBY as their full logic becomes clear
};

// Install the router to handle messages
const uninstallRouter = installApiRouter(routes);
console.log("LocalLens API Router installed.");

// Optional: Listener for when the extension is shutting down (e.g., being disabled or uninstalled)
// This might not be available in all environments or might have limitations.
// self.addEventListener('message', event => {
//   if (event.data && event.data.type === 'chrome-extension://unload') {
//     console.log("LocalLens Background Service Worker unloading.");
//     if (typeof uninstallRouter === 'function') {
//       uninstallRouter();
//       console.log("LocalLens API Router uninstalled.");
//     }
//   }
// });

// Old API Key loading logic removed as Geoapify key is hardcoded in utils.js for now.
// apiClientManager.loadApiKey().then(key => {
//   if (key && key.length > 0) { // Also check if the key is not an empty string
//     console.log("API Key loaded for apiClientManager.");
//   } else if (key === "") {
//     console.warn("API Key is configured but is an empty string.");
//   } else { // Key is null or undefined
//     console.warn("API Key not found for apiClientManager. Please configure it in options.");
//   }
// }).catch(error => {
//   console.error("Error loading API Key:", error);
// });

console.log("LocalLens Background Service Worker initialized.");
