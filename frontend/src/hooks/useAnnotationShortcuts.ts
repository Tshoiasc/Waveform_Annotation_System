import { useEffect } from 'react'
import { useAnnotationStore } from '../store/annotationStore'

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useAnnotationShortcuts() {
  const cancelCurrentEvent = useAnnotationStore((state) => state.cancelCurrentEvent)
  const advancePhase = useAnnotationStore((state) => state.advancePhase)
  const isAnnotating = useAnnotationStore((state) => state.isAnnotating)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (IGNORED_TAGS.has(target.tagName) || target.isContentEditable)) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        void cancelCurrentEvent()
        return
      }

      if (event.key === ' ' && isAnnotating) {
        event.preventDefault()
        advancePhase()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [advancePhase, cancelCurrentEvent, isAnnotating])
}
