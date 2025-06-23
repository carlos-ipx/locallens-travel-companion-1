const installApiRouter = routes => {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) {
    console.error('LocalLens (ApiRouter): Unable to install message router - chrome.runtime.onMessage is unavailable.');
    return () => { /* no-op cleanup */ };
  }

  const listener = (request, sender, sendResponse) => {
    if (!request || typeof request.action !== 'string') {
      console.warn('LocalLens (ApiRouter): Received malformed request (missing or invalid action):', request);
      // Optional: sendResponse({ success: false, error: "Malformed request" });
      return false; // No valid action, so respond synchronously (or not at all).
    }

    const { action, payload } = request;
    const handler = routes[action];

    if (typeof handler !== 'function') {
      const errorMsg = `Unknown action: '${action}'`;
      console.warn(`LocalLens (ApiRouter): ${errorMsg}`, "Request:", request, "Sender:", sender);
      // Consistently send a response for unknown actions if a response pattern is expected.
      // If sendResponse might fail (e.g., port closed), wrap in try-catch.
      try {
        sendResponse({ success: false, error: errorMsg, action });
      } catch (e) {
        console.warn(`LocalLens (ApiRouter): Failed to send 'Unknown action' response for '${action}'. Port may be closed.`, e.message);
      }
      return false; // `sendResponse` was (or should have been) called synchronously.
    }

    // console.log(`LocalLens (ApiRouter): Routing action '${action}'`, payload);
    (async () => {
      try {
        const result = await handler(payload, sender); // Pass sender for context
        // console.log(`LocalLens (ApiRouter): Handler for '${action}' succeeded. Sending response.`, result);
        sendResponse({ success: true, data: result, action });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`LocalLens (ApiRouter): Error executing handler for action '${action}':`, err);
        sendResponse({ success: false, error: errorMsg, action });
      }
    })();

    return true; // Crucial: Indicates sendResponse will be called asynchronously.
  };

  try {
    chrome.runtime.onMessage.addListener(listener);
    // console.log('LocalLens (ApiRouter): Message router installed successfully.');
  } catch (e) {
    console.error('LocalLens (ApiRouter): Failed to add onMessage listener.', e);
    return () => { /* no-op cleanup */ };
  }

  return () => {
    if (chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.removeListener === 'function') {
      try {
        chrome.runtime.onMessage.removeListener(listener);
        // console.log('LocalLens (ApiRouter): Message router uninstalled.');
      } catch (e) {
        console.error('LocalLens (ApiRouter): Failed to remove onMessage listener.', e);
      }
    }
  };
};

export default installApiRouter;
