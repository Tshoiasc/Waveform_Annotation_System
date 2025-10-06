import { useEffect, useMemo, useRef, useState } from 'react'
import FileList from '../components/FileList'
import TrialList from '../components/TrialList'
import WaveformChart from '../components/WaveformChart'
import AnnotationToolbar from '../components/AnnotationToolbar'
import TemplateConfigModal from '../components/TemplateConfigModal'
import SettingsModal from '../components/SettingsModal'
import { PermissionGate } from '../components/PermissionGate'
import UserMenu from '../components/UserMenu'
import AnnotationGuard from '../components/AnnotationGuard'
import { useZoomHistory } from '../hooks/useZoomHistory'
import { useAnnotationSync } from '../hooks/useAnnotationSync'
import { useAnnotationShortcuts } from '../hooks/useAnnotationShortcuts'
import { usePhaseShortcuts } from '../hooks/usePhaseShortcuts'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useTemplateStore } from '../store/templateStore'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'

export default function WorkspacePage() {
  useZoomHistory()
  useAnnotationSync()
  useAnnotationShortcuts()
  usePhaseShortcuts()

  const workspaceRef = useRef<HTMLDivElement>(null)
  const [workspaceSize, setWorkspaceSize] = useState({ width: 800, height: 600 })
  const [configOpen, setConfigOpen] = useState(false)
  const { files } = useWorkspaceStore((state) => ({ files: state.files }))
  const { currentTemplateId, templates } = useTemplateStore((state) => ({
    currentTemplateId: state.currentTemplateId,
    templates: state.templates,
  }))
  const canAnnotate = useAuthStore((state) => state.hasPermission('annotations.annotate'))
  const { isSettingsOpen, closeSettings } = useSettingsStore((s) => ({
    isSettingsOpen: s.isSettingsOpen,
    closeSettings: s.closeSettings,
  }))

  const currentTemplateName = useMemo(() => {
    if (!currentTemplateId) return '未选择模板'
    const template = templates.find((item) => item._id === currentTemplateId)
    return template ? template.name : '未选择模板'
  }, [currentTemplateId, templates])

  const stats = useMemo(() => {
    const totalFiles = files.length
    const totalTrials = files.reduce((sum, file) => sum + (file.trialCount ?? 0), 0)
    const finishedFiles = files.filter((file) => file.isFinished).length
    const inProgressFiles = files.filter((file) => !file.isFinished && (file.hasStarted || (file.finishedTrials ?? 0) > 0)).length
    const finishedTrials = files.reduce((sum, file) => sum + (file.finishedTrials ?? 0), 0)

    return {
      totalFiles,
      totalTrials,
      finishedFiles,
      inProgressFiles,
      finishedTrials,
    }
  }, [files])

  const statChips = [
    {
      key: 'total-files',
      label: 'H5文件',
      value: stats.totalFiles,
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      key: 'total-trials',
      label: 'Trial数量',
      value: stats.totalTrials,
      className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    },
    {
      key: 'finished-files',
      label: '已完成H5',
      value: stats.finishedFiles,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    {
      key: 'in-progress-files',
      label: '进行中H5',
      value: stats.inProgressFiles,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    {
      key: 'finished-trials',
      label: '已完成Trial',
      value: stats.finishedTrials,
      className: 'border-teal-200 bg-teal-50 text-teal-700',
    },
  ]

  useEffect(() => {
    const updateSize = () => {
      if (workspaceRef.current) {
        const { width, height } = workspaceRef.current.getBoundingClientRect()
        setWorkspaceSize({ width, height })
      }
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    const node = workspaceRef.current
    if (node) {
      resizeObserver.observe(node)
    }

    return () => {
      if (node) {
        resizeObserver.unobserve(node)
      }
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">波形标注系统</h1>
            <p className="mt-1 text-sm text-gray-500">
              提示: 滚轮 缩放当前指针附近 | Ctrl/Cmd+滚轮 X轴缩放 | Shift+滚轮 Y轴缩放 | Ctrl+Z 撤销 | Ctrl+Shift+Z 重做
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {statChips.map((chip) => (
              <span
                key={chip.key}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium ${chip.className}`}
              >
                <span>{chip.label}</span>
                <span className="text-sm font-semibold">{chip.value}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              当前模板：<span className="font-medium text-gray-900">{currentTemplateName}</span>
            </div>
            <PermissionGate permission="templates.view">
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:border-blue-500 hover:text-blue-600"
              >
                ⚙️ 配置事件序列
              </button>
            </PermissionGate>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0">
          <FileList />
        </div>

        <div className="w-80 flex-shrink-0">
          <TrialList />
        </div>

        <div className="flex flex-1 flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <div className="text-sm font-semibold text-gray-700">波形查看器</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Phase 2: 标注功能</span>
            </div>
          </div>

          <AnnotationGuard>
            <AnnotationToolbar />
          </AnnotationGuard>

          <div ref={workspaceRef} className="min-h-0 flex-1 overflow-hidden p-4">
            <div className="relative h-full w-full">
              <WaveformChart
                width={Math.max(workspaceSize.width - 32, 0)}
                height={Math.max(workspaceSize.height - 32, 0)}
              />
              {!canAnnotate && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 text-sm font-medium text-gray-600">
                  标注功能已锁定，拥有权限后可进行编辑
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TemplateConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      <SettingsModal open={isSettingsOpen} onClose={closeSettings} />
    </div>
  )
}
