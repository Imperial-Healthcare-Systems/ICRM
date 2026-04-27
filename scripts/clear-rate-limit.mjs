// One-off: clears Upstash Ratelimit keys for a given email.
// Usage: node scripts/clear-rate-limit.mjs mehranischay9@gmail.com
import { readFileSync } from 'node:fs'
import { Redis } from '@upstash/redis'

// Load .env.local manually
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const email = process.argv[2]
if (!email) { console.error('Usage: node scripts/clear-rate-limit.mjs <email>'); process.exit(1) }

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const patterns = [
  `@upstash/ratelimit:otp:${email}*`,
  `otp:${email}*`,
]

let total = 0
for (const pattern of patterns) {
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
    cursor = String(next)
    if (keys.length) {
      await redis.del(...keys)
      total += keys.length
      console.log(`Deleted ${keys.length} keys matching ${pattern}`)
    }
  } while (cursor !== '0')
}

console.log(`\nDone. Cleared ${total} rate-limit keys for ${email}.`)
