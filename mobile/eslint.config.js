const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([expoConfig, { ignores: ['dist/**', 'dist-final/**', 'web-dist/**', 'dist-android/**', 'playwright-report/**', 'test-results/**'] }]);
