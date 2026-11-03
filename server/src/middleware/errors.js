export function methodNotAllowed(_request, response) {
    response.set("Allow", "GET, HEAD").status(405).json({ error: "Method not allowed" });
}

export function notFound(_request, response) {
    response.status(404).json({ error: "Not found" });
}

export function errorHandler(error, _request, response, next) {
    console.error("Request failed:", error);
    if (response.headersSent) return next(error);
    response.status(500).json({ error: "Unable to load data" });
}
