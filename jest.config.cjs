module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  testTimeout: 20000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/app.js',
    'src/middleware/error.js',
    'src/middleware/auth.js',
    'src/middleware/uploadMiddleware.js',
    'src/controllers/authController.js',
    'src/controllers/documentController.js',
    'src/utils/asyncHandler.js',
    'src/utils/logger.js',
    'src/utils/audit.js',
    'src/services/tokenService.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
