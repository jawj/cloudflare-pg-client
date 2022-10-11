// @ts-ignore -- TypeScript doesn't understand WASM imports
// import bearsslwasm from '../worker/bearssl.wasm';
import { bearssl_emscripten } from '../worker/bearssl.js';

declare global {
  interface Response {
    webSocket: WebSocket;
  }
}

export default (async function (
  host: string,
  port: number,
  wsProxy: string, // e.g. http://localhost:9090/
  verbose = false,
) {
  let module: any;
  let socket: any;
  let tlsStarted = false;

  const incomingDataQueue: Uint8Array[] = []
  let emBuf: number /* pointer */ | Uint8Array | null = null;
  let emMaxSize = 0;
  let emResolve: null | ((bytesSent: number) => void) = null;

  function dequeueIncomingData() {
    if (verbose) console.log('dequeue ...');

    if (incomingDataQueue.length === 0) {
      if (verbose) console.log('no data available');
      return;
    }
    if (emResolve === null || emBuf === null) {
      if (verbose) console.log('no data awaited');
      return;
    }

    let nextData = incomingDataQueue[0];
    if (nextData.length > emMaxSize) {
      incomingDataQueue[0] = nextData.subarray(emMaxSize);
      nextData = nextData.subarray(0, emMaxSize);

    } else {
      incomingDataQueue.shift();
    }

    if (tlsStarted) {
      module.HEAPU8.set(nextData, emBuf);

    } else {
      (emBuf as Uint8Array).set(nextData);
    }

    const resolve = emResolve;
    emResolve = emBuf = null;
    emMaxSize = 0;

    const len = nextData.length
    if (verbose) console.log(`${len} bytes dequeued`);
    resolve(len);
  }

  module = await bearssl_emscripten({
    instantiateWasm(info: any, receive: any) {
      // @ts-ignore -- TypeScript doesn't understand this, which is fair enough
      let instance = new WebAssembly.Instance(bearsslwasm, info);
      receive(instance);
      return instance.exports;
    },
    provideEncryptedFromNetwork(buf: number, maxSize: number) {
      if (verbose) console.info(`provideEncryptedFromNetwork: providing up to ${maxSize} bytes`);

      emBuf = buf;
      emMaxSize = maxSize;
      const promise = new Promise(resolve => emResolve = resolve);

      dequeueIncomingData();
      return promise;
    },
    writeEncryptedToNetwork(buf: number, size: number) {
      if (verbose) console.info(`writeEncryptedToNetwork: writing ${size} bytes`);

      const arr = module.HEAPU8.slice(buf, buf + size);
      socket.send(arr);

      return size;
    },
  });

  await new Promise<void>((resolve, reject) => {
    const wsAddr = `${wsProxy}?name=${host}:${port}`;
    fetch(wsAddr, { headers: { Upgrade: 'websocket' } })
      .then(resp => {
        // `webSocket` property exists on Workers `Response` type
        socket = resp.webSocket;
        socket.accept();
        socket.binaryType = 'arraybuffer';
        resolve();

        socket.addEventListener('error', (err: any) => {
          reject(err);
        });
        socket.addEventListener('close', () => {
          if (verbose) console.info('socket: disconnected');
          if (emResolve) emResolve(0);
        });
        socket.addEventListener('message', (msg: any) => {
          const data = new Uint8Array(msg.data);
          if (verbose) console.info(`socket: ${data.length} bytes received`);
          incomingDataQueue.push(data);
          dequeueIncomingData();
        });
      })
      .catch(reason => {
        throw new Error(`WebSocket connection failed: ${reason}`);
      });
  });

  const tls = {
    initTls: module.cwrap('initTls', 'number', ['string', 'array', 'number']),  // host, entropy, entropy length
    writeData: module.cwrap('writeData', 'number', ['array', 'number'], { async: true }) as (data: Uint8Array, length: number) => Promise<number>,
    readData: module.cwrap('readData', 'number', ['number', 'number'], { async: true }) as (pointer: number, length: number) => Promise<number>,
  };

  return {
    startTls() {
      if (verbose) console.info('initialising TLS');
      tlsStarted = true;
      const entropyLen = 128;
      const entropy = new Uint8Array(entropyLen);
      crypto.getRandomValues(entropy);
      return tls.initTls(host, entropy, entropyLen) as number;
    },

    async writeData(data: Uint8Array) {
      if (tlsStarted) {
        if (verbose) console.info('writeData: encrypted');
        const status = await tls.writeData(data, data.length);
        return status as 0 | -1;

      } else {
        if (verbose) console.info('writeData: unencrypted');
        socket.send(data);
        return 0;
      }
    },

    async readData(data: Uint8Array) {

      // TO CONSIDER: if we could set a global maxBytes, we could avoid repeated allocations, 
      // and even build the buffer into the C file (allowing us to compile without ALLOW_MEMORY_GROWTH) 

      // 16709 is BR_SSL_BUFSIZE_INPUT in bearssl_ssl.h

      const maxSize = data.length;

      if (tlsStarted) {
        if (verbose) console.info('readData: encrypted');
        const buf = module._malloc(maxSize);
        const bytesRead = await tls.readData(buf, maxSize);
        data.set(module.HEAPU8.subarray(buf, buf + bytesRead));
        return bytesRead;

      } else {
        if (verbose) console.info('readData: unencrypted');
        emBuf = data;
        emMaxSize = maxSize;
        const promise = new Promise<number>(resolve => emResolve = resolve);

        dequeueIncomingData();
        return promise;
      }

      // TODO: stop leaking buf!
    },

    close() {
      socket.close();
    }
  };
});
