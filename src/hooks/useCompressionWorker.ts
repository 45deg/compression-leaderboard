import { useCallback, useEffect, useRef, useState } from 'react'

import type { CompressionJob, CompressionResultRow, RunProgress } from '../types/compression'
import type {
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
  const restartWorkerRef = useRef<(() => void) | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const onMessage = (event: MessageEvent<WorkerToMainMessage>) => {
      if (event.currentTarget !== workerRef.current) {
        return
      }
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

      handleErrorMessage(message, pendingRequest.reject)
      pendingRequestRef.current = null
    }

    const onError = (event: ErrorEvent) => {
      if (event.currentTarget !== workerRef.current) {
        return
      }
      pendingRequestRef.current?.reject(new Error(event.message || 'Compression worker failed.'))
      pendingRequestRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
      setIsReady(false)
    }

    const createWorker = () => {
      const worker = new Worker(new URL('../workers/compression.worker.ts', import.meta.url), { type: 'module' })
      worker.addEventListener('message', onMessage as EventListener)
      worker.addEventListener('error', onError as EventListener)
      workerRef.current = worker
    }

    createWorker()
    restartWorkerRef.current = () => {
      // WASM runs synchronously, so a queued cancel message cannot interrupt it.
      workerRef.current?.terminate()
      pendingRequestRef.current?.reject(new Error('Compression run cancelled.'))
      pendingRequestRef.current = null
      workerRef.current = null
      setIsReady(false)
      createWorker()
    }

    return () => {
      restartWorkerRef.current = null
      const pendingRequest = pendingRequestRef.current
      if (pendingRequest) {
        pendingRequest.reject(new Error('Compression worker terminated unexpectedly.'))
        pendingRequestRef.current = null
      }

      workerRef.current?.terminate()
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

        try {
          worker.postMessage(
            {
              type: 'run',
              requestId,
              inputBuffer: transferableInput.buffer,
              jobs,
            },
            [transferableInput.buffer],
          )
        } catch (error) {
          pendingRequestRef.current = null
          reject(error)
        }
      })
    },
    [],
  )

  const cancelCurrentRun = useCallback(() => {
    if (!pendingRequestRef.current) {
      return
    }

    restartWorkerRef.current?.()
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
