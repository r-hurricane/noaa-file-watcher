import {config} from './config.js';
import {createLogger as winCreateLogger, format, transports} from "winston";
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

export const createLogger = (label: string)=> {

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
        format: printf(5),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
    });
    fileTransport.setMaxListeners(30);

    return winCreateLogger({
        level: config.logLevel,
        defaultMeta: {service: 'wmo-fetch'},
        format: format.combine(
            format.errors({stack: true, cause: true}),
            format.label({label: label}),
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
}