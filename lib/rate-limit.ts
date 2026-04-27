import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis is not configured.')
  return new Redis({ url, token })
}

function makeLimiter(requests: number, windowSeconds: number) {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds}s`),
    analytics: false,
  })
}

/** 100 mutation requests per minute per identifier */
export async function checkMutationLimit(identifier: string) {
  return makeLimiter(100, 60).limit(identifier)
}

/** 300 read requests per minute per identifier */
export async function checkReadLimit(identifier: string) {
  return makeLimiter(300, 60).limit(identifier)
}

/** 5 OTP requests per hour per email */
export async function checkOtpLimit(email: string) {
  return makeLimiter(5, 3600).limit(`otp:${email}`)
}

/** 10 login attempts per hour per IP */
export async function checkLoginLimit(ip: string) {
  return makeLimiter(10, 3600).limit(`login:${ip}`)
}
