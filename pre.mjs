import * as core from '@actions/core';
import {execFileSync} from 'node:child_process';

const STARTUP_TIMEOUT = 5;

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

core.startGroup('Starting archodex-agent container');

exec('docker',
     [
         'run', '--name', 'archodex-agent', '--detach', '--pid', 'host',
         '--privileged', 'ghcr.io/txase/archodex-agent-ebpf'
     ],
     {stdio : 'inherit'});

exec('docker',
     [
         'ps', '--all', '--filter', 'name=archodex-agent', '--filter',
         'status=running', '--no-trunc', '--format', '{{.ID}} {{.Status}}'
     ],
     {stdio : 'inherit'});

let i = 0;
while (true) {
    let status =
        exec(
            'docker',
            [
                'inspect', '--format',
                '{{if .Config.Healthcheck}}{{print .State.Health.Status}}{{end}}',
                'archodex-agent'
            ])
            .toString()
            .trim();

    core.info(status);

    if (status === 'healthy') {
        core.info("Archodex agent started");
        break;
    } else if (i++ < STARTUP_TIMEOUT) {
        core.info("Archodex agent is not ready yet, waiting 1 second...");
        await new Promise(r => setTimeout(r, 1000));
    } else {
        core.error(
            `Archodex agent failed to start within ${STARTUP_TIMEOUT} seconds`);
        process.exit(1);
    }
}

core.endGroup();