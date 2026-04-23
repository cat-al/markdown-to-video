/**
 * html-server.mjs — Lightweight HTTP static server for html-ppt slides.
 *
 * Serves vendor/html-ppt assets and generated HTML slides so Playwright
 * can load them via http:// (avoids file:// font / Canvas security restrictions).
 */
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {join, extname, resolve} from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

/**
 * Start an HTTP static file server.
 *
 * @param {object} options
 * @param {string} options.rootDir — Filesystem root to serve from
 * @param {number} [options.port=0] — Port (0 = auto-assign)
 * @param {string} [options.host='127.0.0.1']
 * @returns {Promise<{server: import('node:http').Server, port: number, url: string, close: () => Promise<void>}>}
 */
export const startHtmlServer = ({rootDir, port = 0, host = '127.0.0.1'} = {}) => {
  const root = resolve(rootDir);

  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    const filePath = join(root, urlPath === '/' ? 'index.html' : urlPath);

    // Security: prevent path traversal
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  return new Promise((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = addr.port;
      const url = `http://${host}:${actualPort}`;
      resolvePromise({
        server,
        port: actualPort,
        url,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
};
