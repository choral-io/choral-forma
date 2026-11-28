import { once } from "node:events";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
};

export async function startStaticServer(prefix, directory) {
    const server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            if (pathname === "/favicon.ico") {
                response.writeHead(204);
                response.end();
                return;
            }
            if (!pathname.startsWith(prefix + "/")) throw new Error("Outside root");
            let file = resolve(directory, pathname.slice(prefix.length + 1));
            if (file !== directory && !file.startsWith(directory + sep)) throw new Error("Outside site");
            if ((await stat(file)).isDirectory()) file = join(file, "index.html");
            response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
            response.end(await readFile(file));
        } catch {
            response.writeHead(404);
            response.end("Not found");
        }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = `http://127.0.0.1:${server.address().port}`;
    return { server, origin };
}

export async function closeStaticServer(server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
