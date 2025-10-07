import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import annotationService from '../services/annotationService'
import { useWorkspaceStore } from './workspaceStore'
import type { AnnotationSegment, AnnotationSyncResult, AnnotationVersionMeta } from '../types/waveform'

interface DraftEntry {
  id: string
  fileId: string
  trialIndex: number
  userId: string
  username: string | null
  segments: AnnotationSegment[]
  status: 'dirty' | 'syncing' | 'synced' | 'error'
  updatedAt: number
  lastSyncedAt?: number
  error?: string
  versionMeta?: AnnotationVersionMeta | null
}

interface DraftState {
  drafts: Record<string, DraftEntry>
  isSyncing: boolean
  lastMessage: string | null
  syncInterval: number
  timerId: number | null

  setDraft: (draft: DraftEntry) => void
  updateDraftSegments: (
    draftId: string,
    fileId: string,
    trialIndex: number,
    segments: AnnotationSegment[],
    userId: string,
    username: string | null
  ) => void
  removeDraft: (draftId: string) => void
  markDirty: (draftId: string) => void
  markSyncing: (draftId: string) => void
  markSynced: (draftId: string, result: AnnotationSyncResult) => void
  markError: (draftId: string, error: string) => void
  setMessage: (message: string | null) => void
  startAutoSync: () => void
  stopAutoSync: () => void
  syncAll: () => Promise<void>
  syncDraft: (draftId: string) => Promise<void>
}

function buildDraftId(fileId: string, trialIndex: number, userId: string): string {
  return `${fileId}::${trialIndex}::${userId}`
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      isSyncing: false,
      lastMessage: null,
      syncInterval: 60000,
      timerId: null,

      setDraft: (draft) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            [draft.id]: draft,
          },
        }))
      },

      updateDraftSegments: (draftId, fileId, trialIndex, segments, userId, username) => {
        set((state) => {
          const existing = state.drafts[draftId]
          const now = Date.now()
          const next: DraftEntry = existing
            ? {
                ...existing,
                segments,
                status: 'dirty',
                updatedAt: now,
                userId,
                username,
                error: undefined,
              }
            : {
                id: draftId,
                fileId,
                trialIndex,
                userId,
                username,
                segments,
                status: 'dirty',
                updatedAt: now,
              }
          return {
            drafts: {
              ...state.drafts,
              [draftId]: next,
            },
          }
        })
      },

      removeDraft: (draftId) => {
        set((state) => {
          const next = { ...state.drafts }
          delete next[draftId]
          return { drafts: next }
        })
      },

      markDirty: (draftId) => {
        set((state) => {
          const draft = state.drafts[draftId]
          if (!draft) return {}
          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                status: 'dirty',
                error: undefined,
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      markSyncing: (draftId) => {
        set((state) => {
          const draft = state.drafts[draftId]
          if (!draft) return {}
          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                status: 'syncing',
                error: undefined,
              },
            },
            isSyncing: true,
          }
        })
      },

      markSynced: (draftId, result) => {
        set((state) => {
          const draft = state.drafts[draftId]
          if (!draft) {
            return {}
          }
          // 同步成功后，尝试更新工作区的 Trial 列表，让状态立刻反映“版本 N”
          try {
            useWorkspaceStore.setState((ws) => {
              if (ws.selectedFile?.fileId !== draft.fileId) return {}
              return {
                trials: ws.trials.map((t) =>
                  t.trialIndex === draft.trialIndex
                    ? { ...t, versionCount: Math.max(1, (t as any).versionCount ?? 0) }
                    : t
                ),
              }
            })
          } catch {
            // 忽略 UI 刷新失败，确保不影响主流程
          }
          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                status: 'synced',
                lastSyncedAt: Date.now(),
                error: undefined,
                versionMeta: {
                  id: result.versionId,
                  fileId: draft.fileId,
                  trialIndex: draft.trialIndex,
                  userId: draft.userId,
                  username: draft.username,
                  status: result.status,
                  segmentCount: result.segmentCount,
                  createdAt: draft.versionMeta?.createdAt,
                  updatedAt: result.syncedAt,
                  isOwner: true,
                },
              },
            },
            isSyncing: false,
            lastMessage: `草稿同步完成（${new Date().toLocaleTimeString()}）`,
          }
        })
      },

      markError: (draftId, error) => {
        set((state) => {
          const draft = state.drafts[draftId]
          if (!draft) return { isSyncing: false }
          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                status: 'error',
                error,
              },
            },
            isSyncing: false,
            lastMessage: error,
          }
        })
      },

      setMessage: (message) => set({ lastMessage: message }),

      startAutoSync: () => {
        const state = get()
        if (state.timerId !== null) return
        const timer = window.setInterval(() => {
          void get().syncAll()
        }, state.syncInterval)
        set({ timerId: timer })
      },

      stopAutoSync: () => {
        const state = get()
        if (state.timerId !== null) {
          window.clearInterval(state.timerId)
          set({ timerId: null })
        }
      },

      syncAll: async () => {
        const state = get()
        if (state.isSyncing) return
        const entries = Object.values(state.drafts)
          .filter((draft) => draft.status === 'dirty')
          .sort((a, b) => b.updatedAt - a.updatedAt)
        for (const draft of entries) {
          // eslint-disable-next-line no-await-in-loop
          await get().syncDraft(draft.id)
        }
      },

      syncDraft: async (draftId) => {
        const state = get()
        const draft = state.drafts[draftId]
        if (!draft) return
        if (draft.status === 'syncing') return
        get().markSyncing(draftId)
        try {
          const result = await annotationService.syncDraft(
            draft.fileId,
            draft.trialIndex,
            draft.segments,
            new Date(draft.updatedAt).toISOString()
          )
          get().markSynced(draftId, result)
          // 同步成功后移除草稿缓存
          get().removeDraft(draftId)
        } catch (error) {
          const message = error instanceof Error ? error.message : '草稿同步失败'
          get().markError(draftId, message)
        }
      },
    }),
    {
      name: 'annotation-drafts',
    }
  )
)

export { buildDraftId }
