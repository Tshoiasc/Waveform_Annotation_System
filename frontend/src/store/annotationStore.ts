import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import annotationService from '../services/annotationService'
import { normalizeAnnotationPhases } from '../utils/phaseUtils'
import { useWaveformStore } from './waveformStore'
import type { AnnotationEvent, AnnotationPhase, AnnotationSegment } from '../types/waveform'

interface BoundarySnapshot {
  time: number
  index: number
}

interface AnnotationState {
  // 标注数据
  annotations: AnnotationSegment[]
  events: AnnotationEvent[]
  annotationsLoading: boolean
  annotationsError: string | null
  isSyncingDrafts: boolean
  lastSyncAt: number | null
  syncError: string | null

  // 标注阶段配置（可拖拽调整顺序）
  phases: AnnotationPhase[]

  // 标注流程状态
  isAnnotating: boolean
  currentPhaseIndex: number
  currentEventIndex: number
  pendingBoundary: BoundarySnapshot | null
  eventStartBoundary: BoundarySnapshot | null

  // 基本操作
  setIsAnnotating: (value: boolean) => void
  resetCurrentFlow: () => void

  // 阶段配置操作
  setPhases: (phases: AnnotationPhase[]) => void
  reorderPhases: (phases: AnnotationPhase[]) => void
  updatePhase: (id: string, updates: Partial<Pick<AnnotationPhase, 'name' | 'color' | 'shortcut'>>) => void
  addPhase: (phase?: Partial<AnnotationPhase>) => void
  removePhase: (id: string) => void
  resetPhasesToDefault: () => void
  setCurrentPhaseIndex: (index: number) => void
  selectPhaseByShortcut: (shortcut: string) => void

  // 数据操作
  loadAnnotations: (fileId: string, trialIndex: number) => Promise<void>
  clearAnnotations: () => void
  handleBoundaryClick: (params: {
    fileId: string
    trialIndex: number
    time: number
    index: number
  }) => Promise<void>
  updateAnnotation: (id: string, updates: Partial<AnnotationSegment>) => Promise<void>
  deleteAnnotation: (id: string) => Promise<void>
  deleteEvent: (eventIndex: number) => Promise<void>
  syncDrafts: () => Promise<void>
  cancelCurrentEvent: () => Promise<void>
  advancePhase: () => void
}

const DEFAULT_PHASES: AnnotationPhase[] = normalizeAnnotationPhases([
  { id: 'baseline', name: 'Baseline', color: '#38BDF8', shortcut: '1', order: 0 },
  { id: 'approach', name: 'Approach', color: '#A855F7', shortcut: '2', order: 1 },
  { id: 'impact', name: 'Impact', color: '#F97316', shortcut: '3', order: 2 },
  { id: 'ringdown', name: 'Ringdown', color: '#FACC15', shortcut: '4', order: 3 },
])

