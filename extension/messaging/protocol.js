/**
 * Communication Protocol Constants and Validators for Pinterest Publishing Assistant
 */
(function (global) {
  const PROTOCOL = {
    // Message Types from Web App
    PIN_READY: 'PIN_READY',
    PING: 'PING_PINTEREST_ASSISTANT',
    REQUEST_NEXT_PIN: 'REQUEST_NEXT_PIN',

    // Message Types from Extension
    PONG: 'PONG_PINTEREST_ASSISTANT',
    EXTENSION_STATUS: 'EXTENSION_STATUS',
    PIN_PUBLISHED_ACK: 'PIN_PUBLISHED_ACK',

    // Extension States
    STATES: {
      WAITING_FOR_PINTEREST: 'WAITING_FOR_PINTEREST',
      PIN_PAGE_DETECTED: 'PIN_PAGE_DETECTED',
      FILLING: 'FILLING',
      READY_FOR_REVIEW: 'READY_FOR_REVIEW',
      ERROR: 'ERROR',
    },

    // Storage Keys
    STORAGE_KEYS: {
      ACTIVE_PIN: 'active_pinterest_pin',
      PIN_QUEUE: 'pinterest_pin_queue',
      LAST_STATUS: 'pinterest_last_status',
      SETTINGS: 'pinterest_assistant_settings',
    },

    // Validate incoming Pin Data
    validatePinData: function (data) {
      if (!data || typeof data !== 'object') return false;
      if (data.type !== 'PIN_READY') return false;
      if (!data.pinId || typeof data.pinId !== 'string') return false;
      return true;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PROTOCOL;
  } else {
    global.PinProtocol = PROTOCOL;
  }
})(typeof window !== 'undefined' ? window : this);
