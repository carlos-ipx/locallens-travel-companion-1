let map;
let markers = {};
let isMapInitialized = false;
const messageQueue = [];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(s) {
    switch (s) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return s;
    }
  });
}

function initMap() {
  map = L.map('recommendation-map', {
    center: [0, 0],
    zoom: 2,
    zoomControl: true,
    attributionControl: false
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  isMapInitialized = true;
  processQueuedMessages();
}

function processQueuedMessages() {
  while (messageQueue.length) {
    const { message, sender, sendResponse } = messageQueue.shift();
    processMessage(message, sender, sendResponse);
  }
}

function clearMarkers() {
  Object.values(markers).forEach(marker => {
    if (map && map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });
  markers = {};
}

function addRecommendations(recommendations) {
  if (!map) return;
  clearMarkers();
  const bounds = [];
  recommendations.forEach(rec => {
    if (rec.latitude == null || rec.longitude == null) return;
    const lat = rec.latitude;
    const lng = rec.longitude;
    const marker = L.marker([lat, lng]).addTo(map);
    const name = escapeHtml(rec.name);
    const desc = rec.description ? '<br>' + escapeHtml(rec.description) : '';
    const popupContent = '<strong>' + name + '</strong>' + desc;
    marker.bindPopup(popupContent);
    marker.on('click', () => {
      chrome.runtime.sendMessage({ type: 'RECOMMENDATION_SELECTED', payload: rec.id });
      highlightListItem(rec.id);
    });
    markers[rec.id] = marker;
    bounds.push([lat, lng]);
  });
  if (bounds.length) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function highlightListItem(id) {
  document.querySelectorAll('.recommendation-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  const item = document.querySelector('.recommendation-item[data-id="' + id + '"]');
  if (item) {
    item.classList.add('selected');
  }
}

function highlightRecommendation(id) {
  const marker = markers[id];
  if (marker && map) {
    marker.openPopup();
    map.panTo(marker.getLatLng());
    highlightListItem(id);
  }
}

function processMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'LOAD_RECOMMENDATIONS':
      addRecommendations(message.payload);
      break;
    case 'HIGHLIGHT_RECOMMENDATION':
      highlightRecommendation(message.payload);
      break;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isMapInitialized) {
    messageQueue.push({ message, sender, sendResponse });
  } else {
    processMessage(message, sender, sendResponse);
  }
});

document.addEventListener('DOMContentLoaded', initMap);