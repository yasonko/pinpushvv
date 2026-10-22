(function (global) {
  'use strict';

  // Clipboard-only Pinterest assistant helper
  // DOM auto-pasting and field injection is disabled per policy-compliant clipboard workflow.
  const PinterestFiller = {
    copyFieldToClipboard: async function (text) {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(String(text));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PinterestFiller };
  } else {
    global.PinterestFiller = PinterestFiller;
  }
})(typeof window !== 'undefined' ? window : this);
