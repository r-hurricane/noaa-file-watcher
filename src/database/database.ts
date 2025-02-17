// noinspection SqlNoDataSourceInspection

import { config } from '../config.js';
import fs from "fs";
import createLogger from "../logging.js";
import { DatabaseSync } from 'node:sqlite';

const logger = createLogger('Database');

export class FileDatabase {

    private readonly handle: DatabaseSync;

    constructor() {
        const filePath = config.databaseFile;
        logger.debug(`Opening database: ${filePath}`);

        const dbExists = fs.existsSync(filePath);
        this.handle = new DatabaseSync(filePath);

        if (!this.handle)
            throw new Error(`Failed to open database file at ${filePath}.`);

        if (dbExists)
            return;

        logger.debug('Creating new database schema.');
        this.handle.exec(`CREATE TABLE FILE(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issued INTEGER,
            filePath TEXT);`);
        this.handle.exec(`CREATE UNIQUE INDEX UX_FILE_issued ON FILE(issued);`);
    }

    public query() : string {
        return 'hello';
    }
}