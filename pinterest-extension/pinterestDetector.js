(function (global) {
  // Pinterest helper for clipboard-only assistant
  const PinterestDetector = {
    isPinCreationPage: function () {
      const url = window.location.href;
      return url.includes('/pin-builder') || url.includes('/pin-creation') || url.includes('/create');
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PinterestDetector };
  } else {
    global.PinterestDetector = PinterestDetector;
  }
})(typeof window !== 'undefined' ? window : this);
