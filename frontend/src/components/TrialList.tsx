import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useWaveformStore } from '../store/waveformStore'
import type { TrialMetadata } from '../types/waveform'

interface ThumbnailProps {
  metadata: TrialMetadata
  width: number
  height: number
}

// Canvas缩略图组件
function Thumbnail({ metadata, width, height }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const timestamps = metadata.thumbnail.timestamps ?? []
    const rawSeries = metadata.thumbnail.raw ?? metadata.thumbnail.values ?? []
    const filteredSeries = metadata.thumbnail.filtered ?? rawSeries

    // 清空画布
    ctx.clearRect(0, 0, width, height)

    if (timestamps.length === 0 || rawSeries.length === 0) {
      return
    }

    const pointCount = Math.min(timestamps.length, rawSeries.length, filteredSeries.length)
    const effectiveTimestamps = timestamps.slice(0, pointCount)
    const rawValues = rawSeries.slice(0, pointCount)
    const filteredValues = filteredSeries.slice(0, pointCount)

    // 数据范围
    const xMin = Math.min(...effectiveTimestamps)
    const xMax = Math.max(...effectiveTimestamps)
    const combinedValues = [...rawValues, ...filteredValues]
    const yMin = Math.min(...combinedValues)
    const yMax = Math.max(...combinedValues)

    const safeXRange = xMax - xMin || 1
    const safeYRange = yMax - yMin || 1

    // 坐标转换
    const toX = (t: number) => ((t - xMin) / safeXRange) * width
    const toY = (v: number) => height - ((v - yMin) / safeYRange) * height

    const drawSeries = (series: number[], color: string, lineWidth: number) => {
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.beginPath()

      effectiveTimestamps.forEach((t, i) => {
        const x = toX(t)
        const y = toY(series[i])

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()
    }

    drawSeries(rawValues, 'rgba(159, 159, 159, 0.8)', 0.6)
    drawSeries(filteredValues, '#d62728', 1.2)
  }, [metadata, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
    />
  )
}

export default function TrialList() {
  const {
    trials,
    trialsLoading,
    trialsError,
    selectedFile,
    selectedTrial,
    selectTrial,
    updateTrialFinished,
  } = useWorkspaceStore((state) => ({
    trials: state.trials,
    trialsLoading: state.trialsLoading,
    trialsError: state.trialsError,
    selectedFile: state.selectedFile,
    selectedTrial: state.selectedTrial,
    selectTrial: state.selectTrial,
    updateTrialFinished: state.updateTrialFinished,
  }))

  const loadWaveform = useWaveformStore((state) => state.loadWaveform)

  // 处理Trial选择
  const handleTrialClick = (trial: TrialMetadata) => {
    selectTrial(trial)

    // 加载完整波形数据
    if (selectedFile) {
      loadWaveform(selectedFile.fileId, trial.trialIndex)
    }
  }

  const fileStatus = useMemo(() => {
    if (!selectedFile) return null
    if (selectedFile.isFinished) {
      return {
        label: '已完成',
        className: 'border-green-200 bg-green-100 text-green-700'
      }
    }
    if (selectedFile.hasStarted) {
      return {
        label: '进行中',
        className: 'border-amber-200 bg-amber-100 text-amber-700'
      }
    }
    return {
      label: '未开始',
      className: 'border-gray-200 bg-gray-100 text-gray-600'
    }
  }, [selectedFile])

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`
    return `${seconds.toFixed(2)} s`
  }

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-700">Trial列表</h2>
            {selectedFile && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="truncate max-w-[200px]" title={selectedFile.fileName}>
                  {selectedFile.fileName}
                </span>
                {fileStatus && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${fileStatus.className}`}
                  >
                    {fileStatus.label}
                  </span>
                )}
                <span className="text-gray-400">
                  已完成 {selectedFile.finishedTrials ?? 0}/{selectedFile.trialCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 未选择文件 */}
      {!selectedFile && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          请先选择文件
        </div>
      )}

      {/* 加载状态 */}
      {selectedFile && trialsLoading && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          加载中...
        </div>
      )}

      {/* 错误状态 */}
      {selectedFile && trialsError && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">加载失败</p>
            <p className="text-xs text-gray-500">{trialsError}</p>
          </div>
        </div>
      )}

      {/* Trial列表 */}
      {selectedFile && !trialsLoading && !trialsError && (
        <div className="flex-1 overflow-y-auto">
          {trials.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              暂无Trial
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {trials.map((trial) => {
                const isFinished = Boolean(trial.finished)
                const annotationCount = trial.annotationCount ?? 0
                let statusLabel = '未开始'
                let badgeClass = 'border-gray-200 bg-gray-100 text-gray-600'
                if (isFinished) {
                  statusLabel = '已完成'
                  badgeClass = 'border-green-200 bg-green-100 text-green-700'
                } else if (annotationCount > 0) {
                  statusLabel = '进行中'
                  badgeClass = 'border-amber-200 bg-amber-50 text-amber-700'
                }

                const handleToggleClick = async (event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation()
                  if (!selectedFile) return
                  try {
                    await updateTrialFinished(selectedFile.fileId, trial.trialIndex, !isFinished)
                  } catch (error) {
                    console.error('更新Trial状态失败', error)
                  }
                }

                return (
                  <li
                    key={trial.trialIndex}
                    onClick={() => handleTrialClick(trial)}
                    className={`
                      px-4 py-3 cursor-pointer transition-colors
                      hover:bg-gray-50
                      ${
                        selectedTrial?.trialIndex === trial.trialIndex
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : ''
                      }
                    `}
                  >
                    {/* Trial信息 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          Trial {trial.trialIndex}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {formatDuration(trial.duration)}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleClick}
                          className={`rounded px-2 py-1 text-[11px] font-medium transition border ${
                            isFinished
                              ? 'border-gray-300 text-gray-500 hover:bg-gray-100'
                              : 'border-blue-500 text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          {isFinished ? '标记未完成' : '标记完成'}
                        </button>
                      </div>
                    </div>

                    {/* 缩略图 */}
                    <div className="bg-gray-50 rounded border border-gray-200 p-2">
                      <Thumbnail metadata={trial} width={200} height={60} />
                    </div>

                    {/* 元数据 */}
                    <div className="mt-2 text-xs text-gray-500">
                      {trial.sampleRate.toFixed(0)} Hz · {trial.dataPoints} points
                      {annotationCount > 0 && (
                        <span className="ml-2 text-amber-600">
                          标注 {annotationCount}
                        </span>
                      )}
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
