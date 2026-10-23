# Compression Leaderboard (React + Rust/WASM)

Single-page benchmark workbench for comparing compression presets with a two-pane UI:
- **Left pane**: run/cancel controls, input source, compact preset checklist, inline add form with Base64/Base85 modifiers
- **Right pane**: metric chart + sortable results table + binary download action

Compression runs execute in a **Web Worker**, while codecs run inside **Rust-compiled WASM**.

## Setup

Use Node.js 24.22.1 (see `.node-version`), or a patched supported release matching
`package.json`'s `engines.node` range. Older releases are rejected during installation.

```bash
pnpm install
```

The Rust toolchain (cargo) with `wasm-pack` must also be available locally, because
`pnpm dev` and `pnpm build` invoke it automatically. The build is verified with
`wasm-pack` 0.15.0. Install or update it with:

```bash
cargo install wasm-pack --version 0.15.0 --locked
```

### Brotli security

[CVE-2026-111497](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
affects the Google Brotli decoder bundled with Node.js. Fixed Node.js releases are
22.23.4, 24.22.1, and 26.12.1. Node.js 24.22.1 backports the fix, so its reported
Brotli version can still be 1.2.0.

The browser benchmark uses the separate [Rust Brotli implementation](https://github.com/dropbox/rust-brotli),
not Node.js's decoder. Its dependency is updated to 8.0.4 for upstream bug fixes.
`rust/Cargo.lock` records the resolved Rust dependencies for reproducible builds.

## Stack

- React + TypeScript + Vite
- Tailwind CSS + DaisyUI
- Recharts + Lucide React
- Rust (`wasm-bindgen`, `flate2`, `brotli`, `libbz2-rs-sys`, `liblzma-sys`, `zstd`, `lz4_flex`, `snap`)
- `coi-serviceworker` pattern for cross-origin isolation headers

## Implemented algorithm presets

- gzip (level 1, level 9)
- brotli (level 4)
- bzip2
- zstd
- lz4
- snappy
- deflate (level 6)
- xz (lzma2 backend)

## Supported metrics

- compressed size / ratio
- compression time
- decompression time
- encode time (Base64/Base85 modifiers)
- throughput (MB/s)

## Commands

```bash
pnpm dev           # build wasm (dev profile) + start Vite
pnpm build         # build wasm (release) + type-check + bundle
pnpm build:wasm    # generate wasm pkg in src/wasm/pkg (release)
pnpm build:wasm:dev
pnpm lint
pnpm test
pnpm preview
```

`pnpm test` builds the WASM package before running tests, including on a fresh checkout.

## Project layout

```text
rust/                         # Rust wasm-bindgen crate
src/wasm/pkg/                 # generated wasm-pack output
src/workers/compression.worker.ts
src/context/                  # workbench provider + hook + context contract
src/components/explorer/      # left pane controls
src/components/viewer/        # right pane chart + table
src/components/layout/        # app shell layout
src/types/                    # shared TS contracts
src/utils/                    # formatters, sorting, encoding, worker registration
public/coi-serviceworker.js
```
