#!/usr/bin/env zsh -e

# (1) download WolfSSL from GitHub releases and untar/unzip into `../wolfssl-5.5.1-stable`
# (2) install emscripten in `../emsdk`
# (3) `brew install autoconf automake libtool`
# (4) run this script

cd ../wolfssl-5.5.1-stable

echo "Patching wolfscript/src/random.c to use crypto.getRandomBytes() ..."
grep -Fq '<emscripten.h>' wolfcrypt/src/random.c || \
sed \
  -e '1s/^/#include <emscripten.h>\n/' \
  -e 's/#error "you need to write an os specific wc_GenerateSeed() here"/ \
    EM_JS(int, wc_GenerateSeed, (OS_Seed* os, byte* output, word32 sz), { \
        const entropy = new Uint8Array(sz); \
        crypto.getRandomValues(entropy); \
        Module.HEAPU8.set(entropy, output); \
        return 0; \
    }); \
  /' \
  -i.orig wolfcrypt/src/random.c

echo "Generating makefile ..."
./autogen.sh

echo "Configuring ..."
emconfigure ./configure \
  --disable-filesystem --disable-examples \
  --disable-oldtls --disable-tlsv12 \
  --enable-tls13 --enable-maxstrength --enable-sni --enable-altcertchains  \
  --disable-asm --enable-fastmath --enable-static --disable-shared \
  CFLAGS="-DWOLFSSL_USER_IO -DSINGLETHREADED -DWOLFSSL_TLS13_MIDDLEBOX_COMPAT -DWOLFSSL_NO_ASYNC_IO -DNO_PSK \
    -DNO_WRITEV -DNO_WOLFSSL_SERVER -DNO_ERROR_STRINGS -DNO_DEV_RANDOM -DNO_DEV_URANDOM \
    -Oz -I../emsdk/upstream/emscripten/cache/sysroot/include -flto"

echo "Building ..."
emmake make 
