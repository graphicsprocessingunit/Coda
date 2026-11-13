const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Generated native projects and build output — never linted.
    ignores: ['build/*', 'dist/*', 'ios/*', 'android/*', '.expo/*'],
  },
]);
