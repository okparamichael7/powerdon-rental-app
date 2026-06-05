import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const SESSION_SELECT_MINIMAL = `
  *,
  user:users(*),
  reward:rewards!session_id(code, id, status)
`

async function main() {
  const { data: sessions, error: sessionsError } = await supabase
    .from('rental_sessions')
    .select(SESSION_SELECT_MINIMAL)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('sessions:', sessionsError?.message ?? `ok (${sessions?.length ?? 0} rows)`)

  const attempts = [
    'status, amount_charged, duration_minutes, deposit_amount',
    'status, duration_minutes, deposit_amount',
  ]
  for (const cols of attempts) {
    const { error } = await supabase.from('rental_sessions').select(cols)
    if (!error) {
      console.log('analytics metrics:', `ok via ${cols}`)
      break
    }
    console.log('analytics attempt failed:', error.message)
  }
}

main().catch(console.error)
