import {Client} from 'basic-ftp';
import {ConfigPath, ConfigWatcher} from "../config.js";
import {FileServiceBase,FileInfo} from "./fileService.js";
import {Writable} from 'stream';

export class FtpFileService extends FileServiceBase {

    private readonly client: Client;
    private readonly path: string;

    public constructor(watcher: ConfigWatcher, path: ConfigPath) {
        super(watcher, path, "FTP");
        this.client = new Client();
        this.path = watcher.base + "/" + path.path;
    }

    public override async listFiles(): Promise<Array<FileInfo>> {
        await this.access();
        const files = await this.client.list(this.path);
        return files.map(f => new FileInfo(f.name, f.rawModifiedAt, f.size));
    }

    public override async downloadFile(file: string): Promise<string | null> {
        const chunks: Array<Buffer> = [];
        const myStream = new Writable({
            write(chunk, _, callback) {
                chunks.push(chunk);
                callback();
            }
        });
        await this.client.downloadTo(myStream, this.path + '/' + file);
        return Buffer.concat(chunks).toString();
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