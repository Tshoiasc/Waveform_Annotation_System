import { create } from 'zustand'
import type { WaveformResponse, ZoomState } from '../types/waveform'
import fileService from '../services/fileService'
import { useSettingsStore } from './settingsStore'

interface WaveformState {
  // 波形数据
  waveform: WaveformResponse | null
  waveformLoading: boolean
  waveformError: string | null

  // 缩放状态
  currentZoom: ZoomState | null
  zoomHistory: ZoomState[]
  historyIndex: number

  // Actions
  loadWaveform: (fileId: string, trialIndex: number) => Promise<void>
  setZoom: (zoom: ZoomState) => void
  undoZoom: () => void
  redoZoom: () => void
  resetZoom: () => void
  clearWaveform: () => void
}

// 调试：缩放链路日志（不进入状态树）
const DEBUG_ZOOM_FLOW = true

export const useWaveformStore = create<WaveformState>((set, get) => ({
  // 初始状态
  waveform: null,
  waveformLoading: false,
  waveformError: null,

  currentZoom: null,
  zoomHistory: [],
  historyIndex: -1,

  // 加载波形数据
  loadWaveform: async (fileId: string, trialIndex: number) => {
    set({ waveformLoading: true, waveformError: null })

    try {
      const waveform = await fileService.getWaveform(fileId, trialIndex)
      const debug = DEBUG_ZOOM_FLOW
      if (debug) {
        console.debug('[zoom][loadWaveform] fetched waveform', {
          fileId,
          trialIndex,
          rawLen: waveform?.raw?.timestamps?.length,
          filteredLen: waveform?.filtered?.values?.length,
        })
      }

      // 从设置中读取默认缩放倍数（>1 表示放大）
      const { defaultZoomX, defaultZoomY } = useSettingsStore.getState()

      // 计算原始范围（全量）
      const xMinAll = Math.min(...waveform.raw.timestamps)
      const xMaxAll = Math.max(...waveform.raw.timestamps)
      const yMinAll = Math.min(...waveform.raw.values)
      const yMaxAll = Math.max(...waveform.raw.values)

      const xRangeAll = xMaxAll - xMinAll || 1
      const yRangeAll = yMaxAll - yMinAll || 1

      // X 轴：从最左侧开始，根据倍率裁剪；倍率<=1 时显示全范围
      // Y 轴：仍按中位点对称裁剪；倍率<=1 时显示全范围
      const yCenter = (yMinAll + yMaxAll) / 2

      const targetXRange = defaultZoomX > 1 ? xRangeAll / defaultZoomX : xRangeAll
      const targetYRange = defaultZoomY > 1 ? yRangeAll / defaultZoomY : yRangeAll

      let xMinInit = xMinAll
      let xMaxInit = xMinAll + targetXRange
      let yMinInit = yCenter - targetYRange / 2
      let yMaxInit = yCenter + targetYRange / 2

      // 边界校正，避免超出全量范围；若倍率导致范围大于全量，回退为全量范围
      // X 轴边界校正：从左起始，最多到全量最大
      if (xMaxInit - xMinInit > xRangeAll) {
        xMinInit = xMinAll
        xMaxInit = xMaxAll
      } else {
        if (xMinInit < xMinAll) {
          xMinInit = xMinAll
          xMaxInit = xMinAll + targetXRange
        }
        if (xMaxInit > xMaxAll) {
          xMaxInit = xMaxAll
          xMinInit = xMaxAll - targetXRange
        }
      }

      if (yMaxInit - yMinInit > yRangeAll) {
        yMinInit = yMinAll
        yMaxInit = yMaxAll
      } else {
        if (yMinInit < yMinAll) {
          yMinInit = yMinAll
          yMaxInit = yMinAll + targetYRange
        }
        if (yMaxInit > yMaxAll) {
          yMaxInit = yMaxAll
          yMinInit = yMaxAll - targetYRange
        }
      }

      const initialZoom: ZoomState = {
        xMin: xMinInit,
        xMax: xMaxInit,
        yMin: yMinInit,
        yMax: yMaxInit,
        timestamp: Date.now(),
      }
      if (debug) {
        console.debug('[zoom][loadWaveform] defaultZoom settings', {
          defaultZoomX,
          defaultZoomY,
        })
        console.debug('[zoom][loadWaveform] extents', {
          xMinAll,
          xMaxAll,
          yMinAll,
          yMaxAll,
        })
        console.debug('[zoom][loadWaveform] initialZoom', initialZoom)
      }

      set({
        waveform,
        waveformLoading: false,
        currentZoom: initialZoom,
        zoomHistory: [initialZoom],
        historyIndex: 0,
      })
    } catch (error) {
      set({
        waveformError: error instanceof Error ? error.message : 'Failed to load waveform',
        waveformLoading: false,
      })
    }
  },

  // 设置缩放状态 (添加到历史栈)
  setZoom: (zoom: ZoomState) => {
    const { zoomHistory, historyIndex, waveform } = get()
    const debug = DEBUG_ZOOM_FLOW
    if (debug) {
      let xMinAll: number | null = null
      let xMaxAll: number | null = null
      let yMinAll: number | null = null
      let yMaxAll: number | null = null
      if (waveform && waveform.raw?.timestamps?.length) {
        xMinAll = Math.min(...waveform.raw.timestamps)
        xMaxAll = Math.max(...waveform.raw.timestamps)
      }
      if (waveform && waveform.raw?.values?.length) {
        yMinAll = Math.min(...waveform.raw.values)
        yMaxAll = Math.max(...waveform.raw.values)
      }
      const equalsFullX =
        xMinAll != null && xMaxAll != null && Math.abs(zoom.xMin - xMinAll) < 1e-9 && Math.abs(zoom.xMax - xMaxAll) < 1e-9
      const equalsFullY =
        yMinAll != null && yMaxAll != null && Math.abs(zoom.yMin - yMinAll) < 1e-9 && Math.abs(zoom.yMax - yMaxAll) < 1e-9
      console.debug('[zoom][setZoom] incoming', {
        zoom,
        equalsFullX,
        equalsFullY,
        xMinAll,
        xMaxAll,
        yMinAll,
        yMaxAll,
        historyIndex,
        historyLen: zoomHistory.length,
      })
      // 打印调用栈定位来源（滚轮 / 自动平移 / 初始化 / 撤销 等）
      // eslint-disable-next-line no-console
      console.trace('[zoom][setZoom] call stack')
    }

    // 移除当前索引之后的历史记录
    const newHistory = zoomHistory.slice(0, historyIndex + 1)

    // 添加新的缩放状态
    newHistory.push(zoom)

    // 限制历史栈大小为50
    const trimmedHistory = newHistory.slice(-50)

    set({
      currentZoom: zoom,
      zoomHistory: trimmedHistory,
      historyIndex: trimmedHistory.length - 1,
    })
  },

  // 撤销缩放 (Ctrl+Z)
  undoZoom: () => {
    const { zoomHistory, historyIndex } = get()
    const debug = DEBUG_ZOOM_FLOW
    if (debug) {
      console.debug('[zoom][undoZoom] before', { historyIndex, historyLen: zoomHistory.length })
    }

    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      if (debug) {
        console.debug('[zoom][undoZoom] applying', zoomHistory[newIndex])
      }
      set({
        currentZoom: zoomHistory[newIndex],
        historyIndex: newIndex,
      })
    }
  },

  // 重做缩放 (Ctrl+Shift+Z)
  redoZoom: () => {
    const { zoomHistory, historyIndex } = get()
    const debug = DEBUG_ZOOM_FLOW
    if (debug) {
      console.debug('[zoom][redoZoom] before', { historyIndex, historyLen: zoomHistory.length })
    }

    if (historyIndex < zoomHistory.length - 1) {
      const newIndex = historyIndex + 1
      if (debug) {
        console.debug('[zoom][redoZoom] applying', zoomHistory[newIndex])
      }
      set({
        currentZoom: zoomHistory[newIndex],
        historyIndex: newIndex,
      })
    }
  },

  // 重置缩放 (显示全部数据)
  resetZoom: () => {
    const { zoomHistory } = get()
    if (zoomHistory.length > 0) {
      const initialZoom = zoomHistory[0]
      const debug = DEBUG_ZOOM_FLOW
      if (debug) {
        console.debug('[zoom][resetZoom] to initial', initialZoom)
      }
      set({
        currentZoom: initialZoom,
        zoomHistory: [initialZoom],
        historyIndex: 0,
      })
    }
  },

  // 清除波形数据
  clearWaveform: () => {
    const debug = DEBUG_ZOOM_FLOW
    if (debug) {
      console.debug('[zoom][clearWaveform] clearing waveform & zoom state')
    }
    set({
      waveform: null,
      currentZoom: null,
      zoomHistory: [],
      historyIndex: -1,
    })
  },
}))
