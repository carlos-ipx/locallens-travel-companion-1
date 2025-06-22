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
    console.log('LocalLens: Sending PROCESS_POPUP_INPUT with query:', query);
    const response = await chrome.runtime.sendMessage({
      type: 'PROCESS_POPUP_INPUT', // Changed 'action' to 'type' for consistency with other message patterns
      payload: { query }
    });
    console.log('LocalLens: Received response from background:', response);

    if (response && response.payload && Array.isArray(response.payload.items) && response.payload.items.length > 0) {
      renderResults(response.payload.items);
      clearStatus();
    } else if (response && response.message) { // Handle potential error messages from background
      setStatus(response.message);
    }
    else {
      setStatus('No results found or unexpected response structure.');
    }
  } catch (error) {
    console.error('LocalLens: Error sending message or processing response in popup:', error.message);
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
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'result-item'; // Add CSS class for styling

    if (typeof item === 'string') {
      el.textContent = item;
    } else if (item && typeof item === 'object') { // More robust check for object
      el.textContent = item.name || 'Unnamed Item'; // Default if name is missing
      if (item.description) {
        const desc = document.createElement('p');
        desc.className = 'result-desc'; // Add CSS class for styling
        desc.textContent = item.description;
        el.appendChild(desc);
      }
      // You could add more fields from the item object here
      // e.g., if (item.date) { ... }
    } else {
      el.textContent = 'Invalid item format';
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
