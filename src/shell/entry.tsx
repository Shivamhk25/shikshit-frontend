import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './shell.css';
import { BrowserRouter } from 'react-router-dom';
import { createWebSession } from './web-session';
import { ShellApp } from './ShellApp';
import { ConsoleApp } from '../console/ConsoleApp';
import { consoleBase } from '../console/platform-session';
import { SupportVisitApp } from './SupportVisit';

/** Entry for the Shikshit web app. Fonts are bundled with the app, so no request leaves for a font host. */
export function mountShell(root: HTMLElement) {
  // The Super Admin console (decision 0017) is served on console.<domain>; a school's own address never shows it.
  const base = consoleBase(window.location);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      {base !== null ? (
        <BrowserRouter basename={base || undefined}>
          <ConsoleApp />
        </BrowserRouter>
      ) : window.location.pathname === '/support-visit' ? (
        <BrowserRouter>
          <SupportVisitApp />
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <ShellApp session={createWebSession()} />
        </BrowserRouter>
      )}
    </React.StrictMode>,
  );
}
