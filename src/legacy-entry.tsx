import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './app/store';
import { AuthProvider } from './app/providers/AuthProvider';
import { SignalRProvider } from './app/providers/SignalRProvider';
import { App } from './app/App';
import './styles/global.css';

/** The previous app, kept behind VITE_LEGACY_UI=1 until the new shell replaces it screen by screen. */
export function mountLegacy(root: HTMLElement) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <AuthProvider>
            <SignalRProvider>
              <App />
            </SignalRProvider>
          </AuthProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>,
  );
}
