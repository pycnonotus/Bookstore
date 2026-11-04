import { toNodeHandler } from "better-auth/node";

export function authHandler(auth) {
    const handler = toNodeHandler(auth);
    return (request, response) => {
        // Overwrite client input with the address resolved by Express's proxy policy.
        request.headers["x-bookstore-client-ip"] = request.ip;
        return handler(request, response);
    };
}
