/**
 * Test environment helpers — save/restore process.env for isolated tests.
 */

export function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
    const value = overrides[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(overrides)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })
}

export const TEST_STATION_ID = '550e8400-e29b-41d4-a716-446655440001'
export const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440002'
export const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440003'
export const TEST_CAMPAIGN_ID = '550e8400-e29b-41d4-a716-446655440004'
