chrome.runtime.onInstalled.addListener(() => {
  console.log('[Pinterest Assistant v1.2.1] Extension installed and active.');
});

const PINTEREST_URL_PATTERNS = [
  '*://*.pinterest.com/*',
  '*://*.pinterest.co.uk/*',
  '*://*.pinterest.ca/*',
  '*://*.pinterest.de/*',
  '*://*.pinterest.fr/*',
  '*://*.pinterest.es/*',
  '*://*.pinterest.it/*',
  '*://*.pinterest.com.au/*',
  '*://*.pinterest.com.mx/*',
  '*://*.pinterest.com.br/*',
  '*://*.pinterest.jp/*',
  '*://*.pinterest.ch/*',
  '*://*.pinterest.at/*',
  '*://*.pinterest.nl/*',
  '*://*.pinterest.se/*',
  '*://*.pinterest.dk/*',
  '*://*.pinterest.ie/*',
  '*://*.pinterest.pt/*',
  '*://*.pinterest.pl/*',
  '*://*.pinterest.ph/*',
  '*://*.pinterest.nz/*',
  '*://*.pinterest.cl/*',
  '*://*.pinterest.co.in/*'
];

function normalizePinData(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    type: 'PIN_DATA',
    pinId: String(raw.pinId || raw.id || '1'),
    image: raw.image || raw.imageUrl || '',
    imageUrl: raw.imageUrl || raw.image || '',
    title: (raw.title || '').trim(),
    description: (raw.description || '').trim(),
    url: (raw.url || raw.destinationUrl || '').trim(),
    destinationUrl: (raw.destinationUrl || raw.url || '').trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => String(t).trim()).filter(Boolean) : [],
    board: (raw.board || raw.boardName || '').trim(),
    boardId: raw.boardId || '',
    altText: (raw.altText || raw.title || '').trim(),
    timestamp: Date.now()
  };
}

function notifyPinterestTabs(payload) {
  chrome.tabs.query({ url: PINTEREST_URL_PATTERNS }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || tabs.length === 0) return;
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'PIN_DATA_UPDATED',
          payload: payload
        }, () => {
          if (chrome.runtime.lastError) {
            // Silence disconnected tab or navigating tab errors
          }
        });
      }
    });
  });
}

// External communication from Web App
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    sendResponse({ success: false, error: 'Invalid payload' });
    return false;
  }

  if (message.type === 'PING' || message.type === 'PING_PINTEREST_ASSISTANT') {
    chrome.storage.local.get(['activePin', 'pinQueue', 'queueIndex'], (result) => {
      sendResponse({
        success: true,
        type: 'PONG',
        version: '1.2.1',
        activePinId: result?.activePin?.pinId || null,
        queueCount: Array.isArray(result?.pinQueue) ? result.pinQueue.length : 0,
        timestamp: Date.now()
      });
    });
    return true;
  }

  // Handle Full Queue Batch
  if (message.type === 'PIN_QUEUE' && Array.isArray(message.pins)) {
    const normalizedPins = message.pins.map(normalizePinData).filter(Boolean);
    const queueIndex = message.queueIndex || 0;
    const activePin = normalizedPins[queueIndex] || null;

    chrome.storage.local.set({
      pinQueue: normalizedPins,
      queueIndex: queueIndex,
      activePin: activePin,
      active_pinterest_pin: activePin
    }, () => {
      notifyPinterestTabs({
        type: 'PIN_QUEUE_UPDATED',
        queue: normalizedPins,
        queueIndex: queueIndex,
        activePin: activePin
      });
      sendResponse({
        success: true,
        type: 'QUEUE_RECEIVED',
        count: normalizedPins.length,
        activePinId: activePin?.pinId
      });
    });
    return true;
  }

  // Handle Single Pin
  if (message.type === 'PIN_DATA' || message.type === 'PIN_READY') {
    const normalized = normalizePinData(message);
    if (!normalized) {
      sendResponse({ success: false, error: 'Malformed pin data' });
      return false;
    }
    chrome.storage.local.set({
      activePin: normalized,
      active_pinterest_pin: normalized
    }, () => {
      notifyPinterestTabs(normalized);
      sendResponse({ success: true, type: 'PIN_RECEIVED', pinId: normalized.pinId, stored: true });
    });
    return true;
  }

  sendResponse({ success: true, type: 'EXTENSION_ACK' });
  return false;
});

// Internal Extension Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'PING') {
    chrome.storage.local.get(['activePin', 'pinQueue', 'queueIndex'], (result) => {
      sendResponse({
        success: true,
        type: 'PONG',
        version: '1.2.1',
        activePinId: result?.activePin?.pinId || null,
        queueCount: Array.isArray(result?.pinQueue) ? result.pinQueue.length : 0
      });
    });
    return true;
  }

  if (message.type === 'GET_ACTIVE_PIN') {
    chrome.storage.local.get(['activePin', 'pinQueue', 'queueIndex'], (result) => {
      sendResponse({
        activePin: result?.activePin || null,
        pinQueue: result?.pinQueue || [],
        queueIndex: result?.queueIndex || 0
      });
    });
    return true;
  }

  if (message.type === 'SET_ACTIVE_PIN' || message.type === 'PIN_DATA') {
    const normalized = normalizePinData(message.payload || message);
    if (!normalized) {
      sendResponse({ success: false, error: 'Invalid pin data' });
      return false;
    }
    chrome.storage.local.set({ activePin: normalized, active_pinterest_pin: normalized }, () => {
      notifyPinterestTabs(normalized);
      sendResponse({ success: true, pinId: normalized.pinId });
    });
    return true;
  }

  if (message.type === 'SET_QUEUE_INDEX') {
    const nextIdx = Number(message.index || 0);
    chrome.storage.local.get(['pinQueue'], (result) => {
      const queue = result?.pinQueue || [];
      if (queue[nextIdx]) {
        const nextPin = queue[nextIdx];
        chrome.storage.local.set({
          queueIndex: nextIdx,
          activePin: nextPin,
          active_pinterest_pin: nextPin
        }, () => {
          notifyPinterestTabs({
            type: 'PIN_QUEUE_NAVIGATED',
            queueIndex: nextIdx,
            activePin: nextPin
          });
          sendResponse({ success: true, activePin: nextPin, queueIndex: nextIdx });
        });
      } else {
        sendResponse({ success: false, error: 'Index out of bounds' });
      }
    });
    return true;
  }
});
