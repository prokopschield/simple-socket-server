import { encode } from "@prokopschield/don";
import { decode } from "doge-json";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import { Err, Ok, omit, Result } from "ps-std";
import { Server as IOServer, ServerOptions, Socket } from "socket.io";
import { inspect } from "util";

export interface Options extends Partial<ServerOptions> {
	port?: bigint | number | string;
}

export class State extends Map<string, string> {
	get(key: string) {
		return String(decode(super.get(encode(key)) || ""));
	}

	set(key: string, value: string) {
		return super.set(encode(key), encode(value));
	}
}

export class Server<
	T extends Record<
		string,
		(_socket: Socket, _state: Map<string, string>, ...args: any[]) => any
	>
> extends IOServer {
	constructor(options: Options, ...descriptors: (T | T[])[]) {
		const app = express();
		const http = createServer(app);

		super(http, {
			allowEIO3: true,
			cors: { origin: true },
			...omit(options, ["port"]),
		});

		this.app = app;
		this.http = http;

		this.addHandlers(...descriptors);

		this.on("connection", async (socket) => {
			const state = new State();

			this.states.set(socket, state);

			socket.onAny(async (event, ...args) => {
				const callback = args.pop();
				const handler = this.handler[String(event)];

				try {
					callback(await handler(socket, state, ...args));
				} catch (error) {
					callback?.({ error: inspect(error) });
				}
			});
		});

		if (options.port) {
			this.setPort(options.port);
		}
	}

	states = new WeakMap<Socket, State>();

	app: express.Express;
	handler = {} as T;
	http: HttpServer;

	addHandlers(...descriptors: (T | T[])[]) {
		for (const descriptor of descriptors) {
			if (Array.isArray(descriptor)) {
				this.addHandlers(...descriptor);
				continue;
			}

			const handler = { ...descriptor };

			Object.setPrototypeOf(handler, this.handler);

			this.handler = handler;
		}
	}

	_port?: number;

	ports = new Array<number>();

	get port(): number | undefined {
		return this._port;
	}

	set port(port: bigint | number | string) {
		this.setPort(port);
	}

	setPort(port?: bigint | number | string): Result<number, unknown> {
		try {
			const port_number = Number(port);

			if (!this.ports.includes(port_number)) {
				this.ports.push(port_number);
				this.http.listen(port_number);
			}

			return Ok((this._port = port_number));
		} catch (error) {
			return Err(error);
		}
	}
}

export default Server;
