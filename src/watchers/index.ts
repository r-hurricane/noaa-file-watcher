import { FtpWatcher } from "./ftp/index.js";
import { Watcher } from "./watcher.js";
import { FileDatabase } from "../database/database.js";
import { ConfigWatcher } from "../config.js";

export default {
    "ftp": FtpWatcher
} as {[key: string]: new (database: FileDatabase, config: ConfigWatcher) => Watcher};