type AppConfig = Parameters<typeof defineAppConfig>[0];

const appConfig: AppConfig = {
  pages: [
    'pages/onboarding/index',
    'pages/home/index',
    'pages/rooms/index',
    'pages/room-list/index',
    'pages/room-detail/index',
    'pages/add-property/index',
    'pages/add-room-photo/index',
    'pages/add-room-info/index',
    'pages/add-tenant/index',
    'pages/fee-setup/index',
    'pages/rent-list/index',
    'pages/rent-stats/index',
    'pages/bill/index',
    'pages/single-charge/index',
    'pages/payment/index',
    'pages/qr-code/index',
    'pages/contracts/index',
    'pages/records/index',
    'pages/my/index',
    'pages/property-manage/index',
    'pages/privacy/index',
    'pages/terms/index',
    'pages/account/index',
    'pages/share-webview/index',
  ],
  tabBar: {
    color: '#8B7E74',
    selectedColor: '#4A4038',
    backgroundColor: '#FFFDF9',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页', iconPath: 'tab-home.png', selectedIconPath: 'tab-home-active.png' },
      { pagePath: 'pages/rooms/index', text: '房间', iconPath: 'tab-rooms.png', selectedIconPath: 'tab-rooms-active.png' },
      { pagePath: 'pages/rent-list/index', text: '收租', iconPath: 'tab-rent.png', selectedIconPath: 'tab-rent-active.png' },
      { pagePath: 'pages/my/index', text: '我的', iconPath: 'tab-my.png', selectedIconPath: 'tab-my-active.png' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FDF8F3',
    navigationBarTitleText: '五联人家',
    navigationBarTextStyle: 'black',
  },
};

const config: AppConfig = defineAppConfig(appConfig) as AppConfig;

export default config;
