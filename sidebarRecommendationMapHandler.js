(function() { // IIFE for scope protection

  let map;
  let markers = {}; // Store markers by recommendation ID
  let isMapInitialized = false;
  const messageQueue = [];

  // Utility to escape HTML special characters
  function escapeHtml(str) {
    if (typeof str !== 'string') {
      if (str == null) return ''; // Convert null or undefined to empty string
      str = String(str);
    }
    // CORRECTED HTML ESCAPING
    return str.replace(/[&<>"']/g, function(match) {
      switch (match) {
        case '&':
          return '&';
        case '<':
          return '<';
        case '>':
          return '>';
        case '"':
          return '"';
        case "'":
          return '''; // or '
        default:
          return match;
      }
    });
  }

  function initMap() {
    try {
      if (typeof L === 'undefined') {
        console.error('LocalLens: Leaflet library (L) is not loaded. Map cannot be initialized.');
        const mapContainer = document.getElementById('recommendation-map');
        if (mapContainer) {
          mapContainer.innerHTML = '<p style="color:red; text-align:center; padding:20px;">Error: Map library not loaded. Cannot display map.</p>';
        }
        return;
      }

      map = L.map('recommendation-map', {
        center: [0, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      isMapInitialized = true;
      console.log('LocalLens: Map initialized successfully.');
      processQueuedMessages();

    } catch (error) {
      console.error('LocalLens: Error initializing map:', error);
      isMapInitialized = false;
      const mapContainer = document.getElementById('recommendation-map');
      if (mapContainer) {
          mapContainer.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Error initializing map: ${escapeHtml(error.message)}</p>`;
      }
    }
  }

  function processQueuedMessages() {
    if (!isMapInitialized) return;
    console.log(`LocalLens: Processing ${messageQueue.length} queued messages.`);
    while (messageQueue.length > 0) {
      const { message, sender, sendResponse } = messageQueue.shift();
      processMessage(message, sender, sendResponse);
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

      const marker = L.marker([lat, lng]).addTo(map);
      const name = escapeHtml(rec.name);
      const desc = rec.description ? '<br>' + escapeHtml(rec.description) : '';
      const popupContent = `<strong>${name}</strong>${desc}`;
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        chrome.runtime.sendMessage({ type: 'RECOMMENDATION_SELECTED', payload: { id: rec.id, source: 'map' } });
        highlightListItem(rec.id);
      });
      markers[rec.id] = marker;
      bounds.push([lat, lng]);

      if (listElement) {
        const listItem = document.createElement('li');
        listItem.className = 'recommendation-item';
        listItem.setAttribute('data-id', rec.id);
        listItem.setAttribute('tabindex', '0');
        listItem.innerHTML = `<strong>${name}</strong>${rec.address ? `<br><small>${escapeHtml(rec.address)}</small>` : ''}`;

        listItem.addEventListener('click', () => {
          highlightRecommendationOnMap(rec.id);
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
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (recommendations.length > 0) {
        map.setView([0,0], 2);
    }
    console.log(`LocalLens: Added ${recommendations.length} recommendations.`);
  }

  function highlightListItem(recommendationId) {
    document.querySelectorAll('#recommendationsList .recommendation-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    const itemElement = document.querySelector(`#recommendationsList .recommendation-item[data-id="${recommendationId}"]`);
    if (itemElement) {
      itemElement.classList.add('selected');
      itemElement.focus();
      itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function highlightRecommendationOnMap(recommendationId) {
    const marker = markers[recommendationId];
    if (marker && map) {
      map.closePopup();
      map.panTo(marker.getLatLng());
      marker.openPopup();
      highlightListItem(recommendationId);
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
          addRecommendations([]);
        }
        break;
      case 'HIGHLIGHT_RECOMMENDATION':
        if (message.payload != null) {
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isMapInitialized) {
      console.log('LocalLens: Map not ready, queueing message:', message.type);
      messageQueue.push({ message, sender, sendResponse });
    } else {
      processMessage(message, sender, sendResponse);
    }
    // return true; // Uncomment if sendResponse will be used asynchronously by processMessage
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

  console.log('LocalLens: Sidebar recommendation map handler script loaded.');

})();
