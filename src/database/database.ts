// noinspection SqlNoDataSourceInspection

import {config} from '../config.js';
import {createLogger} from "../logging.js";
import {DatabaseSync} from 'node:sqlite';
import fs from "fs";
import {Logger} from "winston";
import path from "node:path";
import {IFileInfo} from "../services/fileService.js";

export class FileDatabase {

    private readonly handle: DatabaseSync;
    private readonly logger: Logger;

    public constructor() {
        this.logger = createLogger('Database');

        const filePath = config.databaseFile;
        this.logger.debug(`Opening database: ${filePath}`);

        const dbExists = fs.existsSync(filePath);

        const dirName = path.dirname(filePath);
        if (!fs.existsSync(dirName))
            fs.mkdirSync(dirName, { recursive: true});

        this.handle = new DatabaseSync(filePath);

        if (!this.handle)
            throw new Error(`Failed to open database file at ${filePath}.`);

        if (dbExists)
            return;

        this.logger.debug('Creating new database schema.');
        this.handle.exec(`CREATE TABLE NoaaFile(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            href TEXT,
            code TEXT,
            modifiedOn INTEGER,
            savePath TEXT
        );`);
        this.handle.exec(`CREATE INDEX UX_NoaaFile_href ON NoaaFile(href);`);
        this.handle.exec(`CREATE INDEX UX_NoaaFile_code ON NoaaFile(code);`);
        this.handle.exec(`CREATE INDEX UX_NoaaFile_modifiedOn ON NoaaFile(modifiedOn);`);
        this.handle.exec(`CREATE UNIQUE INDEX UX_NoaaFile_href_modifiedOn ON NoaaFile(href, modifiedOn);`);
    }

    public getAllLatest(files: Array<IFileInfo>): Map<string, NoaaFileModel | null> {
        const select = this.handle.prepare(`
            SELECT id, href, code, modifiedOn, savePath
            FROM NoaaFile
            WHERE href=@href
            ORDER BY modifiedOn DESC LIMIT 1
        `);

        const result = new Map<string, NoaaFileModel | null>();
        for (const file of files) {
            const dbEntry = select.get({href: file.url.href});
            result.set(file.url.href, dbEntry ? new NoaaFileModel({...dbEntry} as INoaaFileModel) : null);
        }

        return result;
    }

    public insertFile(file: INoaaFileModel) {
        this.handle.prepare(`INSERT INTO NoaaFile(href, code, modifiedOn, savePath) VALUES (@href, @code, @modifiedOn, @savePath)`)
            .run({href: file.href, code: file.code, modifiedOn: file.modifiedOn, savePath: file.savePath});
    }

}

export interface INoaaFileModel {
    id: number | null;
    href: string | null;
    code: string | null;
    modifiedOn: number | null;
    savePath: string | null;
}

export class NoaaFileModel implements INoaaFileModel {
    public id: number | null = null;
    public href: string | null = null;
    public code: string | null = null;
    public modifiedOn: number | null = null;
    public savePath: string | null = null;

    public constructor(param: INoaaFileModel)
    {
        this.id = param?.id ?? null;
        this.href = param?.href ?? null;
        this.code = param?.code ?? null;
        this.modifiedOn = param?.modifiedOn ?? null;
        this.savePath = param?.savePath ?? null;
    }

    public toString(): string {
        return `NoaaFile(id=${this.id}, href=${this.href}, code=${this.code}, modifiedOn=${this.modifiedOn}, savePath=${this.savePath})`;
    }
}