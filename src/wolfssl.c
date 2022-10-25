#include <emscripten.h>
#include <stdio.h>
#include <wolfssl/options.h>
#include <wolfssl/ssl.h>

#ifdef USESUBTLECB
#include <wolfssl/wolfcrypt/cryptocb.h>
#endif

byte rootCert[] =
    "-----BEGIN CERTIFICATE-----\n"
    "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\n"
    "-----END CERTIFICATE-----\n";

WOLFSSL_CTX *ctx = NULL;
WOLFSSL *ssl = NULL;
int ret;
size_t len;

EM_ASYNC_JS(int, jsProvideEncryptedFromNetwork, (char *buff, int sz), {
    const bytesRead = await Module.provideEncryptedFromNetwork(buff, sz);
    return bytesRead;
});

EM_JS(int, jsWriteEncryptedToNetwork, (char *buff, int sz), {
    const bytesWritten = Module.writeEncryptedToNetwork(buff, sz);
    return bytesWritten;
});

int my_IORecv(WOLFSSL *ssl, char *buff, int sz, void *ctx) {
    int recvd = jsProvideEncryptedFromNetwork(buff, sz);
    if (recvd == -1) {
        fprintf(stderr, "General error\n");
        return WOLFSSL_CBIO_ERR_GENERAL;
    }
    if (recvd == 0) return WOLFSSL_CBIO_ERR_CONN_CLOSE;

    #ifdef CHATTY
        printf("%s", "recv:");
        for (int i = 0; i < sz; i++) printf(" %02x", (byte)buff[i]);
        puts("");
        printf("received %d bytes from JS\n\n", recvd);
    #endif
    
    return recvd;
}

int my_IOSend(WOLFSSL *ssl, char *buff, int sz, void *ctx) {
    #ifdef CHATTY
        printf("%s", "send:");
        for (int i = 0; i < sz; i++) printf(" %02x", (byte)buff[i]);
        puts("");
    #endif

    int sent = jsWriteEncryptedToNetwork(buff, sz);

    #ifdef CHATTY
        printf("sent %d bytes to JS\n", sz);
    #endif

    return sent;
}

void cleanup() {
    if (ssl) {
        wolfSSL_free(ssl);
        ssl = NULL;
    }
    if (ctx) {
        wolfSSL_CTX_free(ctx);
        ctx = NULL;
    }
    wolfSSL_Cleanup();
}

EM_ASYNC_JS(void, jsSha, (int shaVersion, const byte *buffDataIn, int sz, byte *buffDigest), {
    #ifdef CHATTY
        console.log('crypto.subtle SHAx', digestType, buffDataIn, sz, buffDigest);
    #endif
    if (buffDataIn !== 0) {  // writing data
        if (Module._digestStream == null) {  // deliberate loose equality
            const stream = new crypto.DigestStream(`SHA-${shaVersion}`);
            const writer = stream.getWriter();
            Module._digestStream = { stream, writer };
        }
        const arrDataIn = Module.HEAPU8.subarray(buffDataIn, buffDataIn + sz);
        await Module._digestStream.writer.write(arrDataIn);

    } else {  // getting digest
        const { stream, writer } = Module._digestStream;
        await writer.close();
        const digest = await stream.digest;
        const arrDigest = new Uint8Array(digest);
        Module.HEAPU8.set(arrDigest, buffDigest);
        Module._digestStream = null;
    } 
});

