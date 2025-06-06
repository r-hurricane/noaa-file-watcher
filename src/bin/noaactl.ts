#!/usr/bin/env node

import {connect as netConnect} from "node:net";
import {config} from '../config.js';

(() => {

    const args = process.argv.slice(2);
    if (args.length <= 0 || !args[0]) {
        console.error('Please specify a command');
        return;
    }

    const cmdList = ['loglevel'];
    if (cmdList.indexOf(args[0]) <= -1) {
        console.error(`Invalid command ${args[0]}. Must be [${cmdList.join()}].`);
        return;
    }

    const client = netConnect({path: config.ipcPath}, () => {
        process.stdout.write('Connected!\n');

        client.cork();
        client.write(args.join(' '));
        process.nextTick(() => client.uncork())
    });

    client.on('data', (data) => {
        process.stdout.write(data.toString());
    });

    client.on('close', () => {
        process.stdout.write("\nGoodbye!\n");
    });

    process.stdout.write('Configured... ');
})();