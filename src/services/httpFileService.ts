import {ConfigPath, ConfigWatcher} from "../config.js";
import {FileServiceBase,FileInfo} from "./fileService.js";
import nodePath from "node:path";
import * as dateFns from "date-fns";

export class HttpFileService extends FileServiceBase {

    private readonly path: string;

    public constructor(watcher: ConfigWatcher, path: ConfigPath) {
        super(watcher, path, "HTTP");
        this.path = nodePath.normalize(watcher.base + "/" + path.path);
    }

    public override async listFiles(): Promise<Array<FileInfo>> {
        const fileInfos: Array<FileInfo> = [];
        for (let f of this.pathConfig.files) {
            const url = this.normalizeFilePath(f);
            const fReq = await this.fetchFile(url, true);
            fileInfos.push(new FileInfo(
                url,
                this.parseDate(fReq.headers.get('Last-Modified')),
                parseInt(fReq.headers.get('Content-Length') || '0'))
            );
        }
        return fileInfos;
    }

    public override async downloadFile(file: string): Promise<string | null> {
        const response = await this.fetchFile(this.normalizeFilePath(file), false);
        return response.text();
    }

    private normalizeFilePath(file: string): string {
        return nodePath.normalize(file.startsWith(this.path) ? file : this.path + '/' + file);
    }

    private async fetchFile(file: string, headOnly: boolean): Promise<Response> {
        const url = 'https://' + this.watcherConfig.host + '/' + file;
        return await fetch(url, { method: headOnly ? 'HEAD' : 'GET' });
    }

    private parseDate(dateStr: string | null): Date | null {
        // If null, return null
        if (!dateStr)
            return null;

        // If the date looks like MMM dd yyyy
        const match = dateStr.match(/\w{3}, (\d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2}) GMT/);
        if (match)
            return dateFns.parse(match[1], 'dd MMM yyyy HH:mm:ss', new Date())

        this.logger.warn(`Unknown date format: ${dateStr}`);
        return null;
    }

}