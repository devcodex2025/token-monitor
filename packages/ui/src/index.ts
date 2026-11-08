/**
 * Shared UI kit (PRD §3 / shadcn-based, "Terminal" theme). Components land in M1; scaffolded in M0.1.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
