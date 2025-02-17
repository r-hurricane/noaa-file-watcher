import {ConfigPath, ConfigWatcher} from "../config.js";
import {FileServiceBase,FileInfo} from "./fileService.js";

export class HttpFileService extends FileServiceBase {

    public constructor(watcher: ConfigWatcher, path: ConfigPath) {
        super(watcher, path, "HTTP");
    }

    public override async listFiles(): Promise<Array<FileInfo>> {
        const fileInfos: Array<FileInfo> = [];
        for (let f of this.pathConfig.files) {
            const fReq = await this.fetchFile(f, true);
            fileInfos.push(new FileInfo(f, fReq.headers.get('Last-Modified') || '', parseInt(fReq.headers.get('Content-Length') || '0')));
        }
        return fileInfos;
    }

    public override async downloadFile(file: string): Promise<string | null> {
        const response = await this.fetchFile(file, false);
        return response.text();
    }

    private async fetchFile(file: string, headOnly: boolean): Promise<Response> {
        const url = 'https://' + this.watcherConfig.host + this.watcherConfig.base + this.pathConfig.path + '/' + file;
        return await fetch(url, { method: headOnly ? 'HEAD' : 'GET' });
    }

}