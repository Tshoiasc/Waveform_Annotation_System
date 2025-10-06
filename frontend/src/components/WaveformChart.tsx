import { useEffect, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useWaveformStore } from '../store/waveformStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { AnnotationEvent, AnnotationPhase, AnnotationSegment } from '../types/waveform'

interface WaveformChartProps {
  width: number
  height: number
}

interface BoundarySnapshot {
  time: number
  index: number
}

interface EventLabel {
  eventIndex: number
  left: number
  width: number
  top: number
}

interface CursorValues {
  raw: number | null
  filtered: number | null
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  eventIndex: number | null
}

// 调试开关：为缩放与坐标计算打印详细日志
const DEBUG_ZOOM = true

function applyAlpha(color: string | undefined, alpha: number) {
  if (!color) {
    return `rgba(59, 130, 246, ${alpha})`
  }

  if (color.startsWith('rgba')) {
    return color.replace(/rgba\(([^)]+)\)/, (_, values) => {
      const parts = values.split(',').map((part: string) => part.trim())
      if (parts.length < 4) {
        parts.push(alpha.toString())
      } else {
        parts[3] = alpha.toString()
      }
      return `rgba(${parts.join(', ')})`
    })
  }

  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
  }

  let hex = color.replace('#', '')
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('')
  }
  const num = parseInt(hex, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function resolveSegmentColor(segment: AnnotationSegment, phases: AnnotationPhase[]) {
  if (segment.color) return segment.color
  const phase = phases.find((item) => item.id === segment.phaseId)
  return phase?.color ?? '#3b82f6'
}

function computeEventLabels(u: uPlot, events: AnnotationEvent[]): EventLabel[] {
  const labels: EventLabel[] = []
  const bbox = u.bbox

  for (const event of events) {
    const startPos = u.valToPos(event.startTime, 'x', true)
    const endPos = u.valToPos(event.endTime, 'x', true)
    if (!Number.isFinite(startPos) || !Number.isFinite(endPos)) continue

    const rawLeft = bbox.left + Math.min(startPos, endPos)
    const rawRight = bbox.left + Math.max(startPos, endPos)
    const clampedLeft = Math.max(bbox.left, rawLeft)
    const clampedRight = Math.min(bbox.left + bbox.width, rawRight)
    const width = clampedRight - clampedLeft

    if (width < 24) continue

    labels.push({
      eventIndex: event.eventIndex,
      left: clampedLeft,
      width,
      top: bbox.top + 2,
    })
  }

  return labels
}

function areEventLabelsEqual(a: EventLabel[], b: EventLabel[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const la = a[i]
    const lb = b[i]
    if (
      la.eventIndex !== lb.eventIndex ||
      Math.abs(la.left - lb.left) > 0.5 ||
      Math.abs(la.width - lb.width) > 0.5 ||
      Math.abs(la.top - lb.top) > 0.5
    ) {
      return false
    }
  }
  return true
}

export default function WaveformChart({ width, height }: WaveformChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)

  const { waveform, currentZoom, setZoom, waveformLoading } = useWaveformStore()
  const { selectedFile, selectedTrial } = useWorkspaceStore()
  const {
    annotations,
    events,
    isAnnotating,
    handleBoundaryClick,
    isOwner,
    ensureEditableViaDraft,
    phases,
    pendingBoundary,
    currentPhaseIndex,
    deleteEvent,
  } = useAnnotationStore((state) => ({
    annotations: state.annotations,
    events: state.events,
    isAnnotating: state.isAnnotating,
    handleBoundaryClick: state.handleBoundaryClick,
    isOwner: state.isOwner,
    ensureEditableViaDraft: state.ensureEditableViaDraft,
    phases: state.phases,
    pendingBoundary: state.pendingBoundary,
    currentPhaseIndex: state.currentPhaseIndex,
    deleteEvent: state.deleteEvent,
  }))

  const [eventLabels, setEventLabels] = useState<EventLabel[]>([])
  const [cursorValues, setCursorValues] = useState<CursorValues>({ raw: null, filtered: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, eventIndex: null })

  const annotationsRef = useRef<AnnotationSegment[]>(annotations)
  const eventsRef = useRef<AnnotationEvent[]>(events)
  const isAnnotatingRef = useRef(isAnnotating)
  const handleBoundaryClickRef = useRef(handleBoundaryClick)
  const isOwnerRef = useRef(isOwner)
  const ensureEditableRef = useRef(ensureEditableViaDraft)
  const selectedFileRef = useRef(selectedFile)
  const selectedTrialRef = useRef(selectedTrial)
  const phasesRef = useRef(phases)
  const waveformRef = useRef(waveform)
  const pendingBoundaryRef = useRef<BoundarySnapshot | null>(pendingBoundary)
  const hoverBoundaryRef = useRef<BoundarySnapshot | null>(null)
  const currentPhaseIndexRef = useRef(currentPhaseIndex)
  const deleteEventRef = useRef(deleteEvent)
  const prevAnnotationCountRef = useRef(annotations.length)
  const isProgrammaticScaleRef = useRef(false)
  const lastWheelTsRef = useRef<number>(0)
  const lastWheelModeRef = useRef<'x' | 'y' | 'xy' | null>(null)

  const applyScale = (plot: uPlot, ranges: { x?: { min: number; max: number }; y?: { min: number; max: number } }) => {
    isProgrammaticScaleRef.current = true
    try {
      if (DEBUG_ZOOM) {
        // 打印将要生效的范围
        console.debug('[waveform][applyScale] incoming', {
          x: ranges.x,
          y: ranges.y,
        })
      }
      if (ranges.x) {
        plot.setScale('x', ranges.x)
      }
      if (ranges.y) {
        plot.setScale('y', ranges.y)
      }
    } finally {
      isProgrammaticScaleRef.current = false
    }
  }

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    isAnnotatingRef.current = isAnnotating
  }, [isAnnotating])

  useEffect(() => {
    handleBoundaryClickRef.current = handleBoundaryClick
  }, [handleBoundaryClick])

  useEffect(() => {
    isOwnerRef.current = isOwner
  }, [isOwner])

  useEffect(() => {
    ensureEditableRef.current = ensureEditableViaDraft
  }, [ensureEditableViaDraft])

  useEffect(() => {
    selectedFileRef.current = selectedFile
  }, [selectedFile])

  useEffect(() => {
    selectedTrialRef.current = selectedTrial
  }, [selectedTrial])

  useEffect(() => {
    phasesRef.current = phases
  }, [phases])

  useEffect(() => {
    waveformRef.current = waveform
  }, [waveform])

  useEffect(() => {
    deleteEventRef.current = deleteEvent
  }, [deleteEvent])

  useEffect(() => {
    pendingBoundaryRef.current = pendingBoundary
    if (!pendingBoundary) {
      hoverBoundaryRef.current = null
    }
    if (uplotRef.current) {
      uplotRef.current.redraw()
    }
  }, [pendingBoundary])

  useEffect(() => {
    currentPhaseIndexRef.current = currentPhaseIndex
  }, [currentPhaseIndex])

  useEffect(() => {
    const plot = uplotRef.current
    if (!plot || !plotRef.current) {
      if (eventLabels.length > 0) setEventLabels([])
      return
    }

    const labels = computeEventLabels(plot, eventsRef.current)
    setEventLabels((prev) => (areEventLabelsEqual(prev, labels) ? prev : labels))
  }, [annotations, events, currentZoom, width, height])

  useEffect(() => {
    const handleWindowPointerDown = (event: PointerEvent) => {
      if (!contextMenu.visible) return
      const container = containerRef.current
      if (!container) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }
      if (!container.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
      }
    }

    if (contextMenu.visible) {
      window.addEventListener('pointerdown', handleWindowPointerDown)
    }

    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown)
    }
  }, [contextMenu.visible])

  useEffect(() => {
    if (!contextMenu.visible || contextMenu.eventIndex === null) return
    const exists = eventsRef.current.some((event) => event.eventIndex === contextMenu.eventIndex)
    if (!exists) {
      setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
    }
  }, [contextMenu.visible, contextMenu.eventIndex, events])

  useEffect(() => {
    if (!plotRef.current || !waveform || !currentZoom) return

    const data: uPlot.AlignedData = [
      waveform.raw.timestamps,
      waveform.raw.values,
      waveform.filtered.values,
    ]

    const opts: uPlot.Options = {
      width,
      height,
      scales: {
        x: {
          time: false,
        },
        y: {},
      },
      axes: [
        {
          label: 'Time (s)',
          stroke: '#6b7280',
          grid: { stroke: '#e5e7eb', width: 1 },
        },
        {
          label: 'Amplitude',
          stroke: '#6b7280',
          grid: { stroke: '#e5e7eb', width: 1 },
        },
      ],
      series: [
        {},
        {
          label: 'AI 采集数据',
          stroke: 'rgba(159, 159, 159, 0.35)',
          width: 0.6,
          spanGaps: true,
        },
        {
          label: '20Hz 低通滤波',
          stroke: '#d62728',
          width: 1,
          spanGaps: true,
        },
      ],
      legend: {
        show: false,
      },
      cursor: {
        // 禁用拖拽缩放，避免标注点击时轻微拖动触发误缩放；保留滚轮缩放
        drag: {
          x: false,
          y: false,
        },
      },
      plugins: [
        {
          hooks: {
            draw: [
              (u) => {
                const ctx = u.ctx
                ctx.save()

                annotationsRef.current.forEach((segment) => {
                  const startX = u.valToPos(segment.startTime, 'x', true)
                  const endX = u.valToPos(segment.endTime, 'x', true)
                  const left = Math.min(startX, endX)
                  const widthPx = Math.max(1, Math.abs(endX - startX))
                  const color = resolveSegmentColor(segment, phasesRef.current)
                  const isDraft = segment.synced === false

                  ctx.fillStyle = applyAlpha(color, isDraft ? 0.14 : 0.22)
                  ctx.fillRect(left, u.bbox.top, widthPx, u.bbox.height)

                  ctx.strokeStyle = applyAlpha(color, isDraft ? 0.7 : 0.5)
                  ctx.lineWidth = isDraft ? 2 : 1
                  if (isDraft) {
                    ctx.setLineDash([6, 4])
                  }
                  ctx.beginPath()
                  ctx.moveTo(left, u.bbox.top)
                  ctx.lineTo(left, u.bbox.top + u.bbox.height)
                  ctx.moveTo(left + widthPx, u.bbox.top)
                  ctx.lineTo(left + widthPx, u.bbox.top + u.bbox.height)
                  ctx.stroke()
                  if (isDraft) {
                    ctx.setLineDash([])
                  }
                })

                eventsRef.current.forEach((event) => {
                  const startX = u.valToPos(event.startTime, 'x', true)
                  const endX = u.valToPos(event.endTime, 'x', true)
                  if (!Number.isFinite(startX) || !Number.isFinite(endX)) return

                  const left = Math.min(startX, endX)
                  const right = Math.max(startX, endX)
                  const bracketY = u.bbox.top + 6

                  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(left, bracketY)
                  ctx.lineTo(right, bracketY)
                  ctx.moveTo(left, bracketY)
                  ctx.lineTo(left, bracketY + 12)
                  ctx.moveTo(right, bracketY)
                  ctx.lineTo(right, bracketY + 12)
                  ctx.stroke()

                  if (right - left > 40) {
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
                    ctx.font = 'bold 15px "Segoe UI", sans-serif'
                    ctx.textAlign = 'center'
                    ctx.fillText(`事件 ${event.eventIndex + 1}`, (left + right) / 2, bracketY - 8)
                  }
                })

                ctx.restore()

                const pending = pendingBoundaryRef.current
                const hover = hoverBoundaryRef.current
                const isAnnotatingNow = isAnnotatingRef.current

                if (isAnnotatingNow && pending) {
                  const pendingX = u.valToPos(pending.time, 'x', true)
                  if (Number.isFinite(pendingX)) {
                    ctx.save()
                    ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)'
                    ctx.setLineDash([6, 6])
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(pendingX, u.bbox.top)
                    ctx.lineTo(pendingX, u.bbox.top + u.bbox.height)
                    ctx.stroke()
                    ctx.restore()
                  }
                }

                // 调试：在图左上角绘制当前 x/y 缩放范围
                if (DEBUG_ZOOM) {
                  const xs = u.scales.x
                  const ys = u.scales.y
                  ctx.save()
                  ctx.fillStyle = 'rgba(0,0,0,0.6)'
                  ctx.font = '12px sans-serif'
                  ctx.textAlign = 'left'
                  ctx.textBaseline = 'top'
                  const pad = 6
                  const text1 = `x:[${(xs?.min ?? NaN).toFixed(3)}, ${(xs?.max ?? NaN).toFixed(3)}]`
                  const text2 = `y:[${(ys?.min ?? NaN).toFixed(3)}, ${(ys?.max ?? NaN).toFixed(3)}]`
                  ctx.fillText(text1, u.bbox.left + pad, u.bbox.top + pad)
                  ctx.fillText(text2, u.bbox.left + pad, u.bbox.top + pad + 14)
                  ctx.restore()
                }

                if (isAnnotatingNow && pending && hover && hover.time > pending.time) {
                  const startX = u.valToPos(pending.time, 'x', true)
                  const endX = u.valToPos(hover.time, 'x', true)
                  if (Number.isFinite(startX) && Number.isFinite(endX)) {
                    const left = Math.min(startX, endX)
                    const widthPx = Math.max(1, Math.abs(endX - startX))
                    const phase = phasesRef.current[currentPhaseIndexRef.current]
                    const color = phase?.color ?? '#3b82f6'

                    ctx.save()
                    ctx.fillStyle = applyAlpha(color, 0.16)
                    ctx.fillRect(left, u.bbox.top, widthPx, u.bbox.height)

                    ctx.strokeStyle = applyAlpha(color, 0.5)
                    ctx.lineWidth = 1
                    ctx.strokeRect(left, u.bbox.top, widthPx, u.bbox.height)
                    ctx.restore()
                  }
                }
              },
            ],
            setCursor: [
              (u) => {
                const idx = u.cursor.idx
                if (idx == null || idx < 0) {
                  setCursorValues({ raw: null, filtered: null })
                  return
                }
                const rawSeries = u.data[1] as number[] | undefined
                const filteredSeries = u.data[2] as number[] | undefined
                const raw = rawSeries && idx < rawSeries.length ? rawSeries[idx] : null
                const filtered = filteredSeries && idx < filteredSeries.length ? filteredSeries[idx] : null
                setCursorValues({ raw, filtered })
              },
            ],
            setScale: [
              (u, key) => {
                if (isProgrammaticScaleRef.current) return
                // 避免在滚轮缩放后，uPlot 内部的 setScale 通知回流覆盖我们在滚轮中计算的范围
                // 这里对极近的回调进行忽略（同时不影响拖拽缩放）
                const now = Date.now()
                if (now - lastWheelTsRef.current < 80) {
                  if (DEBUG_ZOOM) {
                    console.debug('[waveform][hook setScale] ignored due to recent wheel', {
                      key,
                      lastWheelMode: lastWheelModeRef.current,
                      elapsed: now - lastWheelTsRef.current,
                    })
                  }
                  return
                }
                if (key !== 'x' && key !== 'y') return

                const xScale = u.scales.x
                const yScale = u.scales.y
                if (!xScale || !yScale) return

                const { min: xMin, max: xMax } = xScale
                const { min: yMin, max: yMax } = yScale

                if (DEBUG_ZOOM) {
                  console.debug('[waveform][hook setScale] user change', {
                    key,
                    xMin,
                    xMax,
                    yMin,
                    yMax,
                  })
                }

                if (
                  xMin == null || xMax == null || yMin == null || yMax == null ||
                  !Number.isFinite(xMin) || !Number.isFinite(xMax) ||
                  !Number.isFinite(yMin) || !Number.isFinite(yMax)
                ) {
                  return
                }

                const waveformStore = useWaveformStore.getState()
                const currentZoomState = waveformStore.currentZoom
                const nextZoom = {
                  xMin,
                  xMax,
                  yMin,
                  yMax,
                  timestamp: Date.now(),
                }

                if (
                  currentZoomState &&
                  Math.abs(currentZoomState.xMin - nextZoom.xMin) < 1e-9 &&
                  Math.abs(currentZoomState.xMax - nextZoom.xMax) < 1e-9 &&
                  Math.abs(currentZoomState.yMin - nextZoom.yMin) < 1e-9 &&
                  Math.abs(currentZoomState.yMax - nextZoom.yMax) < 1e-9
                ) {
                  return
                }

                waveformStore.setZoom(nextZoom)
              },
            ],
          },
        },
      ],
    }

    const plot = new uPlot(opts, data, plotRef.current)
    const legendEl = plot.root.querySelector('.u-legend') as HTMLElement | null
    if (legendEl) {
      plot.root.style.position = 'relative'
      legendEl.style.position = 'absolute'
      legendEl.style.top = '12px'
      legendEl.style.right = '12px'
      legendEl.style.background = 'rgba(255, 255, 255, 0.9)'
      legendEl.style.padding = '4px 8px'
      legendEl.style.borderRadius = '4px'
      legendEl.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.08)'
      legendEl.style.pointerEvents = 'none'
    }
    uplotRef.current = plot

    // 初始化后用编程方式设置初始缩放，避免 options.range 与后续 setScale 互相覆盖
    applyScale(plot, {
      x: { min: currentZoom.xMin, max: currentZoom.xMax },
      y: { min: currentZoom.yMin, max: currentZoom.yMax },
    })

    setEventLabels((prev) => {
      const labels = computeEventLabels(plot, eventsRef.current)
      return areEventLabelsEqual(prev, labels) ? prev : labels
    })

    const handlePlotClick = async (event: MouseEvent) => {
      if (event.button !== 0) return
      console.debug('[waveform] plot click', { button: event.button })
      if (!isAnnotatingRef.current) {
        console.debug('[waveform] click ignored: annotate mode disabled')
        return
      }

      const currentWaveform = waveformRef.current
      const currentFile = selectedFileRef.current
      const currentTrial = selectedTrialRef.current
      if (!currentWaveform || !currentFile || !currentTrial) return

      const overRect = plot.over.getBoundingClientRect()
      const xWithin = event.clientX - overRect.left
      const yWithin = event.clientY - overRect.top

      if (xWithin < 0 || xWithin > overRect.width || yWithin < 0 || yWithin > overRect.height) {
        console.debug('[waveform] click ignored: outside plot area', { xWithin, yWithin })
        return
      }

      const idx = Math.round(plot.posToIdx(xWithin))
      const timestamps = currentWaveform.raw.timestamps
      const clampedIdx = Math.max(0, Math.min(timestamps.length - 1, idx))
      const timestamp = timestamps[clampedIdx]
      console.debug('[waveform] submit boundary click', {
        idx,
        clampedIdx,
        timestamp,
        timeAtPointer: plot.posToVal(xWithin, 'x'),
      })

      // 只读场景：弹出确认，选择“是”则将当前版本下载为草稿并继续本次点击
      if (!isOwnerRef.current) {
        const ok = window.confirm('当前为他人版本，是否下载到我的草稿箱并进行编辑？')
        if (!ok) return
        try {
          await ensureEditableRef.current()
        } catch (e) {
          console.error('ensureEditableViaDraft failed', e)
          return
        }
      }

      void handleBoundaryClickRef.current({
        fileId: currentFile.fileId,
        trialIndex: currentTrial.trialIndex,
        time: timestamp,
        index: clampedIdx,
      })
    }

    const handleMouseMove = (event: MouseEvent) => {
      const currentWaveform = waveformRef.current
      if (!currentWaveform) return

      const overRect = plot.over.getBoundingClientRect()
      const xWithin = event.clientX - overRect.left
      const yWithin = event.clientY - overRect.top

      if (xWithin < 0 || xWithin > overRect.width || yWithin < 0 || yWithin > overRect.height) {
        if (hoverBoundaryRef.current) {
          hoverBoundaryRef.current = null
          plot.redraw()
        }
        if (plot.over.style.cursor !== 'default') {
          plot.over.style.cursor = 'default'
        }
        return
      }

      const idx = Math.round(plot.posToIdx(xWithin))
      const timestamps = currentWaveform.raw.timestamps
      const clampedIdx = Math.max(0, Math.min(timestamps.length - 1, idx))
      const timestamp = timestamps[clampedIdx]

      if (pendingBoundaryRef.current && isAnnotatingRef.current) {
        const previous = hoverBoundaryRef.current
        const next = { time: timestamp, index: clampedIdx }
        const changed = !previous || previous.index !== next.index
        hoverBoundaryRef.current = next
        if (changed) {
          plot.redraw()
        }
        plot.over.style.cursor = 'crosshair'
      } else {
        hoverBoundaryRef.current = null
        plot.over.style.cursor = isAnnotatingRef.current ? 'crosshair' : 'default'
      }
    }

    const handleMouseLeave = () => {
      if (hoverBoundaryRef.current) {
        hoverBoundaryRef.current = null
        plot.redraw()
      }
      plot.over.style.cursor = 'default'
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()

      const plotInstance = uplotRef.current
      if (!plotInstance || !containerRef.current) return

      const overRect = plotInstance.over.getBoundingClientRect()
      const xWithin = event.clientX - overRect.left
      const yWithin = event.clientY - overRect.top

      if (xWithin < 0 || xWithin > overRect.width || yWithin < 0 || yWithin > overRect.height) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }

      const timeAtPointer = plotInstance.posToVal(xWithin, 'x')
      if (!Number.isFinite(timeAtPointer)) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }

      // 更稳健的事件命中逻辑：
      // 1) 优先命中时间区间内的事件；
      // 2) 若区间极窄（像素级），允许在边缘±阈值像素内命中最近的事件。
      const xScale = plotInstance.scales.x
      const pxPerUnit = xScale && plotInstance.bbox.width > 0
        ? plotInstance.bbox.width / Math.max(1e-12, (xScale.max! - xScale.min!))
        : 1
      const pxTolerance = 6 // 允许距离边缘 6px 内选中
      let target: AnnotationEvent | undefined
      let bestPxDist = Number.POSITIVE_INFINITY
      for (const evt of eventsRef.current) {
        const a = Math.min(evt.startTime, evt.endTime)
        const b = Math.max(evt.startTime, evt.endTime)
        if (timeAtPointer >= a && timeAtPointer <= b) {
          target = evt
          bestPxDist = 0
          break
        }
        // 计算指针时间距离事件区间边缘的像素距离
        const tDist = timeAtPointer < a ? a - timeAtPointer : timeAtPointer - b
        const pxDist = tDist * pxPerUnit
        if (pxDist < bestPxDist) {
          bestPxDist = pxDist
          target = evt
        }
      }

      if (!target || bestPxDist > pxTolerance) {
        setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
        return
      }

      const group = uplotRef.current?.root.closest('[data-event-menu-root]') as HTMLElement | null
      const containerRect = (group ?? containerRef.current).getBoundingClientRect()
      const menuWidth = 160
      const menuHeight = 64
      let menuX = event.clientX - containerRect.left
      let menuY = event.clientY - containerRect.top

      menuX = Math.min(Math.max(0, menuX), containerRect.width - menuWidth)
      menuY = Math.min(Math.max(0, menuY), containerRect.height - menuHeight)

      setContextMenu({ visible: true, x: menuX, y: menuY, eventIndex: target.eventIndex })
    }

    plot.over.addEventListener('click', handlePlotClick)
    plot.over.addEventListener('mousemove', handleMouseMove)
    plot.over.addEventListener('mouseleave', handleMouseLeave)
    plot.over.addEventListener('contextmenu', handleContextMenu)

    return () => {
      plot.over.removeEventListener('click', handlePlotClick)
      plot.over.removeEventListener('mousemove', handleMouseMove)
      plot.over.removeEventListener('mouseleave', handleMouseLeave)
      plot.over.removeEventListener('contextmenu', handleContextMenu)
      plot.destroy()
      uplotRef.current = null
    }
  }, [waveform, width, height])

  useEffect(() => {
    const plot = uplotRef.current
    if (!plot || !currentZoom) return

    applyScale(plot, {
      x: { min: currentZoom.xMin, max: currentZoom.xMax },
      y: { min: currentZoom.yMin, max: currentZoom.yMax },
    })
    if (DEBUG_ZOOM) {
      console.debug('[waveform][effect currentZoom->applyScale]', currentZoom)
    }
    const labels = computeEventLabels(plot, eventsRef.current)
    setEventLabels((prev) => (areEventLabelsEqual(prev, labels) ? prev : labels))
  }, [currentZoom, annotations, events])

  useEffect(() => {
    if (!currentZoom || !isAnnotatingRef.current) return

    const prevCount = prevAnnotationCountRef.current
    const currentCount = annotations.length
    prevAnnotationCountRef.current = currentCount

    if (currentCount === 0 || currentCount <= prevCount) return

    const latestSegment = annotations[annotations.length - 1]
    if (!latestSegment) return

    const widthRange = currentZoom.xMax - currentZoom.xMin
    if (widthRange <= 0) return

    // 自动向后平移：将触发阈值从 25% 提高到 35%，让平移更早触发
    const margin = widthRange * 0.35
    if (latestSegment.endTime <= currentZoom.xMax - margin) return

    const waveformData = waveformRef.current
    if (!waveformData) return

    const dataMin = waveformData.raw.timestamps[0]
    const dataMax = waveformData.raw.timestamps[waveformData.raw.timestamps.length - 1]

    // 将右侧留白从 15% 提高到 35%，平移幅度更大、减少频繁手动移动
    const desiredMax = Math.min(latestSegment.endTime + widthRange * 0.35, dataMax)
    let desiredMin = Math.max(desiredMax - widthRange, dataMin)
    let desiredXMax = desiredMin + widthRange

    if (desiredXMax > dataMax) {
      desiredXMax = dataMax
      desiredMin = Math.max(desiredXMax - widthRange, dataMin)
    }

    setZoom({
      xMin: desiredMin,
      xMax: desiredXMax,
      yMin: currentZoom.yMin,
      yMax: currentZoom.yMax,
      timestamp: Date.now(),
    })
  }, [annotations, currentZoom, setZoom])

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const plot = uplotRef.current
      const currentZoomState = useWaveformStore.getState().currentZoom
      if (!plot || !currentZoomState) return

      const { deltaY, deltaX, shiftKey, metaKey, ctrlKey } = e
      const zoomMode: 'x' | 'y' | 'xy' = metaKey || ctrlKey ? 'x' : shiftKey ? 'y' : 'xy'
      lastWheelTsRef.current = Date.now()
      lastWheelModeRef.current = zoomMode

      let axisDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX
      if (axisDelta === 0 && deltaX !== 0) {
        axisDelta = deltaX
      }

      if (axisDelta === 0) return

      const overRect = plot.over.getBoundingClientRect()
      const xWithinOver = e.clientX - overRect.left
      const yWithinOver = e.clientY - overRect.top
      // 使用 overlay 内相对坐标（overlay 本身就覆盖绘图区，原点即绘图区左上角）
      const xInPlot = Math.max(0, Math.min(xWithinOver, plot.bbox.width))
      const yInPlot = Math.max(0, Math.min(yWithinOver, plot.bbox.height))

      const xValue = plot.posToVal(xInPlot, 'x')
      const yValue = plot.posToVal(yInPlot, 'y')

      const zoomFactor = axisDelta > 0 ? 1.1 : 0.9
      const xRange = currentZoomState.xMax - currentZoomState.xMin
      const yRange = currentZoomState.yMax - currentZoomState.yMin

      let newXMin = currentZoomState.xMin
      let newXMax = currentZoomState.xMax
      let newYMin = currentZoomState.yMin
      let newYMax = currentZoomState.yMax

      const xPivot = Number.isFinite(xValue) ? (xValue as number) : (currentZoomState.xMin + currentZoomState.xMax) / 2
      const yPivot = Number.isFinite(yValue) ? (yValue as number) : (currentZoomState.yMin + currentZoomState.yMax) / 2

      if (DEBUG_ZOOM) {
        console.debug('[waveform][wheel] start', {
          metaKey,
          ctrlKey,
          shiftKey,
          zoomMode,
          deltaX,
          deltaY,
          axisDelta,
          zoomFactor,
          overRect: { left: overRect.left, top: overRect.top, width: overRect.width, height: overRect.height },
          bbox: plot.bbox,
          client: { x: e.clientX, y: e.clientY },
          xWithinOver,
          yWithinOver,
          xInPlot,
          yInPlot,
          xValue,
          yValue,
          currentZoomState,
        })
      }

      if ((zoomMode === 'x' || zoomMode === 'xy') && xRange > 0) {
        const leftSpan = xPivot - currentZoomState.xMin
        const rightSpan = currentZoomState.xMax - xPivot
        const newLeftSpan = leftSpan * zoomFactor
        const newRightSpan = rightSpan * zoomFactor
        newXMin = xPivot - newLeftSpan
        newXMax = xPivot + newRightSpan
      }

      if ((zoomMode === 'y' || zoomMode === 'xy') && yRange > 0) {
        const lowerSpan = yPivot - currentZoomState.yMin
        const upperSpan = currentZoomState.yMax - yPivot
        const newLowerSpan = lowerSpan * zoomFactor
        const newUpperSpan = upperSpan * zoomFactor
        newYMin = yPivot - newLowerSpan
        newYMax = yPivot + newUpperSpan
      }

      const waveformData = waveformRef.current
      if ((zoomMode === 'x' || zoomMode === 'xy') && waveformData) {
        const dataMin = waveformData.raw.timestamps[0]
        const dataMax = waveformData.raw.timestamps[waveformData.raw.timestamps.length - 1]
        const nextRange = newXMax - newXMin
        if (nextRange > 0 && Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
          if (newXMin < dataMin) {
            const diff = dataMin - newXMin
            newXMin = dataMin
            newXMax += diff
          }
          if (newXMax > dataMax) {
            const diff = newXMax - dataMax
            newXMax = dataMax
            newXMin -= diff
          }
          if (newXMin < dataMin) newXMin = dataMin
          if (newXMax > dataMax) newXMax = dataMax
        }
      }

      if (newXMax - newXMin < 1e-9) {
        const center = (newXMax + newXMin) / 2
        newXMin = center - 1e-9
        newXMax = center + 1e-9
      }
      if (newYMax - newYMin < 1e-9) {
        const center = (newYMax + newYMin) / 2
        newYMin = center - 1e-9
        newYMax = center + 1e-9
      }

      applyScale(plot, {
        x: { min: newXMin, max: newXMax },
        y: { min: newYMin, max: newYMax },
      })

      if (DEBUG_ZOOM) {
        const xs = plot.scales.x
        const ys = plot.scales.y
        console.debug('[waveform][wheel] apply', {
          newXMin,
          newXMax,
          newYMin,
          newYMax,
          uplotScalesAfter: {
            xMin: xs?.min,
            xMax: xs?.max,
            yMin: ys?.min,
            yMax: ys?.max,
          },
        })
      }

      setZoom({
        xMin: newXMin,
        xMax: newXMax,
        yMin: newYMin,
        yMax: newYMax,
        timestamp: Date.now(),
      })
    }

    const overEl = uplotRef.current?.over ?? null
    if (overEl) {
      overEl.addEventListener('wheel', handleWheel, { passive: false })
      if (DEBUG_ZOOM) {
        const r = overEl.getBoundingClientRect()
        console.debug('[waveform][wheel] listener attached', {
          overRect: { left: r.left, top: r.top, width: r.width, height: r.height },
        })
      }
    }

    return () => {
      const overCleanup = uplotRef.current?.over ?? overEl
      if (overCleanup) {
        overCleanup.removeEventListener('wheel', handleWheel)
        if (DEBUG_ZOOM) console.debug('[waveform][wheel] listener removed')
      }
    }
  }, [setZoom, waveform, width, height])

  return (
    <div ref={containerRef} data-event-menu-root className="relative w-full h-full">
      {waveformLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="text-sm text-gray-500">加载波形数据中...</div>
        </div>
      )}

      {!waveform && !waveformLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          请选择Trial查看波形
        </div>
      )}

      <div ref={plotRef} className="w-full h-full" />

      <div className="absolute bottom-3 right-3 rounded bg-white/90 px-3 py-2 text-xs text-slate-600 shadow border border-slate-200 min-w-[140px]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />Filtered
          </span>
          <span>{cursorValues.filtered !== null ? cursorValues.filtered.toFixed(3) : '--'}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />Raw
          </span>
          <span>{cursorValues.raw !== null ? cursorValues.raw.toFixed(3) : '--'}</span>
        </div>
      </div>

      {contextMenu.visible && contextMenu.eventIndex !== null && (
        <div
          className="absolute z-20 rounded border border-slate-200 bg-white py-1 text-xs text-slate-700 shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="px-4 py-1 hover:bg-red-50 w-full text-left"
            onClick={(event) => {
              event.stopPropagation()
              if (contextMenu.eventIndex !== null) {
                deleteEventRef.current(contextMenu.eventIndex)
              }
              setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
            }}
          >
            删除事件
          </button>
          <button
            type="button"
            className="px-4 py-1 hover:bg-slate-100 w-full text-left"
            onClick={(event) => {
              event.stopPropagation()
              setContextMenu({ visible: false, x: 0, y: 0, eventIndex: null })
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
