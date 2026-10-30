/// <reference types="vite/client" />

// Set at build time in vite.config.ts.
declare const __APP_VERSION__: string; // the Python engine's version
declare const __BUILD_SHA__: string; // the commit the page was built from
declare const __BUILD_DATE__: string; // YYYY-MM-DD, UTC
