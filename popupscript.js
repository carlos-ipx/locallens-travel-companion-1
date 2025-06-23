const STATE = {
  inputFieldId: 'userInput',
  submitButtonId: 'submitBtn',
  statusFieldId: 'status',
  resultsContainerId: 'results'
};

let submitBtn; // This will be assigned in init

document.addEventListener('DOMContentLoaded', init);

function init() {
  // Query for the submit button and attach event listener
  submitBtn = document.getElementById(STATE.submitButtonId);
  if (submitBtn) {
    submitBtn.addEventListener('click', onSubmit);
  } else {
    console.error(`LocalLens: Submit button with ID '${STATE.submitButtonId}' not found.`);
  }

  // Query for other essential elements to ensure they exist, for early warning
  if (!document.getElementById(STATE.inputFieldId)) {
    console.error(`LocalLens: Input field with ID '${STATE.inputFieldId}' not found.`);
  }
  if (!document.getElementById(STATE.statusFieldId)) {
    console.error(`LocalLens: Status field with ID '${STATE.statusFieldId}' not found.`);
  }
  if (!document.getElementById(STATE.resultsContainerId)) {
    console.error(`LocalLens: Results container with ID '${STATE.resultsContainerId}' not found.`);
  }

  chrome.runtime.onMessage.addListener(onMessageFromBackground);
  console.log('LocalLens: Popup script initialized.');
}

async function onSubmit(event) {
  event.preventDefault();
  clearStatus();
  clearResults();

  const query = getInputValue();
  if (!query) {
    setStatus('Please enter a query.');
    return;
  }

  setStatus('Loading...');
  disableSubmit();

  try {
    console.log('LocalLens: Sending PROCESS_POPUP_INPUT with locationQuery:', query); // query here is the locationQuery
    const response = await chrome.runtime.sendMessage({
      action: 'PROCESS_POPUP_INPUT',
      payload: {
        locationQuery: query, // query from userInput is the locationQuery
        placeTypeQuery: ""    // Empty placeTypeQuery for a general search in the location
      }
    });
    console.log('LocalLens: Received response from background:', response);
    console.log('Detailed response for main search:', JSON.stringify(response, null, 2)); // Added detailed log

    if (response && response.success === true && response.data) {
      console.log('Response was success and has data property.');
      // Successfully handled by background.js route
      if (Array.isArray(response.data.items) && response.data.items.length > 0) {
        console.log('Items found, rendering results:', response.data.items);
        renderResults(response.data.items);
        console.log('Calling clearStatus after rendering results.');
        clearStatus();
      } else if (response.data.message) {
        console.log('No items, but message found. Calling setStatus with message:', response.data.message);
        // Message from background.js handler (e.g., "No results found", or error message from within handler)
        setStatus(response.data.message);
      } else {
        console.log('No items and no message. Calling setStatus with "No items found or data format unexpected."');
        // Successful response from router, but data from handler is not in expected format
        setStatus('No items found or data format unexpected.');
      }
    } else if (response && response.success === false && response.error) {
      console.log('Response was error. Calling setStatus with error:', response.error);
      // Error caught by apiRouterInstaller
      setStatus(`Error: ${response.error}`);
    } else {
      console.log('Response is truly unexpected or chrome.runtime.lastError is set.');
      // Truly unexpected response or chrome.runtime.lastError might be set
      if (chrome.runtime.lastError) {
        console.log('chrome.runtime.lastError:', chrome.runtime.lastError.message);
        setStatus(`Error: ${chrome.runtime.lastError.message}`);
      } else {
        console.log('Calling setStatus with "Unexpected response structure from background service."');
        setStatus('Unexpected response structure from background service.');
      }
    }
  } catch (error) {
    // This catch is for errors in popupscript.js itself, or if sendMessage itself throws an error
    // (e.g. if the extension context is invalidated, though lastError usually covers that)
    console.error('LocalLens: Error in popupscript.js processing message:', error.message);
    setStatus(`An error occurred: ${error.message}`);
    if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
        setStatus('Error: Could not connect to the background service. Try reloading the extension.');
    }
  } finally {
    enableSubmit();
  }
}

