import { NextResponse } from 'next/server';

export async function GET() {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const apiKeys = keysStr
    .split(',')
    .map(k => k.trim())
    .filter(k => k && k !== 'YOUR_GEMINI_API_KEY');
  const isMock = apiKeys.length === 0;

  const response = NextResponse.json({ status: 'ok', mock: isMock });
  response.headers.set('X-Mock-AI', isMock ? 'true' : 'false');
  return response;
}
