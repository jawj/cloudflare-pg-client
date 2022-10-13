# HOW TO

## Build

Steps:

1. Install the PG driver dependencies: `npm install && (cd cloudflare-workers-postgres-client && npm install)`

2. Install emscripten and activate via `source path/to/emsdk/emsdk_env.sh`. _Note: emscripten currently bundles an outdated Node that isn't compatible with `wrangler`, so you'll later need to run `wrangler` in a different shell._

3. In a directory adjacent to this one, get the BearSSL 0.6 source tree: `git clone https://www.bearssl.org/git/BearSSL`.

4. Back in this directory: `./build.sh`. Amongst other things, this runs `./build.sh` inside `cloudflare-workers-postgres-client`.

Notes on `build.sh`:

* To build only the TS/JS parts, use `./build.sh quick`.

* For debugging purposes, you can edit the file to add `-DCHATTY` (which dumps all read/write data in hex) and/or remove `-Oz` in the `emcc` command. Wireshark may also prove useful.

* Emscripten's `-sEXPORT_ES6` option looks like it should be useful, but it creates problems in Cloudflare Workers, so we don't use it. Instead, we use `sed` to hack in an `export` and delete the last few lines referring to `module.exports` etc.

## wsproxy

You need an instance of `wsproxy` running to forward WebSocket traffic over TCP. To run this locally:

```
git clone https://github.com/petuhovskiy/wsproxy.git
LISTEN_PORT=:9090 go run main.go
```

The `wsproxy` URL is currently hard-coded near the bottom of `cloudflare-workers-postgres-client/workers-override.ts`.

## Run

1. Check/change PG connection params in `wrangler.toml` plus password in `.dev.vars` or via `wrangler secret put DB_PASSWORD`.

2. (In a non-emscriptened shell) `npx wrangler dev` or `npx wrangler dev --local`


