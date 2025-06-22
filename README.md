# locallens-travel-companion-1

LocalLens Travel Companion is a Chrome extension that delivers real-time, location-based travel recommendations and insights directly within your browser. Whether you?re planning a trip or exploring your hometown, LocalLens overlays an interactive sidebar onto travel and map websites, letting you discover restaurants, attractions, events, and more?tailored to your interests and preferences.

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

- Destination search with optional ?use my location? fallback  
- Persistent sidebar overlay on supported travel/map sites  
- Real-time recommendations for restaurants, attractions, and events  
- Interactive filters: price range, categories, ratings  
- Embedded map view with markers  
- Offline caching of last search results  
- Persistent user preferences (interests, API keys, default map provider)  
- Multi-language date/time formatting via `utils.js`  
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

### background.js  
Service worker that:  
- Handles `onInstalled`  
- Orchestrates API calls (using `utils.js`)  
- Routes messages (SEARCH_DESTINATION, FETCH_NEARBY)  
- Throttles requests & manages caching in `chrome.storage.local`  

### contentscriptinjector.js  
- Injects `sidebarui.html` into travel/map pages matching URL patterns  
- Listens for data messages from `background.js` and forwards them to `sidebarscript.js`  

### popup.html & popupscript.js  
- Popup UI for destination input or ?use current location?  
- Sends `chrome.runtime` messages to `background.js`  

### optionspage.html & optionsscript.js  
- Settings page for user preferences: interests, API keys, default map provider, localization  
- Persists settings in `chrome.storage.sync` and notifies `background.js`  

### sidebarui.html & sidebarscript.js  
- Renders sidebar overlay with filters, map container, and recommendation list  
- Applies filters and updates UI upon receiving new data  

### styles.css  
- Shared stylesheet for popup, options page, and sidebar  
- Defines layout, theming, responsive behavior, and spinners  

### utils.js  
- Wrapper for third-party API requests  
- Response normalization, error handling, date/time formatting, caching helpers  

---

## Installation

1. Clone this repository:  
   ```bash
   git clone https://github.com/your-org/locallens-travel-companion-1.git
   cd locallens-travel-companion-1
   ```
2. Open Chrome and navigate to `chrome://extensions/`.  
3. Enable **Developer mode** (toggle in top-right).  
4. Click **Load unpacked** and select this project?s root folder.  
5. (Optional) Open **Extension options** to enter your API keys and set default preferences.  

---

## Usage

1. Click the LocalLens icon in the Chrome toolbar.  
2. In the popup, type a destination or click **Use my location**.  
3. The extension fetches recommendations and injects a sidebar on the current page (if it matches supported domains).  
4. Browse, filter, and interact with recommendations directly in the sidebar.  
5. To change your interests or API keys, right-click the icon ? **Options**.  

---

## File Structure

```
locallens-travel-companion-1/
??? manifest.json
??? background.js
??? contentscriptinjector.js
??? popup.html
??? popupscript.js
??? optionspage.html
??? optionsscript.js
??? sidebarui.html
??? sidebarscript.js
??? styles.css
??? utils.js
```

### Component Status

| Component                  | File                 | Status | Purpose                                                        |
|----------------------------|----------------------|--------|----------------------------------------------------------------|
| Extension Manifest         | `manifest.json`      | ? Fail   | Metadata, permissions, entry points                            |
| API & Install Router       | `background.js`      | ? Pass   | Service worker, API orchestration, messaging                   |
| Sidebar Injector           | `contentscriptinjector.js` | ? Fail   | Injects/updates sidebar UI                                     |
| Popup UI                   | `popup.html`         | ? Pass   | Search form, quick-access buttons                              |
| Popup Communicator         | `popupscript.js`     | ? Fail   | Handles user input, sends messages to background               |
| Options Page UI            | `optionspage.html`   | ? Pass   | Configure interests, API keys, preferences                     |
| Preferences Storage        | `optionsscript.js`   | ? Pass   | Load/save settings, validate inputs                            |
| Sidebar HTML               | `sidebarui.html`     | ? Fail   | HTML structure for recommendations & embedded map              |
| Sidebar JS Renderer        | `sidebarscript.js`   | ? Fail   | Renders items, map markers, handles filters                    |
| Utilities / API Client     | `utils.js`           | ? Pass   | API request wrappers, caching, formatting                      |
| Stylesheet                 | `styles.css`         | ? Pass   | Shared styles for popup, options page, sidebar                 |

---

## Dependencies

- Google Chrome (latest version)  
- Geolocation API (built-in)  
- Third-party APIs for points of interest (e.g., Foursquare, Google Places)  
- Mapping service (e.g., Leaflet, Google Maps Embed)  

_No external Node.js dependencies are required to run the extension in Chrome._

---

## To-Do / Roadmap

- [ ] Finalize `styles.css` definitions for sidebar backdrop, close/minimize buttons, spinners, and error states  
- [ ] Implement missing UI elements in `popupscript.js`, `contentscriptinjector.js`, `sidebarui.html`, and `sidebarscript.js`  
- [ ] Add unit tests for:  
  - `utils.js` request wrappers & caching logic  
  - `background.js` message handlers  
  - `sidebarscript.js` rendering & filter application  
- [ ] Internationalization support for UI labels  

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