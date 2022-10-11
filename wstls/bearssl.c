#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>

#include "bearssl.h"

br_ssl_client_context sc;
br_x509_minimal_context xc;
unsigned char iobuf[BR_SSL_BUFSIZE_BIDI];
br_sslio_context ioc;
int ret;
int err;

// === JS functions exposed to C ===

EM_ASYNC_JS(int, jsProvideEncryptedFromNetwork, (unsigned char *buf, size_t len), {
  const bytesRead = await Module.provideEncryptedFromNetwork(buf, len);
  return bytesRead;
});

EM_JS(int, jsWriteEncryptedToNetwork, (const unsigned char *buf, size_t len), {
  const bytesWritten = Module.writeEncryptedToNetwork(buf, len);
  return bytesWritten;
});

EM_JS(int, jsReceiveDecryptedFromLibrary, (unsigned char *buf, size_t len), {
  Module.jsReceiveDecryptedFromLibrary(buf, len);
});


// === I/O callbacks to/from WebSockets in JS ===

static int sock_read(void *ctx, unsigned char *buf, size_t len) {
  int recvd = jsProvideEncryptedFromNetwork(buf, len);

  #ifdef CHATTY
    printf("%s", "recv:");
    for (int i = 0; i < len; i++) printf(" %02x", (unsigned char)buf[i]);
    printf("\nreceived %d bytes from JS\n\n", recvd);
  #endif

  return recvd;
}

static int sock_write(void *ctx, const unsigned char *buf, size_t len) {
  #ifdef CHATTY
    printf("%s", "send:");
    for (int i = 0; i < len; i++) printf(" %02x", (unsigned char)buf[i]);
  #endif

  int sent = jsWriteEncryptedToNetwork(buf, len);

  #ifdef CHATTY
    printf("\nsent %d bytes to JS\n\n", sent);
  #endif

  return sent;
}

// === CA cert(s) ===

/*
 * C code for hardcoded trust anchors can be generated with the "brssl"
 * command-line tool (with the "ta" command).
 */

static const unsigned char TA0_DN[] = {
  0x30, 0x4F, 0x31, 0x0B, 0x30, 0x09, 0x06, 0x03, 0x55, 0x04, 0x06, 0x13,
  0x02, 0x55, 0x53, 0x31, 0x29, 0x30, 0x27, 0x06, 0x03, 0x55, 0x04, 0x0A,
  0x13, 0x20, 0x49, 0x6E, 0x74, 0x65, 0x72, 0x6E, 0x65, 0x74, 0x20, 0x53,
  0x65, 0x63, 0x75, 0x72, 0x69, 0x74, 0x79, 0x20, 0x52, 0x65, 0x73, 0x65,
  0x61, 0x72, 0x63, 0x68, 0x20, 0x47, 0x72, 0x6F, 0x75, 0x70, 0x31, 0x15,
  0x30, 0x13, 0x06, 0x03, 0x55, 0x04, 0x03, 0x13, 0x0C, 0x49, 0x53, 0x52,
  0x47, 0x20, 0x52, 0x6F, 0x6F, 0x74, 0x20, 0x58, 0x31
};

