import { Client } from '@bubblydoo/cloudflare-workers-postgres-client';
// import WsTls from './wstls';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;

	DB_USER: string;
	DB_PASSWORD: string;
	DB_HOST: string;
	DB_PORT?: number;
	DB_DATABASE?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		/*
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

		if (search.startsWith(param_name)) {
			let query = search.slice(param_name.length);
			console.log(`${query}`);

			const array_result = await client.queryArray(query);
			console.log(array_result.rows);

			await client.end();

			return new Response(JSON.stringify({
				original_query: query,
				rows: array_result.rows,
			}, null, 2));

		} else {
			const array_result = await client.queryArray("SELECT url FROM urls");
			console.log(array_result.rows);

			await client.end();

			return new Response(JSON.stringify({
				rows: array_result.rows,
				request
			}, null, 2));
		}

	},
};
