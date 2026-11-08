import type { Logger } from './types'

/**
 * Structured JSON logger (PRD §11). One JSON object per line.
 */
export function createJsonLogger(): Logger {
  const write = (level: string, fields: Record<string, unknown>, message?: string): void => {
    console.log(JSON.stringify({
      level,
      msg: message,
      time: new Date().toISOString(),
      ...fields,
    }))
  }

  return {
    info: (fields, message) => write('info', fields, message),
    warn: (fields, message) => write('warn', fields, message),
    error: (fields, message) => write('error', fields, message),
  }
}
