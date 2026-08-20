module.exports = {
  apps: [{
    name: 'cda-expo',
    cwd: __dirname,
    script: './node_modules/expo/bin/cli',
    args: 'start --lan --clear',
    interpreter: 'node',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: {
      NODE_ENV: 'production',
      EXPO_NO_TELEMETRY: '1'
    }
  }]
};
