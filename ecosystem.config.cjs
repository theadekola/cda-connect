const path = require('node:path');

const backend = path.resolve(__dirname, 'backend');

module.exports = {
  apps: [
    {
      name: 'cda-api',
      cwd: backend,
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '750M',
      time: true
    },
    {
      name: 'cda-worker',
      cwd: backend,
      script: 'dist/workers/worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '750M',
      time: true
    }
  ]
};
