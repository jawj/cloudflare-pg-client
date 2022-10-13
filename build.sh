#!/usr/bin/env zsh

if [ "$1" != "quick" ]; then
  echo "Compiling BearSSL to WASM ..."
  emcc src/bearssl.c $(find ../BearSSL/src -name \*.c) \
    -I../BearSSL/inc -I../BearSSL/src \
    -o build/bearssl.js \
    -sEXPORTED_FUNCTIONS=_initTls,_writeData,_readData,_malloc,_free \
    -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
    -sASYNCIFY=1 -sDYNAMIC_EXECUTION=0 -sALLOW_MEMORY_GROWTH=1 \
    -sNO_FILESYSTEM=1 -sENVIRONMENT=web \
    -sMODULARIZE=1 -sEXPORT_NAME=bearssl_emscripten -flto \
    -Oz # -DCHATTY

  echo "Fixing up exports ..."
  sed \
    -e '2s/^var /export const /' \
    -e "/if (typeof exports === 'object' && typeof module === 'object')/,\$d" \
    -I '' build/bearssl.js
fi

echo "Building pg library ..."
(cd cloudflare-workers-postgres-client && ./build.sh)

echo "Copying to pg ..."
cp cloudflare-workers-postgres-client/build/postgres.js pg/postgres.js
cp build/bearssl.wasm pg/bearssl.wasm

echo "Fixing import ..."
sed \
  -e '2s|^|import bearsslwasm from "./bearssl.wasm";|' \
  -I '' pg/postgres.js

echo "Done."
