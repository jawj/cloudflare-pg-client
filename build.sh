#!/usr/bin/env zsh

if [ "$1" != "quick" ]; then
  echo "Compiling BearSSL to WASM ..."
  emcc wstls/bearssl.c $(find ../BearSSL/src -name \*.c) \
    -I../BearSSL/inc -I../BearSSL/src \
    -o worker/bearssl.js \
    -sEXPORTED_FUNCTIONS=_initTls,_writeData,_readData,_malloc,_free \
    -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
    -sASYNCIFY=1 -sDYNAMIC_EXECUTION=0 -sALLOW_MEMORY_GROWTH=1 \
    -sNO_FILESYSTEM=1 -sENVIRONMENT=web \
    -sMODULARIZE=1 -sEXPORT_NAME=bearssl_emscripten -O3 # -DCHATTY

  echo "Fixing up exports ..."
  sed \
    -e '2s/^var /export const /' \
    -e "/if (typeof exports === 'object' && typeof module === 'object')/,\$d" \
    -I '' worker/bearssl.js
fi

echo "Building pg library ..."
(cd cloudflare-workers-postgres-client && ./build.sh)

echo "Fixing import ..."
sed \
  -e '2s|^|import bearsslwasm from "../../worker/bearssl.wasm";|' \
  -I '' cloudflare-workers-postgres-client/build/postgres.js

echo "Done."
