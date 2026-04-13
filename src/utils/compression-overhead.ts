import type { AlgorithmId } from '../types/compression'

export function getContainerOverheadBytes(algorithm: AlgorithmId, binary: Uint8Array): number {
  if (binary.length === 0) {
    return 0
  }

  switch (algorithm) {
    case 'zlib':
      return getZlibOverheadBytes(binary)
    case 'gzip':
      return getGzipOverheadBytes(binary)
    case 'bzip2':
      return getBzip2OverheadBytes(binary)
    case 'zstd':
      return getZstdOverheadBytes(binary, true)
    case 'zstdMagicless':
      return getZstdOverheadBytes(binary, false)
    case 'lz4':
      return getLz4OverheadBytes(binary)
    case 'xz':
      return getXzOverheadBytes(binary)
    case 'snappy':
      return getSnappyOverheadBytes(binary)
    default:
      return 0
  }
}

function getZlibOverheadBytes(binary: Uint8Array): number {
  if (binary.length < 6) {
    return 0
  }

  const cmf = binary[0]
  const flg = binary[1]
  if ((cmf & 0x0f) !== 8) {
    return 0
  }
  if (((cmf << 8) + flg) % 31 !== 0) {
    return 0
  }

  const hasPresetDictionary = (flg & 0x20) !== 0
  return hasPresetDictionary ? 10 : 6
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

function getBzip2OverheadBytes(binary: Uint8Array): number {
  if (binary.length < 14) {
    return 0
  }
  if (binary[0] !== 0x42 || binary[1] !== 0x5a || binary[2] !== 0x68) {
    return 0
  }

  return 14
}

function getLz4OverheadBytes(binary: Uint8Array): number {
  if (binary.length < 4) {
    return 0
  }

  if (isLz4Frame(binary)) {
    return getLz4FrameOverheadBytes(binary)
  }

  // lz4_flex::compress_prepend_size uses block format with a 4-byte uncompressed-size prefix.
  return 4
}

function getXzOverheadBytes(binary: Uint8Array): number {
  if (binary.length < 24) {
    return 0
  }

  if (
    binary[0] !== 0xfd ||
    binary[1] !== 0x37 ||
    binary[2] !== 0x7a ||
    binary[3] !== 0x58 ||
    binary[4] !== 0x5a ||
    binary[5] !== 0x00
  ) {
    return 0
  }

  if (binary[binary.length - 2] !== 0x59 || binary[binary.length - 1] !== 0x5a) {
    return 0
  }

  const backwardSize =
    binary[binary.length - 8] |
    (binary[binary.length - 7] << 8) |
    (binary[binary.length - 6] << 16) |
    (binary[binary.length - 5] << 24)
  const indexSize = (backwardSize + 1) * 4
  const overhead = 24 + indexSize

  if (overhead > binary.length) {
    return 24
  }

  return overhead
}

function getSnappyOverheadBytes(binary: Uint8Array): number {
  const preambleLength = getSnappyVarintLength(binary)
  if (preambleLength === 0) {
    return 0
  }

  return preambleLength
}

function getSnappyVarintLength(binary: Uint8Array): number {
  const maxVarintBytes = Math.min(5, binary.length)
  let length = 0

  while (length < maxVarintBytes) {
    const value = binary[length]
    length += 1
    if ((value & 0x80) === 0) {
      return length
    }
  }

  return 0
}

function isLz4Frame(binary: Uint8Array): boolean {
  return (
    binary[0] === 0x04 &&
    binary[1] === 0x22 &&
    binary[2] === 0x4d &&
    binary[3] === 0x18
  )
}

function getLz4FrameOverheadBytes(binary: Uint8Array): number {
  if (binary.length < 11) {
    return 0
  }

  const flags = binary[4]
  const version = (flags >> 6) & 0x03
  if (version !== 0x01) {
    return 0
  }

  let cursor = 6
  const hasContentSize = (flags & 0x08) !== 0
  const hasDictionaryId = (flags & 0x01) !== 0
  const hasContentChecksum = (flags & 0x04) !== 0

  if (hasContentSize) {
    cursor += 8
  }
  if (hasDictionaryId) {
    cursor += 4
  }

  cursor += 1 // header checksum
  if (cursor >= binary.length) {
    return 0
  }

  let trailerSize = 4 // EndMark
  if (hasContentChecksum) {
    trailerSize += 4
  }

  if (cursor + trailerSize > binary.length) {
    return 0
  }

  const endMarkStart = binary.length - trailerSize
  if (
    binary[endMarkStart] !== 0 ||
    binary[endMarkStart + 1] !== 0 ||
    binary[endMarkStart + 2] !== 0 ||
    binary[endMarkStart + 3] !== 0
  ) {
    return 0
  }

  return cursor + trailerSize
}

function findNullTerminator(binary: Uint8Array, start: number, end: number): number {
  for (let index = start; index < end; index += 1) {
    if (binary[index] === 0) {
      return index + 1
    }
  }
  return -1
}
