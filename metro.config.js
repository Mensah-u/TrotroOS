const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.alias = {
  ...(config.resolver.alias ?? {}),
  '@': projectRoot,
};

const useNotificationsStub = process.env.EAS_BUILD !== 'true';

if (useNotificationsStub) {
  const stubPath = path.resolve(__dirname, 'services/expo-notifications-stub.js');
  const defaultResolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'expo-notifications') {
      return { type: 'sourceFile', filePath: stubPath };
    }
    if (defaultResolve) {
      return defaultResolve(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

config.cacheVersion = 'trotro-v1.4.0-dev';

// Sentry Metro wrapper slows local bundling; use only for EAS/release builds.
module.exports =
  process.env.EAS_BUILD === 'true'
    ? getSentryExpoConfig(projectRoot, config)
    : config;
