import * as apiLayer from './pwa-api'

export type { PublicSessionLookup } from './pwa-api'

/** PWA customer app always uses production APIs (no mock runtime). */
export function getPwaDataLayer() {
  return apiLayer
}
