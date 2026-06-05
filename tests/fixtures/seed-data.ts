/**
 * Deterministic seed identifiers for integration/E2E tests.
 * Use with factories — does not write to DB directly.
 */

export const SEED = {
  customer: {
    email: 'seed.customer@powerdon.test',
    name: 'Seed Customer',
    phone: '+491701111111',
  },
  admin: {
    email: 'seed.admin@powerdon.test',
  },
  operator: {
    email: 'seed.operator@powerdon.test',
  },
  station: {
    id: '550e8400-e29b-41d4-a716-446655440010',
    externalId: 'SEEDST01',
    name: 'Seed Test Station',
  },
  campaign: {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Seed Campaign',
  },
  session: {
    id: '550e8400-e29b-41d4-a716-446655440012',
    code: 'SEED0001',
  },
} as const

export const STRIPE_TEST_CARD = {
  number: '4242424242424242',
  exp: '12/34',
  cvc: '123',
} as const
