// scripts/seedMenus.js
const mongoose = require('mongoose');
const Menu = require('../src/models/Menu');
require('dotenv').config();

const ALL_ROLES = ["admin", "branch_manager", "loan_officer_retail", "loan_officer_tpo", "broker", "realtor", "borrower"];

const menus = [
  // Tabs
  { alias: "index", slug: "home", label: "Home", icon: "home", route: "/(app)/(drawer)/(tabs)/index", type: "tab", order: 1, visible: true, roles: ALL_ROLES, content: null },
  { alias: "messages", slug: "messages", label: "Messages", icon: "chat", route: "/(app)/(drawer)/(tabs)/messages", type: "tab", order: 2, visible: true, roles: ALL_ROLES, content: null },
  { alias: "my-loan", slug: "my-loans", label: "My Loans", icon: "description", route: "/(app)/(drawer)/(tabs)/my-loan", type: "tab", order: 3, visible: true, roles: ["borrower"], content: null },
  { alias: "pipeline", slug: "pipeline", label: "Pipeline", icon: "list", route: "/(app)/(drawer)/(tabs)/pipeline", type: "tab", order: 4, visible: true, roles: ["admin", "loan_officer_tpo", "loan_officer_retail", "branch_manager"], content: null },
  { alias: "rates", slug: "rates", label: "Rates", icon: "trending-up", route: "/(app)/(drawer)/(tabs)/rates", type: "tab", order: 5, visible: true, roles: ["admin", "broker", "realtor"], content: null },
  { alias: "calculators", slug: "calculators", label: "Calculators", icon: "assignment", route: "/(app)/(drawer)/(tabs)/calculators", type: "tab", order: 6, visible: true, roles: ALL_ROLES, content: null },
  { alias: "new-application", slug: "new-loan", label: "New Loan", icon: "add-box", route: "/(app)/(drawer)/(tabs)/new-application", type: "tab", order: 7, visible: true, roles: ["admin", "loan_officer_tpo", "loan_officer_retail"], content: null },
  { alias: "refer", slug: "refer", label: "Refer", icon: "person-add", route: "/(app)/(drawer)/(tabs)/refer", type: "tab", order: 8, visible: true, roles: ["broker", "realtor"], content: null },
  { alias: "scanner", slug: "scanner", label: "Scanner", icon: "camera-alt", route: "/(app)/(drawer)/(tabs)/scanner", type: "tab", order: 9, visible: true, roles: ["borrower"], content: null },
  { alias: "more", slug: "more", label: "More", icon: "more-horiz", route: "/(app)/(drawer)/(tabs)/more", type: "tab", order: 10, visible: true, roles: ALL_ROLES, content: null },

  // Stack screens (order continues after tabs)
  { alias: "about", slug: "about", label: "About", icon: "info", route: "/(app)/(stack)/about", type: "stack", order: 11, visible: true, roles: ALL_ROLES, content: null },
  { alias: "active-loans", slug: "active-loans", label: "Active Loans", icon: "folder", route: "/(app)/(stack)/active-loans", type: "stack", order: 12, visible: true, roles: ALL_ROLES, content: null },
  { alias: "affordability-calculator", slug: "affordability-calculator", label: "Affordability Calculator", icon: "calculate", route: "/(app)/(stack)/affordability-calculator", type: "stack", order: 13, visible: true, roles: ALL_ROLES, content: null },
  { alias: "apply", slug: "apply", label: "Apply", icon: "assignment", route: "/(app)/(stack)/apply", type: "stack", order: 14, visible: true, roles: ALL_ROLES, content: null },
  { alias: "application", slug: "application", label: "Application", icon: "description", route: "/(app)/(stack)/application", type: "stack", order: 15, visible: true, roles: ALL_ROLES, content: null },
  { alias: "app-partners", slug: "app-partners", label: "App Partners", icon: "group", route: "/(app)/(stack)/app-partners", type: "stack", order: 16, visible: true, roles: ALL_ROLES, content: null },
  { alias: "app-users", slug: "app-users", label: "App Users", icon: "group", route: "/(app)/(stack)/app-users", type: "stack", order: 17, visible: true, roles: ALL_ROLES, content: null },
  { alias: "borrower-profile", slug: "borrower-profile", label: "Borrower Profile", icon: "person", route: "/(app)/(stack)/borrower-profile", type: "stack", order: 18, visible: true, roles: ALL_ROLES, content: null },
  { alias: "calculator", slug: "calculator", label: "Calculator", icon: "calculate", route: "/(app)/(stack)/calculator", type: "stack", order: 19, visible: true, roles: ALL_ROLES, content: null },
  { alias: "chat-assistant", slug: "chat-assistant", label: "Chat Assistant", icon: "chat", route: "/(app)/(stack)/chat-assistant", type: "stack", order: 20, visible: true, roles: ALL_ROLES, content: null },
  { alias: "client-app-users", slug: "client-app-users", label: "Client App Users", icon: "group", route: "/(app)/(stack)/client-app-users", type: "stack", order: 21, visible: true, roles: ALL_ROLES, content: null },
  { alias: "communication", slug: "communication", label: "Communication", icon: "chat", route: "/(app)/(stack)/communication", type: "stack", order: 22, visible: true, roles: ALL_ROLES, content: null },
  { alias: "contacts", slug: "contacts", label: "Contacts", icon: "contacts", route: "/(app)/(stack)/contacts", type: "stack", order: 23, visible: true, roles: ALL_ROLES, content: null },
  { alias: "document-upload", slug: "document-upload", label: "Document Upload", icon: "upload-file", route: "/(app)/(stack)/document-upload", type: "stack", order: 24, visible: true, roles: ALL_ROLES, content: null },
  { alias: "document-viewer", slug: "document-viewer", label: "Document Viewer", icon: "visibility", route: "/(app)/(stack)/document-viewer", type: "stack", order: 25, visible: true, roles: ALL_ROLES, content: null },
  { alias: "documents-uploaded", slug: "documents-uploaded", label: "Documents Uploaded", icon: "folder", route: "/(app)/(stack)/documents-uploaded", type: "stack", order: 26, visible: true, roles: ALL_ROLES, content: null },
  { alias: "documents", slug: "documents", label: "Documents", icon: "folder", route: "/(app)/(stack)/documents", type: "stack", order: 27, visible: true, roles: ALL_ROLES, content: null },
  { alias: "help", slug: "help", label: "Help", icon: "help", route: "/(app)/(stack)/help", type: "stack", order: 28, visible: true, roles: ALL_ROLES, content: null },
  { alias: "insights", slug: "insights", label: "Insights", icon: "insights", route: "/(app)/(stack)/insights", type: "stack", order: 29, visible: true, roles: ALL_ROLES, content: null },
  { alias: "integrations", slug: "integrations", label: "Integrations", icon: "extension", route: "/(app)/(stack)/integrations", type: "stack", order: 30, visible: true, roles: ALL_ROLES, content: null },
  { alias: "learn", slug: "learn", label: "Learn", icon: "school", route: "/(app)/(stack)/learn", type: "stack", order: 31, visible: true, roles: ALL_ROLES, content: null },
  { alias: "loan-application", slug: "loan-application", label: "Loan Application", icon: "description", route: "/(app)/(stack)/loan-application", type: "stack", order: 32, visible: true, roles: ALL_ROLES, content: null },
  { alias: "loan-details", slug: "loan-details", label: "Loan Details", icon: "description", route: "/(app)/(stack)/loan-details", type: "stack", order: 33, visible: true, roles: ALL_ROLES, content: null },
  { alias: "loan-management", slug: "loan-management", label: "Loan Management", icon: "manage-accounts", route: "/(app)/(stack)/loan-management", type: "stack", order: 34, visible: true, roles: ALL_ROLES, content: null },
  { alias: "loan-team", slug: "loan-team", label: "Loan Team", icon: "group", route: "/(app)/(stack)/loan-team", type: "stack", order: 35, visible: true, roles: ALL_ROLES, content: null },
  { alias: "milestone-tracker", slug: "milestone-tracker", label: "Milestone Tracker", icon: "track-changes", route: "/(app)/(stack)/milestone-tracker", type: "stack", order: 36, visible: true, roles: ALL_ROLES, content: null },
  { alias: "my-contact", slug: "my-contact", label: "My Contact", icon: "person", route: "/(app)/(stack)/my-contact", type: "stack", order: 37, visible: true, roles: ALL_ROLES, content: null },
  { alias: "notifications", slug: "notifications", label: "Notifications", icon: "notifications", route: "/(app)/(stack)/notifications", type: "stack", order: 38, visible: true, roles: ALL_ROLES, content: null },
  { alias: "partners", slug: "partners", label: "Partners", icon: "group", route: "/(app)/(stack)/partners", type: "stack", order: 39, visible: true, roles: ALL_ROLES, content: null },
  { alias: "pipeline-management", slug: "pipeline-management", label: "Pipeline Management", icon: "list", route: "/(app)/(stack)/pipeline-management", type: "stack", order: 40, visible: true, roles: ALL_ROLES, content: null },
  { alias: "pre-approval-letter", slug: "pre-approval-letter", label: "Pre-Approval Letter", icon: "description", route: "/(app)/(stack)/pre-approval-letter", type: "stack", order: 41, visible: true, roles: ALL_ROLES, content: null },
  { alias: "privacy-consent", slug: "privacy-consent", label: "Privacy Consent", icon: "privacy-tip", route: "/(app)/(stack)/privacy-consent", type: "stack", order: 42, visible: true, roles: ALL_ROLES, content: null },
  { alias: "profile", slug: "profile", label: "Profile", icon: "person", route: "/(app)/(stack)/profile", type: "stack", order: 43, visible: true, roles: ALL_ROLES, content: null },
  { alias: "rate-alerts", slug: "rate-alerts", label: "Rate Alerts", icon: "notifications", route: "/(app)/(stack)/rate-alerts", type: "stack", order: 44, visible: true, roles: ALL_ROLES, content: null },
  { alias: "rate-comparison", slug: "rate-comparison", label: "Rate Comparison", icon: "compare", route: "/(app)/(stack)/rate-comparison", type: "stack", order: 45, visible: true, roles: ALL_ROLES, content: null },
  { alias: "rates-and-alerts", slug: "rates-and-alerts", label: "Rates and Alerts", icon: "trending-up", route: "/(app)/(stack)/rates-and-alerts", type: "stack", order: 46, visible: true, roles: ALL_ROLES, content: null },
  { alias: "refinance-calculator", slug: "refinance-calculator", label: "Refinance Calculator", icon: "calculate", route: "/(app)/(stack)/refinance-calculator", type: "stack", order: 47, visible: true, roles: ALL_ROLES, content: null },
  { alias: "reports", slug: "reports", label: "Reports", icon: "bar-chart", route: "/(app)/(stack)/reports", type: "stack", order: 48, visible: true, roles: ALL_ROLES, content: null },
  { alias: "saved-calculations", slug: "saved-calculations", label: "Saved Calculations", icon: "calculate", route: "/(app)/(stack)/saved-calculations", type: "stack", order: 49, visible: true, roles: ALL_ROLES, content: null },
  { alias: "scanner-stack", slug: "scanner-stack", label: "Scanner", icon: "camera-alt", route: "/(app)/(stack)/scanner", type: "stack", order: 50, visible: true, roles: ALL_ROLES, content: null },
  { alias: "settings", slug: "settings", label: "Settings", icon: "settings", route: "/(app)/(stack)/settings", type: "stack", order: 51, visible: true, roles: ALL_ROLES, content: null },
  { alias: "share", slug: "share", label: "Share", icon: "share", route: "/(app)/(stack)/share", type: "stack", order: 52, visible: true, roles: ALL_ROLES, content: null },
  { alias: "submissions", slug: "submissions", label: "Submissions", icon: "upload-file", route: "/(app)/(stack)/submissions", type: "stack", order: 53, visible: true, roles: ALL_ROLES, content: null },
  { alias: "support", slug: "support", label: "Support", icon: "support", route: "/(app)/(stack)/support", type: "stack", order: 54, visible: true, roles: ALL_ROLES, content: null },
  { alias: "user-management", slug: "user-management", label: "User Management", icon: "manage-accounts", route: "/(app)/(stack)/user-management", type: "stack", order: 55, visible: true, roles: ALL_ROLES, content: null },

  // Auth screens (if needed)
  { alias: "profile-setup", slug: "profile-setup", label: "Profile Setup", icon: "person", route: "/(auth)/profile-setup", type: "stack", order: 56, visible: true, roles: ALL_ROLES, content: null },
  { alias: "login", slug: "login", label: "Login", icon: "login", route: "/(auth)/login", type: "stack", order: 57, visible: true, roles: ALL_ROLES, content: null },
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