function onMessageFromBackground(message, sender, sendResponse) {
  console.log('LocalLens: Popup received message from background:', message);
  if (message && message.type === 'POPUP_UPDATE') { // Changed 'action' to 'type'
    if (message.payload && Array.isArray(message.payload.items) && message.payload.items.length > 0) {
      renderResults(message.payload.items);
      clearStatus();
    } else {
      setStatus('No updates available or empty data.');
    }
    // sendResponse({status: "Popup received update"}); // Optional: acknowledge message
    // return true; // If you use sendResponse asynchronously
  }
}

function getInputValue() {
  const input = document.getElementById(STATE.inputFieldId);
  return input ? input.value.trim() : '';
}

function renderResults(items) {
  const container = document.getElementById(STATE.resultsContainerId);
  if (!container) {
    console.error(`LocalLens: Results container with ID '${STATE.resultsContainerId}' not found during render.`);
    return;
  }
  container.innerHTML = ''; // Clear previous results
  container.classList.remove('hidden'); // Make the results list visible

  if (!items || items.length === 0) {
    // If items is null, undefined, or empty, still ensure status (like 'no results') is handled by onSubmit
    // but also make sure the results container is empty and visible (then hidden by clearResults if needed).
    // Or, display a "No results found" message directly in the container.
    // For now, popupscript.js's onSubmit handles setting status for "no results".
    // This function's main job is rendering if there *are* items.
    // If items is empty, setStatus in onSubmit will have shown "No results found..."
    // and clearResults might be called by onSubmit which would hide the container again if it's empty.
    // Let's ensure if items is empty, we don't proceed to forEach.
    return;
  }

  items.forEach(item => {
    const el = document.createElement('li'); // Changed to 'li' for semantic HTML with UL parent
    el.className = 'result-item'; // Add CSS class for styling

    if (typeof item === 'string') {
      el.textContent = item;
    } else if (item && typeof item === 'object') { // More robust check for object
      const nameEl = document.createElement('div');
      nameEl.className = 'result-title'; // Use existing class for name styling
      nameEl.textContent = item.name || 'Unnamed Item';
      el.appendChild(nameEl);

      // Display authentic_summary
      if (item.authentic_summary) {
        const summaryEl = document.createElement('p');
        summaryEl.className = 'result-summary'; // New class for summary styling
        summaryEl.textContent = item.authentic_summary;
        el.appendChild(summaryEl);
      }

      // Optionally, display address or categories if summary is too short or for more info
      let secondaryDetailText = '';
      if (item.address && item.address !== "Address not available") {
        secondaryDetailText = item.address;
      } else if (item.categories && item.categories !== "N/A" && (!item.authentic_summary || item.authentic_summary.length < 50)) {
        // Show categories if summary is very short or missing, and address isn't primary
        secondaryDetailText = `Categories: ${item.categories}`;
      }

      if (secondaryDetailText) {
        const detailEl = document.createElement('p');
        detailEl.className = 'result-desc'; // Existing class for address/category styling
        detailEl.textContent = secondaryDetailText;
        el.appendChild(detailEl);
      }
    } else {
      el.textContent = 'Invalid item format'; // Should not happen with current data structure
    }
    container.appendChild(el);
  });
}

function setStatus(message) {
  const statusEl = document.getElementById(STATE.statusFieldId);
  if (statusEl) {
    statusEl.textContent = message;
  } else {
    console.warn(`LocalLens: Status element with ID '${STATE.statusFieldId}' not found when trying to set status: "${message}"`);
  }
}

function clearStatus() {
  setStatus('');
}

function clearResults() {
  const container = document.getElementById(STATE.resultsContainerId);
  if (container) {
    container.innerHTML = '';
  } else {
    console.warn(`LocalLens: Results container with ID '${STATE.resultsContainerId}' not found during clearResults.`);
  }
}

function disableSubmit() {
  if (submitBtn) {
    submitBtn.disabled = true;
  }
}

function enableSubmit() {
  if (submitBtn) {
    submitBtn.disabled = false;
  }
}
