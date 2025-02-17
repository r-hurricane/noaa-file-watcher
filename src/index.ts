import {config} from './config.js';
import {createLogger} from './logging.js';
import {FileDatabase} from "./database/database.js";
import {Watcher} from "./watcher.js";
import {DiscordNotifier} from "./notifications/discord.js";
import {IpcController} from "./notifications/ipcSocket.js";

(async () => {
    const logger = createLogger('Index');

    try {

        logger.info("Starting NOAA File Watcher");

        // Create database
        const database = new FileDatabase();

        // Create IPC Controller
        const ipcController = new IpcController();

        // Create an instance of each watcher
        const watchers : Array<Watcher> = config.watchers
            .flatMap(w => w.paths
                .map(p => new Watcher(database, ipcController, w, p)));

        // On sigterm, call shutdown
        const shutdown = (signal: string) => {
            logger.info(`Received ${signal} signal. Notifying shutdown to all watchers.`);

            DiscordNotifier.Send(`# NOAA File Watcher Shutdown\n## Event: ${signal}\n<@beach> NOAA File Watcher has received a ${signal} and shutdown.`)
                .then(() => {
                    const promises = watchers.map(w => w.shutdown());
                    promises.push(ipcController.shutdown());
                    Promise.all(promises)
                        .then((v) => {
                            logger.info('Shutdown process complete. Goodbye!');
                            process.exit(v.every(r => r) ? 0 : 1);
                        })
                        .catch(e => {
                            logger.error('Error when shutting down watchers');
                            logger.error(e);
                            process.exit(1);
                        });
                })
                .catch(e => {
                    logger.error('Error sending shutdown to Discord');
                    logger.error(e);
                    process.exit(1);
                });
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        await DiscordNotifier.Send('# NOAA File Watcher Started');

    } catch (error) {
        logger.error('General unhandled error:');
        logger.error(error);
        await DiscordNotifier.Send('# Unhandled application error.\n## Service shut down!\n@everyone <@beach> NOAA File Watcher has encountered an unrecoverable error and has shutdown.', error);
    }
})();