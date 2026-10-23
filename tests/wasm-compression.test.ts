import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'

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
  | 'xz'
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
    case 'xz':
      return WasmCompressionAlgorithm.Lzma
    case 'snappy':
      return WasmCompressionAlgorithm.Snappy
  }
}

describe('wasm compression fixture', () => {
  test.each([0, 1, 4, 11])('Brotli quality %s round-trips through WASM', async (level) => {
    await ensureWasmReady()
    const input = new TextEncoder().encode('Brotli round trip. '.repeat(128))
    const result = run_compression(WasmCompressionAlgorithm.Brotli, input, level)
    try {
      expect(result.compressed_size).toBeGreaterThan(0)
      expect(Number.isFinite(result.decompression_ms)).toBe(true)
    } finally {
      result.free()
    }
  })

  test.each([0, 1, 5, 65_536])('LZO validates a %s-byte input through WASM', async (size) => {
    await ensureWasmReady()
    const result = run_compression(WasmCompressionAlgorithm.Lzo, new Uint8Array(size), 0)
    try {
      expect(result.compressed_size).toBeGreaterThan(0)
      expect(Number.isFinite(result.decompression_ms)).toBe(true)
    } finally {
      result.free()
    }
  })

  test('fixture input size matches encoded bytes', () => {
    const input = new TextEncoder().encode(fixture.inputText)
    expect(input.length).toBe(fixture.inputSize)
  })

  test('wasm outputs match fixture including overhead and payload sizes', async () => {
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

        expect(compressedSize, `${algorithm} compressed size`).toBe(expected.compressedSize)
        expect(computedOverheadSize, `${algorithm} overhead size`).toBe(expected.overheadSize)
        expect(payloadSize, `${algorithm} payload size`).toBe(expected.payloadSize)
        expect(Buffer.from(binaryOutput).toString('base64'), `${algorithm} binary fixture payload`).toBe(
          expected.binaryBase64,
        )
        expect(result.ratio, `${algorithm} ratio`).toBe(expected.ratio)
      } finally {
        result.free()
      }
    }
  })
})
