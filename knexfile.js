const { sql } = require('./src/config/env');

const baseConfig = {
  client: 'mssql',
  connection: {
    server: sql.server || 'localhost',
    port: sql.port || 1433,
    user: sql.user,
    password: sql.password,
    database: sql.database,
    options: {
      encrypt: sql.encrypt,
      trustServerCertificate: sql.trustServerCertificate,
    },
  },
  pool: {
    min: Number.isFinite(sql.poolMin) ? sql.poolMin : 0,
    max: Number.isFinite(sql.poolMax) ? sql.poolMax : 10,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
};

module.exports = {
  development: baseConfig,
  test: baseConfig,
  production: baseConfig,
};
