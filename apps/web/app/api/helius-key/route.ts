import { NextRequest, NextResponse } from 'next/server';
import { decodeHeliusApiKey, encodeHeliusApiKey } from '@/lib/heliusKey';

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const trimmed = apiKey.trim();
    const response = NextResponse.json({ success: true });
    response.cookies.set('heliusApiKey', encodeHeliusApiKey(trimmed), {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });
    return response;
  } catch (error) {
    console.error('Failed to store Helius API key:', error);
    return NextResponse.json({ error: 'Failed to store API key' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const encoded = req.cookies.get('heliusApiKey')?.value;
  const hasKey = Boolean(encoded);
  const reveal = req.nextUrl.searchParams.get('reveal');

  if (hasKey && reveal === '1') {
    return NextResponse.json({ hasKey, apiKey: decodeHeliusApiKey(encoded || '') });
  }

  return NextResponse.json({ hasKey });
}

export async function DELETE() {
  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ success: true });
  response.cookies.set('heliusApiKey', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
