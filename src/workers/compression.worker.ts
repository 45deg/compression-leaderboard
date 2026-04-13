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

function getContainerOverheadBytes(algorithm: AlgorithmId, binary: Uint8Array): number {
  if (binary.length === 0) {
    return 0
  }

  switch (algorithm) {
    case 'deflate':
      return getDeflateOverheadBytes()
    case 'brotli':
      return getBrotliOverheadBytes()
    case 'gzip':
      return getGzipOverheadBytes(binary)
    case 'zstd':
      return getZstdOverheadBytes(binary, true)
    case 'zstdMagicless':
      return getZstdOverheadBytes(binary, false)
    default:
      return 0
  }
}

function getDeflateOverheadBytes(): number {
  return 0
}

function getBrotliOverheadBytes(): number {
  return 0
}

function getZstdOverheadBytes(binary: Uint8Array, withMagicNumber: boolean): number {
  const baseOffset = withMagicNumber ? 4 : 0
  if (binary.length <= baseOffset) {
    return 0
  }

  if (
    withMagicNumber &&
    !(
      binary[0] === 0x28 &&
      binary[1] === 0xb5 &&
      binary[2] === 0x2f &&
      binary[3] === 0xfd
    )
  ) {
    return 0
  }

  const frameHeaderDescriptor = binary[baseOffset]
  if (frameHeaderDescriptor === undefined) {
    return 0
  }

  const frameContentSizeFlag = frameHeaderDescriptor >> 6
  const singleSegment = (frameHeaderDescriptor & 0x20) !== 0
  const contentChecksumFlag = (frameHeaderDescriptor & 0x04) !== 0
  const dictionaryIdFlag = frameHeaderDescriptor & 0x03
  const dictionaryIdBytes = dictionaryIdFlag === 0 ? 0 : dictionaryIdFlag === 1 ? 1 : dictionaryIdFlag === 2 ? 2 : 4
  const windowDescriptorBytes = singleSegment ? 0 : 1
  const frameContentSizeBytes = getZstdFrameContentSizeBytes(frameContentSizeFlag, singleSegment)
  const headerBytes = baseOffset + 1 + windowDescriptorBytes + dictionaryIdBytes + frameContentSizeBytes
  const checksumBytes = contentChecksumFlag ? 4 : 0

  if (binary.length < headerBytes + checksumBytes) {
    return 0
  }

  return headerBytes + checksumBytes
}

function getZstdFrameContentSizeBytes(flag: number, singleSegment: boolean): number {
  if (singleSegment) {
    if (flag === 0) {
      return 1
    }
    return 1 << flag
  }

  if (flag === 0) {
    return 0
  }
  if (flag === 1) {
    return 2
  }
  if (flag === 2) {
    return 4
  }
  return 8
}

function getGzipOverheadBytes(binary: Uint8Array): number {
  if (binary.length < 18) {
    return 0
  }
  if (binary[0] !== 0x1f || binary[1] !== 0x8b) {
    return 0
  }

  const flags = binary[3]
  let cursor = 10
  const trailerBytes = 8
  const dataEnd = binary.length - trailerBytes
  if (dataEnd <= cursor) {
    return 0
  }

  if ((flags & 0x04) !== 0) {
    if (cursor + 2 > dataEnd) {
      return 0
    }
    const extraLength = binary[cursor] | (binary[cursor + 1] << 8)
    cursor += 2 + extraLength
    if (cursor > dataEnd) {
      return 0
    }
  }

  if ((flags & 0x08) !== 0) {
    cursor = findNullTerminator(binary, cursor, dataEnd)
    if (cursor < 0) {
      return 0
    }
  }

  if ((flags & 0x10) !== 0) {
    cursor = findNullTerminator(binary, cursor, dataEnd)
    if (cursor < 0) {
      return 0
    }
  }

  if ((flags & 0x02) !== 0) {
    if (cursor + 2 > dataEnd) {
      return 0
    }
    cursor += 2
  }

  if (cursor > dataEnd) {
    return 0
  }

  return cursor + trailerBytes
}

function findNullTerminator(binary: Uint8Array, start: number, end: number): number {
  for (let index = start; index < end; index += 1) {
    if (binary[index] === 0) {
      return index + 1
    }
  }
  return -1
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
