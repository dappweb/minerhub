export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization,content-type,x-signature,x-nonce,x-wallet,x-request-id",
            "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS"
        }
    });
}
export function badRequest(message) {
    return json({ error: message }, 400);
}
export function unauthorized(message) {
    return json({ error: message }, 401);
}
export function notFound(message = "Not found") {
    return json({ error: message }, 404);
}
export function internalError(message = "Internal server error") {
    return json({ error: message }, 500);
}
