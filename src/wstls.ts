import { tls_emscripten } from '../build/tls.js';

// import tlswasm from '../worker/tls.wasm';
// ^^^ note: we'll be adding this import back in after esbuild compilation, so as not to 
// confuse esbuild with the way Cloudflare Workers handle this

declare global {
  const tlswasm: any;  // we'll add this import back in later, see above
  interface Response {
    webSocket: WebSocket;  // Cloudflare-specific
  }
  interface WebSocket {
    accept: () => void;
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
  let tlsStarted = false;

  const incomingDataQueue: Uint8Array[] = [];
  let outstandingDataRequest: DataRequest | null = null;
  let latestWritePromise = Promise.resolve(0);

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

  const wsAddr = `${wsProxy}?name=${host}:${port}`;
  const [resp, module] = await Promise.all([
    // start websocket connection
    fetch(wsAddr, { headers: { Upgrade: 'websocket' } }),

    // init wasm module
    tls_emscripten({
      instantiateWasm(info: any, receive: any) {
        if (verbose) console.log('loading wasm');

        let instance = new WebAssembly.Instance(tlswasm, info);
        receive(instance);

        return instance.exports;
      },

      provideEncryptedFromNetwork(buf: number, maxBytes: number) {
        if (verbose) console.log(`provideEncryptedFromNetwork: providing up to ${maxBytes} bytes`);

        return new Promise(resolve => {
          outstandingDataRequest = { container: buf, maxBytes, resolve };
          dequeueIncomingData();
        });
      },

      writeEncryptedToNetwork(buf: number, size: number) {
        if (verbose) console.log(`writeEncryptedToNetwork: writing ${size} bytes`);

        const arr = module.HEAPU8.slice(buf, buf + size);
        socket.send(arr);
        
        return size;
      },
    }),
  ]);
  
  const socket = resp.webSocket;
  socket.accept();
  socket.binaryType = 'arraybuffer';

  socket.addEventListener('error', (err: any) => {
    throw err;
  });

  socket.addEventListener('close', () => {
    if (verbose) console.log('socket: disconnected');
    if (outstandingDataRequest) {
      // TODO: consider whether this is possible and, if so, whether this is the right way to handle it
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

  return {
    async startTls() {
      // note: WolfSSL handshakes right away; BearSSL only starts the handshake when we next read/write
      // (that means some changes are needed for BearSSL, as this op is not async there)
      if (verbose) console.log('initialising TLS');
      tlsStarted = true;
      const result = await module.ccall('initTls', 'number', ['string'], [host], { async: true });
      return result;
    },

    async writeData(data: Uint8Array) {
      if (tlsStarted) {
        if (verbose) console.log('TLS writeData');
        latestWritePromise = module.ccall('writeData', 'number', ['array', 'number'], [data, data.length], { async: true });
        const status = await latestWritePromise;
        return status as 0 | -1;

      } else {
        if (verbose) console.log('raw writeData');
        socket.send(data);
        return 0;
      }
    },

    async readData(data: Uint8Array) {
      await latestWritePromise;  // must ensure we don't read before writes are finished to avoid empscripten reentrancy
      const maxBytes = data.length;
      
      if (tlsStarted) {
        if (verbose) console.log('TLS readData');
        const buf = module._malloc(maxBytes);
        const bytesRead = await module.ccall('readData', 'number', ['number', 'number'], [buf, maxBytes], { async: true });
        data.set(module.HEAPU8.subarray(buf, buf + bytesRead));
        module._free(buf);
        return bytesRead;

      } else {
        if (verbose) console.log('raw readData');
        return new Promise<number>(resolve => {
          outstandingDataRequest = { container: data, maxBytes, resolve };
          dequeueIncomingData();
        });
      }
    },

    close() {
      if (verbose) console.log('requested close');
      socket.close();
    }
  };
});
