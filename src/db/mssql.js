const knex = require('knex');
const { sql } = require('../config/env');
const logger = require('../utils/logger');

let knexInstance;

function buildConfig() {
  return {
    client: 'mssql',
    connection: {
      server: sql.server,
      port: sql.port,
      user: sql.user,
      password: sql.password,
      database: sql.database,
      options: {
        encrypt: sql.encrypt,
        trustServerCertificate: sql.trustServerCertificate,
      },
    },
    pool: {
      min: sql.poolMin,
      max: sql.poolMax,
    },
  };
}

function getKnex() {
  if (knexInstance) return knexInstance;

  if (!sql.server || !sql.user || !sql.password || !sql.database) {
    throw new Error('MSSQL config is incomplete. Set MSSQL_SERVER, MSSQL_USER, MSSQL_PASSWORD, and MSSQL_DATABASE.');
  }

  knexInstance = knex(buildConfig());
  logger.info('Initialized MSSQL connection pool');
  return knexInstance;
}

async function destroyKnex() {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
    logger.info('Closed MSSQL connection pool');
  }
}

module.exports = {
  getKnex,
  destroyKnex,
};
