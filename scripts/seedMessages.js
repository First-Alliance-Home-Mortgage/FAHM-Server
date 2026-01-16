// scripts/seedMessages.js
// Seed script for Encompass messages
// Usage: node scripts/seedMessages.js


const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


const Message = require('../src/models/Message');
const User = require('../src/models/User');


// Helper to get two random users (sender, recipient)
async function getRandomUsers() {
  const users = await User.find({}).select('_id').lean();
  if (users.length < 2) throw new Error('Need at least 2 users in the database');
  // Shuffle and pick two different users
  const shuffled = users.sort(() => 0.5 - Math.random());
  return [shuffled[0]._id, shuffled[1]._id];
}

async function seedMessages() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });


    const [sender, recipient] = await getRandomUsers();
    const placeholderLoanId = new mongoose.Types.ObjectId();

    const messages = [
      {
        loan: placeholderLoanId,
        sender,
        recipient,
        content: 'Welcome to your loan portal!',
        messageType: 'system',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Initial welcome' },
      },
      {
        loan: placeholderLoanId,
        sender: recipient,
        recipient: sender,
        content: 'Thank you! Happy to start.',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Reply' },
      },
      {
        loan: placeholderLoanId,
        sender,
        recipient,
        content: 'Your loan is in review.',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Status update' },
      },
      {
        loan: placeholderLoanId,
        sender: recipient,
        recipient: sender,
        content: 'How long does review take?',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Question' },
      },
      {
        loan: placeholderLoanId,
        sender,
        recipient,
        content: 'Please upload your documents.',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Document request' },
      },
      {
        loan: placeholderLoanId,
        sender: recipient,
        recipient: sender,
        content: 'I have uploaded the documents.',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Confirmation' },
      },
      {
        loan: placeholderLoanId,
        sender,
        recipient,
        content: 'Congratulations! Your loan is approved.',
        messageType: 'system',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Approval' },
      },
      {
        loan: placeholderLoanId,
        sender: recipient,
        recipient: sender,
        content: 'Thank you for the update!',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Gratitude' },
      },
      {
        loan: placeholderLoanId,
        sender,
        recipient,
        content: 'Your closing date is scheduled.',
        messageType: 'milestone',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Milestone update' },
      },
      {
        loan: placeholderLoanId,
        sender: recipient,
        recipient: sender,
        content: 'Looking forward to closing!',
        messageType: 'text',
        read: false,
        encompassSynced: false,
        metadata: { info: 'Excitement' },
      },
    ];

    await Message.deleteMany({});
    await Message.insertMany(messages);
    console.log('Messages seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding messages:', err);
    process.exit(1);
  }
}

seedMessages();
