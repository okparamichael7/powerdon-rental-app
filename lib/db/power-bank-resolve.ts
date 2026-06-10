import {
  isPowerBankUuid,
  normalizeTerminalExternalId,
  powerBankRepository,
} from './power-bank-repository'

export { isPowerBankUuid, normalizeTerminalExternalId }

/**
 * Resolve power_banks.id UUID from either a UUID or WsCharge terminal hex.
 * Never writes terminal hex into UUID FK columns (avoids Postgres 22P02).
 */
export async function resolveDbPowerBankId(
  terminalOrUuid: string,
  ctx?: {
    stationId?: string
    slotNumber?: number
    batteryLevel?: number
  },
): Promise<string | null> {
  return powerBankRepository.resolveDbPowerBankId(terminalOrUuid, ctx)
}
