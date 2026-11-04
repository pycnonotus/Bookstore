import { Router, raw } from "express";

export function stripeWebhookRouter(payments) {
    const router = Router();
    router.post("/", raw({ type: "application/json", inflate: false }), async (request, response) => {
        if (!payments) return response.status(503).json({ error: "Payments are temporarily unavailable." });
        let event;
        try {
            event = payments.verifyWebhook(request.body, request.get("Stripe-Signature"));
        } catch {
            return response.status(400).json({ error: "Invalid Stripe webhook signature." });
        }
        try {
            await payments.handleWebhook(event);
        } catch (error) {
            console.error("Stripe webhook processing failed", { type: error.type || error.name, code: error.code });
            return response.status(500).json({ error: "Could not process the Stripe event." });
        }
        response.json({ received: true });
    });
    return router;
}
