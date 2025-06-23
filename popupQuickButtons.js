// --- Script for Quick Buttons and their specific search/render logic ---
const quicks = document.querySelectorAll('.quick-buttons button');
const resultsDisplay = document.getElementById('results'); // Renamed to avoid conflict if 'results' is global via ID

// This renderResults is specific to the 'searchPlaces' flow from quick buttons
function renderQuickButtonResults(items) {
  resultsDisplay.innerHTML = '';
  resultsDisplay.classList.remove('hidden'); // Ensure results are visible
  if (items && items.length) {
    items.forEach(place => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      const title = document.createElement('div');
      title.textContent = place.name;
      title.className = 'result-title';
      const addr = document.createElement('div');
      addr.textContent = place.address || '';
      addr.className = 'result-address';
      li.append(title, addr);
      function activate() {
        chrome.runtime.sendMessage({ type: 'openPlace', place: place }); // Ensure 'place' object is passed
        window.close(); // This closes the popup
      }
      li.addEventListener('click', activate);
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          activate();
        }
      });
      resultsDisplay.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No results found for this quick search.';
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '0');
    resultsDisplay.appendChild(li);
  }
}

// This renderError is specific to the 'searchPlaces' flow
function renderQuickButtonError() {
  resultsDisplay.innerHTML = '';
  resultsDisplay.classList.remove('hidden');
  const li = document.createElement('li');
  li.textContent = 'Error in quick search. Please try again.';
  li.setAttribute('role', 'option');
  li.setAttribute('tabindex', '0');
  resultsDisplay.appendChild(li);
}

// This performSearch is specific to the 'searchPlaces' flow for quick buttons
function performQuickButtonSearch(query) {
  resultsDisplay.innerHTML = ''; // Clear previous results
  resultsDisplay.classList.remove('hidden');
  const loading = document.createElement('li');
  loading.textContent = 'Searching for ' + query + '...'; // Clarified loading message
  resultsDisplay.appendChild(loading);
  const locationInputElement = document.getElementById('userInput');
  const locationQuery = locationInputElement ? locationInputElement.value : "";

  // query parameter here is the placeTypeQuery from the button's data-query
  chrome.runtime.sendMessage({
    action: 'searchPlaces',
    payload: {
      placeTypeQuery: query,
      locationQuery: locationQuery
    }
  }, response => {
    // resultsDisplay.innerHTML = ''; // Clearing here might remove "Searching..." too soon if response is fast
    // Note: The response handling for quick buttons does NOT go through apiRouterInstaller's structure,
    // because it's a direct chrome.runtime.sendMessage to a handler that is *also* in background.js
    // but the `installApiRouter` is only one listener.
    // This means `popupQuickButtons.js` expects the raw response from the `searchPlaces` handler in background.js.
    // The `searchPlaces` handler in background.js returns:
    // success: `{ status: 'success', data: results }`
    // no results: `{ status: 'success', data: [], message: "No places found." }`
    // error: `{ status: 'error', message: 'Query is missing...' }` or `{ status: 'error', message: 'Error fetching places:...' }`

    if (chrome.runtime.lastError) {
      console.error("QuickSearch Error:", chrome.runtime.lastError.message);
      renderQuickButtonError();
      return;
    }

    // Assuming 'searchPlaces' action is routed via apiRouterInstaller
    if (response && response.success === true && response.data) {
      // Handler in background.js for searchPlaces returns { status: 'success', data: results } or { status: 'error', message: '...' }
      if (response.data.status === 'success') {
        renderQuickButtonResults(response.data.data); // Access the nested data array
      } else if (response.data.message) { // Error message from within the handler
        console.error("QuickSearch Handler Error:", response.data.message);
        renderQuickButtonError();
      } else { // Unexpected structure from handler's data
        console.error("QuickSearch: Unexpected data structure from successful handler.");
        renderQuickButtonError();
      }
    } else if (response && response.success === false && response.error) {
      // Error caught by apiRouterInstaller
      console.error("QuickSearch Router Error:", response.error);
      renderQuickButtonError();
    } else {
      // Truly unexpected response
      console.error("QuickSearch: Truly unexpected response.");
      renderQuickButtonError();
    }
  });
}

quicks.forEach(btn => {
  btn.addEventListener('click', () => {
    const query = btn.dataset.query;
    if (query) {
      // If you want the main search input to reflect this query:
      // const mainUserInput = document.getElementById('userInput');
      // if (mainUserInput) mainUserInput.value = query;
      performQuickButtonSearch(query);
    }
  });
});

// Removed:
// const input = document.getElementById('search-input'); (now userInput, handled by external script)
// const button = document.getElementById('search-button'); (now submitBtn, handled by external script)
// function updateButton() { ... } (handled by external script)
// input.addEventListener('input', updateButton); (handled by external script)
// input.addEventListener('keydown', e => { if (e.key === 'Enter' ... performSearch) }); (handled by external script)
// button.addEventListener('click', () => { ... performSearch }); (handled by external script)
// updateButton(); (handled by external script)

console.log("LocalLens: Quick buttons script initialized.");
