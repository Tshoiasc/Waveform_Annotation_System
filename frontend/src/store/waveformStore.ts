import { create } from 'zustand'
import type { WaveformResponse, ZoomState } from '../types/waveform'
import fileService from '../services/fileService'

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

      // 初始化缩放状态 (显示全部数据)
      const initialZoom: ZoomState = {
        xMin: Math.min(...waveform.raw.timestamps),
        xMax: Math.max(...waveform.raw.timestamps),
        yMin: Math.min(...waveform.raw.values),
        yMax: Math.max(...waveform.raw.values),
        timestamp: Date.now(),
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
    const { zoomHistory, historyIndex } = get()

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

    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      set({
        currentZoom: zoomHistory[newIndex],
        historyIndex: newIndex,
      })
    }
  },

  // 重做缩放 (Ctrl+Shift+Z)
  redoZoom: () => {
    const { zoomHistory, historyIndex } = get()

    if (historyIndex < zoomHistory.length - 1) {
      const newIndex = historyIndex + 1
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
      set({
        currentZoom: initialZoom,
        zoomHistory: [initialZoom],
        historyIndex: 0,
      })
    }
  },

  // 清除波形数据
  clearWaveform: () => {
    set({
      waveform: null,
      currentZoom: null,
      zoomHistory: [],
      historyIndex: -1,
    })
  },
}))
