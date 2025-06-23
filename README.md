# locallens-travel-companion-1

LocalLens Travel Companion is a Chrome extension that delivers real-time, location-based travel recommendations and insights directly within your browser. Whether you’re planning a trip or exploring your hometown, LocalLens overlays an interactive sidebar onto travel and map websites, letting you discover restaurants, attractions, events, and more—tailored to your interests and preferences.

---

## Table of Contents

1. [Features](#features)
2. [Architecture & Components](#architecture--components)
3. [Installation](#installation)
4. [Usage](#usage)
5. [File Structure](#file-structure)
6. [Dependencies](#dependencies)
7. [To-Do / Roadmap](#to-do--roadmap)
8. [Contributing](#contributing)

---

## Features

- Destination search with optional ‘use my location’ fallback
- Persistent sidebar overlay on supported travel/map sites
- Real-time recommendations for restaurants, attractions, and events
- Interactive filters: price range, categories, ratings
- Embedded map view with markers (using Leaflet.js)
- Offline caching of last search results
- Persistent user preferences (default map provider, API keys via user configuration)
- Robust messaging channels between popup, background, and content scripts

---

## Architecture & Components

### manifest.json
Declares extension metadata, permissions, content scripts, service worker, and CSP rules.
Key permissions:
- `geolocation`
- `storage`
- Host permissions for third-party APIs
- `activeTab`
**Note:** The `oauth2.client_id` within `manifest.json` is a placeholder. You **must** replace `"YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com"` with your actual Google OAuth Client ID for any Google API functionalities to work.

### background.js
Service worker that:
- Imports `utils.js` for API client management and `apiRouterInstaller.js` for message routing.
- Handles `onInstalled` extension lifecycle event.
- Orchestrates API calls via `utils.js`.
- Routes messages between different parts of the extension (e.g., `PROCESS_POPUP_INPUT`, `pageNavigated`).
- Manages caching in `chrome.storage.local` (via `utils.js`).

### utils.js (formerly apiClientManager.js)
- Provides an `APIClientManager` class for making requests to the LocalLens backend API.
- Handles API key storage and retrieval, request retries, and basic caching of API responses.
- Contains helper functions for using `chrome.storage.local`.

### apiRouterInstaller.js (formerly installApiRouter.js)
- Provides a function `installApiRouter` to set up message listeners for `chrome.runtime.onMessage`.
- Used by `background.js` to define and handle incoming actions from other parts of the extension.

### contentScript.js
- Injected into specified travel-related websites (as defined in `manifest.json`).
- Can interact with the page DOM or listen for messages. (Currently basic placeholder)

### emailParserContentScript.js
- Injected into email service pages (e.g., Gmail) as defined in `manifest.json`.
- Intended to parse travel-related emails. (Currently basic placeholder)

### contentscriptinjector.js (formerly sidebarInjectorUpdater.js)
- Injected into travel/map pages matching URL patterns.
- Responsible for injecting the sidebar UI (`sidebarui.html`) into the page.
- Manages sidebar visibility and updates its content based on messages from `background.js`.
- Handles URL changes in Single Page Applications (SPAs) to ensure sidebar state is current.

### popup.html (formerly popupSearchQuickAccess.html) & popupscript.js (formerly popupInputCommunicator.js)
- `popup.html`: Defines the UI for the extension's browser action popup, including a search input and quick action buttons.
- `popupscript.js`: Handles user input from `popup.html`, sends messages (e.g., `PROCESS_POPUP_INPUT`) to `background.js`, and displays results or status messages in the popup.

### optionspage.html (formerly userSettingsPage.html) & optionsscript.js
- `optionspage.html`: Provides the UI for users to configure extension settings.
- `optionsscript.js`: Manages loading and saving of user preferences (defined in `preferencesValidator.js`) using `chrome.storage.sync`.

### preferencesValidator.js (formerly preferencesStorageValidator.js)
- Defines the schema for user preferences.
- Provides functions to get default preferences and validate preference objects.
- Used by `optionsscript.js`.

### sidebarui.html (formerly sidebarRecommendationsMap.html) & sidebarscript.js (formerly sidebarRecommendationMapHandler.js)
- `sidebarui.html`: HTML structure for the sidebar, including a container for the Leaflet map and a list for recommendations.
- `sidebarscript.js`: Manages the Leaflet map (initialization, markers, popups), handles messages from `background.js` to load or highlight recommendations, and communicates user interactions (e.g., `RECOMMENDATION_SELECTED`) back to `background.js`.

### styles.css
- Shared/global stylesheet for popup, options page.
- Defines base layout, theming, and common element styles.

### styles/sidebar.css
- Specific styles for the main sidebar container injected by `contentscriptinjector.js`.

### styles/sidebarRecommendationsMap.css
- Specific styles for the content within `sidebarui.html`, particularly the map and recommendation list.

### Icons (`icons/`)
- Contains `icon16.png`, `icon48.png`, `icon128.png` used by the extension.

### Libraries (`lib/`)
- Contains third-party libraries, currently `leaflet.js` and `leaflet.css`.

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-org/locallens-travel-companion-1.git
   cd locallens-travel-companion-1
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in top-right).
4. Click **Load unpacked** and select this project’s root folder.
5. **Important**: If you intend to use features requiring Google OAuth (like Gmail integration), you must configure your own `client_id` in `manifest.json`.
6. (Optional) Open **Extension options** to set your preferences. (Note: API key input is not part of the current simplified options page).

---

## Usage

1. Click the LocalLens icon in the Chrome toolbar.
2. In the popup, type a destination or click quick action buttons.
3. The extension (once fully implemented) fetches recommendations and injects/updates a sidebar on the current page (if it matches supported domains).
4. Browse, filter, and interact with recommendations directly in the sidebar.
5. To change settings, right-click the icon → **Options**.

---

## File Structure

```
locallens-travel-companion-1/
├── manifest.json
├── background.js
├── utils.js
├── apiRouterInstaller.js
├── contentScript.js
├── emailParserContentScript.js
├── contentscriptinjector.js
├── popup.html
├── popupscript.js
├── optionspage.html
├── optionsscript.js
├── preferencesValidator.js
├── sidebarui.html
├── sidebarscript.js
├── styles.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── lib/
│   ├── leaflet.css
│   └── leaflet.js
└── styles/
    ├── sidebar.css
    └── sidebarRecommendationsMap.css
```

### Component Status

| Component                  | File                        | Status   | Purpose                                                                 |
|----------------------------|-----------------------------|----------|-------------------------------------------------------------------------|
| Extension Manifest         | `manifest.json`             | ✓ Pass   | Metadata, permissions, entry points (OAuth ID needs user config)        |
| Background Script          | `background.js`             | ✓ Pass   | Service worker, orchestrates imports, basic message routing setup       |
| Utilities / API Client     | `utils.js`                  | ✓ Pass   | API request wrappers, caching helpers, storage helpers                  |
| API Router Installer       | `apiRouterInstaller.js`     | ✓ Pass   | Installs message listener for background script                         |
| Generic Content Script     | `contentScript.js`          | ? Partial| Injected into travel sites; basic placeholder                           |
| Email Parser Script        | `emailParserContentScript.js`| ? Partial| Injected into email sites; basic placeholder                            |
| Sidebar Injector           | `contentscriptinjector.js`  | ✓ Pass   | Injects/updates sidebar UI, handles SPA navigation                      |
| Popup UI                   | `popup.html`                | ✓ Pass   | Search form, quick-access buttons, links to `styles.css`                |
| Popup Communicator         | `popupscript.js`            | ✓ Pass   | Handles user input, sends messages to background                        |
| Options Page UI            | `optionspage.html`          | ✓ Pass   | Configure preferences, uses `styles.css`                                |
| Options Script             | `optionsscript.js`          | ✓ Pass   | Load/save settings using `preferencesValidator.js`                      |
| Preferences Validator      | `preferencesValidator.js`   | ✓ Pass   | Defines preference schema, validation, defaults                         |
| Sidebar HTML               | `sidebarui.html`            | ✓ Pass   | HTML structure for recommendations & Leaflet map, links correct scripts |
| Sidebar JS Renderer        | `sidebarscript.js`          | ✓ Pass   | Basic Leaflet map setup, message handling structure                     |
| Global Stylesheet          | `styles.css`                | ✓ Pass   | Shared styles for popup, options page                                   |
| Sidebar CSS                | `styles/sidebar.css`        | ✓ Pass   | Styles for the main sidebar frame                                       |
| Sidebar Map CSS            | `styles/sidebarRecommendationsMap.css` | ✓ Pass | Styles for the map and items within sidebar content                   |
| Icons                      | `icons/`                    | ✓ Pass   | Extension icons provided                                                |
| Libraries                  | `lib/`                      | ? Partial| Contains `leaflet.css` (user needs to add `leaflet.js` manually)    |

---

## Dependencies

- Google Chrome (latest version)
- Leaflet.js (mapping library - user to add `leaflet.js` to `lib/` directory)
- Geolocation API (built-in)
- Third-party APIs for points of interest (e.g., Foursquare, Google Places - requires API key configuration, not yet in UI)

_No external Node.js dependencies are required to run the extension in Chrome once Leaflet.js is added._

---

## To-Do / Roadmap

- [ ] User needs to manually add `leaflet.js` to `lib/` directory.
- [ ] Fully implement API call logic in `background.js` using `utils.js` for `PROCESS_POPUP_INPUT` and other actions.
- [ ] Flesh out `contentScript.js` and `emailParserContentScript.js` with actual functionality.
- [ ] Enhance `sidebarscript.js` for full recommendation rendering, map marker interaction, and filter application.
- [ ] Implement UI for API key input (e.g., in options page) and integrate with `utils.js`.
- [ ] Finalize `styles.css`, `styles/sidebar.css`, `styles/sidebarRecommendationsMap.css` for a polished look, including spinners and error states.
- [ ] Add comprehensive unit tests for:
  - `utils.js` request wrappers & caching logic
  - `background.js` message handlers
  - `sidebarscript.js` rendering & filter application
  - `popupscript.js` interactions
  - `optionsscript.js` preference saving/loading
- [ ] Internationalization support for UI labels.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

Please ensure all new code is covered by tests and follows the existing code style.

---

**Enjoy discovering the world with LocalLens Travel Companion!**