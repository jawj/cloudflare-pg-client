import { Client } from '@bubblydoo/cloudflare-workers-postgres-client';

export interface Env {
	DB_USER: string;
	DB_PASSWORD: string;
	DB_HOST: string;
	DB_PORT?: number;
	DB_DATABASE?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const client = new Client({
			user: env.DB_USER,
			password: env.DB_PASSWORD,
			hostname: env.DB_HOST,
			port: env.DB_PORT ?? 5432,
			database: env.DB_DATABASE ?? 'main',
		});
		await client.connect();

		const url = new URL(request.url);
		const { pathname, search, href } = url;
		const param_name = "?query=";

		const array_result = await client.queryArray("SELECT 42");
		console.log(array_result.rows);

		await client.end();

		return new Response(JSON.stringify({
			rows: array_result.rows,
			request
		}, null, 2));


		/*
		// this example fetches a web page over https
		
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
				'X-Content-Type-Options': 'nosniff'
			}
		});
		*/
	},
};
