import { FileDatabase } from "../database/database.js";
import { ConfigWatcher } from "../config.js";
import createLogger from "../logging.js";
import { Logger } from 'winston';

export abstract class Watcher {

    protected readonly database: FileDatabase;
    protected readonly config: ConfigWatcher;
    protected readonly logger: Logger;
    protected readonly intervals: Array<NodeJS.Timeout> = [];

    protected constructor(database: FileDatabase, config: ConfigWatcher, label: string) {
        this.database = database;
        this.config = config;
        this.logger = createLogger(label);

        this.start();
    }

    protected abstract watch() : void;

    protected start() : void {
        this.intervals.push(setInterval(() => {
            this.watch();
        }, 1000));
    }

    public shutdown() : void {
        this.logger.info("Received shutdown");
        this.intervals.forEach(i => clearInterval(i));
    }
}