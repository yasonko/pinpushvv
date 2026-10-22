(function (global) {
  // Selectors reference for Pinterest URL routing
  const PinterestSelectors = {
    PIN_BUILDER_URL: 'https://www.pinterest.com/pin-builder/'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PinterestSelectors;
  } else {
    global.PinterestSelectors = PinterestSelectors;
  }
})(typeof window !== 'undefined' ? window : this);
