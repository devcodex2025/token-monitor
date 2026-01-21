// Transaction type filter options
export type TransactionType = 'BUY' | 'SELL' | 'ADD_LIQUIDITY' | 'REMOVE_LIQUIDITY' | 'CREATE_POOL' | 'CLAIM_FEES' | 'TRANSFER' | 'UNKNOWN';

export const TRANSACTION_TYPES: { value: TransactionType; label: string; emoji: string }[] = [
  { value: 'BUY', label: 'Buy', emoji: '📈' },
  { value: 'SELL', label: 'Sell', emoji: '📉' },
  { value: 'ADD_LIQUIDITY', label: 'Add LP', emoji: '💧' },
  { value: 'REMOVE_LIQUIDITY', label: 'Remove LP', emoji: '💧' },
  { value: 'CREATE_POOL', label: 'Create Pool', emoji: '🆕' },
  { value: 'CLAIM_FEES', label: 'Claim Fees', emoji: '💰' },
  { value: 'TRANSFER', label: 'Transfer', emoji: '↔️' },
];

export interface DexInfoItem {
  name: string;
  logo?: string;
  color?: string;
}

// DEX Configuration
export const DEX_INFO: Record<string, DexInfoItem> = {
  'JUPITER': { 
    name: 'Jupiter', 
    logo: 'https://jup.ag/svg/jupiter-logo.svg',
    color: '#16a34a' // green-600
  },
  'PUMP.FUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'RAYDIUM': { 
    name: 'Raydium', 
    logo: 'https://img.raydium.io/logo/raydium_logo.png',
    color: '#2563eb' // blue-600
  },
  'ORCA': { 
    name: 'Orca', 
    logo: 'https://cryptologos.cc/logos/orca-orca-logo.png?v=035',
    color: '#f59e0b' // amber-500
  },
  'PUMPFUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP.FUN AMM': { 
    name: 'Pump.fun AMM', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP_FUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP_FUN_AMM': { 
    name: 'Pump.fun AMM', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'PUMP FUN': { 
    name: 'Pump.fun', 
    logo: 'https://pump.fun/logo.png',
    color: '#10b981' // emerald-500
  },
  'OKX_DEX_ROUTER': { 
    name: 'OKX DEX', 
    logo: '/logos/okx.webp',
    color: '#ffffff'
  },
  'OKX DEX': { 
    name: 'OKX DEX', 
    logo: '/logos/okx.webp',
    color: '#ffffff'
  },
  'METEORA DLMM': {  
    name: 'Meteora DLMM', 
    logo: '/logos/meteora-logo.svg',
    color: '#9333ea' // purple-600
  },
  'METEORA': { 
    name: 'Meteora DLMM', 
    logo: '/logos/meteora-logo.svg',
    color: '#9333ea' // purple-600
  },
  'METEORA_DAMM_V2': { 
    name: 'Meteora DAMM v2', 
    logo: '/logos/meteora-logo.svg',
    color: '#9333ea' // purple-600
  },
  'DFlow': {
    name: 'DFlow',
    logo: '/logos/dflow.svg',
    color: '#FF4F98'
  },
  'DFLOW': {
    name: 'DFlow',
    logo: '/logos/dflow.svg',
    color: '#FF4F98'
  },
  'ONCHAIN LABS': {
    name: 'Onchain Labs',
    logo: '/logos/okx.webp', // Using OKX logo as fallback since it's related to OKX DEX
    color: '#ffffff'
  },
  'BAGS': {
    name: 'Bags',
    logo: '/logos/bags-logo.png',
    color: '#000000'
  },
  'PHANTOM': {
    name: 'Phantom',
    logo: '/logos/phantom.svg',
    color: '#AB9FF2'
  },
};

// Deduplicated DEX list for filter UI
export const UNIQUE_DEX_LIST = Object.values(DEX_INFO).reduce((acc, current) => {
  if (!acc.find(item => item.name === current.name)) {
    acc.push(current);
  }
  return acc;
}, [] as DexInfoItem[]);
