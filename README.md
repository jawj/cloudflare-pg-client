# how to

## build

Steps:

1. `npm install && (cd cloudflare-workers-postgres-client && npm install)`

2. Install emscripten and activate via `source path/to/emsdk/emsdk_env.sh`. Note: emscripten currently bundles an outdated Node that isn't compatible with CloudFlare's `wrangler`, so you'll need to run that in a different shell.

3. In a directory adjacent to this one, get the BearSSL 0.6 source tree: `git clone https://www.bearssl.org/git/BearSSL`.

4. Back in this directory: `./build.sh`. Amongst other things, this runs `./build.sh` inside `cloudflare-workers-postgres-client`.
```

Notes on `build.sh`:

* For debugging, you can add `-DCHATTY` and/or remove `-O3` in the `emcc` command.

* `-sEXPORT_ES6` looks like a useful emscripten option, but creates problems in Cloudflare Workers. Instead, we hack in an `export` and delete the last few lines referring to `module.exports` etc.

## wsproxy

```
git clone https://github.com/petuhovskiy/wsproxy.git
LISTEN_PORT=:9090 go run main.go
```

## run

1. Check/change PG connection params in `wrangler.toml` plus password in `.dev.vars` or via `wrangler secret put`.

2. `npx wrangler dev` or `npx wrangler dev --local`


