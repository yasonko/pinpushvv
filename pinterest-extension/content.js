(function () {
  if (window.__pinterestAssistantLoaded) return;
  window.__pinterestAssistantLoaded = true;

  let currentPin = null;
  let pinQueue = [];
  let queueIndex = 0;
  let isMinimized = false;
  let currentTheme = 'dark';
  let rootContainer = null;
  let isAddingTag = false;
  let tagFormat = 'comma'; // 'comma' | 'hashtag'

  function init() {
    createAssistantDOM();
    loadStoredData();
    setupKeyboardShortcuts();

    // Listen for runtime messages from web app or background worker
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message) return;

        if (message.type === 'PIN_DATA_UPDATED' || message.type === 'PIN_READY') {
          currentPin = message.payload;
          renderAssistantUI();
          showNotification('Pin #' + (currentPin?.pinId || '1') + ' loaded ✓', 'success');
          if (sendResponse) sendResponse({ success: true });
        } else if (message.type === 'PIN_QUEUE_UPDATED') {
          pinQueue = message.queue || [];
          queueIndex = message.queueIndex || 0;
          currentPin = message.activePin || pinQueue[queueIndex] || null;
          renderAssistantUI();
          showNotification(`Queue loaded (${pinQueue.length} pins) ✓`, 'success');
          if (sendResponse) sendResponse({ success: true });
        } else if (message.type === 'PIN_QUEUE_NAVIGATED') {
          queueIndex = message.queueIndex || 0;
          currentPin = message.activePin || (pinQueue[queueIndex] || null);
          renderAssistantUI();
          showNotification(`Pin #${currentPin?.pinId || queueIndex + 1} (${queueIndex + 1}/${pinQueue.length})`, 'success');
          if (sendResponse) sendResponse({ success: true });
        } else if (message.type === 'THEME_CHANGED') {
          currentTheme = message.theme || 'dark';
          applyThemeClass();
          renderAssistantUI();
          if (sendResponse) sendResponse({ success: true });
        }
      });
    }

    // Listen for local storage changes across tabs
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          if (changes.theme) {
            currentTheme = changes.theme.newValue || 'dark';
            applyThemeClass();
            renderAssistantUI();
          }
          if (changes.pinQueue) {
            pinQueue = changes.pinQueue.newValue || [];
          }
          if (changes.queueIndex) {
            queueIndex = changes.queueIndex.newValue || 0;
          }
          if (changes.activePin || changes.active_pinterest_pin) {
            const newPin = (changes.activePin || changes.active_pinterest_pin).newValue;
            if (newPin && JSON.stringify(newPin) !== JSON.stringify(currentPin)) {
              currentPin = newPin;
              renderAssistantUI();
            }
          }
        }
      });
    }
  }

  function loadStoredData() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['activePin', 'active_pinterest_pin', 'pinQueue', 'queueIndex', 'theme'], (res) => {
        currentTheme = res?.theme || 'dark';
        pinQueue = Array.isArray(res?.pinQueue) ? res.pinQueue : [];
        queueIndex = typeof res?.queueIndex === 'number' ? res.queueIndex : 0;
        const pin = res?.activePin || res?.active_pinterest_pin || (pinQueue.length > 0 ? pinQueue[queueIndex] : null);
        if (pin && (pin.title || pin.pinId || pin.imageUrl)) {
          currentPin = pin;
        }
        applyThemeClass();
        renderAssistantUI();
      });
    } else {
      applyThemeClass();
      renderAssistantUI();
    }
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (!e.altKey || !e.shiftKey) return;
      const key = e.key.toUpperCase();

      if (key === 'M') {
        e.preventDefault();
        isMinimized = !isMinimized;
        renderAssistantUI();
      } else if (key === 'N') {
        e.preventDefault();
        navigateQueue(1);
      } else if (key === 'P') {
        e.preventDefault();
        navigateQueue(-1);
      } else if (key === 'C') {
        e.preventDefault();
        copyAllMetadata();
      }
    });
  }

  function applyThemeClass() {
    if (!rootContainer) return;
    if (currentTheme === 'light') {
      rootContainer.classList.add('theme-light');
    } else {
      rootContainer.classList.remove('theme-light');
    }
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyThemeClass();
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ theme: currentTheme });
    }
    renderAssistantUI();
  }

  function saveCurrentPin() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local && currentPin) {
      chrome.storage.local.set({
        activePin: currentPin,
        active_pinterest_pin: currentPin,
        pinQueue: pinQueue
      });
    }
  }

  function createAssistantDOM() {
    const existing = document.getElementById('pinterest-assistant-root');
    if (existing) {
      rootContainer = existing;
    } else {
      rootContainer = document.createElement('div');
      rootContainer.id = 'pinterest-assistant-root';
      if (document.body) {
        document.body.appendChild(rootContainer);
      }
    }
    applyThemeClass();
  }

  function navigateQueue(direction) {
    if (!pinQueue || pinQueue.length <= 1) {
      showNotification('No queue loaded or only 1 pin', 'warn');
      return;
    }
    const newIdx = queueIndex + direction;
    if (newIdx < 0 || newIdx >= pinQueue.length) {
      showNotification(direction > 0 ? 'End of pin queue' : 'Start of pin queue', 'warn');
      return;
    }
    queueIndex = newIdx;
    currentPin = pinQueue[queueIndex];

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        queueIndex: queueIndex,
        activePin: currentPin,
        active_pinterest_pin: currentPin
      });
    }

    renderAssistantUI();
    showNotification(`Pin ${queueIndex + 1} of ${pinQueue.length}`, 'success');
  }

  // Visual button feedback helper (resets after ~1.5s)
  function triggerButtonCopied(btn, originalHtml, customMsg) {
    if (!btn) return;
    btn.classList.add('copied');
    btn.innerHTML = '<span>✓ Copied</span>';
    showNotification(customMsg || '✓ Copied to clipboard', 'success');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalHtml;
    }, 1500);
  }

  async function copyText(text, btn, originalHtml, label) {
    const str = String(text || '').trim();
    if (!str) {
      showNotification(`${label} is empty`, 'warn');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(str);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = str;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      triggerButtonCopied(btn, originalHtml, `✓ Copied ${label}`);
    } catch (err) {
      showNotification('Clipboard copy error', 'error');
    }
  }

  function getTagsString() {
    if (!currentPin) return '';
    if (Array.isArray(currentPin.tags)) {
      if (tagFormat === 'hashtag') {
        return currentPin.tags.map(t => '#' + t.replace(/\s+/g, '')).join(' ');
      }
      return currentPin.tags.join(', ');
    }
    return String(currentPin.tags || '');
  }

  function copyAllMetadata(btn) {
    if (!currentPin) {
      showNotification('No Pin loaded', 'warn');
      return;
    }

    const title = currentPin.title || '';
    const description = currentPin.description || '';
    const destinationUrl = currentPin.url || currentPin.destinationUrl || '';
    const altText = currentPin.altText || '';
    const tags = getTagsString();

    // Exact order required:
    // Title
    // Description
    // Destination URL
    // Alt SEO Text
    // Tags
    const allFormatted = [
      title,
      description,
      destinationUrl,
      altText,
      tags
    ].filter(section => section && section.trim().length > 0).join('\n\n');

    const targetBtn = btn || document.getElementById('pa-btn-copy-all');
    copyText(allFormatted, targetBtn, '<span>⚡ COPY ALL</span>', 'All Metadata');
  }

  function renderAssistantUI() {
    if (!rootContainer) return;
    applyThemeClass();

    if (isMinimized) {
      const qText = pinQueue.length > 1 ? ` (${queueIndex + 1}/${pinQueue.length})` : '';
      rootContainer.innerHTML = `
        <div class="pa-minimized-bubble" id="pa-expand-btn" title="Click to expand (Alt+Shift+M)">
          <span>📌</span>
          <span>${currentPin ? 'Pin #' + (currentPin.pinId || queueIndex + 1) + qText : 'Pinterest Assistant'}</span>
        </div>
      `;
      document.getElementById('pa-expand-btn')?.addEventListener('click', () => {
        isMinimized = false;
        renderAssistantUI();
      });
      return;
    }

    const themeIcon = currentTheme === 'dark' ? '🌙' : '☀️';
    const themeLabel = currentTheme === 'dark' ? 'Dark' : 'Light';
    const hasQueue = pinQueue && pinQueue.length > 1;

    if (!currentPin) {
      rootContainer.innerHTML = `
        <div class="pa-card">
          <div class="pa-header" id="pa-drag-header">
            <div class="pa-header-left">
              <div class="pa-logo-icon">P</div>
              <span class="pa-title">Pinterest Assistant</span>
            </div>
            <div class="pa-header-controls">
              <button class="pa-icon-btn" id="pa-theme-toggle" title="Theme: ${themeLabel}">${themeIcon}</button>
              <button class="pa-icon-btn" id="pa-minimize-btn" title="Minimize">−</button>
            </div>
          </div>
          <div class="pa-body" style="text-align:center; padding: 24px 14px;">
            <div style="font-weight: 800; color: var(--text); margin-bottom: 6px; font-size: 13px;">No Pin Loaded</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
              Copy a single pin or queue from PinPulse Web App, or click below to import from clipboard.
            </div>
            <button class="pa-btn-secondary" id="pa-import-clipboard-btn">
              📋 IMPORT FROM CLIPBOARD
            </button>
            <div id="pa-toast" class="pa-toast"></div>
          </div>
          <div class="pa-footer">Clipboard-Only Assistant • 100% Policy Safe</div>
        </div>
      `;
      setupEmptyEventHandlers();
      setupDraggable();
      return;
    }

    const titleVal = currentPin.title || '';
    const descVal = currentPin.description || '';
    const urlVal = currentPin.url || currentPin.destinationUrl || '';
    const altVal = currentPin.altText || '';
    const tagsList = Array.isArray(currentPin.tags) ? currentPin.tags : [];
    const tagsVal = getTagsString();
    const hasImage = !!(currentPin.image || currentPin.imageUrl);

    let tagChipsHtml = '';
    if (tagsList.length > 0) {
      tagChipsHtml = tagsList.map((tag, idx) => `
        <div class="pa-tag-chip" data-tag-idx="${idx}" title="Click to copy tag">
          <span>${escapeHtml(tag)}</span>
          <span style="font-size:9px; opacity:0.6;">📋</span>
        </div>
      `).join('');
    }

    rootContainer.innerHTML = `
      <div class="pa-card">
        <div class="pa-header" id="pa-drag-header">
          <div class="pa-header-left">
            <div class="pa-logo-icon">P</div>
            <span class="pa-title">Pinterest Assistant</span>
          </div>
          <div class="pa-header-controls">
            <button class="pa-icon-btn" id="pa-theme-toggle" title="Theme: ${themeLabel}">${themeIcon}</button>
            <button class="pa-icon-btn" id="pa-minimize-btn" title="Minimize (Alt+Shift+M)">−</button>
          </div>
        </div>

        ${hasQueue ? `
          <div class="pa-queue-bar">
            <button class="pa-queue-nav-btn" id="pa-prev-pin-btn" ${queueIndex === 0 ? 'disabled' : ''} title="Previous Pin (Alt+Shift+P)">◀ Prev</button>
            <div class="pa-queue-status">Pin <b>${queueIndex + 1}</b> of <b>${pinQueue.length}</b></div>
            <button class="pa-queue-nav-btn" id="pa-next-pin-btn" ${queueIndex >= pinQueue.length - 1 ? 'disabled' : ''} title="Next Pin (Alt+Shift+N)">Next ▶</button>
          </div>
        ` : ''}

        <div class="pa-pin-info-bar">
          <div class="pa-pin-id-row">
            <span class="pa-pin-id">Pin #${currentPin.pinId || queueIndex + 1}</span>
            <span class="pa-status-tag">✓ Clipboard Ready</span>
          </div>
        </div>

        <div class="pa-body">
          ${hasImage ? `
            <div class="pa-image-dock">
              <img src="${currentPin.imageUrl || currentPin.image}" class="pa-thumb" alt="Pin preview" />
              <div class="pa-image-actions">
                <button class="pa-btn-micro" id="pa-copy-img-url-btn">📋 Copy Image URL</button>
                <button class="pa-btn-micro" id="pa-download-img-btn">⬇ Download Image</button>
              </div>
            </div>
          ` : ''}

          <!-- 1. TITLE -->
          <div class="pa-field-block">
            <div class="pa-field-header">
              <span class="pa-field-label">TITLE</span>
              <span class="pa-field-count" id="pa-count-title">${titleVal.length} / 100</span>
            </div>
            <input type="text" class="pa-field-input" id="pa-input-title" value="${escapeHtml(titleVal)}" maxlength="100" placeholder="Generated Pinterest title" />
            <button class="pa-copy-btn" id="pa-btn-copy-title">
              <span>📋 Copy Title</span>
            </button>
          </div>

          <!-- 2. DESCRIPTION -->
          <div class="pa-field-block">
            <div class="pa-field-header">
              <span class="pa-field-label">DESCRIPTION</span>
              <span class="pa-field-count" id="pa-count-desc">${descVal.length} / 500</span>
            </div>
            <textarea class="pa-field-textarea" id="pa-input-desc" maxlength="500" rows="3" placeholder="Generated Pinterest description">${escapeHtml(descVal)}</textarea>
            <button class="pa-copy-btn" id="pa-btn-copy-desc">
              <span>📋 Copy Description</span>
            </button>
          </div>

          <!-- 3. DESTINATION URL -->
          <div class="pa-field-block">
            <div class="pa-field-header">
              <span class="pa-field-label">DESTINATION URL</span>
            </div>
            <input type="url" class="pa-field-input" id="pa-input-url" value="${escapeHtml(urlVal)}" placeholder="https://example.com/..." />
            <button class="pa-copy-btn" id="pa-btn-copy-url">
              <span>📋 Copy Destination URL</span>
            </button>
          </div>

          <!-- 4. ALT SEO TEXT -->
          <div class="pa-field-block">
            <div class="pa-field-header">
              <span class="pa-field-label">ALT SEO TEXT</span>
              <span class="pa-field-count" id="pa-count-alt">${altVal.length} / 500</span>
            </div>
            <textarea class="pa-field-textarea" id="pa-input-alt" maxlength="500" rows="2" placeholder="SEO description of the image">${escapeHtml(altVal)}</textarea>
            <button class="pa-copy-btn" id="pa-btn-copy-alt">
              <span>📋 Copy Alt Text</span>
            </button>
          </div>

          <!-- 5. TAGS -->
          <div class="pa-field-block">
            <div class="pa-field-header">
              <span class="pa-field-label">TAGS</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="pa-field-count" id="pa-count-tags">${tagsList.length} tags</span>
                <button type="button" class="pa-btn-micro" id="pa-toggle-tag-format" style="padding:1px 5px; font-size:9px;">${tagFormat === 'hashtag' ? '# Hashes' : ', Commas'}</button>
              </div>
            </div>
            <textarea class="pa-field-textarea" id="pa-input-tags" rows="2" placeholder="matcha, matcha latte, healthy drinks...">${escapeHtml(tagsVal)}</textarea>
            ${tagChipsHtml ? `<div class="pa-tag-chips-wrap">${tagChipsHtml}</div>` : ''}
            <button class="pa-copy-btn" id="pa-btn-copy-tags">
              <span>📋 Copy Tags</span>
            </button>
          </div>

          <!-- 6. PROMINENT COPY ALL -->
          <button class="pa-btn-copy-all" id="pa-btn-copy-all">
            <span>⚡ COPY ALL</span>
          </button>

          ${hasQueue ? `
            <button class="pa-btn-secondary" id="pa-btn-copy-and-next">
              <span>📋 Copy All & Next Pin ▶</span>
            </button>
          ` : ''}

          <button class="pa-btn-secondary" id="pa-import-clipboard-btn">
            <span>📋 Import from Clipboard</span>
          </button>
        </div>

        <div class="pa-footer">
          Click Copy buttons → Paste into Pinterest (Ctrl+V / Cmd+V)
        </div>

        <div id="pa-toast" class="pa-toast"></div>
      </div>
    `;

    setupActiveEventHandlers();
    setupDraggable();
  }

  function setupEmptyEventHandlers() {
    document.getElementById('pa-theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('pa-minimize-btn')?.addEventListener('click', () => {
      isMinimized = true;
      renderAssistantUI();
    });
    document.getElementById('pa-import-clipboard-btn')?.addEventListener('click', importFromClipboard);
  }

  function setupActiveEventHandlers() {
    document.getElementById('pa-theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('pa-minimize-btn')?.addEventListener('click', () => {
      isMinimized = true;
      renderAssistantUI();
    });

    document.getElementById('pa-prev-pin-btn')?.addEventListener('click', () => navigateQueue(-1));
    document.getElementById('pa-next-pin-btn')?.addEventListener('click', () => navigateQueue(1));

    const titleInput = document.getElementById('pa-input-title');
    const descInput = document.getElementById('pa-input-desc');
    const urlInput = document.getElementById('pa-input-url');
    const altInput = document.getElementById('pa-input-alt');
    const tagsInput = document.getElementById('pa-input-tags');

    const countTitle = document.getElementById('pa-count-title');
    const countDesc = document.getElementById('pa-count-desc');
    const countAlt = document.getElementById('pa-count-alt');
    const countTags = document.getElementById('pa-count-tags');

    function syncInputsToPin() {
      if (!currentPin) return;
      if (titleInput) currentPin.title = titleInput.value;
      if (descInput) currentPin.description = descInput.value;
      if (urlInput) {
        currentPin.url = urlInput.value;
        currentPin.destinationUrl = urlInput.value;
      }
      if (altInput) currentPin.altText = altInput.value;
      if (tagsInput) {
        currentPin.tags = tagsInput.value.split(/[,\n]+/).map(t => t.trim()).filter(Boolean);
      }
      if (pinQueue && pinQueue[queueIndex]) {
        pinQueue[queueIndex] = { ...pinQueue[queueIndex], ...currentPin };
      }
      saveCurrentPin();
    }

    titleInput?.addEventListener('input', () => {
      if (countTitle) countTitle.textContent = `${titleInput.value.length} / 100`;
      syncInputsToPin();
    });

    descInput?.addEventListener('input', () => {
      if (countDesc) countDesc.textContent = `${descInput.value.length} / 500`;
      syncInputsToPin();
    });

    urlInput?.addEventListener('input', () => {
      syncInputsToPin();
    });

    altInput?.addEventListener('input', () => {
      if (countAlt) countAlt.textContent = `${altInput.value.length} / 500`;
      syncInputsToPin();
    });

    tagsInput?.addEventListener('input', () => {
      const raw = tagsInput.value.split(/[,\n]+/).map(t => t.trim()).filter(Boolean);
      if (countTags) countTags.textContent = `${raw.length} tags`;
      syncInputsToPin();
    });

    document.getElementById('pa-toggle-tag-format')?.addEventListener('click', () => {
      tagFormat = tagFormat === 'comma' ? 'hashtag' : 'comma';
      renderAssistantUI();
    });

    // 1. Copy Title
    const btnTitle = document.getElementById('pa-btn-copy-title');
    btnTitle?.addEventListener('click', () => {
      syncInputsToPin();
      copyText(titleInput ? titleInput.value : currentPin?.title, btnTitle, '<span>📋 Copy Title</span>', 'Title');
    });

    // 2. Copy Description
    const btnDesc = document.getElementById('pa-btn-copy-desc');
    btnDesc?.addEventListener('click', () => {
      syncInputsToPin();
      copyText(descInput ? descInput.value : currentPin?.description, btnDesc, '<span>📋 Copy Description</span>', 'Description');
    });

    // 3. Copy Destination URL
    const btnUrl = document.getElementById('pa-btn-copy-url');
    btnUrl?.addEventListener('click', () => {
      syncInputsToPin();
      copyText(urlInput ? urlInput.value : (currentPin?.url || currentPin?.destinationUrl), btnUrl, '<span>📋 Copy Destination URL</span>', 'Destination URL');
    });

    // 4. Copy Alt Text
    const btnAlt = document.getElementById('pa-btn-copy-alt');
    btnAlt?.addEventListener('click', () => {
      syncInputsToPin();
      copyText(altInput ? altInput.value : currentPin?.altText, btnAlt, '<span>📋 Copy Alt Text</span>', 'Alt Text');
    });

    // 5. Copy Tags
    const btnTags = document.getElementById('pa-btn-copy-tags');
    btnTags?.addEventListener('click', () => {
      syncInputsToPin();
      copyText(tagsInput ? tagsInput.value : getTagsString(), btnTags, '<span>📋 Copy Tags</span>', 'Tags');
    });

    // Tag chip individual click
    document.querySelectorAll('.pa-tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.getAttribute('data-tag-idx'), 10);
        if (!isNaN(idx) && Array.isArray(currentPin?.tags) && currentPin.tags[idx]) {
          const tag = currentPin.tags[idx];
          const finalTag = tagFormat === 'hashtag' ? '#' + tag.replace(/\s+/g, '') : tag;
          chip.classList.add('copied');
          copyText(finalTag, null, '', `Tag "${finalTag}"`);
          setTimeout(() => chip.classList.remove('copied'), 1500);
        }
      });
    });

    // 6. Prominent Copy All
    const btnCopyAll = document.getElementById('pa-btn-copy-all');
    btnCopyAll?.addEventListener('click', () => {
      syncInputsToPin();
      copyAllMetadata(btnCopyAll);
    });

    // Copy All & Advance
    const btnCopyNext = document.getElementById('pa-btn-copy-and-next');
    btnCopyNext?.addEventListener('click', () => {
      syncInputsToPin();
      copyAllMetadata(btnCopyNext);
      if (queueIndex < pinQueue.length - 1) {
        setTimeout(() => {
          navigateQueue(1);
        }, 500);
      }
    });

    // Image actions
    document.getElementById('pa-copy-img-url-btn')?.addEventListener('click', () => {
      const url = currentPin?.imageUrl || currentPin?.image;
      if (url) {
        copyText(url, document.getElementById('pa-copy-img-url-btn'), '📋 Copy Image URL', 'Image URL');
      }
    });

    document.getElementById('pa-download-img-btn')?.addEventListener('click', () => {
      const url = currentPin?.imageUrl || currentPin?.image;
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = ((currentPin.title || 'pin').replace(/[^a-z0-9_-]/gi, '_')) + '.jpg';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showNotification('Downloading pin image...', 'success');
      }
    });

    document.getElementById('pa-import-clipboard-btn')?.addEventListener('click', importFromClipboard);
  }

  async function importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showNotification('Clipboard is empty', 'warn');
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        showNotification('Clipboard is not valid Pin JSON', 'error');
        return;
      }

      if (parsed && parsed.type === 'PIN_QUEUE' && Array.isArray(parsed.pins)) {
        pinQueue = parsed.pins;
        queueIndex = parsed.queueIndex || 0;
        currentPin = pinQueue[queueIndex] || null;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ pinQueue, queueIndex, activePin: currentPin, active_pinterest_pin: currentPin });
        }
        renderAssistantUI();
        showNotification(`Queue with ${pinQueue.length} pins loaded ✓`, 'success');
        return;
      }

      if (parsed && (parsed.type === 'PIN_DATA' || parsed.type === 'PIN_READY' || parsed.title || parsed.pinId)) {
        currentPin = {
          type: 'PIN_DATA',
          pinId: String(parsed.pinId || parsed.id || '1'),
          image: parsed.image || parsed.imageUrl || '',
          imageUrl: parsed.imageUrl || parsed.image || '',
          title: (parsed.title || '').trim(),
          description: (parsed.description || '').trim(),
          url: (parsed.url || parsed.destinationUrl || '').trim(),
          destinationUrl: (parsed.destinationUrl || parsed.url || '').trim(),
          tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean) : [],
          board: (parsed.board || parsed.boardName || '').trim(),
          altText: (parsed.altText || parsed.title || '').trim(),
          timestamp: Date.now()
        };

        saveCurrentPin();
        renderAssistantUI();
        showNotification('Pin #' + currentPin.pinId + ' imported ✓', 'success');
      } else {
        showNotification('Unrecognized Pin JSON format', 'warn');
      }
    } catch (err) {
      showNotification('Clipboard permission needed', 'error');
    }
  }

  let toastTimer = null;
  function showNotification(text, type = 'success') {
    const box = document.getElementById('pa-toast');
    if (!box) return;
    if (toastTimer) clearTimeout(toastTimer);

    box.style.background = type === 'warn' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#10b981';
    box.textContent = text;
    box.style.display = 'block';

    toastTimer = setTimeout(() => {
      box.style.display = 'none';
    }, 1500);
  }

  function setupDraggable() {
    const header = document.getElementById('pa-drag-header');
    if (!header || !rootContainer) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.onmousedown = function (e) {
      if (e.target.closest('.pa-icon-btn') || e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = rootContainer.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      rootContainer.style.bottom = 'auto';
      rootContainer.style.right = 'auto';
      rootContainer.style.left = initialLeft + 'px';
      rootContainer.style.top = initialTop + 'px';

      document.onmousemove = function (ev) {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let nextLeft = initialLeft + dx;
        let nextTop = initialTop + dy;

        nextLeft = Math.max(10, Math.min(window.innerWidth - 370, nextLeft));
        nextTop = Math.max(10, Math.min(window.innerHeight - 100, nextTop));

        rootContainer.style.left = nextLeft + 'px';
        rootContainer.style.top = nextTop + 'px';
      };

      document.onmouseup = function () {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
