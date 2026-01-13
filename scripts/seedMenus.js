// scripts/seedMenus.js
const mongoose = require('mongoose');
const Menu = require('../src/models/Menu');
require('dotenv').config();

const menus = [
  // Tabs
  { id: "index", label: "Home", icon: "home", route: "/(app)/(drawer)/(tabs)/index", type: "tab", parent: null, order: 1, visible: true, roles: ["all"] },
  { id: "messages", label: "Messages", icon: "chat", route: "/(app)/(drawer)/(tabs)/messages", type: "tab", parent: null, order: 2, visible: true, roles: ["all"] },
  { id: "my-loan", label: "My Loans", icon: "description", route: "/(app)/(drawer)/(tabs)/my-loan", type: "tab", parent: null, order: 3, visible: true, roles: ["borrower"] },
  { id: "pipeline", label: "Pipeline", icon: "list", route: "/(app)/(drawer)/(tabs)/pipeline", type: "tab", parent: null, order: 4, visible: true, roles: ["loan_officer_tpo", "loan_officer_retail", "branch_manager"] },
  { id: "rates", label: "Rates", icon: "trending-up", route: "/(app)/(drawer)/(tabs)/rates", type: "tab", parent: null, order: 5, visible: true, roles: ["broker", "realtor"] },
  { id: "calculators", label: "Calculators", icon: "assignment", route: "/(app)/(drawer)/(tabs)/calculators", type: "tab", parent: null, order: 6, visible: true, roles: ["all"] },
  { id: "new-application", label: "New Loan", icon: "add-box", route: "/(app)/(drawer)/(tabs)/new-application", type: "tab", parent: null, order: 7, visible: true, roles: ["loan_officer_tpo", "loan_officer_retail"] },
  { id: "refer", label: "Refer", icon: "person-add", route: "/(app)/(drawer)/(tabs)/refer", type: "tab", parent: null, order: 8, visible: true, roles: ["broker", "realtor"] },
  { id: "scanner", label: "Scanner", icon: "camera-alt", route: "/(app)/(drawer)/(tabs)/scanner", type: "tab", parent: null, order: 9, visible: true, roles: ["borrower"] },
  { id: "more", label: "More", icon: "more-horiz", route: "/(app)/(drawer)/(tabs)/more", type: "tab", parent: null, order: 10, visible: true, roles: ["all"] },

  // Stack screens (order continues after tabs)
  { id: "about", label: "About", icon: "info", route: "/(app)/(stack)/about", type: "stack", parent: null, order: 11, visible: true, roles: ["all"] },
  { id: "active-loans", label: "Active Loans", icon: "folder", route: "/(app)/(stack)/active-loans", type: "stack", parent: null, order: 12, visible: true, roles: ["all"] },
  { id: "affordability-calculator", label: "Affordability Calculator", icon: "calculate", route: "/(app)/(stack)/affordability-calculator", type: "stack", parent: null, order: 13, visible: true, roles: ["all"] },
  { id: "apply", label: "Apply", icon: "assignment", route: "/(app)/(stack)/apply", type: "stack", parent: null, order: 14, visible: true, roles: ["all"] },
  { id: "application", label: "Application", icon: "description", route: "/(app)/(stack)/application", type: "stack", parent: null, order: 15, visible: true, roles: ["all"] },
  { id: "app-partners", label: "App Partners", icon: "group", route: "/(app)/(stack)/app-partners", type: "stack", parent: null, order: 16, visible: true, roles: ["all"] },
  { id: "app-users", label: "App Users", icon: "group", route: "/(app)/(stack)/app-users", type: "stack", parent: null, order: 17, visible: true, roles: ["all"] },
  { id: "borrower-profile", label: "Borrower Profile", icon: "person", route: "/(app)/(stack)/borrower-profile", type: "stack", parent: null, order: 18, visible: true, roles: ["all"] },
  { id: "calculator", label: "Calculator", icon: "calculate", route: "/(app)/(stack)/calculator", type: "stack", parent: null, order: 19, visible: true, roles: ["all"] },
  { id: "chat-assistant", label: "Chat Assistant", icon: "chat", route: "/(app)/(stack)/chat-assistant", type: "stack", parent: null, order: 20, visible: true, roles: ["all"] },
  { id: "client-app-users", label: "Client App Users", icon: "group", route: "/(app)/(stack)/client-app-users", type: "stack", parent: null, order: 21, visible: true, roles: ["all"] },
  { id: "communication", label: "Communication", icon: "chat", route: "/(app)/(stack)/communication", type: "stack", parent: null, order: 22, visible: true, roles: ["all"] },
  { id: "contacts", label: "Contacts", icon: "contacts", route: "/(app)/(stack)/contacts", type: "stack", parent: null, order: 23, visible: true, roles: ["all"] },
  { id: "document-upload", label: "Document Upload", icon: "upload-file", route: "/(app)/(stack)/document-upload", type: "stack", parent: null, order: 24, visible: true, roles: ["all"] },
  { id: "document-viewer", label: "Document Viewer", icon: "visibility", route: "/(app)/(stack)/document-viewer", type: "stack", parent: null, order: 25, visible: true, roles: ["all"] },
  { id: "documents-uploaded", label: "Documents Uploaded", icon: "folder", route: "/(app)/(stack)/documents-uploaded", type: "stack", parent: null, order: 26, visible: true, roles: ["all"] },
  { id: "documents", label: "Documents", icon: "folder", route: "/(app)/(stack)/documents", type: "stack", parent: null, order: 27, visible: true, roles: ["all"] },
  { id: "help", label: "Help", icon: "help", route: "/(app)/(stack)/help", type: "stack", parent: null, order: 28, visible: true, roles: ["all"] },
  { id: "insights", label: "Insights", icon: "insights", route: "/(app)/(stack)/insights", type: "stack", parent: null, order: 29, visible: true, roles: ["all"] },
  { id: "integrations", label: "Integrations", icon: "extension", route: "/(app)/(stack)/integrations", type: "stack", parent: null, order: 30, visible: true, roles: ["all"] },
  { id: "learn", label: "Learn", icon: "school", route: "/(app)/(stack)/learn", type: "stack", parent: null, order: 31, visible: true, roles: ["all"] },
  { id: "loan-application", label: "Loan Application", icon: "description", route: "/(app)/(stack)/loan-application", type: "stack", parent: null, order: 32, visible: true, roles: ["all"] },
  { id: "loan-details", label: "Loan Details", icon: "description", route: "/(app)/(stack)/loan-details", type: "stack", parent: null, order: 33, visible: true, roles: ["all"] },
  { id: "loan-management", label: "Loan Management", icon: "manage-accounts", route: "/(app)/(stack)/loan-management", type: "stack", parent: null, order: 34, visible: true, roles: ["all"] },
  { id: "loan-team", label: "Loan Team", icon: "group", route: "/(app)/(stack)/loan-team", type: "stack", parent: null, order: 35, visible: true, roles: ["all"] },
  { id: "milestone-tracker", label: "Milestone Tracker", icon: "track-changes", route: "/(app)/(stack)/milestone-tracker", type: "stack", parent: null, order: 36, visible: true, roles: ["all"] },
  { id: "my-contact", label: "My Contact", icon: "person", route: "/(app)/(stack)/my-contact", type: "stack", parent: null, order: 37, visible: true, roles: ["all"] },
  { id: "notifications", label: "Notifications", icon: "notifications", route: "/(app)/(stack)/notifications", type: "stack", parent: null, order: 38, visible: true, roles: ["all"] },
  { id: "partners", label: "Partners", icon: "group", route: "/(app)/(stack)/partners", type: "stack", parent: null, order: 39, visible: true, roles: ["all"] },
  { id: "pipeline-management", label: "Pipeline Management", icon: "list", route: "/(app)/(stack)/pipeline-management", type: "stack", parent: null, order: 40, visible: true, roles: ["all"] },
  { id: "pre-approval-letter", label: "Pre-Approval Letter", icon: "description", route: "/(app)/(stack)/pre-approval-letter", type: "stack", parent: null, order: 41, visible: true, roles: ["all"] },
  { id: "privacy-consent", label: "Privacy Consent", icon: "privacy-tip", route: "/(app)/(stack)/privacy-consent", type: "stack", parent: null, order: 42, visible: true, roles: ["all"] },
  { id: "profile", label: "Profile", icon: "person", route: "/(app)/(stack)/profile", type: "stack", parent: null, order: 43, visible: true, roles: ["all"] },
  { id: "rate-alerts", label: "Rate Alerts", icon: "notifications", route: "/(app)/(stack)/rate-alerts", type: "stack", parent: null, order: 44, visible: true, roles: ["all"] },
  { id: "rate-comparison", label: "Rate Comparison", icon: "compare", route: "/(app)/(stack)/rate-comparison", type: "stack", parent: null, order: 45, visible: true, roles: ["all"] },
  { id: "rates-and-alerts", label: "Rates and Alerts", icon: "trending-up", route: "/(app)/(stack)/rates-and-alerts", type: "stack", parent: null, order: 46, visible: true, roles: ["all"] },
  { id: "refinance-calculator", label: "Refinance Calculator", icon: "calculate", route: "/(app)/(stack)/refinance-calculator", type: "stack", parent: null, order: 47, visible: true, roles: ["all"] },
  { id: "reports", label: "Reports", icon: "bar-chart", route: "/(app)/(stack)/reports", type: "stack", parent: null, order: 48, visible: true, roles: ["all"] },
  { id: "saved-calculations", label: "Saved Calculations", icon: "calculate", route: "/(app)/(stack)/saved-calculations", type: "stack", parent: null, order: 49, visible: true, roles: ["all"] },
  { id: "scanner-stack", label: "Scanner", icon: "camera-alt", route: "/(app)/(stack)/scanner", type: "stack", parent: null, order: 50, visible: true, roles: ["all"] },
  { id: "settings", label: "Settings", icon: "settings", route: "/(app)/(stack)/settings", type: "stack", parent: null, order: 51, visible: true, roles: ["all"] },
  { id: "share", label: "Share", icon: "share", route: "/(app)/(stack)/share", type: "stack", parent: null, order: 52, visible: true, roles: ["all"] },
  { id: "submissions", label: "Submissions", icon: "upload-file", route: "/(app)/(stack)/submissions", type: "stack", parent: null, order: 53, visible: true, roles: ["all"] },
  { id: "support", label: "Support", icon: "support", route: "/(app)/(stack)/support", type: "stack", parent: null, order: 54, visible: true, roles: ["all"] },
  { id: "user-management", label: "User Management", icon: "manage-accounts", route: "/(app)/(stack)/user-management", type: "stack", parent: null, order: 55, visible: true, roles: ["all"] },

  // Auth screens (if needed)
  { id: "profile-setup", label: "Profile Setup", icon: "person", route: "/(auth)/profile-setup", type: "stack", parent: null, order: 56, visible: true, roles: ["all"] },
  { id: "login", label: "Login", icon: "login", route: "/(auth)/login", type: "stack", parent: null, order: 57, visible: true, roles: ["all"] },
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

module.exports = { menus, seedMenus };

if (require.main === module) {
  seedMenus();
}
