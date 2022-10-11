# how to

## emscripten

**Note: emscripten currently bundles an outdated Node that isn't compatible with Wrangler.**

In a directory adjacent to this one, get the BearSSL 0.6 source tree: `git clone https://www.bearssl.org/git/BearSSL`.

Then, back in this directory:

```bash
source path/to/emsdk/emsdk_env.sh

emcc wstls/bearssl.c $(find ../BearSSL/src -name \*.c) \
  -I../BearSSL/inc -I../BearSSL/src \
  -o worker/bearssl.js \
  -sEXPORTED_FUNCTIONS=_initTls,_writeData,_readData \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
  -sASYNCIFY=1 -sDYNAMIC_EXECUTION=0 -sALLOW_MEMORY_GROWTH=1 \
  -sNO_FILESYSTEM=1 -sENVIRONMENT=web \
  -sMODULARIZE=1 -sEXPORT_NAME=bearssl_emscripten -O3 -DCHATTY=1

sed \
  -e '2s/^var /export const /' \
  -e "/if (typeof exports === 'object' && typeof module === 'object')/,\$d" \
  -I '' worker/bearssl.js
```

For debugging, you can add `-DCHATTY` and/or remove `-O3` in the `emcc` command above.

Note: `-sEXPORT_ES6` looks like what we want, but creates problems in Cloudflare Workers. Instead, we hack in an `export` and delete the last few lines referring to `module.exports` etc.

## wsproxy

```
git clone https://github.com/petuhovskiy/wsproxy.git
LISTEN_PORT=:9090 go run main.go
```

## finally

1. `npm install && cd cloudflare-workers-postgres-client && npm install && ./build.sh`

2. change connstr in `src/index.ts`

3. `wrangler dev` and it should work

