// LocalLens Background Service Worker
// This script will handle extension lifecycle events,
// API call orchestration, message routing, and caching.

// Assuming utils.js and apiRouterInstaller.js are ES modules
// and background service worker supports module imports.
import { apiClientManager } from './utils.js';
import { installApiRouter } from './apiRouterInstaller.js';

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
    if (!payload || !payload.query) {
      throw new Error("Query is missing in PROCESS_POPUP_INPUT");
    }
    // Example: Fetch recommendations based on the query
    // This is a placeholder. Actual implementation will depend on API structure.
    // const recommendations = await apiClientManager.getRecommendations(payload.query.lat, payload.query.lon);
    // return { items: recommendations };
    // For now, returning a dummy response
    return { message: `Query "${payload.query}" received. Processing not yet implemented.`, items: [] };
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

// Initialize API Client (e.g., load API key if needed at startup)
apiClientManager.loadApiKey().then(key => {
  if (key && key.length > 0) { // Also check if the key is not an empty string
    console.log("API Key loaded for apiClientManager.");
  } else if (key === "") {
    console.warn("API Key is configured but is an empty string.");
    // Potentially notify the user or guide them to the options page
    // chrome.notifications.create('NO_API_KEY', {
    //   type: 'basic',
    //   iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    //   title: 'LocalLens API Key Needed',
    //   message: 'Please set your API key in the LocalLens options to fetch recommendations.'
    // });
  } else { // Key is null or undefined
    console.warn("API Key not found for apiClientManager. Please configure it in options.");
    // Optionally, create a notification to guide the user to the options page
    // chrome.notifications.create('SETUP_API_KEY', {
    //   type: 'basic',
    //   iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    //   title: 'LocalLens Setup',
    //   message: 'Please set your API key in the LocalLens options page to get started.'
    // });
  }
}).catch(error => {
  console.error("Error loading API Key:", error);
});

console.log("LocalLens Background Service Worker initialized.");
