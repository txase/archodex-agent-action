import * as core from '@actions/core';
import {execFileSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const SHELL_QUOTE_RE = /[\s$'"#><|;{}()*?&~]/;

function exec(file, args, opts) {
    let log = `\u001b[38;2;68;147;248m${file}`;

    for (let arg of args) {
        if (arg.match(SHELL_QUOTE_RE)) {
            log += ` '${arg}'`;
        } else {
            log += ` ${arg}`;
        }
    }

    log += '\u001b[0m';

    core.info(log);

    return execFileSync(file, args, opts);
}

exec('docker', [ 'stop', 'archodex-agent' ], {stdio : 'inherit'});

exec('docker', [ 'logs', '--details', 'archodex-agent' ], {stdio : 'inherit'});

exec('docker', [ 'rm', 'archodex-agent' ], {stdio : 'inherit'});

let rulesDir = join(tmpdir(), 'archodex-rules');
rmSync(rulesDir, {recursive : true});