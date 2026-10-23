use std::ffi::{c_char, c_int, c_uint};
use std::io::{Read, Write};

use flate2::Compression;
use flate2::read::{DeflateDecoder, GzDecoder, ZlibDecoder};
use flate2::write::{DeflateEncoder, GzEncoder, ZlibEncoder};
use js_sys::Uint8Array;
use libbz2_rs_sys::{BZ2_bzBuffToBuffCompress, BZ2_bzBuffToBuffDecompress, BZ_OK, BZ_OUTBUFF_FULL};
use liblzma_sys::{
    lzma_easy_buffer_encode, lzma_stream_buffer_bound, lzma_stream_buffer_decode, LZMA_BUF_ERROR,
    LZMA_CHECK_CRC64, LZMA_CONCATENATED, LZMA_DATA_ERROR, LZMA_FORMAT_ERROR, LZMA_MEM_ERROR,
    LZMA_OK, LZMA_OPTIONS_ERROR, lzma_ret,
};
use wasm_bindgen::{JsCast, prelude::*};
use zstd::stream::raw::{
    CParameter as ZstdRawCParameter, DParameter as ZstdRawDParameter, Decoder as ZstdRawDecoder,
    Encoder as ZstdRawEncoder, InBuffer as ZstdRawInBuffer, Operation as _,
    OutBuffer as ZstdRawOutBuffer,
};
use zstd::zstd_safe::FrameFormat as ZstdFrameFormat;

#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub enum CompressionAlgorithm {
    Deflate,
    Zlib,
    Gzip,
    Brotli,
    Bzip2,
    Zstd,
    ZstdMagicless,
    Lz4,
    Lzo,
    Lzma,
    Snappy,
}

#[wasm_bindgen]
pub struct CompressionResult {
    output: Vec<u8>,
    compression_ms: f64,
    decompression_ms: f64,
    ratio: f64,
    compressed_size: u32,
}

