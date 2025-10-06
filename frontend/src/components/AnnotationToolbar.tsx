import { useMemo, useState } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { buildDraftId, useDraftStore } from '../store/draftStore'
import { useAuthStore } from '../store/authStore'
import DraftModal from './DraftModal'

export default function AnnotationToolbar() {
  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const {
    isAnnotating,
    setIsAnnotating,
    phases,
    currentPhaseIndex,
    annotationsError,
    resetCurrentFlow,
    versions,
    selectedVersionId,
    selectVersion,
    isOwner,
    annotations,
    currentFileId,
    currentTrialIndex,
    loadAnnotations,
    pendingBoundary,
  } = useAnnotationStore((state) => ({
    isAnnotating: state.isAnnotating,
    setIsAnnotating: state.setIsAnnotating,
    phases: state.phases,
    currentPhaseIndex: state.currentPhaseIndex,
    annotationsError: state.annotationsError,
    resetCurrentFlow: state.resetCurrentFlow,
    versions: state.versions,
    selectedVersionId: state.selectedVersionId,
    selectVersion: state.selectVersion,
    isOwner: state.isOwner,
    annotations: state.annotations,
    currentFileId: state.currentFileId,
    currentTrialIndex: state.currentTrialIndex,
    loadAnnotations: state.loadAnnotations,
    pendingBoundary: state.pendingBoundary,
  }))
  const draftCount = useDraftStore((state) => Object.keys(state.drafts).length)
  const updateDraftSegments = useDraftStore((state) => state.updateDraftSegments)
  const setDraftMessage = useDraftStore((state) => state.setMessage)
  const user = useAuthStore((state) => state.user)

  const currentPhase = useMemo(() => phases[currentPhaseIndex] ?? phases[0], [phases, currentPhaseIndex])
  const versionOptions = useMemo(
    () =>
      versions.map((version) => {
        const timeLabel = version.updatedAt
          ? new Date(version.updatedAt).toLocaleString()
          : '未知时间'
        const ownerLabel = version.username ?? '匿名用户'
        return {
          value: version.id,
          label: `${ownerLabel} · ${timeLabel} · ${version.segmentCount}段`,
        }
      }),
    [versions]
  )

  // 计算是否存在“我的版本”以及其ID
  const myVersionId = useMemo(() => {
    const uid = user?.id
    if (!uid) return null
    const mine = versions.find((v) => v.userId === uid || v.isOwner)
    return mine ? mine.id : null
  }, [versions, user])

  // 将当前显示的标注下载为本地草稿（用于开启可编辑态，并在稍后“同步”至云端）
  const handleDownloadToDraft = async () => {
    if (!user?.id || !currentFileId || currentTrialIndex === null) return
    const draftId = buildDraftId(currentFileId, currentTrialIndex, user.id)
    // 将当前内存中的标注写入草稿；由 loadAnnotations 检测到草稿后进入可编辑态
    updateDraftSegments(draftId, currentFileId, currentTrialIndex, annotations, user.id, user.username)
    setDraftMessage('已将当前版本下载为草稿，可在草稿箱中查看与同步')
    // 触发一次重载，使得 isOwner 根据草稿存在而变为可编辑
    await loadAnnotations(currentFileId, currentTrialIndex)
  }

  // 快速切换到“我的版本”（若当前选择的并非本人版本）
  const handleEditMyVersion = async () => {
    if (!myVersionId) return
    if (myVersionId !== selectedVersionId) {
      selectVersion(myVersionId)
    }
    // 切换后立即将其下载为本地草稿，便于直接编辑并覆盖云端本人版本
    await new Promise((r) => setTimeout(r, 0))
    void handleDownloadToDraft()
  }

  return (
    <div className="flex flex-col border-b border-gray-200 bg-gray-50">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAnnotating(!isAnnotating)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              isAnnotating
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
            disabled={isAnnotating && Boolean(pendingBoundary)}
            title={isAnnotating && pendingBoundary ? '当前有未完成的标注，不能关闭。请先完成或按 Esc 取消' : undefined}
          >
            {isAnnotating ? 'Mode:Open' : 'Mode:Close'}
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>版本：</span>
            <select
              value={selectedVersionId ?? ''}
              onChange={(event) => {
                const value = event.target.value
                selectVersion(value ? value : null)
              }}
              disabled={isAnnotating}
              title={isAnnotating ? '编辑中禁止切换版本，请先完成或取消当前标注' : undefined}
              className={`rounded-md border px-2 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none ${
                isAnnotating ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300'
              }`}
            >
              {versionOptions.length === 0 ? (
                <option value="" disabled>
                  暂无版本
                </option>
              ) : (
                versionOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))
              )}
            </select>
            {!isOwner && (
              <>
                <span className="rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                  只读
                </span>
                {/* <span className="ml-2 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  当前为他人版本：可下载到我的草稿箱或切换到我的版本（在草稿箱中操作）
                </span> */}
              </>
            )}
          </div>

          {/* 当存在旧数据（无版本但有标注）时给出引导提示 */}
          {versionOptions.length === 0 && annotations.length > 0 && (
            <div className="text-xs text-amber-600">
              检测到旧标注数据：可直接开始编辑，草稿将自动生成；随后在草稿箱中“立即同步”即可创建云端版本。
            </div>
          )}

          <button
            type="button"
            onClick={() => setDraftModalOpen(true)}
            className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:border-amber-300 hover:bg-amber-100"
          >
            📦 草稿箱
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-amber-600">
              {draftCount}
            </span>
          </button>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Seq：</span>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              {phases.map((phase, idx) => {
                const isActive = idx === currentPhaseIndex && isAnnotating
                return (
                  <div
                    key={phase.id}
                    className={`flex flex-shrink-0 items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
                    <span className="whitespace-nowrap">{phase.name}</span>
                    {phase.shortcut && (
                      <span
                        className={`rounded border px-1 py-0.5 text-[10px] font-semibold ${
                          isActive ? 'border-white/70 bg-white/20' : 'border-gray-300 bg-gray-100 text-gray-600'
                        }`}
                      >
                        {phase.shortcut}
                      </span>
                    )}
                  </div>
                )
              })}
              {phases.length === 0 && <span className="text-xs text-gray-400">尚未配置阶段</span>}
            </div>
          </div>

          {isAnnotating && (
            <button
              onClick={resetCurrentFlow}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              重置当前事件
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 text-xs text-gray-500">
        {isAnnotating ? (
          <>
            {currentPhase ? (
              <span>
                点击波形以结束
                <span className="font-semibold" style={{ color: currentPhase.color }}>
                  {` ${currentPhase.name} `}
                </span>
                阶段，并自动进入下一阶段。
              </span>
            ) : (
              <span>请先在配置事件序列中添加阶段顺序。</span>
            )}
          </>
        ) : (
          <span>开启标注模式后，按照阶段顺序依次点击波形即可生成区间遮罩。</span>
        )}
        {annotationsError && (
          <span className="ml-2 text-red-500">{annotationsError}</span>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-2 text-[11px] text-gray-500">
        数字键1-9可快速切换阶段，Tab / Shift+Tab 循环切换，空格键在标注时推进到下一阶段。
      </div>

      <DraftModal open={draftModalOpen} onClose={() => setDraftModalOpen(false)} />
    </div>
  )
}
