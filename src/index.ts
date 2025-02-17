import {config} from './config.js';
import {FileDatabase} from "./database/database.js";
import createLogger from './logging.js';
import {Watcher} from "./watcher.js";

const logger = createLogger('Index');

try {

    // Create database
    const database = new FileDatabase();

    // Create an instance of each watcher
    const watchers : Array<Watcher> = config.watchers
        .flatMap(w => w.paths
            .map(p => new Watcher(database, w, p)));

    // On sigterm, call shutdown
    const shutdown = () => {
        watchers.forEach(w => w.shutdown());
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

} catch (error) {
    logger.error('Error in file watcher: ');
    logger.error(error);
}