#[wasm_bindgen]
impl CompressionResult {
    #[wasm_bindgen(getter)]
    pub fn output(&self) -> Uint8Array {
        Uint8Array::from(self.output.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn compression_ms(&self) -> f64 {
        self.compression_ms
    }

    #[wasm_bindgen(getter)]
    pub fn decompression_ms(&self) -> f64 {
        self.decompression_ms
    }

    #[wasm_bindgen(getter)]
    pub fn ratio(&self) -> f64 {
        self.ratio
    }

    #[wasm_bindgen(getter)]
    pub fn compressed_size(&self) -> u32 {
        self.compressed_size
    }
}

#[wasm_bindgen]
pub fn run_compression(
    algorithm: CompressionAlgorithm,
    input: &[u8],
    level: u32,
) -> Result<CompressionResult, JsValue> {
    let start = now_ms();
    let output = compress(algorithm, input, level).map_err(|err| JsValue::from_str(&err))?;
    let compression_ms = now_ms() - start;

    let decompress_start = now_ms();
    let restored =
        decompress(algorithm, &output, input.len()).map_err(|err| JsValue::from_str(&err))?;
    let decompression_ms = now_ms() - decompress_start;

    if restored != input {
        return Err(JsValue::from_str(
            "Decompression integrity check failed for selected algorithm",
        ));
    }

    let ratio = if input.is_empty() {
        0.0
    } else {
        output.len() as f64 / input.len() as f64
    };

    Ok(CompressionResult {
        compressed_size: output.len() as u32,
        output,
        compression_ms,
        decompression_ms,
        ratio,
    })
}

fn now_ms() -> f64 {
    if let Some(window) = web_sys::window() {
        if let Some(performance) = window.performance() {
            return performance.now();
        }
    }

    let global = js_sys::global();
    if let Ok(worker_scope) = global.dyn_into::<web_sys::WorkerGlobalScope>() {
        if let Some(performance) = worker_scope.performance() {
            return performance.now();
        }
    }

    js_sys::Date::now()
}

fn compress(algorithm: CompressionAlgorithm, input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    match algorithm {
        CompressionAlgorithm::Deflate => compress_deflate(input, level),
        CompressionAlgorithm::Zlib => compress_zlib(input, level),
        CompressionAlgorithm::Gzip => compress_gzip(input, level),
        CompressionAlgorithm::Brotli => compress_brotli(input, level),
        CompressionAlgorithm::Bzip2 => compress_bzip2(input, level),
        CompressionAlgorithm::Zstd => compress_zstd(input, level),
        CompressionAlgorithm::ZstdMagicless => compress_zstd_magicless(input, level),
        CompressionAlgorithm::Lz4 => compress_lz4(input),
        CompressionAlgorithm::Lzo => compress_lzo(input),
        CompressionAlgorithm::Lzma => compress_lzma(input, level),
        CompressionAlgorithm::Snappy => compress_snappy(input),
    }
}

fn decompress(algorithm: CompressionAlgorithm, input: &[u8], expected_size: usize) -> Result<Vec<u8>, String> {
    match algorithm {
        CompressionAlgorithm::Deflate => decompress_deflate(input),
        CompressionAlgorithm::Zlib => decompress_zlib(input),
        CompressionAlgorithm::Gzip => decompress_gzip(input),
        CompressionAlgorithm::Brotli => decompress_brotli(input),
        CompressionAlgorithm::Bzip2 => decompress_bzip2(input, expected_size),
        CompressionAlgorithm::Zstd => decompress_zstd(input),
        CompressionAlgorithm::ZstdMagicless => decompress_zstd_magicless(input),
        CompressionAlgorithm::Lz4 => decompress_lz4(input),
        CompressionAlgorithm::Lzo => decompress_lzo(input, expected_size),
        CompressionAlgorithm::Lzma => decompress_lzma(input, expected_size),
        CompressionAlgorithm::Snappy => decompress_snappy(input),
    }
}

fn compress_deflate(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::new(level.min(9)));
    encoder
        .write_all(input)
        .map_err(|err| format!("Deflate compression failed: {err}"))?;
    encoder
        .finish()
        .map_err(|err| format!("Deflate finalize failed: {err}"))
}

fn decompress_deflate(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = DeflateDecoder::new(input);
    let mut restored = Vec::new();
    decoder
        .read_to_end(&mut restored)
        .map_err(|err| format!("Deflate decompression failed: {err}"))?;
    Ok(restored)
}

fn compress_zlib(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::new(level.min(9)));
    encoder
        .write_all(input)
        .map_err(|err| format!("Zlib compression failed: {err}"))?;
    encoder
        .finish()
        .map_err(|err| format!("Zlib finalize failed: {err}"))
}

fn decompress_zlib(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = ZlibDecoder::new(input);
    let mut restored = Vec::new();
    decoder
        .read_to_end(&mut restored)
        .map_err(|err| format!("Zlib decompression failed: {err}"))?;
    Ok(restored)
}

fn compress_gzip(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::new(level.min(9)));
    encoder
        .write_all(input)
        .map_err(|err| format!("Gzip compression failed: {err}"))?;
    encoder
        .finish()
        .map_err(|err| format!("Gzip finalize failed: {err}"))
}

fn decompress_gzip(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = GzDecoder::new(input);
    let mut restored = Vec::new();
    decoder
        .read_to_end(&mut restored)
        .map_err(|err| format!("Gzip decompression failed: {err}"))?;
    Ok(restored)
}

fn compress_brotli(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let quality = level.min(11);
    let mut compressed = Vec::new();
    {
        let mut writer = brotli::CompressorWriter::new(&mut compressed, 4096, quality, 22);
        writer
            .write_all(input)
            .map_err(|err| format!("Brotli compression failed: {err}"))?;
    }
    Ok(compressed)
}

