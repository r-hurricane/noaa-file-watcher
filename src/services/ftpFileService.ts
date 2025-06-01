import {Client} from 'basic-ftp';
import {ConfigPath, ConfigWatcher} from "../config.js";
import * as dateFns from 'date-fns';
import {FileServiceBase,FileInfo} from "./fileService.js";
import {Writable} from 'node:stream';

export class FtpFileService extends FileServiceBase {

    private readonly client: Client;

    public constructor(watcher: ConfigWatcher, path: ConfigPath) {
        super(watcher, path, "FTP");
        this.client = new Client();
        //this.client.ftp.verbose = true;
    }

    public override async listFiles(): Promise<Array<FileInfo>> {
        await this.access();
        this.logger.debug('Starting file list request');
        const files = await this.client.list(this.baseUrl.pathname);
        this.logger.debug(`Received ${files.length} files from server`);
        return files
            .filter(f => this.pathConfig.files
                .some(c => f.name.match(c)))
            .map(f => new FileInfo(
                this.normalizeFilePath(f.name),
                this.parseDate(f.rawModifiedAt),
                f.size)
            );
    }

    public override async downloadFile(file: string): Promise<Uint8Array<ArrayBufferLike> | null> {
        const chunks: Uint8Array<ArrayBufferLike>[] = [];
        const myStream = new Writable({
            write(chunk, _, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        const downloadPath = this.normalizeFilePath(file).pathname;
        this.logger.debug(`Starting to download file contents from FTP: ${downloadPath}`);
        await this.client.downloadTo(myStream, downloadPath);
        this.logger.debug(`Finished downloading file contents from FTP: ${downloadPath}`);
        const result = Buffer.concat(chunks);
        if (this.logger.isSillyEnabled()) this.logger.silly(result.toString());
        return result;
    }

    private parseDate(dateStr: string): Date | null {
        this.logger.debug(`Parsing FTP file date: ${dateStr}`);

        // If the date ends with a Z, it is the ISO and should parse directly
        if (dateStr.endsWith('Z'))
            return new Date(dateStr);

        // If the date looks like MMM dd yyyy
        if (dateStr.match(/\w{3}\s+\d\d?\s+\d{4}/))
            return dateFns.parse(dateStr, 'MMM dd yyyy', new Date());

        // If the date looks like MMM dd HH:mm (assuming date is UTC)
        if (dateStr.match(/\w{3}\s+\d\d?\s+\d{2}:\d{2}/)) {
            let now = new Date();
            let date = dateFns.parse(dateStr.replace('  ', ' ') + 'Z', 'MMM d HH:mmX', now);

            // If the date is in the future (by more than an hour) it was likely modified last year
            // i.e. Modified "Dec 28 21:07" but now is 1/1/2025 - The file wqs actually 12/28/2024 not 12/28/2025
            if (date.getTime() > now.getTime()+3600000)
                date = dateFns.addYears(date, -1);

            return date;
        }

        this.logger.warn(`Unknown date format: ${dateStr}`);
        return null;
    }

    private async access() {
        this.logger.debug(`Connecting to ${this.baseUrl}`);
        return this.client.access({
            host: this.baseUrl.hostname,
            port: parseInt(this.baseUrl.port) || 21
        });
    }

}
