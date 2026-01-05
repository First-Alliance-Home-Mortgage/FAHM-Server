// scripts/seedMenus.js
const mongoose = require('mongoose');
const Menu = require('../src/models/menu');
require('dotenv').config();

const menus = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    route: '/(app)/(drawer)/(tabs)/index',
    type: 'tab',
    parent: null,
    order: 1,
    visible: true,
    roles: ['admin', 'user', 'borrower', 'loan_officer_tpo', 'loan_officer_retail', 'branch_manager', 'broker', 'realtor']
  },
  {
    id: 'calculators',
    label: 'Calculators',
    icon: 'assignment',
    route: '/(app)/(drawer)/calculators',
    type: 'drawer',
    parent: null,
    order: 2,
    visible: true,
    roles: ['admin', 'user', 'borrower', 'loan_officer_tpo', 'loan_officer_retail', 'branch_manager', 'broker', 'realtor']
  },
  {
    id: 'my-loan',
    label: 'My Loans',
    icon: 'description',
    route: '/(app)/(drawer)/(tabs)/my-loan',
    type: 'tab',
    parent: null,
    order: 3,
    visible: true,
    roles: ['borrower']
  },
  {
    id: 'scanner',
    label: 'Scanner',
    icon: 'camera-alt',
    route: '/(app)/(drawer)/(tabs)/scanner',
    type: 'tab',
    parent: null,
    order: 4,
    visible: true,
    roles: ['borrower']
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: 'list',
    route: '/(app)/(drawer)/(tabs)/pipeline',
    type: 'tab',
    parent: null,
    order: 5,
    visible: true,
    roles: ['loan_officer_tpo', 'loan_officer_retail', 'branch_manager']
  },
  {
    id: 'new-application',
    label: 'New Loan',
    icon: 'add-box',
    route: '/(app)/(drawer)/(tabs)/new-application',
    type: 'tab',
    parent: null,
    order: 6,
    visible: true,
    roles: ['loan_officer_tpo', 'loan_officer_retail']
  },
  {
    id: 'refer',
    label: 'Refer',
    icon: 'person-add',
    route: '/(app)/(drawer)/(tabs)/refer',
    type: 'tab',
    parent: null,
    order: 7,
    visible: true,
    roles: ['broker', 'realtor']
  },
  {
    id: 'rates',
    label: 'Rates',
    icon: 'trending-up',
    route: '/(app)/(drawer)/(tabs)/rates',
    type: 'tab',
    parent: null,
    order: 8,
    visible: true,
    roles: ['broker', 'realtor']
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'chat',
    route: '/(app)/(drawer)/(tabs)/messages',
    type: 'tab',
    parent: null,
    order: 9,
    visible: true,
    roles: ['admin', 'user', 'borrower', 'loan_officer_tpo', 'loan_officer_retail', 'branch_manager', 'broker', 'realtor']
  },
  {
    id: 'more',
    label: 'More',
    icon: 'more-horiz',
    route: '/(app)/(drawer)/(tabs)/more',
    type: 'tab',
    parent: null,
    order: 10,
    visible: true,
    roles: ['admin', 'user', 'borrower', 'loan_officer_tpo', 'loan_officer_retail', 'branch_manager', 'broker', 'realtor']
  }
];

async function seedMenus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Menu.deleteMany({});
    await Menu.insertMany(menus);
    console.log('Menus seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seedMenus();
