import {ConfigPath, ConfigWatcher} from "../config.js";
import {FileServiceBase,FileInfo} from "./fileService.js";
import * as dateFns from "date-fns";

export class HttpFileService extends FileServiceBase {

    public constructor(watcher: ConfigWatcher, path: ConfigPath) {
        super(watcher, path, "HTTP");
    }

    public override async listFiles(): Promise<Array<FileInfo>> {
        const fileInfos: Array<FileInfo> = [];
        for (let f of this.pathConfig.files) {
            const url = this.normalizeFilePath(f);
            this.logger.debug(`Requesting HEAD for ${url}`);
            const fReq = await this.fetchFile(url, true);
            this.logger.debug(`Received HEAD for ${url}: ${fReq}`);
            fileInfos.push(new FileInfo(
                url,
                this.parseDate(fReq.headers.get('Last-Modified')),
                parseInt(fReq.headers.get('Content-Length') || '0'))
            );
        }
        return fileInfos;
    }

    public override async downloadFile(file: string): Promise<string | null> {
        this.logger.debug(`Downloading file contents ${file}`);
        const response = await this.fetchFile(this.normalizeFilePath(file), false);
        this.logger.debug(`Received file contents ${file}`);
        const text = response.text();
        if (this.logger.isSillyEnabled()) this.logger.silly(text);
        return text;
    }

    private async fetchFile(url: URL, headOnly: boolean): Promise<Response> {
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