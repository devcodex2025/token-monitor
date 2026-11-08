/**
 * MCP server (PRD FR-G4). Tools land in M5.4; tool catalogue scaffolded in M0.1.
 */
export const MCP_TOOLS = [
  'subscribe_token',
  'get_token_summary',
  'get_dev_history',
  'screen_new_tokens',
  'get_wallet_score',
] as const

export type McpTool = (typeof MCP_TOOLS)[number]