fn decompress_brotli(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut decompressor = brotli::Decompressor::new(input, 4096);
    let mut restored = Vec::new();
    decompressor
        .read_to_end(&mut restored)
        .map_err(|err| format!("Brotli decompression failed: {err}"))?;
    Ok(restored)
}

fn compress_zstd(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let clamped_level = level.clamp(1, 22) as i32;
    zstd::stream::encode_all(input, clamped_level)
        .map_err(|err| format!("Zstd compression failed: {err}"))
}

fn decompress_zstd(input: &[u8]) -> Result<Vec<u8>, String> {
    zstd::stream::decode_all(input).map_err(|err| format!("Zstd decompression failed: {err}"))
}

fn compress_zstd_magicless(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let clamped_level = level.clamp(1, 22) as i32;
    let mut encoder = ZstdRawEncoder::new(clamped_level)
        .map_err(|err| format!("Zstd (magicless) encoder init failed: {err}"))?;
    encoder
        .set_parameter(ZstdRawCParameter::Format(ZstdFrameFormat::Magicless))
        .map_err(|err| format!("Zstd (magicless) parameter setup failed: {err}"))?;

    run_zstd_magicless_encode(&mut encoder, input)
}

fn run_zstd_magicless_encode(
    encoder: &mut ZstdRawEncoder<'_>,
    input: &[u8],
) -> Result<Vec<u8>, String> {
    const BUFFER_SIZE: usize = 16 * 1024;
    let mut output = Vec::new();
    let mut source = ZstdRawInBuffer::around(input);
    let mut buffer = [0_u8; BUFFER_SIZE];

    while source.pos() < input.len() {
        let source_pos_before = source.pos();
        let mut destination = ZstdRawOutBuffer::around(&mut buffer[..]);
        encoder
            .run(&mut source, &mut destination)
            .map_err(|err| format!("Zstd (magicless) compression failed: {err}"))?;

        let written = destination.as_slice();
        output.extend_from_slice(written);
        if source.pos() == source_pos_before && written.is_empty() {
            return Err(String::from(
                "Zstd (magicless) compression stalled before consuming input",
            ));
        }
    }

    loop {
        let mut destination = ZstdRawOutBuffer::around(&mut buffer[..]);
        let remaining = encoder
            .finish(&mut destination, true)
            .map_err(|err| format!("Zstd (magicless) finalize failed: {err}"))?;
        let written = destination.as_slice();
        output.extend_from_slice(written);

        if remaining == 0 {
            break;
        }
        if written.is_empty() {
            return Err(String::from("Zstd (magicless) finalize stalled"));
        }
    }

    Ok(output)
}

fn decompress_zstd_magicless(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = ZstdRawDecoder::new()
        .map_err(|err| format!("Zstd (magicless) decoder init failed: {err}"))?;
    decoder
        .set_parameter(ZstdRawDParameter::Format(ZstdFrameFormat::Magicless))
        .map_err(|err| format!("Zstd (magicless) parameter setup failed: {err}"))?;

    run_zstd_magicless_decode(&mut decoder, input)
}

fn run_zstd_magicless_decode(
    decoder: &mut ZstdRawDecoder<'_>,
    input: &[u8],
) -> Result<Vec<u8>, String> {
    const BUFFER_SIZE: usize = 16 * 1024;
    let mut output = Vec::new();
    let mut source = ZstdRawInBuffer::around(input);
    let mut buffer = [0_u8; BUFFER_SIZE];

    loop {
        let source_pos_before = source.pos();
        let mut destination = ZstdRawOutBuffer::around(&mut buffer[..]);
        let remaining = decoder
            .run(&mut source, &mut destination)
            .map_err(|err| format!("Zstd (magicless) decompression failed: {err}"))?;
        let written = destination.as_slice();
        output.extend_from_slice(written);

        if remaining == 0 && source.pos() == input.len() {
            break;
        }
        if source.pos() == source_pos_before && written.is_empty() {
            return Err(String::from(
                "Zstd (magicless) decompression stalled before completing frame",
            ));
        }
        if source.pos() == input.len() && written.is_empty() && remaining > 0 {
            return Err(String::from(
                "Zstd (magicless) decompression ended with incomplete frame",
            ));
        }
    }

    Ok(output)
}

