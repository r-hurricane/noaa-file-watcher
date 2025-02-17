import {config} from '../config.js';
import {createLogger} from "../logging.js";
import {Logger} from "winston";
import {createServer, Server, Socket} from "node:net";
import * as fs from 'node:fs';
import path from "node:path";

export class IpcController {

    private readonly logger: Logger;
    private readonly server: Server;

    private clientList: Socket[] = [];

    public static Start(): Promise<IpcController> {
        return new Promise<IpcController>((res, _rej) => {
            const inst = new IpcController(() => {
               res(inst);
            });
        });
    }

    constructor(cb: () => void) {
        this.logger = createLogger('IpcController');

        // Ensure the dir is created
        const dirName = path.dirname(config.ipcPath);
        if (!fs.existsSync(dirName))
            fs.mkdirSync(dirName, { recursive: true});

        // Confirm path does not exist. Try and delete if it does.
        if (fs.existsSync(config.ipcPath)) {
            fs.unlinkSync(config.ipcPath);
            if (fs.existsSync(config.ipcPath)) {
                throw new Error(`IPC Path ${config.ipcPath} already exists and could not be deleted.`);
            }
        }

        // Create the server
        this.server = createServer((socket) => {
            let socketName = new Date().getTime().toString();
            this.logger.verbose(`IPC client connected: ${socketName}`);
            this.clientList.push(socket);

            socket.on('data', data => {
                const oldName = socketName;
                socketName = data.toString();
                this.logger.verbose(`IPC client ${oldName} => ${socketName}`);
            });

            socket.on('end', () => {
                this.logger.verbose(`IPC client disconnected: ${socketName}`);
                this.clientList = this.clientList.filter(c => c !== socket);
            });

            socket.on('error', (err) => {
                this.logger.verbose(`IPC client error: ${socketName} - ${err}`);
                this.clientList = this.clientList.filter(c => c !== socket);
            });
        });

        // Add error handler
        this.server.on('error', err => {
            this.logger.error(err);
            throw err;
        });

        // Listen on path
        this.server.listen(config.ipcPath, () => {
            this.logger.info(`IPC server listening on ${config.ipcPath}`);
            cb();
        });
    }

    public broadcast(cmd: string, data?: object | null): Promise<void[]> {
        const message = JSON.stringify({ cmd, data });
        this.logger.debug(`Sending data to IPC Channel: ${message}`);
        return Promise.all(this.clientList
            .map(c => new Promise<void>((res) => {
                c.cork();
                c.write(String.fromCharCode(2) + message + String.fromCharCode(3), _ => res());
                process.nextTick(() => c.uncork());
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