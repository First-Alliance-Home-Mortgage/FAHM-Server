const dotenv = require('dotenv');

dotenv.config();

const required = ['MONGO_URI', 'JWT_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[env] Missing required env var ${key}. Set it in .env.`);
  }
});

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  logLevel: process.env.LOG_LEVEL || 'info',
  integrations: {
    encompass: process.env.ENCOMPASS_API_URL,
    totalExpert: process.env.TOTAL_EXPERT_API_URL,
    pos: process.env.POS_API_URL,
    xactus: process.env.XACTUS_API_URL,
    optimalBlue: process.env.OPTIMAL_BLUE_API_URL,
  },
};

