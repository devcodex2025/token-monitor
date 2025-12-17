import { PublicKey } from '@solana/web3.js';

export const validateSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const formatSolAmount = (lamports: number): string => {
  return (lamports / 1e9).toFixed(4);
};

export const formatTokenAmount = (amount: number, decimals: number = 6): string => {
  return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
