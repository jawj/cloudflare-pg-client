import { bearssl_emscripten } from '../worker/bearssl.js';

// import bearsslwasm from '../worker/bearssl.wasm';
// ^^^ note: we'll be adding this import back in after esbuild compilation, so as not to 
// confuse esbuild with the way Cloudflare Workers handle this

declare global {
  const bearsslwasm: any;
  interface Response {
    webSocket: WebSocket;
  }
}

interface DataRequest {
  container: number /* emscripten buffer pointer */ | Uint8Array;
  maxBytes: number;
  resolve: (bytesProvided: number) => void;
}

/**
 * This object handles communication with an emscripten-compiled TLS library.
 * Data flow is somewhat complex, since we're turning new data events into async read calls,
 * and the read and write data paths can either go via the TLS library (after initTLS) or not.
 */

export default (async function (
  host: string,
  port: number,
  wsProxy: string, // e.g. http://localhost:9090/
  verbose = false,
) {
  let module: any;
  let socket: any;
  let tlsStarted = false;

  const incomingDataQueue: Uint8Array[] = [];
  let outstandingDataRequest: DataRequest | null = null;

  function dequeueIncomingData() {
    if (verbose) console.log('dequeue ...');

    if (incomingDataQueue.length === 0) {
      if (verbose) console.log('no data available');
      return;
    }
    if (outstandingDataRequest === null) {
      if (verbose) console.log('data available but not awaited');
      return;
    }

    let nextData = incomingDataQueue[0];
    const { container, maxBytes, resolve } = outstandingDataRequest;

    if (nextData.length > maxBytes) {
      if (verbose) console.log('splitting next chunk');
      incomingDataQueue[0] = nextData.subarray(maxBytes);
      nextData = nextData.subarray(0, maxBytes);

    } else {
      if (verbose) console.log('returning next chunk whole');
      incomingDataQueue.shift();
    }

    if (tlsStarted) {
      if (verbose) console.log('providing data to wasm for decryption');
      module.HEAPU8.set(nextData, container);  // copy data to appropriate memory range

    } else {
      if (verbose) console.log('providing data direct');
      (container as Uint8Array).set(nextData);
    }

    outstandingDataRequest = null;

    const len = nextData.length;
    if (verbose) console.log(`${len} bytes dequeued`);

    resolve(len);
  }

  module = await bearssl_emscripten({
    instantiateWasm(info: any, receive: any) {
      if (verbose) console.log('loading wasm');
      let instance = new WebAssembly.Instance(bearsslwasm, info);
      receive(instance);
      return instance.exports;
    },

    provideEncryptedFromNetwork(buf: number, maxBytes: number) {
      if (verbose) console.log(`provideEncryptedFromNetwork: providing up to ${maxBytes} bytes`);

      let resolve: ((bytesProvided: number) => void);
      const promise = new Promise(r => resolve = r);

      // @ts-ignore -- TypeScript seems not to appreciate that `new Promise(x)` calls `x` synchronously
      outstandingDataRequest = { container: buf, maxBytes, resolve };
      dequeueIncomingData();

      return promise;
    },

    writeEncryptedToNetwork(buf: number, size: number) {
      if (verbose) console.log(`writeEncryptedToNetwork: writing ${size} bytes`);

      const arr = module.HEAPU8.slice(buf, buf + size);
      socket.send(arr);

      return size;
    },
  });

  await new Promise<void>((resolve, reject) => {
    const wsAddr = `${wsProxy}?name=${host}:${port}`;
    fetch(wsAddr, { headers: { Upgrade: 'websocket' } })
      .then(resp => {
        socket = resp.webSocket;
        socket.accept();
        socket.binaryType = 'arraybuffer';
        resolve();

        socket.addEventListener('error', (err: any) => {
          reject(err);
        });

        socket.addEventListener('close', () => {
          if (verbose) console.log('socket: disconnected');
          if (outstandingDataRequest) {
            outstandingDataRequest.resolve(0);
            outstandingDataRequest = null;
          }
        });

        socket.addEventListener('message', (msg: any) => {
          const data = new Uint8Array(msg.data);
          if (verbose) console.log(`socket: ${data.length} bytes received`);
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
      if (verbose) console.log('initialising TLS');
      tlsStarted = true;
      const entropyLen = 128;
      const entropy = new Uint8Array(entropyLen);
      crypto.getRandomValues(entropy);
      return tls.initTls(host, entropy, entropyLen) as number;
    },

    async writeData(data: Uint8Array) {
      if (tlsStarted) {
        if (verbose) console.log('TLS writeData');
        const status = await tls.writeData(data, data.length);
        return status as 0 | -1;

      } else {
        if (verbose) console.log('raw writeData');
        socket.send(data);
        return 0;
      }
    },

    async readData(data: Uint8Array) {
      const maxBytes = data.length;

      if (tlsStarted) {
        if (verbose) console.log('TLS readData');

        const buf = module._malloc(maxBytes);
        const bytesRead = await tls.readData(buf, maxBytes);
        data.set(module.HEAPU8.subarray(buf, buf + bytesRead));
        module._free(buf);

        return bytesRead;

      } else {
        if (verbose) console.log('raw readData');

        let resolve: (bytesProvided: number) => void;
        const promise = new Promise<number>(r => resolve = r);

        // @ts-ignore -- TypeScript seems not to appreciate that `new Promise(x)` calls `x` synchronously
        outstandingDataRequest = { container: data, maxBytes, resolve };
        dequeueIncomingData();

        return promise;
      }
    },

    close() {
      if (verbose) console.log('requested close');
      socket.close();
    }
  };
});
