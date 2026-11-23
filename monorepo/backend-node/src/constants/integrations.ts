/**
 * External integration endpoints and identifiers.
 */

export const IntegrationUrls = {
  GOOGLE_OAUTH_TOKEN: 'https://oauth2.googleapis.com/token',
  FCM_SCOPE: 'https://www.googleapis.com/auth/firebase.messaging',
  FCM_SEND: (projectId: string) => `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
  WHATSAPP_MESSAGES: (phoneNumberId: string) => `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
  GOOGLE_MAPS_DIRECTIONS: (lat: number | string, lng: number | string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  GOOGLE_MAPS_SEARCH: (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
} as const;

export const Razorpay = {
  CURRENCY: 'INR',
  PAISE_PER_RUPEE: 100,
  EVENTS: { PAYMENT_CAPTURED: 'payment.captured', ORDER_PAID: 'order.paid', PAYMENT_FAILED: 'payment.failed', REFUND_PROCESSED: 'refund.processed' },
  STATUS: { CREATED: 'created', PAID: 'paid', FAILED: 'failed', REFUNDED: 'refunded' },
} as const;

export const TokenTtl = {
  GOOGLE_ACCESS_SECONDS: 3600,
  GOOGLE_REFRESH_MARGIN_MS: 60_000,
} as const;
