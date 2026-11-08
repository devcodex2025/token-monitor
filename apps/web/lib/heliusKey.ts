import { NextRequest } from 'next/server';

const toBase64 = (value: string) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }
  return btoa(value);
};

const fromBase64 = (value: string) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('utf8');
  }
  return atob(value);
};

export const encodeHeliusApiKey = (value: string) => toBase64(value);

export const decodeHeliusApiKey = (value: string) => {
  try {
    return fromBase64(value);
  } catch {
    return '';
  }
};

export const getHeliusApiKeyFromRequest = (req: NextRequest) => {
  const encoded = req.cookies.get('heliusApiKey')?.value;
  if (!encoded) return '';
  return decodeHeliusApiKey(encoded);
};
