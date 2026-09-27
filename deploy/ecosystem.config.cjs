// PM2 process file for the API (the website and admin are hosted on Netlify).
//   pm2 startOrReload deploy/ecosystem.config.cjs --update-env
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'companio-api',
      cwd: path.resolve(__dirname, '../apps/api'), // .env is read from here
      script: 'dist/main.js',
      env: { NODE_ENV: 'production' },
      // exactly one instance: realtime rooms and the booking jobs live in this process's memory
      // (see README "Scale-out" before adding more)
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '700M',
      kill_timeout: 10_000,
      time: true,
    },
  ],
};
