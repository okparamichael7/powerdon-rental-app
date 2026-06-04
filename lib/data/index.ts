import { isMockDataEnabled } from '@/lib/services/config'
import * as apiLayer from './pwa-api'
import * as mockLayer from './mock-bridge'

/** Single PWA data plane — API-backed unless mock is explicitly enabled. */
export function getPwaDataLayer() {
  return isMockDataEnabled() ? mockLayer : apiLayer
}
