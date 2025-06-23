// LocalLens Content Script
// This script is injected into specified travel-related websites.
// Its primary role might be to interact with the page,
// extract information, or prepare for sidebar injection.

console.log("LocalLens contentScript.js loaded and running.");

// Example: Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("contentScript.js received message:", request);

  if (request.type === "HIGHLIGHT_ELEMENT") {
    // Placeholder for future functionality: highlight an element on the page
    // const element = document.querySelector(request.selector);
    // if (element) {
    //   element.style.border = "2px solid red";
    // }
    sendResponse({ status: "Element highlighting action processed by contentScript.js" });
    return true; // Indicates asynchronous response
  }
  // Add more message handlers as needed
});

// Example: Send a message to the background script when the page is fully loaded
// window.addEventListener('load', () => {
//   chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_LOADED", url: window.location.href });
// });

// This script works in conjunction with contentscriptinjector.js,
// which is responsible for injecting the sidebar UI and its associated scripts.
// This contentScript.js can be used for tasks that need to run in the
// isolated world of the content script, separate from the page's own JavaScript.
