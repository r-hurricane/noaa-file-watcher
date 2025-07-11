﻿import {config} from '../config.js';
import {createLogger, setLogLevel} from "../logging.js";
import {Logger} from "winston";
import {createServer, Server, Socket} from "node:net";
import * as fs from 'node:fs';
import path from "node:path";
import {Watcher} from "../watcher.js";

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
                const dataStr = data.toString();
                if (!dataStr || dataStr.length <= 0) return;

                // If received command string, perform command
                if (this.actionCommand(dataStr, socket)) return;

                // Otherwise, set as name (backwards compatibility)
                const oldName = socketName;
                socketName = dataStr;
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

    private actionCommand(paramStr: string, socket: Socket): boolean {
        // Split param string into param
        const params = paramStr.trim().split(/\s+/);

        // Force cmd to lower
        const cmd = params[0].toLowerCase();

        // Helper for sending message back to client
        const sendMsg = (msg: string, close: boolean = true) => {
            socket.cork();
            socket.write(msg);
            process.nextTick(() => {
                socket.uncork();
                if (close) socket.end();
            });
        };

        switch (cmd) {

            // Set log level
            case 'loglevel':
                sendMsg(setLogLevel(params[1], params[2]));
                return true;

            // Force check of specific file or all files
            case 'check':
                Watcher.Watchers.forEach(w => w.watch());
                sendMsg('Triggered checks');
                return true;
        }

        return false;
    }
}