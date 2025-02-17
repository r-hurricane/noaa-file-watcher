// noinspection SqlNoDataSourceInspection

import {config} from '../config.js';
import {createLogger} from "../logging.js";
import {DatabaseSync} from 'node:sqlite';
import fs from "fs";
import {Logger} from "winston";
import path from "node:path";
import {IFileInfo} from "../services/fileService.js";
import {INoaaFileModel, NoaaFileModel, FileDatabase} from "./fileDatabase.js";

export class SqliteFileDatabase extends FileDatabase {

    private readonly logger: Logger;
    private handle: DatabaseSync | null = null;

    public constructor() {
        super();

        this.logger = createLogger('Database');
    }

    public override async connect(): Promise<void> {

        const filePath = config.database;
        this.logger.verbose(`Opening database: ${filePath}`);

        const dbExists = fs.existsSync(filePath);

        const dirName = path.dirname(filePath);
        if (!fs.existsSync(dirName))
            fs.mkdirSync(dirName, { recursive: true});

        this.handle = new DatabaseSync(filePath);

        if (!this.handle)
            throw new Error(`Failed to open database file at ${filePath}.`);

        if (dbExists)
            return;

        this.logger.info('Creating new database schema.');
        this.handle.exec(`CREATE TABLE NoaaFile(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            href TEXT,
            code TEXT,
            modified_on INTEGER,
            savePath TEXT
        );`);
        this.handle.exec(`CREATE INDEX UX_NoaaFile_href ON NoaaFile(href);`);
        this.handle.exec(`CREATE INDEX UX_NoaaFile_code ON NoaaFile(code);`);
        this.handle.exec(`CREATE INDEX UX_NoaaFile_modified_on ON NoaaFile(modified_on);`);
        this.handle.exec(`CREATE UNIQUE INDEX UX_NoaaFile_href_modified_on ON NoaaFile(href, modified_on);`);
    }

    public override async getAllLatest(files: Array<IFileInfo>): Promise<Map<string, NoaaFileModel | null>> {
        if (!this.handle) throw new Error("Not connected");
        const select = this.handle.prepare(`
            SELECT id, href, code, modified_on, savePath
            FROM NoaaFile
            WHERE href=@href
            ORDER BY modified_on DESC LIMIT 1
        `);

        const result = new Map<string, NoaaFileModel | null>();
        for (const file of files) {
            const dbEntry = select.get({href: file.url.href});
            result.set(file.url.href, dbEntry ? new NoaaFileModel({...dbEntry} as INoaaFileModel) : null);
        }

        return result;
    }

    public override async insertFile(file: INoaaFileModel): Promise<void> {
        if (!this.handle) throw new Error("Not connected");
        this.handle.prepare(`INSERT INTO NoaaFile(href, code, modified_on, savePath) VALUES (@href, @code, @modified_on, @savePath)`)
            .run({href: file.href, code: file.code, modified_on: file.modified_on, savePath: file.savePath});
    }

    public override async end(): Promise<void> {

    }

}