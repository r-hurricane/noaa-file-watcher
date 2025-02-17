import {config, ConfigPath, ConfigWatcher} from "./config.js";
import {createLogger} from "./logging.js";
import * as dateFns from 'date-fns';
import {DiscordNotifier} from "./notifications/discord.js";
import {FileDatabase, INoaaFileModel} from "./database/fileDatabase.js";
import fs from "node:fs";
import {FtpFileService} from "./services/ftpFileService.js";
import {HttpFileService} from "./services/httpFileService.js";
import {IFileInfo, IFileService} from "./services/fileService.js";
import {Logger} from 'winston';
import nodePath from "node:path";
import {parsers} from './parsers/index.js';
import {IpcController} from "./notifications/ipcSocket.js";
import {IParserResult} from "./parsers/parser.js";

export class Watcher {

    private readonly database: FileDatabase;
    private readonly ipcController: IpcController;
    private readonly watcherConfig: ConfigWatcher;
    private readonly pathConfig: ConfigPath;
    private readonly baseUrl: URL;
    private readonly logger: Logger;

    private running: boolean = false;
    private timeout: NodeJS.Timeout | null = null;

    public constructor(database: FileDatabase, ipcController: IpcController, watcherConfig: ConfigWatcher, pathConfig: ConfigPath) {
        this.database = database;
        this.ipcController = ipcController;
        this.watcherConfig = watcherConfig;
        this.pathConfig = pathConfig;
        this.baseUrl = new URL(nodePath.normalize(nodePath.join(watcherConfig.baseUrl, pathConfig.path)));
        this.logger = createLogger(`Watcher (${this.baseUrl})`);

        this.schedule();
    }

    private schedule() : void {
        setImmediate(async () => { await this.watch(); });
        this.timeout = setTimeout(this.schedule.bind(this), this.getFrequency() * 60000);
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
            const dbLatest = await this.database.getAllLatest(files);

            // For each file listing, check if an update is needed
            for (const f of files) {
                try {
                    await this.checkFile(f, dbLatest, fileService);
                } catch (error) {
                    this.logger.error(`Failed to download the contents of new file: ${f}`);
                    this.logger.error(error);
                    await DiscordNotifier.Send(`<@beach> Failed to download the contents of new file: ${f}`, error);
                }
            }

        } catch (error) {
            this.logger.error(`Error running watch checks on ${this.baseUrl}:`);
            this.logger.error(error);
            await DiscordNotifier.Send(`<@beach> Error running watch checks on ${this.baseUrl}:`, error);
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

    private async checkFile(file: IFileInfo, dbLatest: Map<string, INoaaFileModel | null>, fileService: IFileService) {
        this.logger.verbose(`Checking file ${file}`);

        // See if exists in database
        const dbEntry = dbLatest.get(file.url.href);
        if (dbEntry) {
            this.logger.debug(`DB: ${dbEntry} | File: ${JSON.stringify(file)}`)

            // If the last modified matches, continue to the next file
            if (dbEntry.modified_on === file.lastModified?.getTime().toString()) {
                this.logger.debug(`Existing database modifiedOn ${dbEntry.modified_on} matches source lastModified datetime ${file.lastModified?.getTime()}.`);
                return;
            }

            this.logger.debug(`Existing database modifiedOn ${dbEntry.modified_on} does not match source lastModified datetime ${file.lastModified?.getTime()}.`);
        } else {
            this.logger.debug("No existing database entry found.");
        }

        // Log message about new file available
        this.logger.info(`New version of ${file} detected`);

        // Fetch the contents of the new file
        const fileContents = await fileService.downloadFile(file.url.pathname);

        // Check not null
        if (!fileContents) {
            this.logger.error(`Failed to download the contents of ${file}`);
            await DiscordNotifier.Send(`Failed to download the contents of new file ${file}`);
            return;
        }

        // Get the save file path
        const modifiedDate = file.lastModified ?? new Date();
        const pathDate = dateFns.format(modifiedDate, 'yyyy\'/\'MM');
        const saveDir = nodePath.join(config.dataPath, pathDate, nodePath.dirname(file.url.pathname));
        const fileDate = dateFns.format(modifiedDate, 'dd-HHmm');
        const savePath = nodePath.resolve(nodePath.join(saveDir, `${fileDate}-${nodePath.basename(file.url.pathname)}`));

        // Check folder exists
        if (!fs.existsSync(saveDir)) {
            this.logger.info('Creating save directory: ' + saveDir);
            fs.mkdirSync(saveDir, { recursive: true });
        }

        // Write raw text to text file
        this.logger.verbose(`Saving new file to file system: ${savePath}`);
        fs.writeFileSync(savePath, fileContents);

        // Run parser if specified
        let parseResult: IParserResult | null = null;
        if (this.pathConfig.parser && this.pathConfig.parser.toLowerCase() !== 'none') {
            const parser = parsers.get(this.pathConfig.parser.toLowerCase());
            if (!parser)
                throw new Error(`Unknown parser type ${(this.pathConfig.parser)}`);
            parseResult = await parser.parse(file, savePath, fileContents);
        }

        // Save the new entry to the database for the next check
        await this.database.insertFile({
            id: null,
            href: file.url.href,
            code: parseResult?.code ?? null,
            modified_on: file.lastModified?.getTime().toString() ?? null,
            savePath: savePath
        });

        // Send notification to the IPC Clients
        await this.ipcController.broadcast('new', {
            file: file,
            savePath: savePath,
            parser: this.pathConfig.parser,
            code: parseResult?.code,
            json: parseResult?.json
        });
    }

    public async shutdown() : Promise<boolean> {
        this.logger.verbose('Received shutdown signal.');

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        let attempt = 0;
        while (this.running && ++attempt <= 5) {
            this.logger.info('Currently processing a watch. Waiting 1 second.');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (this.running) {
            this.logger.error('Watcher did not shut down in time.');
        }

        return !this.running;
    }
}