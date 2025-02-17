import nodeConfig from 'config';

export interface ConfigDiscord {
    mock: boolean,
    users: {[key: string] : string} | null,
    webhooks: Array<string>
}

export interface ConfigEmails {
    mock: boolean,
    from: string,
    to: string,
    sendgridKey: string
}

export interface ConfigNotifications {
    email: ConfigEmails | null,
    discord: ConfigDiscord | null
}

export interface ConfigPath {
    path: string,
    parser: string | null,
    freq: number | null,
    freqFunc: string | null,
    literal: boolean | null,
    files: Array<string>
}

export interface ConfigWatcher {
    baseUrl: string,
    freq: number | null,
    freqFunc: string | null,
    paths: Array<ConfigPath>
}

export interface ConfigApp {
    logLevel: string,
    databaseFile: string,
    dataPath: string,
    notifications: ConfigNotifications,
    watchers: Array<ConfigWatcher>
}

export const config: ConfigApp = {
    logLevel: nodeConfig.get<string>('logLevel'),
    databaseFile: nodeConfig.get<string>('databaseFile'),
    dataPath: nodeConfig.get<string>('dataPath'),
    notifications: nodeConfig.get<ConfigNotifications>('notifications'),
    watchers: nodeConfig.get<Array<ConfigWatcher>>('watchers'),
};