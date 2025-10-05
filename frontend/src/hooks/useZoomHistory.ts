import { useEffect } from 'react'
import { useWaveformStore } from '../store/waveformStore'

/**
 * 缩放历史键盘快捷键Hook
 * Ctrl+Z: 撤销缩放
 * Ctrl+Shift+Z: 重做缩放
 */
export function useZoomHistory() {
  const { undoZoom, redoZoom } = useWaveformStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl/Cmd + Z (撤销)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoZoom()
      }

      // Ctrl/Cmd + Shift + Z (重做)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redoZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [undoZoom, redoZoom])
}
