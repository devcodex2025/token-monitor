function stripControlCharacters(input: string): string {
  return [...input]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0
      return code <= 0x1F || code === 0x7F ? ' ' : char
    })
    .join('')
}

/**
 * Guardrail for chain-sourced strings (PRD FR-E3): strip URLs and control characters,
 * cap length. Chain data is only ever injected into the user message, never the system prompt.
 */
export function sanitizeUserText(input: string, maxLength = 300): string {
  const withoutUrls = input.replaceAll(/https?:\/\/\S+/gi, '[link]')
  return stripControlCharacters(withoutUrls).slice(0, maxLength).trim()
}
