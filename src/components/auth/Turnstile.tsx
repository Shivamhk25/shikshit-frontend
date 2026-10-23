import { useEffect, useRef, useState, forwardRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  tabIndex?: number;
}

export interface TurnstileRef {
  reset: () => void;
}

const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  (
    {
      onVerify,
      onExpire,
      onError,
      theme = 'light',
      size = 'normal',
      tabIndex = 0,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<number | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
      const loadScript = () => {
        if (document.querySelector('script[src*="turnstile"]')) {
          setScriptLoaded(true);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => setScriptLoaded(true);
        script.onerror = () => console.error('Failed to load Turnstile script');
        document.head.appendChild(script);
      };

      loadScript();

      return () => {
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (!scriptLoaded || !containerRef.current || !window.turnstile) return;

      if (widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x0000000000000000000000000000000AA',
        theme,
        size,
        tabIndex,
        callback: (token: string) => {
          setToken(token);
          onVerify(token);
        },
        'expired-callback': () => {
          setToken(null);
          onExpire?.();
        },
        'error-callback': () => {
          setToken(null);
          onError?.();
        },
      });
    }, [scriptLoaded, theme, size, tabIndex, onVerify, onExpire, onError]);

    const reset = () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setToken(null);
      }
    };

    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref({ reset });
        } else {
          ref.current = { reset };
        }
      }
    }, [ref]);

    return (
      <>
        <div ref={containerRef} className="cf-turnstile" />
        <input type="hidden" name="cf-turnstile-response" value={token || ''} />
      </>
    );
  }
);

Turnstile.displayName = 'Turnstile';

export { Turnstile };

declare global {
  interface Window {
    turnstile: {
      render: (container: HTMLElement, options: any) => number;
      remove: (widgetId: number) => void;
      reset: (widgetId: number) => void;
      getResponse: (widgetId: number) => string;
    };
  }
}