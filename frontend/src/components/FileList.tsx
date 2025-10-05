import { useEffect } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useWaveformStore } from '../store/waveformStore'
import type { FileInfo } from '../types/waveform'

export default function FileList() {
  const files = useWorkspaceStore((state) => state.files)
  const filesLoading = useWorkspaceStore((state) => state.filesLoading)
  const filesError = useWorkspaceStore((state) => state.filesError)
  const selectedFile = useWorkspaceStore((state) => state.selectedFile)
  const loadFiles = useWorkspaceStore((state) => state.loadFiles)
  const selectFile = useWorkspaceStore((state) => state.selectFile)

  const clearWaveform = useWaveformStore((state) => state.clearWaveform)

  // 组件挂载时加载文件列表
  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  // 处理文件选择
  const handleFileClick = (file: FileInfo) => {
    selectFile(file)
    clearWaveform() // 清除之前的波形数据
  }

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusInfo = (file: FileInfo) => {
    if (file.isFinished) {
      return {
        label: '已完成',
        className: 'border-green-200 bg-green-100 text-green-700'
      }
    }
    if (file.hasStarted) {
      return {
        label: '进行中',
        className: 'border-amber-200 bg-amber-100 text-amber-700'
      }
    }
    return {
      label: '未开始',
      className: 'border-gray-200 bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">文件列表</h2>
        <button
          onClick={loadFiles}
          disabled={filesLoading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          刷新
        </button>
      </div>

      {/* 加载状态 */}
      {filesLoading && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          加载中...
        </div>
      )}

      {/* 错误状态 */}
      {filesError && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">加载失败</p>
            <p className="text-xs text-gray-500">{filesError}</p>
          </div>
        </div>
      )}

      {/* 文件列表 */}
      {!filesLoading && !filesError && (
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              暂无文件
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {files.map((file) => {
                const status = getStatusInfo(file)
                const finished = file.finishedTrials ?? 0
                const total = file.trialCount ?? file.metadataTrials ?? 0

                return (
                  <li
                    key={file.fileId}
                    onClick={() => handleFileClick(file)}
                    className={`
                      px-4 py-3 cursor-pointer transition-colors
                      hover:bg-gray-50
                      ${
                        selectedFile?.fileId === file.fileId
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : ''
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatSize(file.size)} · {file.trialCount} trials
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            已完成 {finished}/{total}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