EM_ASYNC_JS(void, jsAesGcmEncrypt, (
        const byte *dataBuff, 
        int dataSz, 
        const byte *keyBuff, 
        int keySize, 
        const byte *ivBuff, 
        int ivSz, 
        const byte *authInBuff, 
        int authInSz, 
        byte *authTagBuff, 
        int authTagSz, 
        byte *outBuff
    ), {
    #ifdef CHATTY
        console.log('crypto.subtle encrypt');
    #endif

    const iv = Module.HEAPU8.subarray(ivBuff, ivBuff + ivSz);
    const tagLength = authTagSz << 3;  // WolfSSL uses bytes, JS uses bits
    const additionalData = Module.HEAPU8.subarray(authInBuff, authInBuff + authInSz);
    const algorithm = { name: 'AES-GCM', iv, tagLength, additionalData };

    const keyData = Module.HEAPU8.subarray(keyBuff, keyBuff + keySize);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);

    const data = Module.HEAPU8.subarray(dataBuff, dataBuff + dataSz);
    const resultArrBuff = await crypto.subtle.encrypt(algorithm, key, data);

    const result = new Uint8Array(resultArrBuff);
    const cipherText = result.subarray(0, dataSz);
    const authTag = result.subarray(dataSz);
    Module.HEAPU8.set(cipherText, outBuff);
    Module.HEAPU8.set(authTag, authTagBuff);
});

EM_ASYNC_JS(int, jsAesGcmDecrypt, (
        const byte *dataBuff, 
        int dataSz, 
        const byte *keyBuff, 
        int keySize, 
        const byte *ivBuff, 
        int ivSz, 
        const byte *authInBuff, 
        int authInSz, 
        const byte *authTagBuff, 
        int authTagSz, 
        byte *outBuff
    ), {
    #ifdef CHATTY
        console.log('crypto.subtle decrypt');
    #endif

    const iv = Module.HEAPU8.subarray(ivBuff, ivBuff + ivSz);
    const tagLength = authTagSz << 3;  // WolfSSL uses bytes, JS uses bits
    const additionalData = Module.HEAPU8.subarray(authInBuff, authInBuff + authInSz);
    const algorithm = { name: 'AES-GCM', iv, tagLength, additionalData };

    const keyData = Module.HEAPU8.subarray(keyBuff, keyBuff + keySize);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

    const data = Module.HEAPU8.subarray(dataBuff, dataBuff + dataSz);
    const authTag = Module.HEAPU8.subarray(authTagBuff, authTagBuff + authTagSz);
    const taggedData = new Uint8Array(dataSz + authTagSz);
    taggedData.set(data);
    taggedData.set(authTag, dataSz);
    try {
        const resultArrBuff = await crypto.subtle.decrypt(algorithm, key, taggedData);
        const plainText = new Uint8Array(resultArrBuff);
        Module.HEAPU8.set(plainText, outBuff);
        return 0;

    } catch(err) {
        console.log("decrypt error:", err.message);
        return -1;
    }    
});

