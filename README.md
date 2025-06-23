# locallens-travel-companion-1

LocalLens Travel Companion is a Chrome extension that delivers real-time, location-based travel recommendations and insights directly within your browser. Whether you?re planning a trip or exploring your hometown, LocalLens overlays an interactive sidebar onto travel and map websites, letting you discover restaurants, attractions, events, and more?tailored to your interests and preferences.

---

## Table of Contents

1. [Project Goal](#project-goal)
2. [Core Features (MVP)](#core-features-mvp)
3. [Architecture & Key Components](#architecture--key-components)
4. [Installation](#installation)
5. [Usage (Conceptual)](#usage-conceptual)
6. [File Structure (Current)](#file-structure-current)
7. [Dependencies](#dependencies)
8. [To-Do / Roadmap](#to-do--roadmap)

---

## Project Goal

The primary goal is to automatically capture and organize all of a traveler’s booking confirmations (from websites and email) into an encrypted, chronological itinerary timeline and then augment that itinerary with real-time, authentic local experience recommendations tied to the user’s destinations and dates. This Chrome extension will manage these tasks directly in the browser.

---

## Core Features (MVP)

Based on the project plan, the MVP aims to include:
- Automatic Booking Confirmation Detection (content scripts on major travel sites).
- Email Integration and Parsing (Gmail/Outlook).
- NLP-Powered Document Classification (flights, stays, transport, activities).
- Chronological Timeline Organization with conflict detection.
- Basic Local Experience Finder (map/list view with free local tips via LocalLens API).
- Encrypted local storage.

---

## Architecture & Key Components

### `manifest.json`
Declares extension metadata, permissions (storage, tabs, activeTab, notifications, downloads), content scripts, background service worker, browser action popup, options page, and web-accessible resources. Includes host permissions for travel sites, email providers, and necessary APIs. Defines OAuth2 configuration for Google services.

### `background.js` (Assumed, not provided for review yet)
The background service worker. Expected to:
- Initialize the extension and user data from encrypted Chrome Storage.
- Handle communication between different parts of the extension (popup, content scripts, options page).
- Manage the core logic for fetching/parsing confirmations.
- Interact with the NLP engine.
- Build and maintain the itinerary timeline.
- Detect scheduling conflicts.
- Call the `apiClientManager.js` for fetching local experiences.

### Content Scripts
- **`contentScript.js` (Assumed, not provided for review yet):** Runs on known travel sites (Booking.com, Expedia, etc.) to detect and scrape booking confirmations.
- **`emailParserContentScript.js` (Assumed, not provided for review yet):** Runs on Gmail to help identify and parse travel-related confirmations.
- **`sidebarInjectorUpdater.js`:** Injects and manages a sidebar UI (likely `sidebar.html` or `sidebarRecommendationsMap.html`) onto web pages, updating its content based on messages.

### Browser Action Popup
- **`popupSearchQuickAccess.html`:** The HTML structure for the extension's popup when the toolbar icon is clicked. Provides a search interface.
- **`popupInputCommunicator.js`:** The JavaScript for `popupSearchQuickAccess.html`. Handles user input from the popup, communicates with the background script to process queries (e.g., `PROCESS_POPUP_INPUT`), and displays results or status messages in the popup.

### Options Page
- **`userSettingsPage.html`:** The HTML structure for the extension's options/settings page. Allows users to configure preferences.
- *Inline script within `userSettingsPage.html`*: Handles loading and saving user preferences to `chrome.storage.sync`.

### Sidebar for Recommendations
- **`sidebarRecommendationsMap.html`:** HTML structure for displaying local recommendations, featuring an interactive map (using Leaflet.js) and a list view. This is likely injected by `sidebarInjectorUpdater.js`.
- **`sidebarRecommendationMapHandler.js`:** JavaScript for `sidebarRecommendationsMap.html`. Initializes and controls the Leaflet map, populates the map with markers, displays a list of recommendations, and handles interactions (e.g., clicking a marker or list item).
- **`styles/sidebarRecommendationsMap.css`:** CSS styles specifically for the `sidebarRecommendationsMap.html` interface.

### Utility & API Management
- **`apiClientManager.js`:** Manages API requests to a backend (e.g., `https://api.locallens.com/v1`). Handles API key loading, request retries, caching of responses in `chrome.storage.local`, and data fetching for recommendations and insights.
- **`installApiRouter.js`:** A utility to set up message listeners for `chrome.runtime.onMessage`, routing actions to appropriate handler functions. Likely used in `background.js`.
- **`preferencesStorageValidator.js`:** Provides functions to get default preferences and validate user settings based on a defined schema. Used by the options page.

### Styling
- **`missingFileAlert.css`:** Styles for an alert component, possibly used to notify users of missing files or configurations (though its usage isn't explicitly defined in the provided JS files).
- The `README.md` previously mentioned a global `styles.css`. This is not present; styling seems to be component-specific (e.g., `sidebarRecommendationsMap.css`) or inline.

---

## Installation

1.  **Clone the repository or download the source code.**
    ```bash
    # Example: git clone https://github.com/your-username/your-repository-name.git
    # cd your-repository-name
    ```
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (using the toggle switch, usually in the top-right corner).
4.  Click the **"Load unpacked"** button.
5.  Select the root folder of the extension (the folder containing `manifest.json` and all other files).
6.  The LocalLens Travel Companion icon should appear in your Chrome toolbar.
7.  **(Important for Gmail API):** Configure your `YOUR_GOOGLE_OAUTH_CLIENT_ID` in `manifest.json`. You'll need to create a project in Google Cloud Console, enable the Gmail API, and create OAuth 2.0 credentials (Client ID for Web application, though for extensions it's a bit different – ensure redirect URIs are set up correctly for `chrome.identity`).
8.  **(Important for LocalLens API):** Ensure the API key for `https://api.locallens.com/v1` can be set, likely via the options page (`userSettingsPage.html`) so that `apiClientManager.js` can function.

---

## Usage (Conceptual)

1.  **Install & Setup:** After installation, open the extension's options page (`userSettingsPage.html`) to configure any necessary settings (like API keys, if `apiClientManager.js` requires one to be user-provided via storage). Grant OAuth permissions if prompted for Gmail access.
2.  **Booking Capture:** As you browse travel sites and make bookings, content scripts (`contentScript.js`) would ideally detect confirmation details.
3.  **Email Parsing:** The extension would scan emails (via Gmail API, orchestrated by `background.js`) for travel confirmations.
4.  **Itinerary & Recommendations:**
    *   Click the LocalLens icon in the Chrome toolbar to open `popupSearchQuickAccess.html` for quick searches or to view itinerary summaries (once that part is built).
    *   When on relevant pages or viewing itinerary details, a sidebar (managed by `sidebarInjectorUpdater.js` and using `sidebarRecommendationsMap.html`) might appear, showing local recommendations on a map and list.

---

## File Structure (Current)

```
your-extension-root-folder/
├── .gitignore
├── LICENSE
├── README.md
├── apiClientManager.js
├── installApiRouter.js
├── manifest.json
├── missingFileAlert.css
├── popupInputCommunicator.js
├── popupSearchQuickAccess.html
├── preferencesStorageValidator.js
├── sidebarInjectorUpdater.js
├── sidebarRecommendationMapHandler.js
├── sidebarRecommendationsMap.html
├── userSettingsPage.html
├── styles/
│   └── sidebarRecommendationsMap.css
├── icons/ (Assumed, referenced in manifest.json)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background.js (Assumed, referenced in manifest.json - NOT YET REVIEWED)
├── contentScript.js (Assumed, referenced in manifest.json - NOT YET REVIEWED)
├── emailParserContentScript.js (Assumed, referenced in manifest.json - NOT YET REVIEWED)
└── sidebar.html (Assumed, referenced in manifest.json - NOT YET REVIEWED)
```
*(Note: `options.html` from the manifest is `userSettingsPage.html` in your file list.)*

---

## Dependencies

-   Google Chrome (latest version)
-   Leaflet.js (for maps, included via CDN in `sidebarRecommendationsMap.html`)
-   Access to a LocalLens API backend (e.g., `https://api.locallens.com/v1`)
-   Gmail API (for email parsing)

---

## To-Do / Roadmap (Based on current files & project plan)

-   [ ] **Implement `background.js`:** This is the core orchestrator.
-   [ ] **Implement `contentScript.js`:** For scraping booking sites.
-   [ ] **Implement `emailParserContentScript.js` and associated background logic for Gmail/Outlook API interaction.**
-   [ ] **Develop NLP Engine:** For document classification.
-   [ ] **Design and implement the itinerary timeline data structure and UI.**
-   [ ] **Implement conflict detection logic.**
-   [ ] **Implement client-side encryption for `chrome.storage.local`.**
-   [ ] **Develop `sidebar.html`** (if it's different from `sidebarRecommendationsMap.html` and is the primary injected UI for itinerary/docs).
-   [ ] **Implement PDF export functionality.**
-   [ ] **Create icons** for the extension (referenced in `manifest.json`).
-   [ ] **Refine API key management:** Ensure `apiClientManager.js` can securely obtain and use the API key for `api.locallens.com`. This likely involves the options page (`userSettingsPage.html`) saving the key to `chrome.storage.local` or `chrome.storage.sync`.
-   [ ] **Thoroughly test message passing** between all components.
-   [ ] **Finalize UI/UX** for all components.
