/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you when using Next.js)
    '^@/app/(.*)$': '<rootDir>/app/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  transform: {
    // Use ts-jest for TypeScript files
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Specific environment for browser tests
  testEnvironmentOptions: {
    // Custom options for JSDOM
    url: 'http://localhost',
  },
  // Add coverage report
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/api/route.js',
    '!**/node_modules/**',
  ],
  // Adjust as needed
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'jsx'],
};
