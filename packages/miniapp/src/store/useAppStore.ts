import { create } from 'zustand';

export type TabKey = 'home' | 'rooms' | 'rent' | 'my';

interface AppState {
  currentTab: TabKey;
  currentPage: string;
  pageStack: string[];
  /** 云数据是否已同步完成（控制 UI loading 状态） */
  dataReady: boolean;
  setDataReady: (ready: boolean) => void;
  switchTab: (tab: TabKey) => void;
  navigateTo: (page: string) => void;
  goBack: () => void;
}

const TAB_PAGES: Record<TabKey, string> = {
  home: '/pages/home/index',
  rooms: '/pages/rooms/index',
  rent: '/pages/rent-list/index',
  my: '/pages/my/index',
};

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'home',
  currentPage: '/pages/home/index',
  pageStack: ['/pages/home/index'],
  dataReady: false,

  setDataReady: (ready: boolean) => {
    set({ dataReady: ready });
  },

  switchTab: (tab: TabKey) => {
    const url = TAB_PAGES[tab];
    set({
      currentTab: tab,
      currentPage: url,
      pageStack: [url],
    });
  },

  navigateTo: (page: string) => {
    const { pageStack } = get();
    const url = page.startsWith('/') ? page : `/pages/${page}/index`;
    set({
      currentPage: url,
      pageStack: [...pageStack, url],
    });
  },

  goBack: () => {
    const { pageStack } = get();
    if (pageStack.length <= 1) return;
    const newStack = pageStack.slice(0, -1);
    const prevPage = newStack[newStack.length - 1];
    set({
      currentPage: prevPage,
      pageStack: newStack,
    });
  },
}));
