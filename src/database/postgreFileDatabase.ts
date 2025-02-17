// noinspection SqlNoDataSourceInspection

import {config} from '../config.js';
import {createLogger} from "../logging.js";
import {Logger} from "winston";
import {IFileInfo} from "../services/fileService.js";
import {INoaaFileModel, NoaaFileModel, FileDatabase} from "./fileDatabase.js";
import pg, {PoolClient} from 'pg';
const {Pool} = pg;

export class PostgreFileDatabase extends FileDatabase {

    private readonly pool: pg.Pool;
    private readonly logger: Logger;

    public constructor() {
        super();

        const logger = createLogger('Postgre');
        this.logger = logger;

        this.pool = new Pool({
            connectionString: config.database,
            connectionTimeoutMillis: 10000
        });
        this.pool.on('error', (err: Error, _client: PoolClient) => {
            logger.error(err);
        });
    }

    public override async connect(): Promise<void> {
        // Open the connection
        this.logger.verbose(`Opening database: ${config.database}`);
        const client = await this.pool.connect();

        // Check if the database has been initialized
        const result = await client.query(`SELECT * FROM information_schema.tables WHERE table_name = 'noaa_file';`);
        if (result.rows.length > 0) {
            client.release();
            return;
        }

        // If the database has not been initialized, initialize it
        this.logger.info('Creating new database schema.');
        await client.query(`CREATE TABLE noaa_file(
            id SERIAL PRIMARY KEY,
            href TEXT,
            code TEXT,
            modified_on BIGINT,
            savePath TEXT
        );`);
        await client.query(`CREATE INDEX UX_noaa_file_href ON noaa_file(href);`);
        await client.query(`CREATE INDEX UX_noaa_file_code ON noaa_file(code);`);
        await client.query(`CREATE INDEX UX_noaa_file_modified_on ON noaa_file(modified_on);`);
        await client.query(`CREATE UNIQUE INDEX UX_noaa_file_href_modified_on ON noaa_file(href, modified_on);`);

        client.release();
    }

    public override async getAllLatest(files: Array<IFileInfo>): Promise<Map<string, NoaaFileModel | null>> {
        const sqlStmt = `
            SELECT id, href, code, modified_on, savePath
            FROM noaa_file
            WHERE href=$1::text
            ORDER BY modified_on DESC LIMIT 1;
        `;

        const client = await this.pool.connect();
        const result = new Map<string, NoaaFileModel | null>();
        for (const file of files) {
            const dbEntry = await client.query(sqlStmt, [file.url.href]);
            result.set(file.url.href, dbEntry ? new NoaaFileModel({...(dbEntry.rows[0])} as INoaaFileModel) : null);
        }
        client.release();

        return result;
    }

    public override async insertFile(file: INoaaFileModel): Promise<void> {
        const sqlStmt = `INSERT INTO noaa_file(href, code, modified_on, savePath) VALUES ($1::text, $2::text, $3::bigint, $4::text);`;
        const client = await this.pool.connect();
        await client.query(sqlStmt, [file.href, file.code, file.modified_on, file.savePath]);
        client.release();
    }

    public override async end(): Promise<void> {
        await this.pool.end();
    }

}