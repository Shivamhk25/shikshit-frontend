import React from 'react';
import ReactDOM from 'react-dom/client';
import './shell.css';
import { BrowserRouter } from 'react-router-dom';
import { createWebSession } from './web-session';
import { ShellApp } from './ShellApp';

/** Entry for the new Shikshit web app. The legacy app stays available with VITE_LEGACY_UI=1. */
export function mountShell(root: HTMLElement) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <ShellApp session={createWebSession()} />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
