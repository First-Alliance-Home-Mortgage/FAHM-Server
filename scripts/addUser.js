const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectMongo = require('../src/db/mongoose');
const logger = require('../src/utils/logger');

const DEFAULT_PASSWORD = 'Password123!';

async function addUser({ name, email, password = DEFAULT_PASSWORD, role = 'borrower', phone = '555-000-0000', emailVerified = true, isActive = true }) {
  await connectMongo();
  const existing = await User.findOne({ email });
  if (existing) {
    logger.info('User already exists', { email });
    await mongoose.disconnect();
    return;
  }
  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    emailVerified,
    isActive,
  });
  logger.info('Created user', { email, id: user._id.toString(), role });
  await mongoose.disconnect();
}

// Usage: node scripts/addUser.js "Name" email@example.com [role] [password]
if (require.main === module) {
  const [,, nameArg, emailArg, roleArg, passwordArg] = process.argv;
  const readline = require('readline');

  async function prompt(question, defaultValue) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${question}${defaultValue ? ` [${defaultValue}]` : ''}: `, (answer) => {
        rl.close();
        resolve(answer || defaultValue);
      });
    });
  }

  (async () => {
    const name = nameArg || await prompt('Name');
    const email = emailArg || await prompt('Email');
    const role = roleArg || await prompt('Role', 'borrower');
    const password = passwordArg || await prompt('Password', DEFAULT_PASSWORD);
    const phone = await prompt('Phone', '555-000-0000');
    if (!name || !email) {
      console.error('Name and Email are required.');
      process.exit(1);
    }
    await addUser({ name, email, password, role, phone }).catch((err) => {
      logger.error('Add user failed', { err: err.message });
      process.exit(1);
    });
  })();
}
