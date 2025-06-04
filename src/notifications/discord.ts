import {config} from '../config.js';
import {createLogger, errorTrace} from "../logging.js";

export class DiscordNotifier {

    // TODO: Add a channel name to configs + send method (i.e. channel for errors vs ATCF vs TWO vs Recon, etc)
    public static async Send(content: string, error: unknown = null) {

        const logger = createLogger('Discord');
        const discordConfig = config.notifications.discord;

        // If no configured discord messages, skip
        if (discordConfig == null)
            return;

        // Get the list of hooks
        const hooks = discordConfig.webhooks
        if (hooks.length <= 0)
            return;

        // Transform <@user> with the user ID
        // See https://discord.com/developers/docs/reference#message-formatting
        let transformMessage : string = content;
        if (discordConfig.users != null) {

            // For each user, check for mentions with that username.
            const users = discordConfig.users;
            for (let username in users) {
                if (users.hasOwnProperty(username))
                    transformMessage = transformMessage.replace(`<@${username}>`, `<@${users[username]}>`);
            }
        }

        // Add error message in code block
        if (error) {
            transformMessage += '\n```\n' + errorTrace(error) + '\n```';
        }

        // Helper method for mock sending
        const sendMessage = async (hook: string, message: string )=> {
            // Build the log message
            const logMessage = `Discord Message (${hook}):\n${message}\n${''.padStart(53, '-')}`;

            // If mock setting is on, don't actually send the message
            if (discordConfig.mock) {
                logger.info(`!!! MOCK MESSAGE - NOT SENT!!!\n${logMessage}`);
                return;
            }

            logger.info('Sending notification message to discord.');
            logger.debug(logMessage);

            const resp = await fetch(hook, {
                method: 'POST',
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({content: message})
            });

            if (resp.status >= 300) {
                logger.error(`Discord Error Response: ${resp.status} ${resp.statusText}`);
            } else {
                logger.debug('Discord response: ', resp.statusText);
            }
        }

        // Send the message to each hook
        for (let hook of hooks) {
            await sendMessage(hook, transformMessage);
        }
    }
}