fn compress_bzip2(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let source_len = to_c_uint(input.len(), "BZip2 source length exceeds c_uint")?;
    let block_size = level.clamp(1, 9) as c_int;
    let mut output_capacity = estimate_bzip2_output_capacity(input.len())?;
    let mut output = vec![0_u8; output_capacity];

    loop {
        let mut dest_len = to_c_uint(output.len(), "BZip2 destination length exceeds c_uint")?;
        let result = unsafe {
            BZ2_bzBuffToBuffCompress(
                output.as_mut_ptr() as *mut c_char,
                &mut dest_len as *mut c_uint,
                input.as_ptr() as *mut c_char,
                source_len,
                block_size,
                0,
                30,
            )
        };

        if result == BZ_OK {
            output.truncate(dest_len as usize);
            return Ok(output);
        }

        if result == BZ_OUTBUFF_FULL {
            output_capacity = output_capacity
                .checked_mul(2)
                .ok_or_else(|| String::from("BZip2 compression output capacity overflow"))?;
            output.resize(output_capacity, 0);
            continue;
        }

        return Err(format!("BZip2 compression failed with error code: {result}"));
    }
}

fn decompress_bzip2(input: &[u8], expected_size: usize) -> Result<Vec<u8>, String> {
    let source_len = to_c_uint(input.len(), "BZip2 source length exceeds c_uint")?;
    let initial_capacity = expected_size.max(1);
    let mut output_capacity = initial_capacity;
    let mut output = vec![0_u8; output_capacity];

    loop {
        let mut dest_len = to_c_uint(output.len(), "BZip2 destination length exceeds c_uint")?;
        let result = unsafe {
            BZ2_bzBuffToBuffDecompress(
                output.as_mut_ptr() as *mut c_char,
                &mut dest_len as *mut c_uint,
                input.as_ptr() as *mut c_char,
                source_len,
                0,
                0,
            )
        };

        if result == BZ_OK {
            output.truncate(dest_len as usize);
            return Ok(output);
        }

        if result == BZ_OUTBUFF_FULL {
            output_capacity = output_capacity
                .checked_mul(2)
                .ok_or_else(|| String::from("BZip2 decompression output capacity overflow"))?;
            output.resize(output_capacity, 0);
            continue;
        }

        return Err(format!("BZip2 decompression failed with error code: {result}"));
    }
}

fn compress_lzma(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let preset = level.min(9);
    let output_bound = unsafe { lzma_stream_buffer_bound(input.len()) };
    let mut compressed = vec![0_u8; output_bound.max(1)];
    let mut output_position = 0usize;
    let result = unsafe {
        lzma_easy_buffer_encode(
            preset,
            LZMA_CHECK_CRC64,
            std::ptr::null(),
            input.as_ptr(),
            input.len(),
            compressed.as_mut_ptr(),
            &mut output_position,
            compressed.len(),
        )
    };

    if result != LZMA_OK {
        return Err(format!(
            "XZ compression failed: {} ({result})",
            lzma_error_name(result)
        ));
    }

    compressed.truncate(output_position);
    Ok(compressed)
}

