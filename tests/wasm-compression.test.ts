import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getContainerOverheadBytes } from '../src/utils/compression-overhead.ts'
import initWasm, {
  CompressionAlgorithm as WasmCompressionAlgorithm,
  run_compression,
} from '../src/wasm/pkg/compression_wasm.js'

type AlgorithmId =
  | 'deflate'
  | 'zlib'
  | 'gzip'
  | 'brotli'
  | 'bzip2'
  | 'zstd'
  | 'zstdMagicless'
  | 'lz4'
  | 'lzo'
  | 'lzma'
  | 'snappy'

interface WasmFixtureCase {
  algorithm: AlgorithmId
  level: number
  compressedSize: number
  overheadSize: number
  payloadSize: number
  ratio: number
  binaryBase64: string
}

interface WasmFixture {
  inputText: string
  inputSize: number
  cases: WasmFixtureCase[]
}

const fixturePath = new URL('../src/wasm/fixtures/wasm-compression-fixture.json', import.meta.url)
const fixture = JSON.parse(await readFile(fixturePath, 'utf-8')) as WasmFixture
const fixtureCases = new Map<AlgorithmId, WasmFixtureCase>(fixture.cases.map((entry) => [entry.algorithm, entry]))
let wasmReadyPromise: Promise<void> | null = null

function ensureWasmReady(): Promise<void> {
  if (!wasmReadyPromise) {
    wasmReadyPromise = readFile(new URL('../src/wasm/pkg/compression_wasm_bg.wasm', import.meta.url)).then((bytes) =>
      initWasm({ module_or_path: bytes }).then(() => undefined),
    )
  }

  return wasmReadyPromise
}

function mapToWasmAlgorithm(algorithm: AlgorithmId): WasmCompressionAlgorithm {
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

test('wasm fixture input size matches encoded bytes', () => {
  const input = new TextEncoder().encode(fixture.inputText)
  assert.equal(input.length, fixture.inputSize)
})

test('wasm compression outputs match fixture including overhead and payload sizes', async () => {
  await ensureWasmReady()

  const input = new TextEncoder().encode(fixture.inputText)

  for (const [algorithm, expected] of fixtureCases) {
    const wasmAlgorithm = mapToWasmAlgorithm(algorithm)
    const result = run_compression(wasmAlgorithm, input, expected.level)
    let binaryOutput = new Uint8Array()

    try {
      binaryOutput = new Uint8Array(result.output)
      const compressedSize = result.compressed_size
      const computedOverheadSize = getContainerOverheadBytes(algorithm, binaryOutput)
      const payloadSize = Math.max(0, compressedSize - computedOverheadSize)

      assert.equal(compressedSize, expected.compressedSize, `${algorithm} compressed size`)
      assert.equal(computedOverheadSize, expected.overheadSize, `${algorithm} overhead size`)
      assert.equal(payloadSize, expected.payloadSize, `${algorithm} payload size`)
      assert.equal(
        Buffer.from(binaryOutput).toString('base64'),
        expected.binaryBase64,
        `${algorithm} binary fixture payload`,
      )
      assert.equal(result.ratio, expected.ratio, `${algorithm} ratio`)
    } finally {
      result.free()
    }
  }
})
