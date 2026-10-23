import { describe, expect, test } from 'vitest'

import { getContainerOverheadBytes } from '../src/utils/compression-overhead'

describe('container overhead bounds', () => {
  test('does not count missing zlib dictionary bytes as overhead', () => {
    // Valid CMF/FLG with FDICT set, but no room for DICTID and Adler-32.
    expect(getContainerOverheadBytes('zlib', new Uint8Array([0x78, 0x20, 0, 0, 0, 0]))).toBe(0)
    expect(getContainerOverheadBytes('zlib', new Uint8Array([0x78, 0x20, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(10)
  })

  test.each([0x80000000, 0xffffffff])('reads XZ backward size %s as unsigned', (backwardSize) => {
    const binary = new Uint8Array(32)
    binary.set([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0])
    binary.set([0x59, 0x5a], binary.length - 2)
    new DataView(binary.buffer).setUint32(binary.length - 8, backwardSize, true)

    const overhead = getContainerOverheadBytes('xz', binary)
    expect(overhead).toBe(24)
    expect(overhead).toBeGreaterThanOrEqual(0)
    expect(overhead).toBeLessThanOrEqual(binary.length)
  })
})
