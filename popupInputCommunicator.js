const STATE = {
  inputFieldId: 'userInput',
  submitButtonId: 'submitBtn',
  statusFieldId: 'status',
  resultsContainerId: 'results'
};

let submitBtn;

document.addEventListener('DOMContentLoaded', init);

function init() {
  submitBtn = document.getElementById(STATE.submitButtonId);
  if (submitBtn) submitBtn.addEventListener('click', onSubmit);
  chrome.runtime.onMessage.addListener(onMessageFromBackground);
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
    const response = await chrome.runtime.sendMessage({
      action: 'PROCESS_POPUP_INPUT',
      payload: { query }
    });
    if (
      response &&
      response.payload &&
      Array.isArray(response.payload.items) &&
      response.payload.items.length
    ) {
      renderResults(response.payload.items);
      clearStatus();
    } else {
      setStatus('No results found.');
    }
  } catch (error) {
    console.error('Popup sender error:', error);
    setStatus('An error occurred.');
  } finally {
    enableSubmit();
  }
}

function onMessageFromBackground(message) {
  if (message && message.action === 'POPUP_UPDATE') {
    if (
      message.payload &&
      Array.isArray(message.payload.items) &&
      message.payload.items.length
    ) {
      renderResults(message.payload.items);
      clearStatus();
    } else {
      setStatus('No updates available.');
    }
  }
}

function getInputValue() {
  const input = document.getElementById(STATE.inputFieldId);
  return input ? input.value.trim() : '';
}

function renderResults(items) {
  const container = document.getElementById(STATE.resultsContainerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'result-item';
    if (typeof item === 'string') {
      el.textContent = item;
    } else {
      el.textContent = item.name || JSON.stringify(item);
      if (item.description) {
        const desc = document.createElement('p');
        desc.className = 'result-desc';
        desc.textContent = item.description;
        el.appendChild(desc);
      }
    }
    container.appendChild(el);
  });
}

function setStatus(message) {
  const statusEl = document.getElementById(STATE.statusFieldId);
  if (statusEl) statusEl.textContent = message;
}

function clearStatus() {
  setStatus('');
}

function clearResults() {
  const container = document.getElementById(STATE.resultsContainerId);
  if (container) container.innerHTML = '';
}

function disableSubmit() {
  if (submitBtn) submitBtn.disabled = true;
}

function enableSubmit() {
  if (submitBtn) submitBtn.disabled = false;
}