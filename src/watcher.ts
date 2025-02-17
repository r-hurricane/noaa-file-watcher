import {ConfigPath, ConfigWatcher} from "./config.js";
import createLogger from "./logging.js";
import {FileDatabase} from "./database/database.js";
import {FtpFileService} from "./services/ftpFileService.js";
import {Logger} from 'winston';
import {HttpFileService} from "./services/httpFileService.js";
import {IFileService} from "./services/fileService.js";

export class Watcher {

    private readonly database: FileDatabase;
    private readonly watcherConfig: ConfigWatcher;
    private readonly pathConfig: ConfigPath;
    private readonly baseUrl: URL;
    private readonly logger: Logger;

    private running: boolean = false;
    private timeout: NodeJS.Timeout | null = null;

    public constructor(database: FileDatabase, watcherConfig: ConfigWatcher, pathConfig: ConfigPath) {
        this.database = database;
        this.watcherConfig = watcherConfig;
        this.pathConfig = pathConfig;
        this.baseUrl = new URL(pathConfig.path, watcherConfig.baseUrl);
        this.logger = createLogger(`Watcher (${this.baseUrl})`);

        this.schedule();
    }

    private schedule() : void {
        setImmediate(async () => { await this.watch(); });
        this.timeout = setTimeout(this.schedule.bind(this), this.getFrequency() * 1000);
    }

    private getFrequency() : number {
        const freq = this.pathConfig.freq || this.watcherConfig.freq || 60;

        // TODO: Handle the path.freqFunc
        if (this.pathConfig.freqFunc)
            this.logger.warn(`FreqFunc not supported at this time. Using ${freq}.`);

        return freq;
    }

    private async watch() : Promise<void> {
        this.running = true;
        try {
            // List the files to get their latest last-modified
            const fileService = this.getFileService();
            const files = await fileService.listFiles();

            // Query the database for the same files found
            const dbLatest = this.database.getAllLatest(files);
            this.logger.info(dbLatest.size);
            files.forEach(f => this.logger.info(f.url.href));
            files.forEach(f => this.database.insertFile({
                    id: null,
                    href: f.url.href,
                    code: null,
                    modifiedOn: f.lastModified?.getTime() ?? null,
                    savePath: f.url.pathname
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
        const urlScheme = this.baseUrl.protocol.replace(/:$/, '');
        switch (urlScheme) {
            case 'ftp':
                return new FtpFileService(this.watcherConfig, this.pathConfig);
            case 'http':
            case 'https':
                return new HttpFileService(this.watcherConfig, this.pathConfig);
            default:
                throw new Error('Unknown file service type ' + urlScheme);
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