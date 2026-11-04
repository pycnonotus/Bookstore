import { fromNodeHeaders } from "better-auth/node";

export function requireAuth(auth) {
    return async (request, response, next) => {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
        if (!session) return response.status(401).json({ error: "Please log in to continue" });
        request.auth = session;
        next();
    };
}
