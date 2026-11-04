import { Router, json } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { createOrder, getOrder, listOrders, OrderError, validateOrder } from "../services/orders.js";

export function ordersRouter(db, auth, payments) {
    const router = Router();
    router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });
    router.use(requireAuth(auth));
    router.get("/", async (request, response) => response.json(await listOrders(db, request.auth.user.id)));
    const orderResponse = async request => ({ ...await getOrder(db, request.auth.user.id, request.params.id), checkoutAvailable: Boolean(payments) });
    router.get("/:id", async (request, response) => response.json(await orderResponse(request)));
    for (const action of ["checkout", "payment-status"]) {
        router.post(`/:id/${action}`, async (request, response) => {
            if (!auth.options.trustedOrigins.includes(request.get("Origin"))) return response.status(403).json({ error: "Untrusted request origin." });
            // Check ownership even when payment configuration is unavailable.
            await getOrder(db, request.auth.user.id, request.params.id);
            if (!payments) return response.status(503).json({ error: "Payments are temporarily unavailable. Please try again later." });
            try {
                if (action === "checkout") return response.json(await payments.checkout(request.auth.user.id, request.params.id));
                await payments.refresh(request.auth.user.id, request.params.id);
                response.json(await orderResponse(request));
            } catch (error) {
                if (error instanceof OrderError) throw error;
                console.error("Stripe request failed", { type: error.type || error.name, code: error.code });
                response.status(502).json({ error: "We could not confirm the payment with Stripe. Please try again." });
            }
        });
    }
    router.post("/", (request, response, next) => {
        if (!auth.options.trustedOrigins.includes(request.get("Origin"))) return response.status(403).json({ error: "Untrusted request origin." });
        if (!request.is("application/json")) return response.status(415).json({ error: "Send the order as JSON." });
        next();
    }, json({ limit: "32kb" }), async (request, response) => {
        const result = await createOrder(db, request.auth.user.id, validateOrder(request.body));
        response.status(result.created ? 201 : 200).location(`/api/orders/${result.order.id}`).json(result.order);
    });
    router.use((error, _request, response, next) => {
        if (error instanceof OrderError) return response.status(error.status).json({ error: error.message });
        if (error.type === "entity.parse.failed") return response.status(400).json({ error: "Invalid JSON." });
        if (error.type === "entity.too.large") return response.status(413).json({ error: "The order is too large." });
        next(error);
    });
    return router;
}
