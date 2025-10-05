import { create } from 'zustand'
import type { FileInfo, TrialMetadata } from '../types/waveform'
import fileService from '../services/fileService'
import { useAnnotationStore } from './annotationStore'

interface WorkspaceState {
  // 文件列表
  files: FileInfo[]
  filesLoading: boolean
  filesError: string | null

  // 当前选中的文件
  selectedFile: FileInfo | null

  // Trial列表
  trials: TrialMetadata[]
  trialsLoading: boolean
  trialsError: string | null

  // 当前选中的Trial
  selectedTrial: TrialMetadata | null

  // Actions
  loadFiles: () => Promise<void>
  selectFile: (file: FileInfo) => Promise<void>
  selectTrial: (trial: TrialMetadata) => void
  clearSelection: () => void
  updateFileFinished: (fileId: string, finished: boolean) => Promise<void>
  updateTrialFinished: (fileId: string, trialIndex: number, finished: boolean) => Promise<void>
}

function deriveFileStatus(trials: TrialMetadata[], fallbackTotal?: number) {
  const total = fallbackTotal ?? trials.length
  const finishedTrials = trials.filter((trial) => trial.finished).length
  const hasAnnotations = trials.some((trial) => (trial.annotationCount ?? 0) > 0)
  const isFinished = total > 0 && finishedTrials >= total
  return {
    finishedTrials,
    isFinished,
    hasAnnotations,
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // 初始状态
  files: [],
  filesLoading: false,
  filesError: null,

  selectedFile: null,

  trials: [],
  trialsLoading: false,
  trialsError: null,

  selectedTrial: null,

  // 加载文件列表
  loadFiles: async () => {
    const selectedFileId = get().selectedFile?.fileId ?? null
    set({ filesLoading: true, filesError: null })

    try {
      const files = await fileService.getFiles()
      const nextSelected = selectedFileId
        ? files.find((item) => item.fileId === selectedFileId) ?? null
        : null

      set({
        files,
        filesLoading: false,
        selectedFile: nextSelected,
      })
    } catch (error) {
      set({
        filesError: error instanceof Error ? error.message : 'Failed to load files',
        filesLoading: false,
      })
    }
  },

  // 选择文件并加载其Trials
  selectFile: async (file: FileInfo) => {
    set({
      selectedFile: file,
      trialsLoading: true,
      trialsError: null,
      selectedTrial: null,
    })

    try {
      const trials = await fileService.getTrials(file.fileId)
      set((state) => {
        const status = deriveFileStatus(trials, file.trialCount)
        const updatedFiles = state.files.map((item) =>
          item.fileId === file.fileId
            ? {
                ...item,
                finishedTrials: status.finishedTrials,
                isFinished: status.isFinished,
                hasStarted: status.hasAnnotations,
              }
            : item
        )

        return {
          trials,
          trialsLoading: false,
          files: updatedFiles,
          selectedFile: {
            ...file,
            finishedTrials: status.finishedTrials,
            isFinished: status.isFinished,
            hasStarted: status.hasAnnotations,
          },
        }
      })
    } catch (error) {
      set({
        trialsError: error instanceof Error ? error.message : 'Failed to load trials',
        trialsLoading: false,
        trials: [],
      })
    }
  },

  // 选择Trial
  selectTrial: (trial: TrialMetadata) => {
    set({ selectedTrial: trial })

    // 自动加载该trial的标注
    const { selectedFile } = get()
    if (selectedFile) {
      const loadAnnotations = useAnnotationStore.getState().loadAnnotations
      loadAnnotations(selectedFile.fileId, trial.trialIndex)
    }
  },

  // 清除选择
  clearSelection: () => {
    set({
      selectedFile: null,
      selectedTrial: null,
      trials: [],
    })
  },

  updateFileFinished: async (fileId, finished) => {
    set({ trialsError: null })
    try {
      const currentTrialIndex = get().selectedTrial?.trialIndex ?? null
      await fileService.updateFileStatus(fileId, finished)
      await get().loadFiles()
      const updatedFile = get().files.find((item) => item.fileId === fileId)
      if (updatedFile) {
        await get().selectFile(updatedFile)
        if (currentTrialIndex !== null) {
          const refreshedTrial = get().trials.find((trial) => trial.trialIndex === currentTrialIndex)
          if (refreshedTrial) {
            get().selectTrial(refreshedTrial)
          }
        }
      }
    } catch (error) {
      set({
        trialsError: error instanceof Error ? error.message : 'Failed to update file status',
      })
      throw error
    }
  },

  updateTrialFinished: async (fileId, trialIndex, finished) => {
    set({ trialsError: null })
    try {
      await fileService.updateTrialStatus(fileId, trialIndex, finished)
      set((state) => {
        const trials = state.trials.map((trial) =>
          trial.trialIndex === trialIndex
            ? {
                ...trial,
                finished,
                finishedAt: finished ? new Date().toISOString() : undefined,
              }
            : trial
        )

        const status = deriveFileStatus(trials, state.selectedFile?.trialCount)

        const updatedFiles = state.files.map((item) =>
          item.fileId === fileId
            ? {
                ...item,
                finishedTrials: status.finishedTrials,
                isFinished: status.isFinished,
                hasStarted: status.hasAnnotations,
              }
            : item
        )

        const updatedSelectedFile = state.selectedFile?.fileId === fileId
          ? {
              ...state.selectedFile,
              finishedTrials: status.finishedTrials,
              isFinished: status.isFinished,
              hasStarted: status.hasAnnotations,
            }
          : state.selectedFile

        const updatedSelectedTrial = state.selectedTrial?.trialIndex === trialIndex
          ? { ...state.selectedTrial, finished }
          : state.selectedTrial

        return {
          trials,
          files: updatedFiles,
          selectedFile: updatedSelectedFile,
          selectedTrial: updatedSelectedTrial,
        }
      })
    } catch (error) {
      set({
        trialsError: error instanceof Error ? error.message : 'Failed to update trial status',
      })
      throw error
    }
  },
}))
