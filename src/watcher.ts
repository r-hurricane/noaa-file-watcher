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

    private running: boolean = false;
    private timeout: NodeJS.Timeout | null = null;

    public constructor(database: FileDatabase, watcher: ConfigWatcher, path: ConfigPath) {
        this.database = database;
        this.watcher = watcher;
        this.path = path;
        this.logger = createLogger(`Watcher (${watcher.host}${watcher.base}${path.path})`);

        this.schedule();
    }

    private schedule() : void {
        setImmediate(async () => { await this.watch(); });
        this.timeout = setTimeout(this.schedule.bind(this), this.getFrequency() * 1000);
    }

    private getFrequency() : number {
        // TODO: Handle the path.freqFunc
        if (this.path.freqFunc)
            this.logger.warn(`FreqFunc not supported at this time. Using ${this.path.freq || this.watcher.freq || 60}.`);
        return this.path.freq || this.watcher.freq || 60;
    }

    private async watch() : Promise<void> {
        this.running = true;
        try {
            // List the files to get their latest last-modified
            const fileService = this.getFileService();
            const files = await fileService.listFiles();

            // Query the database for the same files found
            const dbLatest = this.database.getAllLatest(files);


            files.forEach(f => this.logger.info(f.toString()));
            files.forEach(f => this.database.insertFile({
                    id: null,
                    fileName: `${this.watcher.type}://${this.watcher.host}${f.path}`,
                    code: null,
                    modifiedOn: f.lastModified?.getTime() ?? null,
                    rawPath: f.path
                }));
            //const fileContents = await fileService.downloadFile(files[0].path);
            //this.logger.info(fileContents);
            //this.logger.info(this.database.getLatest(`${this.watcher.type}://${this.watcher.host}/atcf/btk/bep032024.dat`)?.toString() ?? 'Not Found');
            //this.logger.info(this.database.getLatest(`${this.watcher.type}://${this.watcher.host}/atcf/btk/bep032024.dat`, "test")?.toString() ?? 'Not Found');
        } catch(error) {
            this.logger.error(error);
        }
        this.running = false;
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

    public async shutdown() : Promise<boolean> {
        this.logger.debug("Received shutdown signal.");

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        let attempt = 0;
        while (this.running && ++attempt <= 5) {
            this.logger.debug('Currently processing a watch. Waiting 1 second.');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        return !this.running;
    }
}