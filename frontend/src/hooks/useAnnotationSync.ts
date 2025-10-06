import { useEffect, useRef } from 'react'
import { useDraftStore } from '../store/draftStore'
import { useAnnotationStore } from '../store/annotationStore'

export function useAnnotationSync() {
  const startAutoSync = useDraftStore((state) => state.startAutoSync)
  const stopAutoSync = useDraftStore((state) => state.stopAutoSync)
  const syncAll = useDraftStore((state) => state.syncAll)
  const drafts = useDraftStore((state) => state.drafts)
  const isSyncing = useDraftStore((state) => state.isSyncing)
  const loadAnnotations = useAnnotationStore((state) => state.loadAnnotations)
  const currentFileId = useAnnotationStore((state) => state.currentFileId)
  const currentTrialIndex = useAnnotationStore((state) => state.currentTrialIndex)
  const isAnnotating = useAnnotationStore((state) => state.isAnnotating)
  const draftPresenceRef = useRef(false)

  useEffect(() => {
    startAutoSync()
    return () => {
      stopAutoSync()
    }
  }, [startAutoSync, stopAutoSync])

  // 仅在非标注进行中时，才会尝试基于草稿变化做一次被动同步
  // 避免用户逐段标注时频繁同步导致流程被打断
  useEffect(() => {
    if (!isSyncing && !isAnnotating) {
      void syncAll()
    }
  }, [drafts, isSyncing, isAnnotating, syncAll])

  useEffect(() => {
    if (!currentFileId || currentTrialIndex === null) return
    const hasDraft = Object.values(drafts).some(
      (draft) => draft.fileId === currentFileId && draft.trialIndex === currentTrialIndex
    )
    // 仅当不在标注流程中时，且草稿从有到无的过渡，才触发刷新
    if (!isAnnotating && draftPresenceRef.current && !hasDraft) {
      void loadAnnotations(currentFileId, currentTrialIndex)
    }
    draftPresenceRef.current = hasDraft
  }, [drafts, currentFileId, currentTrialIndex, isAnnotating, loadAnnotations])
}
