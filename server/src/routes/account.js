import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";

export function accountRouter(auth) {
    const router = Router();
    router.use(requireAuth(auth));
    router.get("/", (request, response) => {
        response.set("Cache-Control", "no-store").json({ user: request.auth.user });
    });
    return router;
}
