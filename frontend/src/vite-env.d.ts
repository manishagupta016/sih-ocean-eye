/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Partial gl3d-only Plotly bundle (see src/lib/plot3d.tsx) - no published types; it satisfies the
// same runtime shape react-plotly.js expects from the full 'plotly.js' package.
declare module 'plotly.js-gl3d-dist-min'
