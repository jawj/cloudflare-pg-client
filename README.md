This repo patches the deno-postgres library to work within a Cloudflare Worker, by redirecting TCP traffic over a WebSocket.

Since a TLS connection is required for security, we support this by compiling either [BearSSL](https://bearssl.org/) or [WolfSSL](https://www.wolfssl.com/) to wasm using [emscripten](https://emscripten.org/).

In general, BearSSL is slightly smaller and slightly slower. In testing from the UK, BearSSL (using TLS 1.2 only) weighs in at 311 KB (JS + wasm) and a request to a worker that make a DB query takes around 1500ms, while WolfSSL (compiled for TLS 1.3 only) comes to 390 KB (JS + wasm) and a request takes around 1300ms. We are therefore favouring WolfSSL.

# HOW TO

## Build

Steps:

* Install the PG driver dependencies: `npm install && (cd cloudflare-workers-postgres-client && npm install)`

* Install emscripten in an directory adjacent to this one, and activate it: `source ../emsdk/emsdk_env.sh`. 

_Note: emscripten currently bundles an outdated Node that isn't compatible with `wrangler`, so you'll later need to run `wrangler` in a different shell._

### With BearSSL

* In a directory adjacent to this one, get the BearSSL 0.6 source tree: `git clone https://www.bearssl.org/git/BearSSL`.

* Back in this directory, run `./buildbear.sh`. Amongst other things, this runs `./build.sh` inside `cloudflare-workers-postgres-client`.

### With WolfSSL

* In a directory adjacent to this one, get the [WolfSSL 5.5.1 release](https://github.com/wolfSSL/wolfssl/releases).

* Install some build tools as necessary: `brew install autoconf automake libtool`.

* Back in this directory, run `./buildwolflib.sh`.

* Lastly, run `./buildwolf.sh`. Amongst other things, this runs `./build.sh` inside `cloudflare-workers-postgres-client`.


*Notes on the build scripts:*

* In both cases, the final build product you need is just two files: `pg/postgres.js` and `pg/tls.wasm`.

* To skip the emscripten step (if nothing changed there) and build only the TS/JS elements, use `./buildwolf.sh quick` or `./buildbear.sh quick`.

* For debugging purposes, you can edit the `build*.sh` files to add `-DCHATTY` (which dumps all read/write data in hex) and/or remove `-Oz` in the `emcc` command. Wireshark may also prove useful.

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


