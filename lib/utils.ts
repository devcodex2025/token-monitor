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

export const formatSolAmount = (amount: number): string => {
  // Use toPrecision for significant digits instead of toFixed to avoid rounding
  // This preserves the actual value like 0.04995 instead of rounding to 0.0500
  if (amount === 0) return '0.0000';
  
  // For very small amounts, show more precision
  if (amount < 0.0001) {
    return amount.toPrecision(4);
  }
  
  // For normal amounts, show up to 5 decimal places without trailing zeros
  return Number(amount.toFixed(5)).toString();
};

export const formatTokenAmount = (amount: number, decimals: number = 6): string => {
  return (amount / Math.pow(10, decimals)).toLocaleString('en-US', {
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

export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const timeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  
  return Math.floor(seconds) + "s ago";
};
