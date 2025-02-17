import createLogger from "../logging.js";
import {Logger} from "winston";
import {ConfigPath, ConfigWatcher} from "../config.js";

export interface IFileInfo {
    path: string,
    lastModified: Date | null,
    size: number
}

export class FileInfo implements IFileInfo {
    public readonly path: string;
    public readonly lastModified: Date | null;
    public readonly size: number;

    public constructor(path: string, lastModified: Date | null, size: number) {
        this.path = path;
        this.lastModified = lastModified;
        this.size = size;
    }

    public toString(): string {
        return `${this.path} - ${this.lastModified?.toISOString() ?? ' <NULL> '} - ${this.size}`;
    }
}

export interface IFileService {
    listFiles: () => Promise<Array<FileInfo>>,
    downloadFile: (file: string) => Promise<string | null>;
}

export abstract class FileServiceBase implements IFileService {

    protected readonly watcherConfig: ConfigWatcher;
    protected readonly pathConfig: ConfigPath;
    protected readonly logger: Logger;

    protected constructor(watcher: ConfigWatcher, path: ConfigPath, label: string) {
        this.watcherConfig = watcher;
        this.pathConfig = path;
        this.logger = createLogger(`${label} (${watcher.host}/${path.path})`);
    }

    public abstract listFiles(): Promise<Array<FileInfo>>;
    public abstract downloadFile(file: string): Promise<string | null>;
}