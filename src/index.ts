import { encode } from "@prokopschield/don";
import { decode } from "doge-json";
import express from "express";
import { createServer, Server as HttpServer } from "http";
import { Server as IOServer, ServerOptions, Socket } from "socket.io";

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
	constructor(options: Partial<ServerOptions>, ...descriptors: (T | T[])[]) {
		const app = express();
		const http = createServer(app);

		super(http, {
			allowEIO3: true,
			cors: { origin: true },
			...options,
		});

		this.app = app;
		this.http = http;

		this.addHandlers(...descriptors);

		this.on("connection", async (socket) => {
			const state = new State();

			socket.onAny(async (event, ...args) => {
				const callback = args.pop();
				const handler = this.handler[String(event)];

				try {
					callback(await handler(socket, state, ...args));
				} catch (error) {
					callback?.(error);
				}
			});
		});
	}

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
}

export default Server;
