/**
 * Pinterest Publishing Assistant - Web App Bridge Content Script
 * Bridges window.postMessage from the React Web App to chrome.runtime / chrome.storage.
 */
(function () {
  // Inject flag into DOM to confirm extension presence immediately
  try {
    const el = document.createElement('div');
    el.id = '__pinterest_publishing_assistant_extension_active__';
    el.setAttribute('data-version', '1.0.0');
    el.style.display = 'none';
    document.documentElement.appendChild(el);
  } catch (e) {
    // Ignore
  }

  // Listen for messages from React Web App
  window.addEventListener('message', (event) => {
    // Basic source safety check
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    const data = event.data;

    // 1. PING from Web App
    if (data.type === 'PING_PINTEREST_ASSISTANT') {
      try {
        chrome.runtime.sendMessage({ type: 'PING_PINTEREST_ASSISTANT' }, (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: 'PONG_PINTEREST_ASSISTANT',
              version: '1.0.0',
              status: 'ready',
              timestamp: Date.now()
            }, '*');
          } else if (response) {
            window.postMessage(response, '*');
          }
        });
      } catch (err) {
        window.postMessage({
          type: 'PONG_PINTEREST_ASSISTANT',
          version: '1.0.0',
          status: 'ready',
          timestamp: Date.now()
        }, '*');
      }
    }

    // 2. PIN_READY payload from Web App
    if (data.type === 'PIN_READY') {
      try {
        chrome.runtime.sendMessage(data, (res) => {
          if (chrome.runtime.lastError) {
            console.warn('[Pinterest Assistant Bridge] Error sending pin to background:', chrome.runtime.lastError.message);
          }
        });
      } catch (err) {
        console.warn('[Pinterest Assistant Bridge] Send failed:', err);
      }
    }
  });

  // Also listen for storage changes and relay status back to Web App
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.pinterest_last_status) {
        window.postMessage(changes.pinterest_last_status.newValue, '*');
      }
    });
  } catch (e) {
    // Ignore
  }
})();
