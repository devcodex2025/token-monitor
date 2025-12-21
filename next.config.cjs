/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: [
      'ipfs.io', 
      'arweave.net', 
      'shdw-drive.genesysgo.net', 
      'cf-ipfs.com', 
      'nftstorage.link', 
      'pump.fun', 
      'gateway.pinata.cloud', 
      'raw.githubusercontent.com', 
      'img.raydium.io', 
      'cryptologos.cc', 
      'static.okx.com', 
      'jup.ag'
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: 'shdw-drive.genesysgo.net' },
      { protocol: 'https', hostname: 'cf-ipfs.com' },
      { protocol: 'https', hostname: 'nftstorage.link' },
      { protocol: 'https', hostname: 'pump.fun' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'img.raydium.io' },
      { protocol: 'https', hostname: 'cryptologos.cc' },
      { protocol: 'https', hostname: 'static.okx.com' },
      { protocol: 'https', hostname: 'jup.ag' }
    ],
  },
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })
    return config
  },
}

module.exports = nextConfig