function buildEventsFromSegments(segments: AnnotationSegment[]): AnnotationEvent[] {
  const map = new Map<number, AnnotationEvent>()
  for (const seg of segments) {
    const existing = map.get(seg.eventIndex)
    if (!existing) {
      map.set(seg.eventIndex, {
        eventIndex: seg.eventIndex,
        startTime: Math.min(seg.startTime, seg.endTime),
        endTime: Math.max(seg.startTime, seg.endTime),
      })
    } else {
      existing.startTime = Math.min(existing.startTime, seg.startTime, seg.endTime)
      existing.endTime = Math.max(existing.endTime, seg.startTime, seg.endTime)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.eventIndex - b.eventIndex)
}

function buildPhase(phase?: Partial<AnnotationPhase>): AnnotationPhase {
  const candidate = {
    id: phase?.id ?? '',
    name: phase?.name ?? '未命名阶段',
    color: phase?.color ?? '#94A3B8',
    shortcut: phase?.shortcut,
    order: phase?.order ?? 0,
  }
  return normalizeAnnotationPhases([candidate])[0]
}

interface IncompleteEventInfo {
  eventIndex: number
  phaseIndex: number
  resumeBoundary: BoundarySnapshot | null
  eventStartBoundary: BoundarySnapshot | null
}

function findIncompleteEvent(
  annotations: AnnotationSegment[],
  phases: AnnotationPhase[]
): IncompleteEventInfo | null {
  if (phases.length === 0) return null
  const grouped = new Map<number, AnnotationSegment[]>()
  annotations.forEach((segment) => {
    const list = grouped.get(segment.eventIndex)
    if (list) {
      list.push(segment)
    } else {
      grouped.set(segment.eventIndex, [segment])
    }
  })

  const sortedEventIndices = Array.from(grouped.keys()).sort((a, b) => a - b)
  for (const eventIndex of sortedEventIndices) {
    const segments = grouped.get(eventIndex)
    if (!segments) continue
    const ordered = segments.slice().sort((a, b) => a.startTime - b.startTime)
    if (ordered.length < phases.length) {
      const lastSegment = ordered[ordered.length - 1] ?? null
      const firstSegment = ordered[0] ?? null
      const resumeBoundary = lastSegment
        ? { time: lastSegment.endTime, index: lastSegment.endIndex }
        : null
      const eventStartBoundary = firstSegment
        ? { time: firstSegment.startTime, index: firstSegment.startIndex }
        : resumeBoundary
      const phaseIndex = Math.min(ordered.length, phases.length - 1)
      return { eventIndex, phaseIndex, resumeBoundary, eventStartBoundary }
    }
  }
  return null
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      annotations: [],
      events: [],
      annotationsLoading: false,
      annotationsError: null,
      isSyncingDrafts: false,
      lastSyncAt: null,
      syncError: null,
      phases: DEFAULT_PHASES,
      isAnnotating: false,
      currentPhaseIndex: 0,
      currentEventIndex: 0,
      pendingBoundary: null,
      eventStartBoundary: null,

      setIsAnnotating: (value) => {
        const state = get()
        const partial: Partial<AnnotationState> = {
          isAnnotating: value,
          annotationsError: null,
        }

        if (!value) {
          partial.pendingBoundary = null
          partial.eventStartBoundary = null
          partial.currentPhaseIndex = 0
          set(partial as AnnotationState)
          return
        }

        const resume = findIncompleteEvent(state.annotations, state.phases)
        if (resume) {
          console.debug('[annotation] resume event', resume)
          partial.currentEventIndex = resume.eventIndex
          partial.currentPhaseIndex = resume.phaseIndex
          partial.pendingBoundary = resume.resumeBoundary
          partial.eventStartBoundary = resume.eventStartBoundary ?? resume.resumeBoundary
        } else {
          const nextIndex = state.annotations.reduce(
            (max, ann) => Math.max(max, ann.eventIndex),
            -1,
          ) + 1
          partial.currentEventIndex = nextIndex
          partial.currentPhaseIndex = 0
          partial.pendingBoundary = null
          partial.eventStartBoundary = null
        }

        set(partial as AnnotationState)
      },

      resetCurrentFlow: () => {
        set({
          pendingBoundary: null,
          eventStartBoundary: null,
          currentPhaseIndex: 0,
          annotationsError: null,
        })
      },

      setPhases: (phases) => {
        const normalized = normalizeAnnotationPhases(phases)
        set({
          phases: normalized,
          currentPhaseIndex: normalized.length > 0 ? 0 : 0,
        })
      },

      reorderPhases: (phases) => {
        set((state) => {
          const normalizedInput = phases.map((phase, index) => ({
            ...phase,
            order: index,
          }))
          const normalized = normalizeAnnotationPhases(normalizedInput)
          const currentId = state.phases[state.currentPhaseIndex]?.id ?? null
          const nextIndex = currentId
            ? normalized.findIndex((phase) => phase.id === currentId)
            : 0
          return {
            phases: normalized,
            currentPhaseIndex:
              nextIndex >= 0 ? nextIndex : Math.max(Math.min(state.currentPhaseIndex, normalized.length - 1), 0),
          }
        })
      },

      updatePhase: (id, updates) => {
        set((state) => {
          const currentId = state.phases[state.currentPhaseIndex]?.id ?? null
          const updated = state.phases.map((phase) =>
            phase.id === id ? { ...phase, ...updates } : phase
          )
          const normalized = normalizeAnnotationPhases(updated)
          const preferredId = currentId ?? id
          const nextIndex = normalized.findIndex((phase) => phase.id === preferredId)
          return {
            phases: normalized,
            currentPhaseIndex:
              nextIndex >= 0 ? nextIndex : Math.max(Math.min(state.currentPhaseIndex, normalized.length - 1), 0),
          }
        })
      },

      addPhase: (phase) => {
        set((state) => ({
          phases: normalizeAnnotationPhases([...state.phases, buildPhase(phase)]),
        }))
      },

      removePhase: (id) => {
        set((state) => {
          const filtered = state.phases.filter((phase) => phase.id !== id)
          const normalized = normalizeAnnotationPhases(filtered)
          const nextIndex = normalized.length === 0
            ? 0
            : Math.max(Math.min(state.currentPhaseIndex, normalized.length - 1), 0)
          return {
            phases: normalized,
            currentPhaseIndex: nextIndex,
          }
        })
      },

      resetPhasesToDefault: () => {
        set({ phases: DEFAULT_PHASES, currentPhaseIndex: 0 })
      },

      setCurrentPhaseIndex: (index) => {
        set((state) => {
          if (state.phases.length === 0) {
            return { currentPhaseIndex: 0 }
          }
          const safe = Math.max(0, Math.min(index, state.phases.length - 1))
          return { currentPhaseIndex: safe }
        })
      },

      selectPhaseByShortcut: (shortcut) => {
        set((state) => {
          if (!shortcut) return {}
          const target = state.phases.findIndex((phase) =>
            phase.shortcut?.toUpperCase() === shortcut.toUpperCase(),
          )
          if (target === -1) {
            return {}
          }
          return { currentPhaseIndex: target, annotationsError: null }
        })
      },

      loadAnnotations: async (fileId, trialIndex) => {
        set({ annotationsLoading: true, annotationsError: null })
        try {
          const segments = await annotationService.getAnnotations(fileId, trialIndex)
          const sorted = segments
            .map((segment) => ({ ...segment, synced: true as const }))
            .sort((a, b) => a.startTime - b.startTime)
          const events = buildEventsFromSegments(sorted)
          const maxEvent = events.length > 0 ? events[events.length - 1].eventIndex : -1
          set({
            annotations: sorted,
            events,
            annotationsLoading: false,
            currentPhaseIndex: 0,
            currentEventIndex: maxEvent + 1,
            pendingBoundary: null,
            eventStartBoundary: null,
          })
        } catch (error) {
          console.error('Failed to load annotations:', error)
          set({
            annotationsLoading: false,
            annotations: [],
            events: [],
            annotationsError: error instanceof Error ? error.message : 'Failed to load annotations',
            currentPhaseIndex: 0,
            currentEventIndex: 0,
            pendingBoundary: null,
            eventStartBoundary: null,
          })
        }
      },

      clearAnnotations: () => {
        set({
          annotations: [],
          events: [],
          pendingBoundary: null,
          eventStartBoundary: null,
          currentPhaseIndex: 0,
          currentEventIndex: 0,
        })
      },

      handleBoundaryClick: async ({ fileId, trialIndex, time, index }) => {
        const state = get()
        console.debug('[annotation] boundary click', {
          fileId,
          trialIndex,
          time,
          index,
          isAnnotating: useAnnotationStore.getState().isAnnotating,
          pendingBoundary: state.pendingBoundary,
        })
        if (state.phases.length === 0) {
          set({ annotationsError: '请先在标注配置中添加阶段' })
          console.warn('[annotation] no phases configured')
          return
        }

        const boundary: BoundarySnapshot = { time, index }

        if (!state.pendingBoundary) {
          console.debug('[annotation] set pending boundary', boundary)
          set({
            pendingBoundary: boundary,
            eventStartBoundary: boundary,
            annotationsError: null,
          })
          return
        }

        if (boundary.time <= state.pendingBoundary.time) {
          console.warn('[annotation] invalid second click: end before start', {
            pending: state.pendingBoundary,
            boundary,
          })
          set({
            annotationsError: '结束时间必须大于起始时间，请选择更晚的时间点',
          })
          return
        }

        const phase = state.phases[state.currentPhaseIndex]
        if (!phase) {
          console.error('[annotation] current phase not found', {
            currentPhaseIndex: state.currentPhaseIndex,
            phases: state.phases,
          })
          set({ annotationsError: '标注阶段配置为空，请确认设置' })
          return
        }

        const start = state.pendingBoundary
        const end = boundary

        if (
          !Number.isFinite(start.time) ||
          !Number.isFinite(end.time) ||
          !Number.isFinite(start.index) ||
          !Number.isFinite(end.index)
        ) {
          console.error('[annotation] boundary contains invalid values', { start, end })
          set({ annotationsError: '标注数据异常，请重试或重新加载波形' })
          return
        }

        const waveform = useWaveformStore.getState().waveform
        const timestamps = waveform?.raw.timestamps ?? []
        const lastIndex = Math.max(0, timestamps.length - 1)

        let startIndex = Math.max(0, Math.min(Math.floor(start.index), lastIndex))
        let endIndex = Math.max(Math.floor(end.index), startIndex + 1)
        if (timestamps.length > 0) {
          endIndex = Math.min(endIndex, lastIndex)
          if (endIndex <= startIndex) {
            endIndex = Math.min(startIndex + 1, lastIndex)
          }
          if (endIndex <= startIndex) {
            console.warn('[annotation] adjusted indices still invalid', {
              startIndex,
              endIndex,
              lastIndex,
            })
            set({ annotationsError: '标注范围过小，无法创建，请选择更远的结束位置' })
            return
          }
        }

        const startTime = timestamps.length > 0 ? timestamps[startIndex] : Number(start.time)
        const endTime = timestamps.length > 0 ? timestamps[endIndex] : Number(end.time)

        const payload = {
          fileId,
          trialIndex,
          phaseId: phase.id,
          phaseName: phase.name,
          startTime,
          endTime,
          startIndex,
          endIndex,
          eventIndex: state.currentEventIndex,
          color: phase.color,
        }

        try {
          console.debug('[annotation] create annotation payload', payload)
          const newSegment = await annotationService.createAnnotation(payload)

          set((current) => {
            const annotations = [...current.annotations, newSegment].sort(
              (a, b) => a.startTime - b.startTime
            )
            const events = buildEventsFromSegments(annotations)

            const isLastPhase = current.currentPhaseIndex >= current.phases.length - 1
            const nextPhaseIndex = isLastPhase ? 0 : current.currentPhaseIndex + 1
            const nextEventIndex = isLastPhase ? current.currentEventIndex + 1 : current.currentEventIndex
            const nextPending = isLastPhase ? null : boundary
            const nextEventStart = isLastPhase ? null : current.eventStartBoundary

            console.debug('[annotation] annotation created', {
              newSegment,
              annotationsCount: annotations.length,
              nextPhaseIndex,
              nextEventIndex,
            })

            return {
              annotations,
              events,
              pendingBoundary: nextPending,
              eventStartBoundary: nextEventStart,
              currentPhaseIndex: nextPhaseIndex,
              currentEventIndex: nextEventIndex,
              annotationsError: null,
            }
          })
        } catch (error) {
          console.error('Failed to create annotation:', error)
          if (error && typeof error === 'object' && 'response' in error && error.response) {
            const axiosError = error as { response?: { data?: unknown } }
            const detail =
              typeof axiosError.response?.data === 'object' && axiosError.response?.data
                ? (axiosError.response?.data as Record<string, unknown>).detail
                : null
            set({
              annotationsError:
                typeof detail === 'string'
                  ? `创建标注失败: ${detail}`
                  : '创建标注失败，请检查网络或数据有效性',
            })
          } else {
            set({
              annotationsError: error instanceof Error ? error.message : 'Failed to create annotation',
            })
          }
        }
      },

      updateAnnotation: async (id, updates) => {
        try {
          const updated = await annotationService.updateAnnotation(id, updates)
          set((state) => {
            const annotations = state.annotations.map((ann) =>
              ann.id === id ? updated : ann
            )
            return {
              annotations,
              events: buildEventsFromSegments(annotations),
              pendingBoundary: null,
              eventStartBoundary: null,
              currentPhaseIndex: 0,
            }
          })
        } catch (error) {
          console.error('Failed to update annotation:', error)
          set({
            annotationsError: error instanceof Error ? error.message : 'Failed to update annotation',
          })
        }
      },

      deleteAnnotation: async (id) => {
        const target = get().annotations.find((ann) => ann.id === id)
        if (!target) return

        if (target.synced === false) {
          set((state) => {
            const annotations = state.annotations.filter((ann) => ann.id !== id)
            return {
              annotations,
              events: buildEventsFromSegments(annotations),
            }
          })
          return
        }

        try {
          await annotationService.deleteAnnotation(id)
          set((state) => {
            const annotations = state.annotations.filter((ann) => ann.id !== id)
            return {
              annotations,
              events: buildEventsFromSegments(annotations),
            }
          })
        } catch (error) {
          console.error('Failed to delete annotation:', error)
          set({
            annotationsError: error instanceof Error ? error.message : 'Failed to delete annotation',
          })
        }
      },

      deleteEvent: async (eventIndex) => {
        const annotations = get().annotations
        const segments = annotations.filter((ann) => ann.eventIndex === eventIndex)
        if (segments.length === 0) return

        const drafts = segments.filter((segment) => segment.synced === false)
        if (drafts.length > 0) {
          set((state) => {
            const filtered = state.annotations.filter((ann) =>
              !(ann.eventIndex === eventIndex && ann.synced === false)
            )
            return {
              annotations: filtered,
              events: buildEventsFromSegments(filtered),
            }
          })
        }

        const syncedSegments = segments.filter((segment) => segment.synced !== false)
        if (syncedSegments.length === 0) {
          set((state) => {
            const filtered = state.annotations.filter((ann) => ann.eventIndex !== eventIndex)
            return {
              annotations: filtered,
              events: buildEventsFromSegments(filtered),
            }
          })
          return
        }

        try {
          await Promise.all(syncedSegments.map((segment) => annotationService.deleteAnnotation(segment.id)))
          set((state) => {
            const filtered = state.annotations.filter((ann) => ann.eventIndex !== eventIndex)
            return {
              annotations: filtered,
              events: buildEventsFromSegments(filtered),
            }
          })
        } catch (error) {
          console.error('Failed to delete event:', error)
          set({
            annotationsError: error instanceof Error ? error.message : 'Failed to delete event',
          })
        }
      },
      syncDrafts: async () => {
        const state = get()
        if (state.isSyncingDrafts) return
        const drafts = state.annotations.filter((ann) => ann.synced === false)
        if (drafts.length === 0) {
          set({ lastSyncAt: Date.now(), syncError: null })
          return
        }

        set({ isSyncingDrafts: true })
        const updates: AnnotationSegment[] = []
        let syncError: string | null = null

        for (const draft of drafts) {
          try {
            const payload = {
              fileId: draft.fileId,
              trialIndex: draft.trialIndex,
              phaseId: draft.phaseId,
              phaseName: draft.phaseName,
              startTime: draft.startTime,
              endTime: draft.endTime,
              startIndex: draft.startIndex,
              endIndex: draft.endIndex,
              eventIndex: draft.eventIndex,
              color: draft.color,
              label: draft.label,
            }
            console.debug('[annotation] sync draft', payload)
            const result = await annotationService.createAnnotation(payload)
            updates.push({ ...result, synced: true, localId: draft.localId ?? draft.id })
          } catch (error) {
            console.error('[annotation] draft sync failed', error, draft)
            if (!syncError) {
              syncError = error instanceof Error ? error.message : '未知错误'
            }
          }
        }

        set((current) => {
          let annotations = current.annotations
          if (updates.length > 0) {
            annotations = annotations.map((ann) => {
              const matched = updates.find((update) =>
                update.localId && (ann.localId === update.localId || ann.id === update.localId)
              )
              return matched
                ? { ...matched, synced: true, localId: matched.localId }
                : ann
            })
          }

          const sorted = [...annotations].sort((a, b) => a.startTime - b.startTime)

          return {
            annotations: sorted,
            events: buildEventsFromSegments(sorted),
            isSyncingDrafts: false,
            lastSyncAt: Date.now(),
            syncError,
          }
        })
      },

      cancelCurrentEvent: async () => {
        const state = get()
        const targetIndex = state.currentEventIndex
        const segments = state.annotations.filter((ann) => ann.eventIndex === targetIndex)
        if (segments.length === 0) {
          set({
            isAnnotating: false,
            pendingBoundary: null,
            eventStartBoundary: null,
            annotationsError: null,
          })
          return
        }

        const drafts = segments.filter((segment) => segment.synced === false)
        if (drafts.length > 0) {
          set((current) => {
            const annotations = current.annotations.filter((ann) =>
              !(ann.eventIndex === targetIndex && ann.synced === false)
            )
            return {
              annotations,
              events: buildEventsFromSegments(annotations),
            }
          })
        }

        const syncedSegments = segments.filter((segment) => segment.synced !== false)
        if (syncedSegments.length > 0) {
          try {
            await Promise.all(syncedSegments.map((segment) => annotationService.deleteAnnotation(segment.id)))
          } catch (error) {
            console.error('[annotation] cancel event delete failed', error)
            set({
              annotationsError: error instanceof Error ? error.message : '取消事件失败',
            })
          }
        }

        set((current) => {
          const annotations = current.annotations.filter((ann) => ann.eventIndex !== targetIndex)
          const events = buildEventsFromSegments(annotations)
          const nextEventIndex =
            annotations.reduce((max, ann) => Math.max(max, ann.eventIndex), -1) + 1
          return {
            annotations,
            events,
            isAnnotating: false,
            pendingBoundary: null,
            eventStartBoundary: null,
            currentPhaseIndex: 0,
            currentEventIndex: nextEventIndex,
          }
        })
      },

      advancePhase: () => {
        const state = get()
        if (!state.isAnnotating || state.phases.length === 0) return

        const nextPhaseIndex = (state.currentPhaseIndex + 1) % state.phases.length
        let nextEventIndex = state.currentEventIndex

        const segments = state.annotations
          .filter((ann) => ann.eventIndex === nextEventIndex)
          .sort((a, b) => a.endTime - b.endTime)
        const lastSegment = segments[segments.length - 1] ?? null

        if (nextPhaseIndex === 0) {
          nextEventIndex = state.annotations.reduce(
            (max, ann) => Math.max(max, ann.eventIndex),
            state.currentEventIndex,
          ) + 1
          set({
            currentPhaseIndex: 0,
            currentEventIndex: nextEventIndex,
            pendingBoundary: null,
            eventStartBoundary: null,
            annotationsError: null,
          })
        } else {
          set({
            currentPhaseIndex: nextPhaseIndex,
            currentEventIndex: nextEventIndex,
            pendingBoundary: lastSegment
              ? { time: lastSegment.endTime, index: lastSegment.endIndex }
              : state.pendingBoundary,
            eventStartBoundary: lastSegment
              ? { time: lastSegment.endTime, index: lastSegment.endIndex }
              : state.eventStartBoundary,
            annotationsError: null,
          })
        }
      },
    }),
    {
      name: 'annotation-preferences',
      partialize: (state) => ({
        phases: state.phases,
        draftCache: state.annotations.filter((ann) => ann.synced === false),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.phases = state.phases ? normalizeAnnotationPhases(state.phases) : DEFAULT_PHASES
          const draftCache = (state as unknown as { draftCache?: AnnotationSegment[] }).draftCache
          const drafts = draftCache?.map((draft) => ({ ...draft, synced: false as const })) ?? []
          state.annotations = drafts
          state.events = buildEventsFromSegments(drafts)
          state.annotationsLoading = false
          state.annotationsError = null
          state.isAnnotating = false
          state.currentPhaseIndex = 0
          state.currentEventIndex = drafts.reduce(
            (max, ann) => Math.max(max, ann.eventIndex),
            -1,
          ) + 1
          state.pendingBoundary = null
          state.eventStartBoundary = null
          state.isSyncingDrafts = false
          state.lastSyncAt = null
          state.syncError = null
          delete (state as unknown as Record<string, unknown>).draftCache
        }
      },
    }
  )
)
