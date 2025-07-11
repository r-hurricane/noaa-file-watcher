﻿import {config} from './config.js';
import {createLogger as winCreateLogger, format, Logger, transports} from "winston";
import 'winston-daily-rotate-file';

const printf = (padLength: number) => {
    return format.printf(({ level, message, label, timestamp, stack, cause } ) => {
        const levelStr = level.padStart(padLength, ' ');
        let err = '';
        if (stack) {
            err += `\n-- Stack ${''.padStart(41, '-')}\n${stack}`;
        }
        if (cause) {
            err += `\n-- Cause ${''.padStart(41, '-')}\n${(cause as any).stack || cause}`;
        }
        if (err.length > 0) {
            err += `\n${''.padStart(50, '=')}`;
        }
        return `${timestamp} [${label || 'General'}] | ${levelStr}: ${message}${err}`;
    })
};

const consoleTransport = new transports.Console({
    handleExceptions: true,
    format: format.combine(
        format.colorize({all: true}),
        printf(15)
    )
});

const fileTransport = new transports.DailyRotateFile({
    handleExceptions: true,
    dirname: 'logs',
    filename: 'wmo-fetch-%DATE%.log',
    format: format.combine(
        format.colorize({all: true}),
        printf(15)
    ),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
});

const logger = winCreateLogger({
    level: config.logLevel,
    defaultMeta: {service: 'wmo-fetch'},
    format: format.combine(
        format.errors({stack: true, cause: true}),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.splat(),
    ),
    transports: [
        consoleTransport,
        fileTransport
    ]
});

export const errorTrace = (error: unknown)=> {
    if (!(error instanceof Error))
        return `${error}`;

    let err = error.message;
    if (error.stack) {
        err += `\n-- Stack ${''.padStart(41, '-')}\n${error.stack}`;
    }
    if (error.cause) {
        err += `\n-- Cause ${''.padStart(41, '-')}\n${(error.cause as any).stack || error.cause}`;
    }
    if (err.length > 0) {
        err += `\n${''.padStart(50, '=')}`;
    }
    return err;
}

const loggerNameMap: Map<string, Logger> = new Map<string, Logger>();
export const createLogger = (label: string)=> {
    const child = logger.child({label});
    loggerNameMap.set(label.toLowerCase(), child);
    return child;
}

export const setLogLevel = (level: string, name: string | undefined) => {
    // Find logger, if specified
    let loggers: Logger[];
    if(name && name.toLowerCase() !== 'all') {
        const found = loggerNameMap.get(name.toLowerCase());
        if (!found)
            return `Failed to find a logger named ${name}. Current loggers:\n${[...loggerNameMap].map(e => `  ${e[0]}: ${e[1].level}`).join('\n')}`;
        loggers = [found];
    } else {
        loggers = [...loggerNameMap.values()];
    }

    // If no loggers, return
    if (loggers.length <= 0)
        return `Found no loggers to set log level`;

    // Force level to lower
    level = level.toLowerCase();

    // Determine current log level and valid log levels
    const oldLevel = loggers[0].level;
    const validLevels = Object.keys(loggers[0].levels);
    if (validLevels.indexOf(level) <= -1)
        return `Invalid log level ${level}. Must be [${validLevels.join()}].`;

    // Finally, set the log level on all loggers and transports for each logger
    loggers.forEach(l => {
        l.level = level;
        l.transports.forEach(t => t.level = level);
    });

    return `Changed log level on ${name ?? 'all'}: ${oldLevel} => ${level}`;
}