import { useState, useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// 设置弹窗：用于设置波形初始默认缩放倍率（X/Y）
export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    defaultZoomX,
    defaultZoomY,
    setDefaultZoomXY,
    autoPanEnabled,
    autoPanTriggerThreshold,
    autoPanRightPadding,
    setAutoPanEnabled,
    setAutoPanTriggerThreshold,
    setAutoPanRightPadding,
  } = useSettingsStore((s) => ({
    defaultZoomX: s.defaultZoomX,
    defaultZoomY: s.defaultZoomY,
    setDefaultZoomXY: s.setDefaultZoomXY,
    autoPanEnabled: s.autoPanEnabled,
    autoPanTriggerThreshold: s.autoPanTriggerThreshold,
    autoPanRightPadding: s.autoPanRightPadding,
    setAutoPanEnabled: s.setAutoPanEnabled,
    setAutoPanTriggerThreshold: s.setAutoPanTriggerThreshold,
    setAutoPanRightPadding: s.setAutoPanRightPadding,
  }))

  const [x, setX] = useState<number>(defaultZoomX)
  const [y, setY] = useState<number>(defaultZoomY)
  // 自动平移设置（使用百分比输入，内部转换为 0~1）
  const [autoPanOn, setAutoPanOn] = useState<boolean>(autoPanEnabled)
  const [triggerPct, setTriggerPct] = useState<number>(Math.round(autoPanTriggerThreshold * 100))
  const [rightPadPct, setRightPadPct] = useState<number>(Math.round(autoPanRightPadding * 100))

  // 打开时同步现有值
  useEffect(() => {
    if (open) {
      setX(defaultZoomX)
      setY(defaultZoomY)
      setAutoPanOn(autoPanEnabled)
      setTriggerPct(Math.round(autoPanTriggerThreshold * 100))
      setRightPadPct(Math.round(autoPanRightPadding * 100))
    }
  }, [open, defaultZoomX, defaultZoomY, autoPanEnabled, autoPanTriggerThreshold, autoPanRightPadding])

  const applyAndClose = () => {
    // 最小值限制，避免 0/负数
    const safeX = !Number.isFinite(x) || x <= 0 ? 1 : x
    const safeY = !Number.isFinite(y) || y <= 0 ? 1 : y
    setDefaultZoomXY(safeX, safeY)

    // 自动平移参数：转换/夹紧到合理范围
    const clampPct = (v: number) => {
      const n = Number.isFinite(v) ? v : 0
      return Math.max(0, Math.min(95, n))
    }
    const tPct = clampPct(triggerPct)
    const rPct = clampPct(rightPadPct)

    setAutoPanEnabled(!!autoPanOn)
    setAutoPanTriggerThreshold(tPct / 100)
    setAutoPanRightPadding(rPct / 100)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-lg bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">设置</h2>
            <p className="text-xs text-gray-500">配置波形默认缩放与自动平移参数（点击 Trial 打开波形时生效）。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">X 轴默认缩放倍率</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={x}
                onChange={(e) => setX(Number(e.target.value))}
                className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="text-xs text-gray-500">1 表示显示全范围；2 表示放大 2 倍（显示范围减半）。</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">快捷：</span>
              {[1, 2, 4, 8].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setX(v)}
                  className="rounded border border-gray-300 px-2 py-0.5 hover:border-blue-500 hover:text-blue-600"
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Y 轴默认缩放倍率</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={y}
                onChange={(e) => setY(Number(e.target.value))}
                className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="text-xs text-gray-500">与 X 轴规则相同。</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">快捷：</span>
              {[1, 2, 4, 8].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setY(v)}
                  className="rounded border border-gray-300 px-2 py-0.5 hover:border-blue-500 hover:text-blue-600"
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>

          {/* 自动平移设置 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">自动平移</label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoPanOn}
                  onChange={(e) => setAutoPanOn(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">开启</span>
              </label>
            </div>
            <div className="space-y-2 opacity-100">
              <label className="block text-sm font-medium text-gray-700">触发阈值（%）</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={95}
                  step={1}
                  value={triggerPct}
                  onChange={(e) => setTriggerPct(Number(e.target.value))}
                  disabled={!autoPanOn}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                />
                <div className="text-xs text-gray-500">靠近右边该比例范围内时触发自动平移（例如 25 表示靠近右侧 25%）。</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">快捷：</span>
                {[10, 15, 25, 35, 50].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTriggerPct(v)}
                    disabled={!autoPanOn}
                    className="rounded border border-gray-300 px-2 py-0.5 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">右侧留白（%）</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={95}
                  step={1}
                  value={rightPadPct}
                  onChange={(e) => setRightPadPct(Number(e.target.value))}
                  disabled={!autoPanOn}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                />
                <div className="text-xs text-gray-500">自动平移后在最新事件右侧保留的空间比例（例如 35 表示右侧保留 35%）。</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">快捷：</span>
                {[15, 25, 35, 50, 65].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRightPadPct(v)}
                    disabled={!autoPanOn}
                    className="rounded border border-gray-300 px-2 py-0.5 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              说明：仅在标注模式中、且添加了新的区段后触发自动平移。关闭后将保留当前视图位置，不再自动跟随。
            </div>
          </div>

          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            说明：倍率 &gt; 1 表示默认放大，以数据中位为中心裁剪显示范围；倍率 &le; 1 将视为显示全范围。
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="button"
            onClick={applyAndClose}
            className="rounded-md bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
