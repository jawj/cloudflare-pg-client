// import { Buffer } from "./build/buffer.js";
// import { deferred } from "./build/deferred.js";
// import { __Deferred as Deferred } from "./build/types-package";

import WsTls from '../src/wstls';

declare namespace Deno {
  export interface Reader {
    read(p: Uint8Array): Promise<number | null>;
  }

  export interface ReaderSync {
    readSync(p: Uint8Array): number | null;
  }

  export interface Writer {
    write(p: Uint8Array): Promise<number>;
  }

  export interface WriterSync {
    writeSync(p: Uint8Array): number;
  }

  export interface Closer {
    close(): void;
  }

  export enum SeekMode {
    Start = 0,
    Current = 1,
    End = 2,
  }
  export interface Seeker {
    seek(offset: number, whence: SeekMode): Promise<number>;
  }
  export interface SeekerSync {
    seekSync(offset: number, whence: SeekMode): number;
  }

  export interface ConnectOptions {
    /** The port to connect to. */
    port: number;
    /** A literal IP address or host name that can be resolved to an IP address.
     * If not specified, defaults to `127.0.0.1`. */
    hostname?: string;
    transport?: "tcp";
  }

  export interface NetAddr {
    transport: "tcp" | "udp";
    hostname: string;
    port: number;
  }

  export interface UnixAddr {
    transport: "unix" | "unixpacket";
    path: string;
  }

  export type Addr = NetAddr | UnixAddr;

  export interface Conn extends Reader, Writer, Closer {
    /** The local address of the connection. */
    readonly localAddr: Addr;
    /** The remote address of the connection. */
    readonly remoteAddr: Addr;
    /** The resource ID of the connection. */
    readonly rid: number;
    /** Shuts down (`shutdown(2)`) the write side of the connection. Most
     * callers should just use `close()`. */
    closeWrite(): Promise<void>;
  }
}

type WsTlsInstance = Awaited<ReturnType<typeof WsTls>>;

export class TcpOverWebsocketConn implements Deno.Conn {
  localAddr: Deno.Addr = { transport: "tcp", hostname: "localhost", port: 5432 };
  remoteAddr: Deno.Addr = { transport: "tcp", hostname: "172.17.0.2", port: 5432 };
  rid: number = 1;

  ws: WsTlsInstance;
  // buffer: Buffer;
  // empty_notifier: Deferred<void>;

  constructor(ws: WsTlsInstance) {
    this.ws = ws;
    // this.buffer = new Buffer();
    // this.empty_notifier = deferred();

    // Incoming messages get written to a buffer
    // this.ws.addEventListener("message", (msg: any) => {
    //   const data = new Uint8Array(msg.data);

    //   this.buffer.write(data).then(() => {
    //     this.empty_notifier.resolve();
    //   });
    // });

    // this.ws.addEventListener("error", (err) => {
    //   console.log("ws error");
    // });
    // this.ws.addEventListener("close", () => {
    //   this.empty_notifier.resolve();
    //   console.log("ws close");
    // });
    // this.ws.addEventListener("open", () => {
    //   console.log("ws open");
    // });
  }

  closeWrite(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // Reads up to p.length bytes from our buffer
  async read(p: Uint8Array) {
    const bytesRead = await this.ws.readData(p);
    return bytesRead;

    //If the buffer is empty, we need to block until there is data
    // if (this.buffer.length === 0) {
    //   return new Promise(async (resolve, reject) => {
    //     this.empty_notifier = deferred();
    //     await this.empty_notifier;

    //     if (this.buffer.length === 0) {
    //       reject(0); // TODO what is the correct way to handle errors
    //     } else {
    //       const bytes = await this.buffer.read(p);
    //       resolve(bytes);
    //     }
    //   });
    // } else {
    //   return this.buffer.read(p);
    // }
  }

  async write(p: Uint8Array) {
    await this.ws.writeData(p);
    return p.length;

    // this.ws.send(p);

    // We have to assume the socket buffered our entire message
    // return Promise.resolve(p.byteLength);
  }

  close(): void {
    this.ws.close();
  }
}

export const workerDenoPostgres_startTls = function (
  connection: Deno.Conn
): Promise<Deno.Conn> {

  // return Promise.resolve(connection);

  (connection as any).ws.startTls();
  return Promise.resolve(connection);
};

export const workerDenoPostgres_connect = async function (
  options: Deno.ConnectOptions
): Promise<Deno.Conn> {

    if (options.hostname === undefined) {
      throw new Error("Tunnel hostname undefined");
    }

    const wsProxy = 'http://proxy.hahathon.monster/';
    const wsTls = await WsTls(options.hostname, options.port, wsProxy, true);

    return new TcpOverWebsocketConn(wsTls);

    // let wsAddr = `http://localhost:9090/?name=${options.hostname}:${options.port}`
    // console.log("Connecting to", wsAddr);

    // const resp = fetch(wsAddr, {
    //   headers: {
    //     Upgrade: "websocket",
    //   }
    // })
    //   .then((resp) => {
    //     // N.B. `webSocket` property exists on Workers `Response` type.
    //     if (resp.webSocket) {
    //       resp.webSocket.accept();
    //       let c = new TcpOverWebsocketConn(resp.webSocket);
    //       resolve(c);
    //     } else {
    //       throw new Error(
    //         `Failed to create WebSocket connection: ${resp.status} ${resp.statusText}`
    //       );
    //     }
    //   })
    //   .catch((e) => {
    //     console.log((e as Error).message);
    //     reject(e); //TODO error handling
    //   });
    // return resp;
};
