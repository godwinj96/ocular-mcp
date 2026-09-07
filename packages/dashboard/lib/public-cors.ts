// CORS for the two routes under app/api/public/* — the only dashboard
// endpoints a browser on a DIFFERENT origin (the website, a static Vite SPA)
// calls directly. Every other dashboard route is same-origin (the dashboard
// app itself) or server-to-server (mcp-server's internal calls, Bachs's
// webhook), neither of which needs CORS headers at all — this file exists
// because these two routes are the one real exception, not because CORS is
// a general dashboard concern.
const ALLOWED_ORIGINS = new Set([
  'https://useocular.dev',
  'http://localhost:5173', // website's Vite dev server default
]);

export function corsHeaders(requestOrigin: string | null): HeadersInit {
  const origin = requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : null;
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}
