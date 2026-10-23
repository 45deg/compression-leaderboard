import type { CompressionJob, CompressionResultRow } from './compression'

export interface WorkerRunMessage {
  type: 'run'
  requestId: string
  inputBuffer: ArrayBuffer
  jobs: CompressionJob[]
}

export type MainToWorkerMessage = WorkerRunMessage

export interface WorkerReadyMessage {
  type: 'ready'
}

export interface WorkerProgressMessage {
  type: 'progress'
  requestId: string
  completed: number
  total: number
  currentLabel: string
}

export interface WorkerDoneMessage {
  type: 'done'
  requestId: string
  results: CompressionResultRow[]
}

export interface WorkerErrorMessage {
  type: 'error'
  requestId: string
  message: string
}

export type WorkerToMainMessage =
  | WorkerReadyMessage
  | WorkerProgressMessage
  | WorkerDoneMessage
  | WorkerErrorMessage
