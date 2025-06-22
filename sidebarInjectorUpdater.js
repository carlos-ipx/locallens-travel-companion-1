const SIDEBAR_ID = 'locallens-sidebar';
const SIDEBAR_CSS_ID = 'locallens-sidebar-css';
let lastUrl = location.href;

function injectCSS() {
  if (document.getElementById(SIDEBAR_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = SIDEBAR_CSS_ID;
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(link);
}

function createSidebar() {
  injectCSS();
  const existing = document.getElementById(SIDEBAR_ID);
  if (existing) return existing;
  const container = document.createElement('div');
  container.id = SIDEBAR_ID;
  container.className = 'locallens-sidebar';
  container.innerHTML = ''
    + '<div class="locallens-sidebar-header">'
    +   '<span class="locallens-title">LocalLens</span>'
    +   '<button class="locallens-close-btn" title="Close">&times;</button>'
    + '</div>'
    + '<div class="locallens-sidebar-content">Loading...</div>';
  document.body.appendChild(container);
  const btn = container.querySelector('.locallens-close-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      container.style.display = 'none';
    });
  }
  return container;
}

function sanitizeHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
  return doc.body.innerHTML;
}

function updateSidebar(payload) {
  const sidebar = document.getElementById(SIDEBAR_ID) || createSidebar();
  const content = sidebar.querySelector('.locallens-sidebar-content');
  if (!content) return;
  if (payload.html) {
    try {
      content.innerHTML = sanitizeHTML(payload.html);
    } catch (e) {
      content.textContent = 'Failed to render content.';
      console.error('sanitizeHTML error', e);
    }
  } else if (payload.data) {
    try {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(payload.data, null, 2);
      content.innerHTML = '';
      content.appendChild(pre);
    } catch (e) {
      content.textContent = 'Failed to display data.';
      console.error('render data error', e);
    }
  }
  sidebar.style.display = 'block';
}

function ensureSidebar() {
  if (!document.getElementById(SIDEBAR_ID)) {
    createSidebar();
  }
}

function handleUrlChange() {
  const current = location.href;
  if (current !== lastUrl) {
    lastUrl = current;
    ensureSidebar();
    chrome.runtime.sendMessage({ type: 'pageNavigated', url: lastUrl });
  }
}

window.addEventListener('popstate', handleUrlChange);
window.addEventListener('hashchange', handleUrlChange);

const _push = history.pushState;
history.pushState = function() {
  const ret = _push.apply(this, arguments);
  window.dispatchEvent(new Event('popstate'));
  return ret;
};

const _replace = history.replaceState;
history.replaceState = function() {
  const ret = _replace.apply(this, arguments);
  window.dispatchEvent(new Event('popstate'));
  return ret;
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'updateSidebar') {
    updateSidebar(request.payload || {});
    sendResponse({ status: 'ok' });
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureSidebar);
} else {
  ensureSidebar();
}
})();