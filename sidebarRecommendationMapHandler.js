(function() { // IIFE for scope protection

  let map;
  let markers = {}; // Store markers by recommendation ID
  let isMapInitialized = false;
  const messageQueue = [];

  // Utility to escape HTML special characters
  function escapeHtml(str) {
    if (typeof str !== 'string') {
      // If it's not a string (e.g., null, undefined, number), convert it safely
      if (str == null) return ''; // Convert null or undefined to empty string
      str = String(str);
    }
    return str.replace(/[&<>"']/g, function(s) {
      switch (s) {
        case '&': return '&';
        case '<': return '<';
        case '>': return '>';
        case '"': return '"';
        case "'": return '''; // or '
        default: return s;
      }
    });
  }

  function initMap() {
    try {
      // Check if Leaflet library is loaded
      if (typeof L === 'undefined') {
        console.error('LocalLens: Leaflet library (L) is not loaded. Map cannot be initialized.');
        // Display an error message to the user in the map container
        const mapContainer = document.getElementById('recommendation-map');
        if (mapContainer) {
          mapContainer.innerHTML = '<p style="color:red; text-align:center; padding:20px;">Error: Map library not loaded. Cannot display map.</p>';
        }
        // Do not set isMapInitialized = true and do not process queue
        return;
      }

      map = L.map('recommendation-map', { // This ID should be correct now
        center: [0, 0], // Default center
        zoom: 2,        // Default zoom
        zoomControl: true,
        attributionControl: false // Using OpenStreetMap, attribution is good practice but can be managed
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // It's good practice to include attribution for OpenStreetMap
        // attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      isMapInitialized = true;
      console.log('LocalLens: Map initialized successfully.');
      processQueuedMessages();

    } catch (error) {
      console.error('LocalLens: Error initializing map:', error);
      isMapInitialized = false; // Ensure it stays false on error
      const mapContainer = document.getElementById('recommendation-map');
      if (mapContainer) {
          mapContainer.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Error initializing map: ${escapeHtml(error.message)}</p>`;
      }
    }
  }

  function processQueuedMessages() {
    if (!isMapInitialized) return; // Should not happen if called correctly, but good guard
    console.log(`LocalLens: Processing ${messageQueue.length} queued messages.`);
    while (messageQueue.length > 0) {
      const { message, sender, sendResponse } = messageQueue.shift();
      processMessage(message, sender, sendResponse); // Pass sendResponse along
    }
  }

  function clearMapMarkers() {
    if (!map) return;
    Object.values(markers).forEach(marker => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    markers = {};
  }

  function clearRecommendationsList() {
    const listElement = document.getElementById('recommendationsList');
    if (listElement) {
      listElement.innerHTML = '';
    }
  }

  function addRecommendations(recommendations) {
    if (!isMapInitialized || !map) {
      console.warn('LocalLens: Map not initialized, cannot add recommendations yet.');
      return;
    }
    if (!Array.isArray(recommendations)) {
      console.error('LocalLens: Invalid recommendations format received.', recommendations);
      return;
    }

    clearMapMarkers();
    clearRecommendationsList();

    const bounds = [];
    const listElement = document.getElementById('recommendationsList');

    if (!listElement) {
      console.error('LocalLens: recommendationsList element not found in DOM.');
    }

    recommendations.forEach(rec => {
      if (rec == null || rec.latitude == null || rec.longitude == null || rec.id == null || rec.name == null) {
        console.warn('LocalLens: Skipping recommendation with missing data:', rec);
        return;
      }

      const lat = parseFloat(rec.latitude);
      const lng = parseFloat(rec.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        console.warn('LocalLens: Skipping recommendation with invalid lat/lng:', rec);
        return;
      }

      // Add marker to map
      const marker = L.marker([lat, lng]).addTo(map);
      const name = escapeHtml(rec.name);
      const desc = rec.description ? '<br>' + escapeHtml(rec.description) : '';
      const popupContent = `<strong>${name}</strong>${desc}`;
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        // When a map marker is clicked
        chrome.runtime.sendMessage({ type: 'RECOMMENDATION_SELECTED', payload: { id: rec.id, source: 'map' } });
        highlightListItem(rec.id);
        // map.panTo([lat, lng]); // Center map on clicked marker, already happens with openPopup
      });
      markers[rec.id] = marker;
      bounds.push([lat, lng]);

      // Add item to the HTML list
      if (listElement) {
        const listItem = document.createElement('li');
        listItem.className = 'recommendation-item'; // For styling
        listItem.setAttribute('data-id', rec.id);   // For linking to marker
        listItem.setAttribute('tabindex', '0');      // For accessibility (keyboard focus)

        // Simple text content, or create more complex HTML structure
        listItem.innerHTML = `<strong>${name}</strong>${rec.address ? `<br><small>${escapeHtml(rec.address)}</small>` : ''}`;

        listItem.addEventListener('click', () => {
          // When a list item is clicked
          highlightRecommendationOnMap(rec.id); // Highlight on map and open popup
          // Optionally, notify background if needed, though map click already does
          // chrome.runtime.sendMessage({ type: 'RECOMMENDATION_SELECTED', payload: { id: rec.id, source: 'list' } });
        });
        listItem.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                highlightRecommendationOnMap(rec.id);
            }
        });
        listElement.appendChild(listItem);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 }); // Added maxZoom to prevent over-zooming on single point
    } else if (recommendations.length > 0) {
        // If there were items but none had valid coordinates, maybe set a default view
        map.setView([0,0], 2);
    }
    console.log(`LocalLens: Added ${recommendations.length} recommendations.`);
  }

  function highlightListItem(recommendationId) {
    // Remove 'selected' class from any currently selected list item
    document.querySelectorAll('#recommendationsList .recommendation-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    // Add 'selected' class to the new item
    const itemElement = document.querySelector(`#recommendationsList .recommendation-item[data-id="${recommendationId}"]`);
    if (itemElement) {
      itemElement.classList.add('selected');
      itemElement.focus(); // For accessibility
      // Scroll into view if needed
      itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Renamed for clarity: this function highlights the item on the map
  function highlightRecommendationOnMap(recommendationId) {
    const marker = markers[recommendationId];
    if (marker && map) {
      map.closePopup(); // Close any currently open popups
      map.panTo(marker.getLatLng());
      marker.openPopup();
      highlightListItem(recommendationId); // Also highlight in the list
    }
  }

  function processMessage(message, sender, sendResponse) {
    if (!message || !message.type) {
        console.warn("LocalLens: Received invalid message structure", message);
        return;
    }
    console.log('LocalLens: Processing message:', message);
    switch (message.type) {
      case 'LOAD_RECOMMENDATIONS':
        if (message.payload && Array.isArray(message.payload)) {
          addRecommendations(message.payload);
        } else {
          console.error('LocalLens: LOAD_RECOMMENDATIONS received invalid payload.', message.payload);
          addRecommendations([]); // Clear existing recommendations
        }
        break;
      case 'HIGHLIGHT_RECOMMENDATION': // This would typically be called if an external event wants to highlight an item
        if (message.payload != null) { // payload could be an ID
          highlightRecommendationOnMap(message.payload);
        } else {
           console.error('LocalLens: HIGHLIGHT_RECOMMENDATION received invalid payload.', message.payload);
        }
        break;
      default:
        console.warn('LocalLens: Unknown message type received in map handler:', message.type);
        break;
    }
    // If you need to send a response:
    // sendResponse({status: "processed", type: message.type});
    // return true; // if sendResponse is asynchronous
  }

  // Listener for messages from other parts of the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if the message is intended for this map handler context
    // (e.g., by checking sender.tab or a specific property in the message)
    // For now, assume all messages here are relevant or handled by type.

    if (!isMapInitialized) {
      console.log('LocalLens: Map not ready, queueing message:', message.type);
      messageQueue.push({ message, sender, sendResponse });
      // If you are queueing and might sendResponse later, you must return true.
      // However, if processMessage doesn't actually call sendResponse, it's not strictly needed.
      // For simplicity, if not using sendResponse, you can omit it.
    } else {
      processMessage(message, sender, sendResponse);
    }
    // If processMessage *might* call sendResponse (even if it currently doesn't),
    // it's safer to return true to keep the channel open.
    // Given the current structure, sendResponse is not used.
    // return true; // Uncomment if sendResponse will be used asynchronously.
  });

  // Initialize the map once the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    // DOMContentLoaded has already fired
    initMap();
  }

  console.log('LocalLens: Sidebar recommendation map handler script loaded.');

})(); // End of IIFE