static const unsigned char TA0_RSA_N[] = {
  0xAD, 0xE8, 0x24, 0x73, 0xF4, 0x14, 0x37, 0xF3, 0x9B, 0x9E, 0x2B, 0x57,
  0x28, 0x1C, 0x87, 0xBE, 0xDC, 0xB7, 0xDF, 0x38, 0x90, 0x8C, 0x6E, 0x3C,
  0xE6, 0x57, 0xA0, 0x78, 0xF7, 0x75, 0xC2, 0xA2, 0xFE, 0xF5, 0x6A, 0x6E,
  0xF6, 0x00, 0x4F, 0x28, 0xDB, 0xDE, 0x68, 0x86, 0x6C, 0x44, 0x93, 0xB6,
  0xB1, 0x63, 0xFD, 0x14, 0x12, 0x6B, 0xBF, 0x1F, 0xD2, 0xEA, 0x31, 0x9B,
  0x21, 0x7E, 0xD1, 0x33, 0x3C, 0xBA, 0x48, 0xF5, 0xDD, 0x79, 0xDF, 0xB3,
  0xB8, 0xFF, 0x12, 0xF1, 0x21, 0x9A, 0x4B, 0xC1, 0x8A, 0x86, 0x71, 0x69,
  0x4A, 0x66, 0x66, 0x6C, 0x8F, 0x7E, 0x3C, 0x70, 0xBF, 0xAD, 0x29, 0x22,
  0x06, 0xF3, 0xE4, 0xC0, 0xE6, 0x80, 0xAE, 0xE2, 0x4B, 0x8F, 0xB7, 0x99,
  0x7E, 0x94, 0x03, 0x9F, 0xD3, 0x47, 0x97, 0x7C, 0x99, 0x48, 0x23, 0x53,
  0xE8, 0x38, 0xAE, 0x4F, 0x0A, 0x6F, 0x83, 0x2E, 0xD1, 0x49, 0x57, 0x8C,
  0x80, 0x74, 0xB6, 0xDA, 0x2F, 0xD0, 0x38, 0x8D, 0x7B, 0x03, 0x70, 0x21,
  0x1B, 0x75, 0xF2, 0x30, 0x3C, 0xFA, 0x8F, 0xAE, 0xDD, 0xDA, 0x63, 0xAB,
  0xEB, 0x16, 0x4F, 0xC2, 0x8E, 0x11, 0x4B, 0x7E, 0xCF, 0x0B, 0xE8, 0xFF,
  0xB5, 0x77, 0x2E, 0xF4, 0xB2, 0x7B, 0x4A, 0xE0, 0x4C, 0x12, 0x25, 0x0C,
  0x70, 0x8D, 0x03, 0x29, 0xA0, 0xE1, 0x53, 0x24, 0xEC, 0x13, 0xD9, 0xEE,
  0x19, 0xBF, 0x10, 0xB3, 0x4A, 0x8C, 0x3F, 0x89, 0xA3, 0x61, 0x51, 0xDE,
  0xAC, 0x87, 0x07, 0x94, 0xF4, 0x63, 0x71, 0xEC, 0x2E, 0xE2, 0x6F, 0x5B,
  0x98, 0x81, 0xE1, 0x89, 0x5C, 0x34, 0x79, 0x6C, 0x76, 0xEF, 0x3B, 0x90,
  0x62, 0x79, 0xE6, 0xDB, 0xA4, 0x9A, 0x2F, 0x26, 0xC5, 0xD0, 0x10, 0xE1,
  0x0E, 0xDE, 0xD9, 0x10, 0x8E, 0x16, 0xFB, 0xB7, 0xF7, 0xA8, 0xF7, 0xC7,
  0xE5, 0x02, 0x07, 0x98, 0x8F, 0x36, 0x08, 0x95, 0xE7, 0xE2, 0x37, 0x96,
  0x0D, 0x36, 0x75, 0x9E, 0xFB, 0x0E, 0x72, 0xB1, 0x1D, 0x9B, 0xBC, 0x03,
  0xF9, 0x49, 0x05, 0xD8, 0x81, 0xDD, 0x05, 0xB4, 0x2A, 0xD6, 0x41, 0xE9,
  0xAC, 0x01, 0x76, 0x95, 0x0A, 0x0F, 0xD8, 0xDF, 0xD5, 0xBD, 0x12, 0x1F,
  0x35, 0x2F, 0x28, 0x17, 0x6C, 0xD2, 0x98, 0xC1, 0xA8, 0x09, 0x64, 0x77,
  0x6E, 0x47, 0x37, 0xBA, 0xCE, 0xAC, 0x59, 0x5E, 0x68, 0x9D, 0x7F, 0x72,
  0xD6, 0x89, 0xC5, 0x06, 0x41, 0x29, 0x3E, 0x59, 0x3E, 0xDD, 0x26, 0xF5,
  0x24, 0xC9, 0x11, 0xA7, 0x5A, 0xA3, 0x4C, 0x40, 0x1F, 0x46, 0xA1, 0x99,
  0xB5, 0xA7, 0x3A, 0x51, 0x6E, 0x86, 0x3B, 0x9E, 0x7D, 0x72, 0xA7, 0x12,
  0x05, 0x78, 0x59, 0xED, 0x3E, 0x51, 0x78, 0x15, 0x0B, 0x03, 0x8F, 0x8D,
  0xD0, 0x2F, 0x05, 0xB2, 0x3E, 0x7B, 0x4A, 0x1C, 0x4B, 0x73, 0x05, 0x12,
  0xFC, 0xC6, 0xEA, 0xE0, 0x50, 0x13, 0x7C, 0x43, 0x93, 0x74, 0xB3, 0xCA,
  0x74, 0xE7, 0x8E, 0x1F, 0x01, 0x08, 0xD0, 0x30, 0xD4, 0x5B, 0x71, 0x36,
  0xB4, 0x07, 0xBA, 0xC1, 0x30, 0x30, 0x5C, 0x48, 0xB7, 0x82, 0x3B, 0x98,
  0xA6, 0x7D, 0x60, 0x8A, 0xA2, 0xA3, 0x29, 0x82, 0xCC, 0xBA, 0xBD, 0x83,
  0x04, 0x1B, 0xA2, 0x83, 0x03, 0x41, 0xA1, 0xD6, 0x05, 0xF1, 0x1B, 0xC2,
  0xB6, 0xF0, 0xA8, 0x7C, 0x86, 0x3B, 0x46, 0xA8, 0x48, 0x2A, 0x88, 0xDC,
  0x76, 0x9A, 0x76, 0xBF, 0x1F, 0x6A, 0xA5, 0x3D, 0x19, 0x8F, 0xEB, 0x38,
  0xF3, 0x64, 0xDE, 0xC8, 0x2B, 0x0D, 0x0A, 0x28, 0xFF, 0xF7, 0xDB, 0xE2,
  0x15, 0x42, 0xD4, 0x22, 0xD0, 0x27, 0x5D, 0xE1, 0x79, 0xFE, 0x18, 0xE7,
  0x70, 0x88, 0xAD, 0x4E, 0xE6, 0xD9, 0x8B, 0x3A, 0xC6, 0xDD, 0x27, 0x51,
  0x6E, 0xFF, 0xBC, 0x64, 0xF5, 0x33, 0x43, 0x4F
};

