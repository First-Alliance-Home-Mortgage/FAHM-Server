const mongoose = require('mongoose');
const { mongoUri } = require('../config/env');
const logger = require('../utils/logger');

const connectMongo = async () => {
  if (!mongoUri) {
    throw new Error('MONGO_URI is required');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  logger.info('Connected to MongoDB');
};

module.exports = connectMongo;

