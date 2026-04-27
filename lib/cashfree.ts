import crypto from 'node:crypto'
import { Cashfree, CFEnvironment } from 'cashfree-pg'

function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID
  const secretKey = process.env.CASHFREE_SECRET_KEY
  const env = process.env.CASHFREE_ENV ?? 'SANDBOX'

  if (!appId || !secretKey) throw new Error('Cashfree credentials not configured.')

  return { appId, secretKey, env: env as 'SANDBOX' | 'PRODUCTION' }
}

function getClient() {
  const { appId, secretKey, env } = getCashfreeConfig()
  return new Cashfree(
    env === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    appId,
    secretKey
  )
}

export async function createPaymentSession(params: {
  orderId: string
  orderAmount: number
  customerEmail: string
  customerPhone: string
  customerName: string
  returnUrl: string
  notifyUrl?: string
  orderNote?: string
}) {
  const client = getClient()

  const request = {
    order_id: params.orderId,
    order_amount: params.orderAmount,
    order_currency: 'INR',
    order_note: params.orderNote ?? 'Imperial CRM Subscription',
    customer_details: {
      customer_id: params.customerEmail.replace(/[^a-zA-Z0-9]/g, '_'),
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone,
      customer_name: params.customerName,
    },
    order_meta: {
      return_url: params.returnUrl,
      notify_url: params.notifyUrl,
    },
  }

  const response = await client.PGCreateOrder(request)
  return response.data
}

export function verifyWebhookSignature(payload: string, timestamp: string, signature: string): boolean {
  const { secretKey } = getCashfreeConfig()
  const message = `${timestamp}${payload}`
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest('base64')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
