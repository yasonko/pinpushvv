// Ensure window.fetch has both getter and setter across all iframe environments
(function ensureFetchSetter() {
  try {
    if (typeof window !== 'undefined') {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
      if (descriptor && !descriptor.set && descriptor.get) {
        let currentFetch = window.fetch.bind(window);
        Object.defineProperty(window, 'fetch', {
          get() {
            return currentFetch;
          },
          set(val) {
            currentFetch = typeof val === 'function' ? val : currentFetch;
          },
          configurable: true,
          enumerable: true,
        });
      }
    }
  } catch (e) {
    // ignore
  }
})();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PasswordGate } from './components/Auth/PasswordGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </StrictMode>,
);
