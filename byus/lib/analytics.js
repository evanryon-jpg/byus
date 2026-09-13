import { track } from '@vercel/analytics/server';

// Analytics must never become a dependency of a customer-facing flow. Vercel event
// delivery is useful, but a temporary analytics outage must not fail account creation,
// Stripe onboarding, checkout, or webhook processing.
export async function trackServerEvent(eventName, properties = {}, request) {
  try {
    await track(eventName, properties, request ? { request } : undefined);
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warning',
      message: 'analytics_event_failed',
      eventName,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}
