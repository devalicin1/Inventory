import type { Job, ListedProduct } from '../../api/production-jobs'
import type { BatchQrPayload, StageTransitionRule } from '../jobs/create/types'

export type ScanMode = 'camera' | 'manual'
export type ScannedType = 'job' | 'product' | 'po' | 'none'

export interface ProductionScannerProps {
  workspaceId: string
  onClose?: () => void
}

export interface RecentScan {
  code: string
  type: ScannedType
  timestamp: Date
}

export interface BatchTransferData {
  batchPayload: BatchQrPayload
  rule?: StageTransitionRule
  lotId: string
  sourceStageName: string
  targetStageName: string
}

export interface SelectedStageForOutput {
  stageId: string
  stageName: string
  nextStageId?: string
  nextStageName?: string
}

export interface SelectedLotForPosting {
  lot: string
  qty: number
}

export interface ProductionSummary {
  currentStageInputUOM: string
  currentStageOutputUOM: string
  numberUp: number
  totalProducedInStage: number
  plannedQty: number
  plannedUOM: string
  completionThreshold: number
  completionThresholdUpper: number
  convertToOutputUOM: (qtyInInputUOM: number) => number
}

export interface StageProgress {
  stageId: string
  stageName: string
  produced: number
  planned: number
  percentage: number
  uom: string
  isCurrent: boolean
}

export interface LotAvailability {
  lot: string
  transferredQty: number
  processedQty: number
  remainingQty: number
  transferDate: Date
}

