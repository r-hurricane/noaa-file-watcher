import {config} from '../config.js';
import {createLogger} from "../logging.js";
import {Logger} from "winston";
import {createServer, Server, Socket} from "node:net";
import * as fs from 'node:fs';

export class IpcController {

    private readonly logger: Logger;
    private readonly server: Server;

    private clientList: Socket[] = [];

    constructor() {
        this.logger = createLogger('IpcController');

        // Confirm path does not exist. Try and delete if it does.
        if (fs.existsSync(config.ipcPath)) {
            fs.unlinkSync(config.ipcPath);
            if (fs.existsSync(config.ipcPath)) {
                throw new Error(`IPC Path ${config.ipcPath} already exists and could not be deleted.`);
            }
        }

        // Create the server
        this.server = createServer((socket) => {
            this.logger.verbose(`IPC client connected: ${socket.localAddress}:${socket.localPort}`);
            this.clientList.push(socket);

            socket.on('end', () => {
                this.logger.verbose(`IPC client disconnected: ${socket.localAddress}:${socket.localPort}`);
                this.clientList = this.clientList.filter(c => c !== socket);
            });

            socket.on('error', (err) => {
                this.logger.verbose(`IPC client error: ${socket.localAddress}:${socket.localPort} - ${err}`);
                this.clientList = this.clientList.filter(c => c !== socket);
            });
        });

        // Listen on path
        this.server.listen(config.ipcPath, () => {
            this.logger.info(`IPC server listening on ${config.ipcPath}`);
        });
    }

    public broadcast(data: string): Promise<void[]> {
        return Promise.all(this.clientList
            .map(c => new Promise<void>((res) => {
                c.write(data, _ => res());
            }))
        );
    }

    public async shutdown(): Promise<boolean> {
        this.logger.info("IPC shutting down");
        await this.broadcast('shutdown');
        await Promise.all(this.clientList.map(c => new Promise<void>(res => {
            c.end(res);
        })));
        await new Promise<void>(res => {
            this.server.close(_ => res());
        });
        return true;
    }
}