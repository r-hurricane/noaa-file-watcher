import { ConfigWatcher } from "../../config.js";
import { FileDatabase } from "../../database/database.js";
import { Watcher } from "../watcher.js";

export class FtpWatcher extends Watcher {

    constructor(database: FileDatabase, config: ConfigWatcher) {
        super(database, config, `FTP (${config.host})`);
    }

    public override watch() : void {
        this.logger.info("Inside watch");
    }

}