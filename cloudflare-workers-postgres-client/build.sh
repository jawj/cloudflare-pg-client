#!/bin/bash
mkdir -p build

deno bundle https://deno.land/x/postgres@v0.16.1/mod.ts > build/postgres-deno.js
# until https://github.com/denodrivers/postgres/pull/411/files
sed \
-e '6938s/hash: "SHA-256"/hash: "SHA-256", length: 256/' \
-I '' build/postgres-deno.js

# deno bundle https://deno.land/std@0.138.0/async/deferred.ts > build/deferred.js
# deno bundle https://deno.land/std@0.138.0/io/buffer.ts > build/buffer.js
deno run --allow-all build-types.ts
node build.js
