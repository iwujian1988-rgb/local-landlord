import { create } from 'zustand';

interface GuideState {
  showRoomGuide: boolean;
  showTenantGuide: boolean;
  showQrGuide: boolean;
  firstVacantRoomId: number;
  setFromStats: (stats: {
    showRoomGuide?: boolean;
    showTenantGuide?: boolean;
    showQrGuide?: boolean;
    firstVacantRoomId?: number;
  }) => void;
  clear: () => void;
}

export const useGuideStore = create<GuideState>((set) => ({
  showRoomGuide: false,
  showTenantGuide: false,
  showQrGuide: false,
  firstVacantRoomId: 0,
  setFromStats: (stats) =>
    set({
      showRoomGuide: !!stats.showRoomGuide,
      showTenantGuide: !!stats.showTenantGuide,
      showQrGuide: !!stats.showQrGuide,
      firstVacantRoomId: stats.firstVacantRoomId || 0,
    }),
  clear: () =>
    set({ showRoomGuide: false, showTenantGuide: false, showQrGuide: false, firstVacantRoomId: 0 }),
}));
