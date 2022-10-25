#!/usr/bin/env zsh -e

if [ "$1" != "quick" ]; then
  echo "Compiling WolfSSL to WASM ..."
    emcc src/wolfssl.c \
      ../wolfssl-5.5.1-stable/wolfcrypt/src/*.o ../wolfssl-5.5.1-stable/src/*.o \
      -I../wolfssl-5.5.1-stable/ \
      -o build/tls.js \
      -sEXPORTED_FUNCTIONS=_initTls,_writeData,_readData,_pending,_shutdown,_malloc,_free \
      -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
      -sASYNCIFY=1 -sALLOW_MEMORY_GROWTH=1 -sDYNAMIC_EXECUTION=0 \
      -sNO_FILESYSTEM=1 -sENVIRONMENT=web \
      -sMODULARIZE=1 -sEXPORT_NAME=tls_emscripten \
      -Oz -flto # -DCHATTY -DUSESUBTLECB

  echo "Fixing up exports ..."
  sed \
    -e '2s/^var /export const /' \
    -e "/if (typeof exports === 'object' && typeof module === 'object')/,\$d" \
    -I '' build/tls.js
fi

echo "Building pg library ..."
(cd cloudflare-workers-postgres-client && ./build.sh)

echo "Copying to pg ..."
cp cloudflare-workers-postgres-client/build/postgres.js pg/postgres.js
cp build/tls.wasm pg/tls.wasm

echo "Fixing import ..."
sed \
  -e '2s|^|import tlswasm from "./tls.wasm";|' \
  -I '' pg/postgres.js

echo "Done."