#ifdef USESUBTLECB
    int cryptCb(int devId, wc_CryptoInfo *info, void* ctx) {
        // TODO: test for WC_ALGO_TYPE_SEED here instead of patching WolfSSL source?
        if (info->algo_type == WC_ALGO_TYPE_CIPHER && info->cipher.type == WC_CIPHER_AES_GCM) {
            if (info->cipher.enc == 1) {
                #ifdef CHATTY
                    printf("AES_GCM  enc: %i  rounds: %i  keylen: %i  out: %p  in: %p  sz: %i  iv: %p  ivSz: %i  authTag: %p  authTagSz: %i  authIn: %p  authInSz: %i\n", 
                    info->cipher.enc, 
                    info->cipher.aesgcm_enc.aes->rounds,
                    info->cipher.aesgcm_enc.aes->keylen,
                    info->cipher.aesgcm_enc.out,
                    info->cipher.aesgcm_enc.in,
                    info->cipher.aesgcm_enc.sz,
                    info->cipher.aesgcm_enc.iv,
                    info->cipher.aesgcm_enc.ivSz,
                    info->cipher.aesgcm_enc.authTag,
                    info->cipher.aesgcm_enc.authTagSz,
                    info->cipher.aesgcm_enc.authIn,
                    info->cipher.aesgcm_enc.authInSz
                    );
                #endif

                jsAesGcmEncrypt(
                    info->cipher.aesgcm_enc.in, 
                    info->cipher.aesgcm_enc.sz, 
                    (byte *)info->cipher.aesgcm_enc.aes->devKey, 
                    info->cipher.aesgcm_enc.aes->keylen,
                    info->cipher.aesgcm_enc.iv, 
                    info->cipher.aesgcm_enc.ivSz, 
                    info->cipher.aesgcm_enc.authIn, 
                    info->cipher.aesgcm_enc.authInSz, 
                    info->cipher.aesgcm_enc.authTag, 
                    info->cipher.aesgcm_enc.authTagSz, 
                    info->cipher.aesgcm_enc.out
                );

            } else {
                #ifdef CHATTY
                    printf("AES_GCM  enc: %i  rounds: %i  keylen: %i  out: %p  in: %p  sz: %i  iv: %p  ivSz: %i  authTag: %p  authTagSz: %i  authIn: %p  authInSz: %i\n", 
                    info->cipher.enc, 
                    info->cipher.aesgcm_dec.aes->rounds,
                    info->cipher.aesgcm_dec.aes->keylen,
                    info->cipher.aesgcm_dec.out,
                    info->cipher.aesgcm_dec.in,
                    info->cipher.aesgcm_dec.sz,
                    info->cipher.aesgcm_dec.iv,
                    info->cipher.aesgcm_dec.ivSz,
                    info->cipher.aesgcm_dec.authTag,
                    info->cipher.aesgcm_dec.authTagSz,
                    info->cipher.aesgcm_dec.authIn,
                    info->cipher.aesgcm_dec.authInSz
                    );
                #endif

                int result = jsAesGcmDecrypt(
                    info->cipher.aesgcm_dec.in, 
                    info->cipher.aesgcm_dec.sz, 
                    (byte *)info->cipher.aesgcm_dec.aes->devKey, 
                    info->cipher.aesgcm_dec.aes->keylen,
                    info->cipher.aesgcm_dec.iv, 
                    info->cipher.aesgcm_dec.ivSz, 
                    info->cipher.aesgcm_dec.authIn, 
                    info->cipher.aesgcm_dec.authInSz, 
                    info->cipher.aesgcm_dec.authTag, 
                    info->cipher.aesgcm_dec.authTagSz, 
                    info->cipher.aesgcm_dec.out
                );
                if (result == -1) return AES_GCM_AUTH_E;

            }
            return 0;

        } else if (info->algo_type == WC_ALGO_TYPE_HASH && (
            info->hash.type == WC_HASH_TYPE_SHA ||
            info->hash.type == WC_HASH_TYPE_SHA256 || 
            info->hash.type == WC_HASH_TYPE_SHA384 || 
            info->hash.type == WC_HASH_TYPE_SHA512)) {

            int shaVersion = 
            info->hash.type == WC_HASH_TYPE_SHA256 ? 256 :
            info->hash.type == WC_HASH_TYPE_SHA384 ? 384 : 
            info->hash.type == WC_HASH_TYPE_SHA512 ? 512 : 1;
            
            jsSha(shaVersion, info->hash.in, info->hash.inSz, info->hash.digest);
            return 0;

        } else {
            #ifdef CHATTY
                printf("cb: algo_type %i\n", info->algo_type);
                if (info->algo_type == WC_ALGO_TYPE_HASH) printf("hash.type %i\n\n", info->hash.type);
                if (info->algo_type == WC_ALGO_TYPE_PK) printf("pk.type %i\n\n", info->pk .type);
                if (info->algo_type == WC_ALGO_TYPE_HMAC) printf("hmac.macType %i\n\n", info->hmac.macType);
                // potential further ops are ECC keygen (3, 9), ECDH (3, 3), RSA (3, 1) and SHA256-HMAC (6, 6)
            #endif
            return CRYPTOCB_UNAVAILABLE;
        }
    }
#endif

