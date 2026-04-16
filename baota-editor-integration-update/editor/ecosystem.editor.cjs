module.exports = {
  apps: [
    {
      name: 'rdesign-editor',
      script: '/www/wwwroot/rdesign-editor/current/apps/editor/server.js',
      cwd: '/www/wwwroot/rdesign-editor/current/apps/editor',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1200M',
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        PORT: '4302',
      },
      out_file: '/www/wwwlogs/rdesign-editor-out.log',
      error_file: '/www/wwwlogs/rdesign-editor-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};

