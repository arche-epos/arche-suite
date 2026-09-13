// playwright.config.js — Pilgrim Private smoke tests
// Run from pilgrim-private/. Requires Live Server (or any static server)
// at the baseURL below — this suite does not start one for you.
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false, // shared localStorage/session state across tests in a file
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5500',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
