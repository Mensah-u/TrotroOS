const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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

module.exports = config;