int initTls(char *tlsHost) {
    #ifdef CHATTY
        puts("WolfSSL initializing ...");
    #endif
    wolfSSL_Init();

    #ifdef CHATTY
        puts("WolfSSL creating context ...");
    #endif
    ctx = wolfSSL_CTX_new(wolfTLS_client_method());
    if (ctx == NULL) {
        fprintf(stderr, "ERROR: failed to create WOLFSSL_CTX\n");
        ret = -1;
        goto exit;
    }

    #ifdef CHATTY
        puts("WolfSSL loading verify buffer ...");
    #endif
    ret = wolfSSL_CTX_load_verify_buffer(ctx, rootCert, sizeof(rootCert), WOLFSSL_FILETYPE_PEM);
    if (ret != WOLFSSL_SUCCESS) {
        fprintf(stderr, "ERROR: failed to load cert, please check the buffer.\n");
        goto exit;
    }

    #ifdef CHATTY
        puts("Setting I/O callbacks ...");
    #endif
    wolfSSL_SetIORecv(ctx, my_IORecv);
    wolfSSL_SetIOSend(ctx, my_IOSend);

    #ifdef CHATTY
        puts("Creating SSL object ...");
    #endif
    ssl = wolfSSL_new(ctx);
    if (ssl == NULL) {
        fprintf(stderr, "ERROR: failed to create WOLFSSL object\n");
        ret = -1;
        goto exit;
    }

    #ifdef USESUBTLECB
        #ifdef CHATTY
            puts("Registering callback ...");
        #endif
        int devId = 1;
        wc_CryptoCb_RegisterDevice(devId, &cryptCb, NULL);
        ret = wolfSSL_SetDevId(ssl, devId);
        if (ret != WOLFSSL_SUCCESS) {
            fprintf(stderr, "ERROR: failed to register callback.\n");
            goto exit;
        }
    #endif

    #ifdef CHATTY
        puts("Setting ciphers ...");
    #endif
    ret = wolfSSL_set_cipher_list(ssl, "TLS13-CHACHA20-POLY1305-SHA256:TLS13-AES128-GCM-SHA256:TLS13-AES256-GCM-SHA384");
    if (ret != WOLFSSL_SUCCESS) {
        fprintf(stderr, "ERROR: failed to set ciphers\n");
        goto exit;
    }

    #ifdef CHATTY
        puts("Enabling SNI ...");
    #endif
    ret = wolfSSL_UseSNI(ssl, WOLFSSL_SNI_HOST_NAME, tlsHost, strlen(tlsHost));
    if (ret != WOLFSSL_SUCCESS) {
        fprintf(stderr, "ERROR: failed to set host for SNI\n");
        goto exit;
    }

    #ifdef CHATTY
        puts("Enabling domain name check...");
    #endif
    ret = wolfSSL_check_domain_name(ssl, tlsHost);
    if (ret != WOLFSSL_SUCCESS) {
        puts("Failed to enable domain name check");
        goto exit;
    };

    #ifdef CHATTY
        puts("Connecting ...");
    #endif
    ret = wolfSSL_connect(ssl);
    if (ret != WOLFSSL_SUCCESS) {
        int err = wolfSSL_get_error(ssl, ret);
        fprintf(stderr, "ERROR: failed to connect to wolfSSL, error %i\n", err);
        goto exit;
    }

    #ifdef CHATTY
        const char *cipher = wolfSSL_get_cipher_name(ssl);
        printf("WolfSSL connected with cipher: %s\n", cipher);
    #endif

    return 0;

exit:
    cleanup();
    return -1;
}

int readData(char *buff, int sz) {
    ret = wolfSSL_read(ssl, buff, sz);
    if (ret < 0) {
        fprintf(stderr, "ERROR: failed to read\n");
        return ret;
    }
    if (ret == 0) {
        fprintf(stderr, "Zero-length read\n");
        return ret;
    }
    return ret;
}

int writeData(char *buff, int sz) {
    ret = wolfSSL_write(ssl, buff, sz);
    if (ret != sz) {
        fprintf(stderr, "ERROR: failed to write\n");
    }
    return ret;
}

int pending() {
    ret = wolfSSL_pending(ssl);
    return ret;
}

int shutdown() {
    ret = wolfSSL_shutdown(ssl);
    return ret;
}
