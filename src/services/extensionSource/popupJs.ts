export const popupJs = `
document.addEventListener('DOMContentLoaded', () => {
  let activePin = null;
  let pinQueue = [];
  let queueIndex = 0;
  let currentTheme = 'dark';

  const titleInput = document.getElementById('input-title');
  const descInput = document.getElementById('input-desc');
  const urlInput = document.getElementById('input-url');
  const altInput = document.getElementById('input-alt');
  const tagsInput = document.getElementById('input-tags');

  const countTitle = document.getElementById('count-title');
  const countDesc = document.getElementById('count-desc');
  const countAlt = document.getElementById('count-alt');
  const countTags = document.getElementById('count-tags');
  const cardPinId = document.getElementById('card-pin-id');

  let toastTimer = null;
  function showToast(text, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = text;
    toast.style.background = type === 'warn' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#10b981';
    toast.style.display = 'block';
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 1500);
  }

  function applyTheme(theme) {
    currentTheme = theme;
    const btn = document.getElementById('theme-btn');
    if (theme === 'light') {
      document.body.classList.add('theme-light');
      if (btn) btn.textContent = '☀️';
    } else {
      document.body.classList.remove('theme-light');
      if (btn) btn.textContent = '🌙';
    }
  }

  function updateCounts() {
    if (countTitle && titleInput) {
      countTitle.textContent = \`\${titleInput.value.length} / 100\`;
    }
    if (countDesc && descInput) {
      countDesc.textContent = \`\${descInput.value.length} / 500\`;
    }
    if (countAlt && altInput) {
      countAlt.textContent = \`\${altInput.value.length} / 500\`;
    }
    if (countTags && tagsInput) {
      const rawTags = tagsInput.value.split(/[,\\n]+/).map(t => t.trim()).filter(Boolean);
      countTags.textContent = \`\${rawTags.length} tags\`;
    }
  }

  function syncActivePinFromInputs() {
    if (!activePin) activePin = { type: 'PIN_DATA', pinId: '1' };
    if (titleInput) activePin.title = titleInput.value;
    if (descInput) activePin.description = descInput.value;
    if (urlInput) {
      activePin.url = urlInput.value;
      activePin.destinationUrl = urlInput.value;
    }
    if (altInput) activePin.altText = altInput.value;
    if (tagsInput) {
      activePin.tags = tagsInput.value.split(/[,\\n]+/).map(t => t.trim()).filter(Boolean);
    }
    if (pinQueue && pinQueue[queueIndex]) {
      pinQueue[queueIndex] = { ...pinQueue[queueIndex], ...activePin };
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ activePin, active_pinterest_pin: activePin, pinQueue });
    }
  }

  function renderPin() {
    if (!activePin) {
      if (cardPinId) cardPinId.textContent = 'No Pin Loaded';
      if (titleInput) titleInput.value = '';
      if (descInput) descInput.value = '';
      if (urlInput) urlInput.value = '';
      if (altInput) altInput.value = '';
      if (tagsInput) tagsInput.value = '';
      updateCounts();
      return;
    }

    if (cardPinId) cardPinId.textContent = 'Pin #' + (activePin.pinId || queueIndex + 1);
    if (titleInput) titleInput.value = activePin.title || '';
    if (descInput) descInput.value = activePin.description || '';
    if (urlInput) urlInput.value = activePin.url || activePin.destinationUrl || '';
    if (altInput) altInput.value = activePin.altText || '';
    if (tagsInput) {
      if (Array.isArray(activePin.tags)) {
        tagsInput.value = activePin.tags.join(', ');
      } else if (typeof activePin.tags === 'string') {
        tagsInput.value = activePin.tags;
      } else {
        tagsInput.value = '';
      }
    }

    updateCounts();

    const queueBox = document.getElementById('queue-container');
    if (pinQueue && pinQueue.length > 1) {
      if (queueBox) {
        queueBox.style.display = 'flex';
        const qStatus = document.getElementById('q-status-text');
        if (qStatus) qStatus.textContent = \`Pin \${queueIndex + 1} of \${pinQueue.length}\`;
        const prevBtn = document.getElementById('q-prev-btn');
        if (prevBtn) prevBtn.disabled = queueIndex === 0;
        const nextBtn = document.getElementById('q-next-btn');
        if (nextBtn) nextBtn.disabled = queueIndex >= pinQueue.length - 1;
      }
    } else if (queueBox) {
      queueBox.style.display = 'none';
    }
  }

  // Real-time live count updates and saving
  [titleInput, descInput, urlInput, altInput, tagsInput].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => {
      updateCounts();
      syncActivePinFromInputs();
    });
  });

  // Visual button feedback helper for 1.5s
  function triggerButtonCopied(btn, originalHtml, customToast) {
    btn.classList.add('copied');
    btn.innerHTML = '<span>✓ Copied</span>';
    showToast(customToast || '✓ Copied', 'success');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalHtml;
    }, 1500);
  }

  async function copyTextToClipboard(text, btn, originalHtml, label) {
    if (!text || !text.trim()) {
      showToast(\`\${label} is empty\`, 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      triggerButtonCopied(btn, originalHtml, \`✓ Copied \${label}\`);
    } catch (err) {
      // Fallback
      try {
        const temp = document.createElement('textarea');
        temp.value = text;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        triggerButtonCopied(btn, originalHtml, \`✓ Copied \${label}\`);
      } catch (e) {
        showToast('Clipboard copy failed', 'error');
      }
    }
  }

  // Copy Title
  const btnCopyTitle = document.getElementById('btn-copy-title');
  btnCopyTitle?.addEventListener('click', () => {
    syncActivePinFromInputs();
    const text = titleInput ? titleInput.value : (activePin?.title || '');
    copyTextToClipboard(text, btnCopyTitle, '<span>📋 Copy Title</span>', 'Title');
  });

  // Copy Description
  const btnCopyDesc = document.getElementById('btn-copy-desc');
  btnCopyDesc?.addEventListener('click', () => {
    syncActivePinFromInputs();
    const text = descInput ? descInput.value : (activePin?.description || '');
    copyTextToClipboard(text, btnCopyDesc, '<span>📋 Copy Description</span>', 'Description');
  });

  // Copy Destination URL
  const btnCopyUrl = document.getElementById('btn-copy-url');
  btnCopyUrl?.addEventListener('click', () => {
    syncActivePinFromInputs();
    const text = urlInput ? urlInput.value : (activePin?.url || activePin?.destinationUrl || '');
    copyTextToClipboard(text, btnCopyUrl, '<span>📋 Copy Destination URL</span>', 'Destination URL');
  });

  // Copy Alt Text
  const btnCopyAlt = document.getElementById('btn-copy-alt');
  btnCopyAlt?.addEventListener('click', () => {
    syncActivePinFromInputs();
    const text = altInput ? altInput.value : (activePin?.altText || '');
    copyTextToClipboard(text, btnCopyAlt, '<span>📋 Copy Alt Text</span>', 'Alt Text');
  });

  // Copy Tags
  const btnCopyTags = document.getElementById('btn-copy-tags');
  btnCopyTags?.addEventListener('click', () => {
    syncActivePinFromInputs();
    const text = tagsInput ? tagsInput.value : (Array.isArray(activePin?.tags) ? activePin.tags.join(', ') : '');
    copyTextToClipboard(text, btnCopyTags, '<span>📋 Copy Tags</span>', 'Tags');
  });

  // Prominent COPY ALL
  const btnCopyAll = document.getElementById('btn-copy-all');
  btnCopyAll?.addEventListener('click', () => {
    syncActivePinFromInputs();
    const title = titleInput ? titleInput.value : (activePin?.title || '');
    const description = descInput ? descInput.value : (activePin?.description || '');
    const destinationUrl = urlInput ? urlInput.value : (activePin?.url || activePin?.destinationUrl || '');
    const altText = altInput ? altInput.value : (activePin?.altText || '');
    const tags = tagsInput ? tagsInput.value : (Array.isArray(activePin?.tags) ? activePin.tags.join(', ') : '');

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
    ].filter(section => section && section.trim().length > 0).join('\\n\\n');

    copyTextToClipboard(allFormatted, btnCopyAll, '<span>⚡ COPY ALL</span>', 'All Metadata');
  });

  // Load initial state
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['activePin', 'active_pinterest_pin', 'pinQueue', 'queueIndex', 'theme'], (res) => {
      currentTheme = res?.theme || 'dark';
      applyTheme(currentTheme);
      pinQueue = Array.isArray(res?.pinQueue) ? res.pinQueue : [];
      queueIndex = typeof res?.queueIndex === 'number' ? res.queueIndex : 0;
      activePin = res?.activePin || res?.active_pinterest_pin || (pinQueue[queueIndex] || null);
      renderPin();
    });
  } else {
    applyTheme('dark');
    renderPin();
  }

  // Theme toggle
  document.getElementById('theme-btn')?.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ theme: nextTheme });
    }
  });

  // Queue Nav
  document.getElementById('q-prev-btn')?.addEventListener('click', () => {
    if (queueIndex > 0) {
      syncActivePinFromInputs();
      queueIndex--;
      activePin = pinQueue[queueIndex];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ queueIndex, activePin, active_pinterest_pin: activePin });
      }
      renderPin();
    }
  });

  document.getElementById('q-next-btn')?.addEventListener('click', () => {
    if (queueIndex < pinQueue.length - 1) {
      syncActivePinFromInputs();
      queueIndex++;
      activePin = pinQueue[queueIndex];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ queueIndex, activePin, active_pinterest_pin: activePin });
      }
      renderPin();
    }
  });

  // Import clipboard
  document.getElementById('btn-import-clipboard')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) { showToast('Clipboard is empty', 'warn'); return; }
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { showToast('Invalid Pin JSON in clipboard', 'warn'); return; }

      if (parsed && parsed.type === 'PIN_QUEUE' && Array.isArray(parsed.pins)) {
        pinQueue = parsed.pins;
        queueIndex = parsed.queueIndex || 0;
        activePin = pinQueue[queueIndex] || null;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ pinQueue, queueIndex, activePin, active_pinterest_pin: activePin }, () => {
            renderPin();
            showToast(\`✓ Loaded \${pinQueue.length} pins from queue\`, 'success');
          });
        } else {
          renderPin();
          showToast(\`✓ Loaded \${pinQueue.length} pins\`, 'success');
        }
        return;
      }

      if (parsed && (parsed.type === 'PIN_DATA' || parsed.type === 'PIN_READY' || parsed.title || parsed.pinId)) {
        activePin = {
          type: 'PIN_DATA',
          pinId: String(parsed.pinId || parsed.id || '1'),
          image: parsed.image || parsed.imageUrl || '',
          imageUrl: parsed.imageUrl || parsed.image || '',
          title: (parsed.title || '').trim(),
          description: (parsed.description || '').trim(),
          url: (parsed.url || parsed.destinationUrl || '').trim(),
          destinationUrl: (parsed.destinationUrl || parsed.url || '').trim(),
          tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).trim()).filter(Boolean) : [],
          board: (parsed.board || parsed.boardName || '').trim(),
          altText: (parsed.altText || parsed.title || '').trim(),
          timestamp: Date.now()
        };
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ activePin: activePin, active_pinterest_pin: activePin }, () => {
            renderPin();
            showToast(\`✓ Pin #\${activePin.pinId} loaded\`, 'success');
          });
        } else {
          renderPin();
          showToast(\`✓ Pin #\${activePin.pinId} loaded\`, 'success');
        }
      } else { showToast('Unrecognized Pin JSON format', 'warn'); }
    } catch (err) { showToast('Clipboard access required', 'warn'); }
  });

  // Open Pinterest Pin Builder
  document.getElementById('btn-open-pinterest')?.addEventListener('click', () => {
    const pinBuilderUrl = 'https://www.pinterest.com/pin-builder/';
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
        chrome.tabs.create({ url: pinBuilderUrl });
      } else {
        window.open(pinBuilderUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      window.open(pinBuilderUrl, '_blank', 'noopener,noreferrer');
    }
  });
});
`.trim();
