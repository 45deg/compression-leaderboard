import { describe, expect, test } from 'vitest'

import { buildCompressedDownloadFilename } from '../src/utils/compression-download.ts'
import type { AlgorithmId } from '../src/types/compression'

describe('buildCompressedDownloadFilename', () => {
  const cases: Array<[AlgorithmId, string]> = [
    ['deflate', '.deflate.bin'],
    ['zlib', '.zlib'],
    ['gzip', '.gz'],
    ['brotli', '.br'],
    ['bzip2', '.bz2'],
    ['zstd', '.zst'],
    ['zstdMagicless', '.zstd.bin'],
    ['lz4', '.lz4'],
    ['lzo', '.lzo'],
    ['xz', '.xz'],
    ['snappy', '.snappy.bin'],
  ]

  test.each(cases)('uses %s for compressed downloads', (algorithm, extension) => {
    expect(buildCompressedDownloadFilename('preset', algorithm)).toBe(`preset${extension}`)
  })
})
