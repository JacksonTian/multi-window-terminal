#!/usr/bin/env node

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: '1987' },
    host: { type: 'string', default: '127.0.0.1' },
    open: { type: 'boolean', default: true },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowNegative: true,
});

if (values.help) {
  console.log(`
  mwt - Multi-Window Terminal

  Usage:
    mwt [options]

  Options:
    -p, --port <port>  Port to listen on (default: 1987)
    --host <host>      Host to bind to (default: 127.0.0.1)
    --no-open          Do not open the browser automatically
    -h, --help         Show this help message
`);
  process.exit(0);
}

import {start} from '../lib/server.js';

const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`
  mwt: invalid port "${values.port}" — must be an integer between 1 and 65535.

  Options:
    Use the default port:         mwt
    Specify a valid port:         mwt -p 1987
`);
  process.exit(1);
}

start(port, values.host, { open: values.open });
