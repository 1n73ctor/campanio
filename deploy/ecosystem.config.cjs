// PM2 process file: the API and (when apps/web/.env.production.local exists) the website.
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
    // website (Next.js), behind nginx; only started once the server has the website's settings file
    ...(require('fs').existsSync(path.resolve(__dirname, '../apps/web/.env.production.local'))
      ? [
          {
            name: 'companio-web',
            cwd: path.resolve(__dirname, '../apps/web'),
            script: path.resolve(__dirname, '../node_modules/next/dist/bin/next'),
            args: 'start -p 3001 -H 127.0.0.1',
            env: { NODE_ENV: 'production' },
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '600M',
            kill_timeout: 10_000,
            time: true,
          },
        ]
      : []),
  ],
};
