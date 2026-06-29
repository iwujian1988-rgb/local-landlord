const path = require('path');

const config = {
  projectName: 'local-landlord',
  date: '2026-6-2',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-react'],
  defineConstants: {
    API_BASE: '"http://127.0.0.1:3100/api"',
    APP_USE_CLOUD: 'false',
    APP_CLOUD_ENV_ID: '""',
    APP_CLOUD_SVC: '""',
    APP_H5_BASE: '""',
  },
  copy: { patterns: [], options: {} },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    baseLevel: 16,
    compile: {
      exclude: [],
    },
    webpackChain(chain) {
      chain.resolve.alias.set('@local-landlord/shared', path.resolve(__dirname, '../../shared/src'));
    },
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
    },
  },
};

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
};
