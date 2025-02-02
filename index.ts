import { Client } from './pg/postgres';

declare global {
  interface Request {
    cf: {
      latitude: string | null;
      longitude: string | null;
    };
  }
}

export interface Env {
  DB_USER: string;
  DB_PASSWORD: string;
  DB_HOST: string;
  DB_PORT?: number;
  DB_DATABASE?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 404 });

    const client = new Client({
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      hostname: env.DB_HOST,
      port: env.DB_PORT ?? 5432,
      database: env.DB_DATABASE ?? 'main',
    });
    
    await client.connect();
    const array_result = await client.queryArray("SELECT now()");
    ctx.waitUntil(client.end());

    return new Response(JSON.stringify({
      rows: array_result.rows,
      lat: request.cf.latitude,
      lng: request.cf.longitude,
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });

    /*
    // this example fetches a web page over https instead
    
    const host = 'neon.tech';
    const port = 443;
    const wsProxy = 'http://proxy.hahathon.monster/';

    const wsTls = await WsTls(host, port, wsProxy);
    wsTls.startTls();

    const getReqBuf = new TextEncoder()
      .encode(`GET / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);  // UTF8
    await wsTls.writeData(getReqBuf);

    const te = new TextDecoder();  // UTF8
    const data = new Uint8Array(16709);
    let html = '';
    while (true) {
      const bytesRead = await wsTls.readData(data);
      if (bytesRead <= 0) break;

      const str = te.decode(data.subarray(0, bytesRead));
      html += str;
    }

    return new Response(html, {
      headers: {
        'content-type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
      }
    });
    */
  },
};
