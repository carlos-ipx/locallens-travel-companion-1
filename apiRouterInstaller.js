const installApiRouter = routes => {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) {
    console.error('[installApiRouter] Unable to install message router: chrome.runtime.onMessage is unavailable.');
    return () => {};
  }

  const listener = (request, sender, sendResponse) => {
    const { action, payload } = request || {};
    const handler = routes[action];
    if (typeof handler !== 'function') {
      try {
        sendResponse({ success: false, error: `Unknown action: ${action}` });
      } catch (e) {
        console.warn('[installApiRouter] Failed to send unknown action response', e);
      }
      return false;
    }

    (async () => {
      try {
        const result = await handler(payload, sender);
        sendResponse({ success: true, data: result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      }
    })();

    return true;
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
};

export { installApiRouter };