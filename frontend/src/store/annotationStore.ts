import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import annotationService from '../services/annotationService'
import { normalizeAnnotationPhases } from '../utils/phaseUtils'
import { useWaveformStore } from './waveformStore'
import { useAuthStore } from './authStore'
import { buildDraftId, useDraftStore } from './draftStore'
import type {
  AnnotationEvent,
  AnnotationPhase,
  AnnotationSegment,
  AnnotationVersionMeta,
} from '../types/waveform'

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
  currentFileId: string | null
  currentTrialIndex: number | null
  versions: AnnotationVersionMeta[]
  activeVersionId: string | null
  selectedVersionId: string | null
  isOwner: boolean

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
  loadAnnotations: (fileId: string, trialIndex: number, versionId?: string | null) => Promise<void>
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
  cancelCurrentEvent: () => Promise<void>
  advancePhase: () => void
  selectVersion: (versionId: string | null) => void
  // 确保当前视图可编辑：在他人版本下提示并将当前版本下载为草稿
  ensureEditableViaDraft: () => Promise<void>
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

function persistDraftSegments(
  fileId: string,
  trialIndex: number,
  segments: AnnotationSegment[]
) {
  const auth = useAuthStore.getState()
  const userId = auth.user?.id
  const username = auth.user?.username ?? null
  if (!userId) return

  const draftId = buildDraftId(fileId, trialIndex, userId)
  useDraftStore
    .getState()
    .updateDraftSegments(draftId, fileId, trialIndex, segments, userId, username)
}

function markSegmentsUnsynced(segments: AnnotationSegment[]): AnnotationSegment[] {
  return segments.map((segment) => ({ ...segment, synced: false as const }))
}

