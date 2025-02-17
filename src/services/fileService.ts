import {ConfigPath, ConfigWatcher} from "../config.js";
import createLogger from "../logging.js";
import nodePath from 'node:path';
import {Logger} from "winston";

export interface IFileInfo {
    url: URL,
    lastModified: Date | null,
    size: number
}

export class FileInfo implements IFileInfo {
    public readonly url: URL;
    public readonly lastModified: Date | null;
    public readonly size: number;

    public constructor(url: URL | string, lastModified: Date | null, size: number) {
        this.url = url instanceof URL ? url as URL : new URL(url);
        this.lastModified = lastModified;
        this.size = size;
    }

    public toString(): string {
        return `${this.url} - ${this.lastModified?.toISOString() ?? ' <NULL> '} - ${this.size}`;
    }
}

export interface IFileService {
    listFiles: () => Promise<Array<FileInfo>>,
    downloadFile: (file: string) => Promise<string | null>;
}

export abstract class FileServiceBase implements IFileService {
    protected readonly watcherConfig: ConfigWatcher;
    protected readonly pathConfig: ConfigPath;
    protected readonly baseUrl: URL;
    protected readonly logger: Logger;

    protected constructor(watcherConfig: ConfigWatcher, pathConfig: ConfigPath, label: string) {
        this.watcherConfig = watcherConfig;
        this.pathConfig = pathConfig;

        const watcherUrl = new URL(watcherConfig.baseUrl);
        let fullPath = nodePath.join(watcherUrl.pathname, pathConfig.path);

        if (this.pathConfig.literal) {

            if (this.pathConfig.files.length !== 1)
                throw new Error('Literal path can only be used with one file.');

            fullPath = nodePath.join(fullPath, this.pathConfig.files[0]);
        }

        this.baseUrl = new URL(nodePath.normalize(fullPath), watcherUrl);
        this.logger = createLogger(`${label}FileService (${this.baseUrl})`);

        this.logger.debug(`Setup filesystem with baseUrl: ${this.baseUrl}`);
    }

    public abstract listFiles(): Promise<Array<FileInfo>>;
    public abstract downloadFile(file: string): Promise<string | null>;

    protected normalizeFilePath(file: string): URL {
        const appendPath = file.startsWith(this.baseUrl.pathname)
            ? file
            : nodePath.normalize(this.baseUrl.pathname + '/' + file)
        return new URL(appendPath, this.baseUrl);
    }
}