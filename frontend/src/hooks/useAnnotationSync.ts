import { useEffect } from 'react'
import { useAnnotationStore } from '../store/annotationStore'

const SYNC_INTERVAL = 15000

export function useAnnotationSync() {
  const syncDrafts = useAnnotationStore((state) => state.syncDrafts)
  const annotations = useAnnotationStore((state) => state.annotations)
  const isSyncing = useAnnotationStore((state) => state.isSyncingDrafts)

  useEffect(() => {
    const timer = setInterval(() => {
      void syncDrafts()
    }, SYNC_INTERVAL)
    return () => clearInterval(timer)
  }, [syncDrafts])

  useEffect(() => {
    if (!isSyncing) {
      void syncDrafts()
    }
  }, [annotations.length, isSyncing, syncDrafts])
}