fn decompress_lzma(input: &[u8], expected_size: usize) -> Result<Vec<u8>, String> {
    let mut output_capacity = expected_size.max(1);
    let mut restored = vec![0_u8; output_capacity];

    loop {
        let mut memory_limit = u64::MAX;
        let mut input_position = 0usize;
        let mut output_position = 0usize;

        let result = unsafe {
            lzma_stream_buffer_decode(
                &mut memory_limit,
                LZMA_CONCATENATED,
                std::ptr::null(),
                input.as_ptr(),
                &mut input_position,
                input.len(),
                restored.as_mut_ptr(),
                &mut output_position,
                restored.len(),
            )
        };

        if result == LZMA_OK {
            if input_position != input.len() {
                return Err(String::from(
                    "XZ decompression failed: input stream was not fully consumed",
                ));
            }

            restored.truncate(output_position);
            return Ok(restored);
        }

        if result == LZMA_BUF_ERROR {
            output_capacity = output_capacity
                .checked_mul(2)
                .ok_or_else(|| String::from("XZ decompression output capacity overflow"))?;
            restored.resize(output_capacity, 0);
            continue;
        }

        return Err(format!(
            "XZ decompression failed: {} ({result})",
            lzma_error_name(result)
        ));
    }
}

fn compress_lz4(input: &[u8]) -> Result<Vec<u8>, String> {
    Ok(lz4_flex::compress_prepend_size(input))
}

fn decompress_lz4(input: &[u8]) -> Result<Vec<u8>, String> {
    lz4_flex::decompress_size_prepended(input)
        .map_err(|err| format!("LZ4 decompression failed: {err}"))
}

fn compress_lzo(input: &[u8]) -> Result<Vec<u8>, String> {
    if input.is_empty() {
        // lzokay-native emits no bytes for empty input; LZO requires an end marker.
        return Ok(vec![0x11, 0x00, 0x00]);
    }
    lzokay_native::compress(input).map_err(|err| format!("LZO compression failed: {err}"))
}

fn decompress_lzo(input: &[u8], expected_size: usize) -> Result<Vec<u8>, String> {
    lzokay_native::decompress_all(input, Some(expected_size))
        .map_err(|err| format!("LZO decompression failed: {err}"))
}

fn compress_snappy(input: &[u8]) -> Result<Vec<u8>, String> {
    snap::raw::Encoder::new()
        .compress_vec(input)
        .map_err(|err| format!("Snappy compression failed: {err}"))
}

fn decompress_snappy(input: &[u8]) -> Result<Vec<u8>, String> {
    snap::raw::Decoder::new()
        .decompress_vec(input)
        .map_err(|err| format!("Snappy decompression failed: {err}"))
}

fn lzma_error_name(code: lzma_ret) -> &'static str {
    match code {
        LZMA_MEM_ERROR => "memory error",
        LZMA_FORMAT_ERROR => "format error",
        LZMA_OPTIONS_ERROR => "options error",
        LZMA_DATA_ERROR => "data error",
        LZMA_BUF_ERROR => "output buffer too small",
        _ => "unknown error",
    }
}

fn estimate_bzip2_output_capacity(input_len: usize) -> Result<usize, String> {
    let one_percent = input_len
        .checked_div(100)
        .ok_or_else(|| String::from("Failed to compute BZip2 output estimate"))?;
    input_len
        .checked_add(one_percent)
        .and_then(|value| value.checked_add(600))
        .ok_or_else(|| String::from("BZip2 output estimate overflow"))
}

fn to_c_uint(value: usize, context: &str) -> Result<c_uint, String> {
    if value > c_uint::MAX as usize {
        return Err(String::from(context));
    }
    Ok(value as c_uint)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brotli_round_trips_at_all_quality_levels() {
        let input = b"Brotli round trip: repeated text. ".repeat(128);
        for quality in 0..=11 {
            let compressed = compress_brotli(&input, quality).unwrap();
            assert_eq!(decompress_brotli(&compressed).unwrap(), input);
        }
    }

    #[test]
    fn lzo_round_trips_empty_short_and_repeated_inputs() {
        for input in [vec![], vec![0], b"hello".to_vec(), vec![0; 65_536]] {
            let compressed = compress_lzo(&input).unwrap();
            let restored = decompress_lzo(&compressed, input.len())
                .unwrap_or_else(|error| panic!("{}-byte input ({compressed:?}): {error}", input.len()));
            assert_eq!(restored, input);
        }
    }
}
