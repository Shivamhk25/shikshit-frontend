import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './shell.css';
import { BrowserRouter } from 'react-router-dom';
import { createWebSession } from './web-session';
import { ShellApp } from './ShellApp';

/** Entry for the Shikshit web app. Fonts are bundled with the app, so no request leaves for a font host. */
export function mountShell(root: HTMLElement) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <ShellApp session={createWebSession()} />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
