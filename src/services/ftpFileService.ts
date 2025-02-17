import {Client} from 'basic-ftp';
import {ConfigPath, ConfigWatcher} from "../config.js";
import * as dateFns from 'date-fns';
import {FileServiceBase,FileInfo} from "./fileService.js";
import nodePath from 'node:path';
import {Writable} from 'stream';

export class FtpFileService extends FileServiceBase {

    private readonly client: Client;
    private readonly baseUrl: string;

    public constructor(watcher: ConfigWatcher, path: ConfigPath) {
        super(watcher, path, "FTP");
        this.client = new Client();
        this.client.ftp.verbose = true;
        this.baseUrl = nodePath.normalize(watcher.base + "/" + path.path);

        if (this.pathConfig.literal) {

            if (this.pathConfig.files.length !== 1)
                throw new Error('Literal path can only be used with one file.');

            this.baseUrl = nodePath.normalize(this.baseUrl + "/" + this.pathConfig.files[0]);
        }
    }

    public override async listFiles(): Promise<Array<FileInfo>> {
        await this.access();
        const files = await this.client.list(this.baseUrl);
        return files
            .filter(f => this.pathConfig.files
                .some(c => f.name.match(c)))
            .map(f => new FileInfo(
                this.normalizeFilePath(f.name),
                this.parseDate(f.rawModifiedAt),
                f.size)
            );
    }

    public override async downloadFile(file: string): Promise<string | null> {
        const chunks: Array<Buffer> = [];
        const myStream = new Writable({
            write(chunk, _, callback) {
                chunks.push(chunk);
                callback();
            }
        });
        await this.client.downloadTo(myStream, this.normalizeFilePath(file));
        return Buffer.concat(chunks).toString();
    }

    private normalizeFilePath(file: string): string {
        return nodePath.normalize(file.startsWith(this.baseUrl) ? file : this.baseUrl + '/' + file);
    }

    private parseDate(dateStr: string): Date | null {
        // If the date ends with a Z, it is the ISO and should parse directly
        if (dateStr.endsWith('Z'))
            return new Date(dateStr);

        // If the date looks like MMM dd yyyy
        if (dateStr.match(/\w{3}\s+\d\d?\s+\d{4}/))
            return dateFns.parse(dateStr, 'MMM dd yyyy', new Date());

        // If the date looks like MMM dd HH:mm
        if (dateStr.match(/\w{3}\s+\d\d?\s+\d{2}:\d{2}/))
            return dateFns.parse(dateStr, 'MMM dd HH:mm', new Date());

        this.logger.warn(`Unknown date format: ${dateStr}`);
        return null;
    }

    private async access() {
        const colPos = this.watcherConfig.host.indexOf(':');
        const host = colPos >= 0 ? this.watcherConfig.host.substring(0, colPos) : this.watcherConfig.host;
        const port = colPos >= 0 ? parseInt(this.watcherConfig.host.substring(colPos +1)) : 21;
        return this.client.access({
            host: host,
            port: port
        });
    }

}