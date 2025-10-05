import { useEffect } from 'react'
import { useAnnotationStore } from '../store/annotationStore'

export function usePhaseShortcuts() {
  const {
    isAnnotating,
    phases,
    currentPhaseIndex,
    advancePhase,
    selectPhaseByShortcut,
  } = useAnnotationStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 仅在标注模式下才响应
      if (!isAnnotating) return

      // Shift+Tab：跳转到上一个阶段
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        if (phases.length === 0) return
        const prevIndex = currentPhaseIndex > 0 ? currentPhaseIndex - 1 : phases.length - 1
        useAnnotationStore.setState({ currentPhaseIndex: prevIndex })
        return
      }

      // Tab键：跳转到下一个阶段
      if (e.key === 'Tab') {
        e.preventDefault()
        advancePhase()
        return
      }

      // 数字键1-9：根据快捷键切换阶段
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        selectPhaseByShortcut(e.key)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnnotating, phases, currentPhaseIndex, advancePhase, selectPhaseByShortcut])
}
