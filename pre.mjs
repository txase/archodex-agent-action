import * as core from '@actions/core';
import {execFileSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import YAML from 'yaml';

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

const reportApiKey = core.getInput('report-api-key');
const logReport = core.getInput('log-report') === 'true' || !reportApiKey;

const env = {...process.env};

if (reportApiKey) {
    env.ARCHODEX_REPORT_API_KEY = reportApiKey;

    core.info(
        'report_api_key input value provided, will send report to Archodex service');

    if (logReport) {
        env.ARCHODEX_LOG_REPORT = 'true';

        core.info(
            "log_report input value is 'true', will also log the report at the end of the workflow");
    }
} else {
    core.info(
        'report_api_key input value not provided, will not send report to Archodex service');
    if (logReport) {
        core.info('Will log the report at the end of the workflow');
    } else {
        env.ARCHODEX_LOG_REPORT = 'false';

        core.warn(
            'report_api_key input value not provided and log_report input value set to non-true value, Archodex report will not be sent to the Archodex service nor logged at the end of the workflow');
    }
}

core.startGroup('Generating Archodex configuration files');

let configsYaml = core.getInput('configs', {required : true});

let ruleSets;
try {
    ruleSets = YAML.parse(configsYaml);
} catch (err) {
    throw new Error(`Failed to parse 'configs' action input: ${err}`);
}

let configsDir = join(tmpdir(), 'archodex-configs');
mkdirSync(configsDir);

for (const [name, ruleSet] of Object.entries(ruleSets)) {
    let ruleSetPath = join(configsDir, `${name}.yaml`);

    writeFileSync(ruleSetPath, YAML.stringify(ruleSet));
    core.info(`Wrote ${ruleSetPath}`);
}

core.endGroup();

core.startGroup('Starting archodex-agent container');

const envVarFile = join(tmpdir(), "archodex-env-vars");
writeFileSync(envVarFile, Object.keys(env).join("\n"));

exec('docker',
     [
         'run', '--name', 'archodex-agent', '--detach', '--pid', 'host',
         '--privileged', '--env-file', envVarFile, '--mount',
         `type=bind,source=${configsDir},target=/config`,
         'ghcr.io/txase/archodex-agent-ebpf'
     ],
     {env, stdio : 'inherit'});

rmSync(envVarFile);

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