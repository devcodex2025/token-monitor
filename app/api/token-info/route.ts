import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const response = await axios.post(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        jsonrpc: '2.0',
        id: 'token-info',
        method: 'getAsset',
        params: {
          id: address,
        },
      }
    );

    if (response.data?.result) {
      const asset = response.data.result;
      const metadata = asset.content?.metadata;
      const links = asset.content?.links;

      return NextResponse.json({
        name: metadata?.name || 'Unknown Token',
        symbol: metadata?.symbol || 'UNKNOWN',
        image: links?.image || asset.content?.json_uri || '', // Fallback to json_uri if image link is missing, though usually image is in links or files
        decimals: asset.token_info?.decimals || 0,
      });
    }

    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json({ error: 'Failed to fetch token info' }, { status: 500 });
  }
}
