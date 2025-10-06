import { useMemo } from 'react'
import { useDraftStore } from '../store/draftStore'

function extractFileDisplayName(fileId: string): string {
  // 提取第二个斜线后的首个下划线前缀，默认回退至原始文件名
  const parts = fileId.split('/')
  const target = parts[2] ?? parts[parts.length - 1] ?? fileId
  const underscoreIndex = target.indexOf('_')
  if (underscoreIndex === -1) {
    return target
  }
  return target.slice(0, underscoreIndex)
}

interface DraftModalProps {
  open: boolean
  onClose: () => void
}

export default function DraftModal({ open, onClose }: DraftModalProps) {
  const drafts = useDraftStore((state) => state.drafts)
  const syncDraft = useDraftStore((state) => state.syncDraft)
  const removeDraft = useDraftStore((state) => state.removeDraft)
  const lastMessage = useDraftStore((state) => state.lastMessage)

  const entries = useMemo(() => Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt), [drafts])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">草稿箱</h2>
            <p className="text-sm text-gray-500">展示最近编辑且尚未同步的标注草稿</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            关闭
          </button>
        </div>

        {lastMessage && (
          <div className="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {lastMessage}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
            暂无草稿，开始标注后草稿会自动出现在此处。
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm text-gray-700">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2">文件</th>
                  <th className="px-3 py-2">Trial</th>
                  <th className="px-3 py-2">片段数</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">最近更新</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((draft) => {
                  const statusTag = {
                    dirty: '待同步',
                    syncing: '同步中',
                    synced: '已同步',
                    error: draft.error ?? '异常',
                  }[draft.status]
                  const statusColor = {
                    dirty: 'text-amber-600 bg-amber-50 border-amber-100',
                    syncing: 'text-blue-600 bg-blue-50 border-blue-100',
                    synced: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                    error: 'text-red-600 bg-red-50 border-red-100',
                  }[draft.status]

                  const fileDisplayName = extractFileDisplayName(draft.fileId)

                  return (
                    <tr key={draft.id} className="rounded-md border border-gray-200 bg-white shadow-sm">
                      <td className="px-3 py-2 font-medium text-gray-800" title={draft.fileId}>
                        {fileDisplayName}
                      </td>
                      <td className="px-3 py-2">{draft.trialIndex}</td>
                      <td className="px-3 py-2">{draft.segments.length}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
                          {statusTag}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {new Date(draft.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void syncDraft(draft.id)}
                            disabled={draft.status === 'syncing'}
                            className="rounded-md border border-blue-200 px-2 py-1 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            立即同步
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDraft(draft.id)}
                            className="rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                          >
                            删除草稿
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
