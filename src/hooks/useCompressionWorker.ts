import { useCallback, useEffect, useRef, useState } from 'react'

import type { CompressionJob, CompressionResultRow, RunProgress } from '../types/compression'
import type {
  WorkerCancelMessage,
  WorkerDoneMessage,
  WorkerErrorMessage,
  WorkerProgressMessage,
  WorkerToMainMessage,
} from '../types/worker-messages'

interface RunCompressionInput {
  input: Uint8Array
  jobs: CompressionJob[]
  onProgress?: (progress: RunProgress) => void
}

interface PendingRequest {
  requestId: string
  onProgress?: (progress: RunProgress) => void
  resolve: (rows: CompressionResultRow[]) => void
  reject: (error: Error) => void
}

export interface CompressionWorkerController {
  isReady: boolean
  runCompression: (input: RunCompressionInput) => Promise<CompressionResultRow[]>
  cancelCurrentRun: () => void
}

export function useCompressionWorker(): CompressionWorkerController {
  const workerRef = useRef<Worker | null>(null)
  const pendingRequestRef = useRef<PendingRequest | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/compression.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    const onMessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const message = event.data

      if (message.type === 'ready') {
        setIsReady(true)
        return
      }

      const pendingRequest = pendingRequestRef.current
      if (!pendingRequest || message.requestId !== pendingRequest.requestId) {
        return
      }

      if (message.type === 'progress') {
        handleProgressMessage(message, pendingRequest.onProgress)
        return
      }

      if (message.type === 'done') {
        handleDoneMessage(message, pendingRequest.resolve)
        pendingRequestRef.current = null
        return
      }

      if (message.type === 'cancelled') {
        pendingRequest.reject(new Error('Compression run cancelled.'))
        pendingRequestRef.current = null
        return
      }

      handleErrorMessage(message, pendingRequest.reject)
      pendingRequestRef.current = null
    }

    worker.addEventListener('message', onMessage as EventListener)

    return () => {
      worker.removeEventListener('message', onMessage as EventListener)

      const pendingRequest = pendingRequestRef.current
      if (pendingRequest) {
        pendingRequest.reject(new Error('Compression worker terminated unexpectedly.'))
        pendingRequestRef.current = null
      }

      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const runCompression = useCallback(
    ({ input, jobs, onProgress }: RunCompressionInput) => {
      const worker = workerRef.current
      if (!worker) {
        return Promise.reject(new Error('Compression worker is not available.'))
      }

      if (pendingRequestRef.current) {
        return Promise.reject(new Error('A compression run is already in progress.'))
      }

      const requestId = crypto.randomUUID()
      const transferableInput = new Uint8Array(input)

      return new Promise<CompressionResultRow[]>((resolve, reject) => {
        pendingRequestRef.current = {
          requestId,
          onProgress,
          resolve,
          reject,
        }

        worker.postMessage(
          {
            type: 'run',
            requestId,
            inputBuffer: transferableInput.buffer,
            jobs,
          },
          [transferableInput.buffer],
        )
      })
    },
    [],
  )

  const cancelCurrentRun = useCallback(() => {
    const worker = workerRef.current
    const pendingRequest = pendingRequestRef.current
    if (!worker || !pendingRequest) {
      return
    }

    const message: WorkerCancelMessage = {
      type: 'cancel',
      requestId: pendingRequest.requestId,
    }
    worker.postMessage(message)
  }, [])

  return {
    isReady,
    runCompression,
    cancelCurrentRun,
  }
}

function handleProgressMessage(message: WorkerProgressMessage, onProgress?: (progress: RunProgress) => void): void {
  if (!onProgress) {
    return
  }

  onProgress({
    completed: message.completed,
    total: message.total,
    currentLabel: message.currentLabel,
  })
}

function handleDoneMessage(message: WorkerDoneMessage, resolve: (rows: CompressionResultRow[]) => void): void {
  resolve(message.results)
}

function handleErrorMessage(message: WorkerErrorMessage, reject: (error: Error) => void): void {
  reject(new Error(message.message))
}
