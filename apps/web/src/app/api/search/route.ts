import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return Response.json({ error: 'Quill API URL is not configured.' }, { status: 503 });
  const body = await request.text();
  const authorization = request.headers.get('authorization');
  const upstream = await fetch(`${apiUrl.replace(/\/$/, '')}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { authorization } : {}) },
    body,
    cache: 'no-store',
  });
  if (!upstream.body) return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' } });
  return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } });
}
