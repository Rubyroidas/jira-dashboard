/**
 * Tests are compiled to CommonJS so Jest needs no `--experimental-vm-modules`
 * and `npm test` stays a plain `jest`. The app itself still ships as ESM; the
 * one thing this rules out is testing a module that uses `import.meta`.
 *
 * Extensionless relative imports (`moduleResolution: "bundler"`) resolve as-is,
 * hence no `moduleNameMapper`.
 */
export default {
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', verbatimModuleSyntax: false } }],
  },
};
