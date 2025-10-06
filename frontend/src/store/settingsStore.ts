import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 全局设置存储（使用 zustand + persist）
// - defaultZoomX / defaultZoomY: 默认缩放倍数（>1 表示放大，即显示范围缩小）
// - isSettingsOpen: 设置弹窗开关
interface SettingsState {
  // 设置弹窗开关
  isSettingsOpen: boolean
  // 默认缩放倍数（X/Y 轴），1 表示显示全范围，>1 表示放大
  defaultZoomX: number
  defaultZoomY: number
  // 自动平移设置
  // - autoPanEnabled: 是否开启自动向后平移
  // - autoPanTriggerThreshold: 触发阈值（窗口宽度比例 0~1），表示“靠近右侧多少比例以内时触发自动平移”
  // - autoPanRightPadding: 平移后的右侧留白比例（0~1）
  autoPanEnabled: boolean
  autoPanTriggerThreshold: number
  autoPanRightPadding: number
  // actions
  openSettings: () => void
  closeSettings: () => void
  setDefaultZoomX: (value: number) => void
  setDefaultZoomY: (value: number) => void
  setDefaultZoomXY: (x: number, y: number) => void
  setAutoPanEnabled: (enabled: boolean) => void
  setAutoPanTriggerThreshold: (ratio: number) => void
  setAutoPanRightPadding: (ratio: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isSettingsOpen: false,
      defaultZoomX: 1,
      defaultZoomY: 1,
      autoPanEnabled: true,
      // 默认与现有实现保持一致：触发阈值 25%，右侧留白 65%
      autoPanTriggerThreshold: 0.25,
      autoPanRightPadding: 0.65,
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      setDefaultZoomX: (value: number) =>
        set({ defaultZoomX: Number.isFinite(value) && value > 0 ? value : 1 }),
      setDefaultZoomY: (value: number) =>
        set({ defaultZoomY: Number.isFinite(value) && value > 0 ? value : 1 }),
      setDefaultZoomXY: (x: number, y: number) =>
        set({
          defaultZoomX: Number.isFinite(x) && x > 0 ? x : 1,
          defaultZoomY: Number.isFinite(y) && y > 0 ? y : 1,
        }),
      setAutoPanEnabled: (enabled: boolean) => set({ autoPanEnabled: !!enabled }),
      setAutoPanTriggerThreshold: (ratio: number) =>
        set({
          autoPanTriggerThreshold:
            Number.isFinite(ratio) ? Math.max(0, Math.min(0.95, ratio)) : 0.25,
        }),
      setAutoPanRightPadding: (ratio: number) =>
        set({
          autoPanRightPadding:
            Number.isFinite(ratio) ? Math.max(0, Math.min(0.95, ratio)) : 0.65,
        }),
    }),
    {
      name: 'ui-settings',
      // 仅存储用户相关的 UI 设置
      partialize: (state) => ({
        defaultZoomX: state.defaultZoomX,
        defaultZoomY: state.defaultZoomY,
        autoPanEnabled: state.autoPanEnabled,
        autoPanTriggerThreshold: state.autoPanTriggerThreshold,
        autoPanRightPadding: state.autoPanRightPadding,
      }),
    }
  )
)
