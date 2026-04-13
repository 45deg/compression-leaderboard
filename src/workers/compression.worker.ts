/// <reference lib="webworker" />

import initWasm, { CompressionAlgorithm as WasmCompressionAlgorithm, run_compression } from '../wasm/pkg/compression_wasm'
import type { AlgorithmId, CompressionResultRow, EncodingMode } from '../types/compression'
import type {
  MainToWorkerMessage,
  WorkerCancelledMessage,
  WorkerDoneMessage,
  WorkerErrorMessage,
  WorkerProgressMessage,
  WorkerRunMessage,
} from '../types/worker-messages'
import { getContainerOverheadBytes } from '../utils/compression-overhead'
import { bytesToAscii85, bytesToBase64 } from '../utils/encoding'

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope
const cancelledRequests = new Set<string>()

let wasmReadyPromise: Promise<void> | null = null

function ensureWasmReady(): Promise<void> {
  if (!wasmReadyPromise) {
    wasmReadyPromise = initWasm().then(() => undefined)
  }
  return wasmReadyPromise
}

function mapAlgorithm(algorithm: AlgorithmId): WasmCompressionAlgorithm {
  switch (algorithm) {
    case 'deflate':
      return WasmCompressionAlgorithm.Deflate
    case 'zlib':
      return WasmCompressionAlgorithm.Zlib
    case 'gzip':
      return WasmCompressionAlgorithm.Gzip
    case 'brotli':
      return WasmCompressionAlgorithm.Brotli
    case 'bzip2':
      return WasmCompressionAlgorithm.Bzip2
    case 'zstd':
      return WasmCompressionAlgorithm.Zstd
    case 'zstdMagicless':
      return WasmCompressionAlgorithm.ZstdMagicless
    case 'lz4':
      return WasmCompressionAlgorithm.Lz4
    case 'lzo':
      return WasmCompressionAlgorithm.Lzo
    case 'lzma':
      return WasmCompressionAlgorithm.Lzma
    case 'snappy':
      return WasmCompressionAlgorithm.Snappy
  }
}

function getThroughput(originalBytes: number, compressionMs: number): number {
  if (compressionMs <= 0) {
    return 0
  }
  const seconds = compressionMs / 1000
  const megabytes = originalBytes / (1024 * 1024)
  return megabytes / seconds
}

function postCancelled(requestId: string): void {
  const message: WorkerCancelledMessage = { type: 'cancelled', requestId }
  workerScope.postMessage(message)
}

function postProgress(requestId: string, completed: number, total: number, currentLabel: string): void {
  const message: WorkerProgressMessage = { type: 'progress', requestId, completed, total, currentLabel }
  workerScope.postMessage(message)
}

function postError(requestId: string, message: string): void {
  const errorMessage: WorkerErrorMessage = { type: 'error', requestId, message }
  workerScope.postMessage(errorMessage)
}

function resolveEncoding(base64: boolean, base85: boolean): EncodingMode {
  if (base85) {
    return 'base85'
  }
  if (base64) {
    return 'base64'
  }
  return 'none'
}

async function executeRun(message: WorkerRunMessage): Promise<void> {
  await ensureWasmReady()

  const { requestId, jobs } = message
  const input = new Uint8Array(message.inputBuffer)
  const total = jobs.length
  const results: CompressionResultRow[] = []

  for (let index = 0; index < jobs.length; index += 1) {
    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId)
      postCancelled(requestId)
      return
    }

    const job = jobs[index]
    const wasmResult = run_compression(mapAlgorithm(job.algorithm), input, job.level)
    let binaryOutput = new Uint8Array()

    try {
      binaryOutput = new Uint8Array(wasmResult.output)
      const binarySize = wasmResult.compressed_size
      const binaryRatio = input.length === 0 ? 0 : binarySize / input.length
      const compressionMs = wasmResult.compression_ms
      const decompressionMs = wasmResult.decompression_ms
      const throughputMbps = getThroughput(input.length, compressionMs)

      const encoding = resolveEncoding(job.modifiers.base64, job.modifiers.base85)
      const encodeStart = performance.now()
      const encodedText =
        encoding === 'base64'
          ? bytesToBase64(binaryOutput)
          : encoding === 'base85'
            ? bytesToAscii85(binaryOutput)
            : null
      const encodeMs = encoding === 'none' ? 0 : performance.now() - encodeStart
      const containerOverheadBytes = getContainerOverheadBytes(job.algorithm, binaryOutput)
      const payloadSize = Math.max(0, binarySize - containerOverheadBytes)
      const encodedSize = encodedText === null ? binarySize : encodedText.length
      const overheadBytes = containerOverheadBytes
      const ratio = input.length === 0 ? 0 : encodedSize / input.length

      results.push({
        presetId: job.presetId,
        label: job.label,
        algorithm: job.algorithm,
        level: job.level,
        originalSize: input.length,
        compressedSize: encodedSize,
        binarySize,
        payloadSize,
        overheadBytes,
        ratio,
        binaryRatio,
        compressionMs,
        decompressionMs,
        encodeMs,
        throughputMbps,
        encoding,
        binary: binaryOutput,
        encodedText,
      })
    } finally {
      wasmResult.free()
    }

    postProgress(requestId, index + 1, total, job.label)
  }

  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId)
    postCancelled(requestId)
    return
  }

  const transferables = results.map((result) => result.binary.buffer)
  const doneMessage: WorkerDoneMessage = { type: 'done', requestId, results }
  workerScope.postMessage(doneMessage, transferables)
}

workerScope.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data

  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId)
    return
  }

  executeRun(message).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : 'Compression worker failed.'
    postError(message.requestId, detail)
  })
}

workerScope.postMessage({ type: 'ready' })
