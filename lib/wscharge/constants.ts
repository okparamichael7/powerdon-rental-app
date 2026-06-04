/**
 * WsCharge Protocol v5.8P constants (Shenzhen Worthy Network Technology Co.)
 * Source: WsCharge Communication Protocol.md
 */

export const WSCHARGE_PROTOCOL_VERSION = '5.8P' as const

/** Fixed session token (Uint32 BE 0x11223344) — both directions per spec §2.1 */
export const WSCHARGE_PROTOCOL_VSN = 0x01

/** Cabinet heartbeat interval after login (seconds) */
export const WSCHARGE_HEARTBEAT_INTERVAL_SEC = 30

/** Server marks station offline after 4 missed heartbeats (4 × 30s) */
export const WSCHARGE_HEARTBEAT_MISSED_BEFORE_OFFLINE = 4

export const WSCHARGE_HEARTBEAT_STALE_MS =
  WSCHARGE_HEARTBEAT_INTERVAL_SEC * WSCHARGE_HEARTBEAT_MISSED_BEFORE_OFFLINE * 1000

/** Default command timeout waiting for cabinet response */
export const WSCHARGE_COMMAND_TIMEOUT_MS = 30_000

/** TCP proxy default port */
export const WSCHARGE_DEFAULT_TCP_PORT = 8088
