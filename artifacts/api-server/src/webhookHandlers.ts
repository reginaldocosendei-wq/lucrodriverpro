/**
 * WebhookHandlers — thin dispatcher.
 *
 * All webhook logic lives in PaymentService.handleStripeWebhook.
 * This class exists for backward compatibility with app.ts.
 */

import { paymentService } from "./paymentService";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    await paymentService.handleStripeWebhook(payload, signature);
  }
}