function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      annotations: [],
      events: [],
      annotationsLoading: false,
      annotationsError: null,
      currentFileId: null,
      currentTrialIndex: null,
      versions: [],
      activeVersionId: null,
      selectedVersionId: null,
      isOwner: false,
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

        // 若尝试关闭标注，但当前存在未完成的区间（已选择起点未选择终点），禁止关闭
        if (!value) {
          if (state.pendingBoundary) {
            set({
              annotationsError: '当前存在未完成的标注，请先完成或按 Esc 取消',
            })
            return
          }
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

      loadAnnotations: async (fileId, trialIndex, versionId) => {
        set({
          annotationsLoading: true,
          annotationsError: null,
        })

        const authState = useAuthStore.getState()
        const user = authState.user
        const userId = user?.id ?? ''
        const username = user?.username ?? null

        try {
          const { annotations, versions, activeVersionId } = await annotationService.getAnnotations(
            fileId,
            trialIndex,
            versionId ?? undefined
          )

          const draftStore = useDraftStore.getState()
          const draftId = userId ? buildDraftId(fileId, trialIndex, userId) : null
          const existingDraft = draftId ? draftStore.drafts[draftId] : undefined

          const effectiveVersionId = (versionId ?? activeVersionId) ?? null
          const activeVersion = versions.find((item) => item.id === effectiveVersionId) ?? null
          const preliminaryOwnerFlag =
            versions.length === 0 || activeVersion === null
              ? true
              : Boolean(activeVersion.isOwner)

          const sourceSegments: AnnotationSegment[] = existingDraft
            ? existingDraft.segments.map((segment) => ({ ...segment, synced: false as const }))
            : (annotations ?? []).map((segment) => ({ ...segment, synced: true as const }))

          if (existingDraft && existingDraft.segments.length === 0) {
            draftStore.removeDraft(existingDraft.id)
          }

          const sorted = sourceSegments.sort((a, b) => a.startTime - b.startTime)
          const events = buildEventsFromSegments(sorted)
          const maxEvent = events.length > 0 ? events[events.length - 1].eventIndex : -1

          set({
            annotations: sorted,
            events,
            annotationsLoading: false,
            annotationsError: null,
            currentPhaseIndex: 0,
            currentEventIndex: maxEvent + 1,
            pendingBoundary: null,
            eventStartBoundary: null,
            currentFileId: fileId,
            currentTrialIndex: trialIndex,
            versions,
            activeVersionId,
            selectedVersionId: effectiveVersionId,
            isOwner: existingDraft ? true : preliminaryOwnerFlag,
          })

          if (existingDraft) {
            draftStore.markDirty(existingDraft.id)
          }
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
            currentFileId: fileId,
            currentTrialIndex: trialIndex,
            versions: [],
            activeVersionId: null,
            selectedVersionId: null,
            isOwner: true,
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
          currentFileId: null,
          currentTrialIndex: null,
          versions: [],
          activeVersionId: null,
          selectedVersionId: null,
          isOwner: false,
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
        if (!state.isOwner) {
          set({ annotationsError: '当前版本为只读，无法编辑' })
          return
        }
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

        const auth = useAuthStore.getState()
        const userId = auth.user?.id ?? ''
        const versionId = get().activeVersionId ?? null
        const newSegment: AnnotationSegment = {
          id: createLocalId(),
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
          label: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false as const,
          userId,
          versionId: versionId ?? undefined,
        }

        set((current) => {
          const annotations = [...current.annotations, newSegment].sort((a, b) => a.startTime - b.startTime)
          const unsynced = markSegmentsUnsynced(annotations)
          persistDraftSegments(fileId, trialIndex, unsynced)

          const events = buildEventsFromSegments(unsynced)
          const isLastPhase = current.currentPhaseIndex >= current.phases.length - 1
          const nextPhaseIndex = isLastPhase ? 0 : current.currentPhaseIndex + 1
          const nextEventIndex = isLastPhase ? current.currentEventIndex + 1 : current.currentEventIndex
          const nextPending = isLastPhase ? null : boundary
          const nextEventStart = isLastPhase ? null : current.eventStartBoundary

          return {
            annotations: unsynced,
            events,
            pendingBoundary: nextPending,
            eventStartBoundary: nextEventStart,
            currentPhaseIndex: nextPhaseIndex,
            currentEventIndex: nextEventIndex,
            annotationsError: null,
            isOwner: true,
          }
        })
      },

      updateAnnotation: async (id, updates) => {
        const state = get()
        const target = state.annotations.find((ann) => ann.id === id)
        if (!target) {
          set({ annotationsError: '未找到需要更新的标注' })
          return
        }
        if (!state.isOwner) {
          set({ annotationsError: '当前版本为只读，无法编辑' })
          return
        }

        const merged: AnnotationSegment = {
          ...target,
          ...updates,
          updatedAt: new Date().toISOString(),
          synced: false as const,
        }

        set((current) => {
          const annotations = current.annotations.map((ann) => (ann.id === id ? merged : ann))
          const unsynced = markSegmentsUnsynced(annotations)
          persistDraftSegments(target.fileId, target.trialIndex, unsynced)
          return {
            annotations: unsynced,
            events: buildEventsFromSegments(unsynced),
            pendingBoundary: null,
            eventStartBoundary: null,
            currentPhaseIndex: 0,
            annotationsError: null,
            isOwner: true,
          }
        })
      },

      deleteAnnotation: async (id) => {
        if (!get().isOwner) {
          set({ annotationsError: '当前版本为只读，无法编辑' })
          return
        }
        const target = get().annotations.find((ann) => ann.id === id)
        if (!target) return

        set((state) => {
          const annotations = state.annotations.filter((ann) => ann.id !== id)
          const unsynced = markSegmentsUnsynced(annotations)
          persistDraftSegments(target.fileId, target.trialIndex, unsynced)
          return {
            annotations: unsynced,
            events: buildEventsFromSegments(unsynced),
            annotationsError: null,
            isOwner: true,
          }
        })
      },

      deleteEvent: async (eventIndex) => {
        if (!get().isOwner) {
          set({ annotationsError: '当前版本为只读，无法编辑' })
          return
        }
        const annotations = get().annotations
        const segments = annotations.filter((ann) => ann.eventIndex === eventIndex)
        if (segments.length === 0) return
        const reference = segments[0]

        set((state) => {
          const filtered = state.annotations.filter((ann) => ann.eventIndex !== eventIndex)
          const unsynced = markSegmentsUnsynced(filtered)
          const events = buildEventsFromSegments(unsynced)
          const nextEventIndex = unsynced.reduce((max, ann) => Math.max(max, ann.eventIndex), -1) + 1
          persistDraftSegments(reference.fileId, reference.trialIndex, unsynced)
          return {
            annotations: unsynced,
            events,
            isAnnotating: true,
            pendingBoundary: null,
            eventStartBoundary: null,
            currentPhaseIndex: 0,
            currentEventIndex: nextEventIndex,
            annotationsError: null,
            isOwner: true,
          }
        })
      },

      cancelCurrentEvent: async () => {
        const state = get()
        if (!state.isOwner) {
          set({ annotationsError: '当前版本为只读，无法编辑' })
          return
        }
        const targetIndex = state.currentEventIndex
        const segments = state.annotations.filter((ann) => ann.eventIndex === targetIndex)
        if (segments.length === 0) {
          // 没有已完成的片段，仅清除当前未完成的起止点，保持标注模式开启
          set({
            isAnnotating: true,
            pendingBoundary: null,
            eventStartBoundary: null,
            annotationsError: null,
          })
          return
        }

        const reference = segments[0]
        set((current) => {
          const annotations = current.annotations.filter((ann) => ann.eventIndex !== targetIndex)
          const unsynced = markSegmentsUnsynced(annotations)
          const events = buildEventsFromSegments(unsynced)
          const nextEventIndex =
            unsynced.reduce((max, ann) => Math.max(max, ann.eventIndex), -1) + 1

          if (reference) {
            persistDraftSegments(
              reference.fileId,
              reference.trialIndex,
              unsynced
            )
          }
          return {
            annotations: unsynced,
            events,
            isAnnotating: true,
            pendingBoundary: null,
            eventStartBoundary: null,
            currentPhaseIndex: 0,
            currentEventIndex: nextEventIndex,
            annotationsError: null,
            isOwner: true,
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

      selectVersion: (versionId) => {
        const state = get()
        if (!state.currentFileId || state.currentTrialIndex === null) return
        void get()
          .loadAnnotations(state.currentFileId, state.currentTrialIndex, versionId)
          .catch((error) => {
            console.error('[annotation] select version failed', error)
            set({
              annotationsError:
                error instanceof Error ? error.message : '切换版本失败',
            })
          })
      },

      ensureEditableViaDraft: async () => {
        const state = get()
        if (state.isOwner) return
        const fileId = state.currentFileId
        const trialIndex = state.currentTrialIndex
        if (!fileId || trialIndex === null) return

        const auth = useAuthStore.getState()
        const userId = auth.user?.id
        const username = auth.user?.username ?? null
        if (!userId) {
          set({ annotationsError: '未登录用户无法创建草稿' })
          return
        }

        // 使用当前内存标注作为草稿内容，全部标记为未同步
        const unsynced = markSegmentsUnsynced(state.annotations)
        persistDraftSegments(fileId, trialIndex, unsynced)
        try {
          useDraftStore.getState().setMessage('已将当前版本下载为草稿，可在草稿箱中“立即同步”上传至云端')
        } catch {
          // 忽略 UI 消息失败
        }
        await get().loadAnnotations(fileId, trialIndex)
      },
    }),
    {
      name: 'annotation-preferences',
      partialize: (state) => ({
        phases: state.phases,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.phases = state.phases ? normalizeAnnotationPhases(state.phases) : DEFAULT_PHASES
        }
      },
    }
  )
)
