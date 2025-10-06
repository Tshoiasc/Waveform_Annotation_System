// 文件信息类型
export interface FileInfo {
  fileId: string
  fullPath: string
  fileName: string
  size: number
  trialCount: number
  finishedTrials?: number
  metadataTrials?: number
  isFinished?: boolean
  hasStarted?: boolean
}

// 缩略图数据
export interface ThumbnailData {
  timestamps: number[]
  raw?: number[]
  filtered?: number[]
  values?: number[]
}

// Trial元数据
export interface TrialMetadata {
  trialIndex: number
  duration: number
  sampleRate: number
  dataPoints: number
  thumbnail: ThumbnailData
  finished?: boolean
  finishedAt?: string
  annotationCount?: number
  versionCount?: number
}

// 波形数据
export interface WaveformData {
  timestamps: number[]
  values: number[]
}

// 完整波形响应
export interface WaveformResponse {
  raw: WaveformData
  filtered: WaveformData
  keypoints: number[]
}

// 缩放状态
export interface ZoomState {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  timestamp: number
}

// 标注阶段配置
export interface AnnotationPhase {
  id: string
  name: string
  color: string
  shortcut?: string
  order?: number
}

// 区间标注数据
export interface AnnotationSegment {
  id: string
  fileId: string
  trialIndex: number
  phaseId: string
  phaseName: string
  startTime: number
  endTime: number
  startIndex: number
  endIndex: number
  eventIndex: number
  label?: string
  color?: string
  createdAt: string
  updatedAt: string
  synced?: boolean
  localId?: string
  userId?: string
  versionId?: string
}

export interface AnnotationSegmentPayload {
  fileId: string
  trialIndex: number
  phaseId: string
  phaseName: string
  startTime: number
  endTime: number
  startIndex: number
  endIndex: number
  eventIndex: number
  color?: string
  label?: string
}

// 标注事件概览
export interface AnnotationEvent {
  eventIndex: number
  startTime: number
  endTime: number
}

export interface AnnotationVersionMeta {
  id: string
  fileId: string
  trialIndex: number
  userId: string
  username?: string | null
  status: 'active' | 'draft'
  segmentCount: number
  createdAt?: string | null
  updatedAt?: string | null
  isOwner: boolean
}

export interface AnnotationSyncResult {
  versionId: string
  syncedAt: string
  segmentCount: number
  status: 'active' | 'draft'
}
