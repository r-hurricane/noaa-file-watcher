import {ConfigPath, ConfigWatcher} from "./config.js";
import createLogger from "./logging.js";
import {FileDatabase} from "./database/database.js";
import {FtpFileService} from "./services/ftpFileService.js";
import {Logger} from 'winston';
import {HttpFileService} from "./services/httpFileService.js";
import {IFileService} from "./services/fileService.js";

export class Watcher {

    private readonly database: FileDatabase;
    private readonly watcher: ConfigWatcher;
    private readonly path: ConfigPath;
    private readonly logger: Logger;

    private timeout: NodeJS.Timeout | null = null;

    public constructor(database: FileDatabase, watcher: ConfigWatcher, path: ConfigPath) {
        this.database = database;
        this.watcher = watcher;
        this.path = path;
        this.logger = createLogger(`Watcher (${watcher.host}${watcher.base}${path.path})`);

        this.schedule();
    }

    private schedule() : void {
        (async () => { await this.watch(); })();
        this.timeout = setTimeout(this.schedule.bind(this), this.getFrequency() * 1000);
    }

    private getFrequency() : number {
        // TODO: Handle the path.freqFunc
        if (this.path.freqFunc)
            this.logger.warn(`FreqFunc not supported at this time. Using ${this.path.freq || this.watcher.freq || 60}.`);
        return this.path.freq || this.watcher.freq || 60;
    }

    private async watch() : Promise<void> {
        try {
            const fileService = this.getFileService();
            const files = await fileService.listFiles();
            const fileContents = await fileService.downloadFile(files[0].path);
            files.forEach(f => this.logger.info(`${f.path} - ${f.lastModified} - ${f.size}`));
            this.logger.info(fileContents);
            this.logger.info(this.database.query());
        } catch(error) {
            this.logger.error(error);
        }
    }

    private getFileService(): IFileService {
        switch (this.watcher.type) {
            case 'ftp':
                return new FtpFileService(this.watcher, this.path);
            case 'http':
                return new HttpFileService(this.watcher, this.path);
            default:
                throw new Error('Unknown file service type ' + this.watcher.type);
        }
    }

    public shutdown() : void {
        this.logger.debug("Received shutdown signal.");

        if (this.timeout)
            clearTimeout(this.timeout);
    }
}