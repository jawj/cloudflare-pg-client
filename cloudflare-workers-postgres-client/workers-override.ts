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

  constructor(ws: WsTlsInstance) {
    this.ws = ws;
  }

  closeWrite(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  // Reads up to p.length bytes from our buffer
  async read(p: Uint8Array) {
    const bytesRead = await this.ws.readData(p);
    return bytesRead;
  }

  async write(p: Uint8Array) {
    await this.ws.writeData(p);

    // we must assume the socket buffered our entire message
    return p.length;
  }

  close(): void {
    this.ws.close();
  }
}

export const workerDenoPostgres_startTls = async function (
  connection: Deno.Conn
): Promise<Deno.Conn> {

  await (connection as any).ws.startTls();
  return connection;
};

export const workerDenoPostgres_connect = async function (
  options: Deno.ConnectOptions
): Promise<Deno.Conn> {

    if (options.hostname === undefined) {
      throw new Error("Tunnel hostname undefined");
    }

    const wsProxy = 'http://proxy.hahathon.monster/';
    const wsTls = await WsTls(options.hostname, options.port, wsProxy, false);

    return new TcpOverWebsocketConn(wsTls);
};
