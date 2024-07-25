import * as core from '@actions/core';
import {execFileSync} from 'node:child_process';

function exec(file, args, opts) {
    core.info(`\u001b[38;2;68;147;248m${file} ${args.join(' ')}\u001b[0m`);

    return execFileSync(file, args, opts);
}

exec('docker', [ 'logs', '--details', 'archodex-agent' ], {stdio : 'inherit'})

exec('docker', [ 'stop', 'archodex-agent' ], {stdio : 'inherit'});