static const unsigned char TA0_RSA_E[] = {
  0x01, 0x00, 0x01
};

static const br_x509_trust_anchor TAs[1] = {
  {
    { (unsigned char *)TA0_DN, sizeof TA0_DN },
    BR_X509_TA_CA,
    {
      BR_KEYTYPE_RSA,
      { .rsa = {
        (unsigned char *)TA0_RSA_N, sizeof TA0_RSA_N,
        (unsigned char *)TA0_RSA_E, sizeof TA0_RSA_E,
      } }
    }
  }
};

#define TAs_NUM   1

// === TLS functions exposed to JavaScript ===

int initTls(char *host, char *entropy, size_t entropyLen) {
  br_ssl_client_init_full(&sc, &xc, TAs, TAs_NUM);
  br_ssl_engine_set_versions(&sc.eng, BR_TLS12, BR_TLS12);  // TLS 1.2 only, please

  static const uint16_t suites[] = {  // matched to rustls: https://docs.rs/rustls/latest/src/rustls/suites.rs.html#125-143
    BR_TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
    BR_TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
    BR_TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
    BR_TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
    BR_TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
    BR_TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  };
  br_ssl_engine_set_suites(&sc.eng, suites, (sizeof suites) / (sizeof suites[0]));  

  br_ssl_engine_inject_entropy(&sc.eng, entropy, entropyLen);  // required with emscripten
  br_ssl_engine_set_buffer(&sc.eng, iobuf, sizeof iobuf, 1);

  ret = br_ssl_client_reset(&sc, host, 0);
  if (ret != 1) {  // errors can occur here, e.g. no entropy available
    err = br_ssl_engine_last_error(&sc.eng);
    printf("client reset failed with error %i\n", err);
    return -1;
  }

  br_sslio_init(&ioc, &sc.eng, sock_read, NULL, sock_write, NULL);

  return 0;
}

int writeData(unsigned char *buf, size_t len) {  // ask BearSSL to encrypt and send (via JS callback) data
  #ifdef CHATTY
    printf("writing %li unencrypted bytes:", len);
    for (int i = 0; i < len; i++) printf(" %02x", buf[i]);
    puts("");
  #endif
  
  ret = br_sslio_write_all(&ioc, buf, len);
  if (ret != 0) {
    err = br_ssl_engine_last_error(&sc.eng);
    printf("write failed with error %i\n", err);
    return ret;
  }

  ret = br_sslio_flush(&ioc);
  if (ret != 0) {
    err = br_ssl_engine_last_error(&sc.eng);
    printf("flush failed with error %i\n", err);
    return ret;
  }

  return 0;
}

int readData(unsigned char *buf, size_t len) {
  ret = br_sslio_read(&ioc, buf, len);
  if (ret == -1) {
    err = br_ssl_engine_last_error(&sc.eng);
    printf("read failed with error %i\n", err);
    return ret;
  }

  #ifdef CHATTY
    printf("read %i decrypted bytes\n", ret);
  #endif

  return ret;
}
