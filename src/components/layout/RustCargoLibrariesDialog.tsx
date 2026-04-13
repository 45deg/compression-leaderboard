import { BookOpen, ExternalLink, X } from 'lucide-react'
import { useCallback, useRef } from 'react'

type RustCargoLibrary = {
  name: string
  version: string
  description: string
  docsUrl: string
}

const RUST_CARGO_LIBRARIES: RustCargoLibrary[] = [
  {
    name: 'brotli',
    version: '8.0.2',
    description: 'Brotli compression and decompression.',
    docsUrl: 'https://docs.rs/brotli',
  },
  {
    name: 'flate2',
    version: '1.1.9',
    description: 'Deflate, gzip, and zlib helpers.',
    docsUrl: 'https://docs.rs/flate2',
  },
  {
    name: 'libbz2-rs-sys',
    version: '0.2.2',
    description: 'BZip2 bindings for compression and decompression.',
    docsUrl: 'https://docs.rs/libbz2-rs-sys',
  },
  {
    name: 'liblzma-sys',
    version: '0.4.6',
    description: 'XZ / LZMA bindings for buffer encode and decode.',
    docsUrl: 'https://docs.rs/liblzma-sys',
  },
  {
    name: 'lz4_flex',
    version: '0.13.0',
    description: 'LZ4 compression and decompression utilities.',
    docsUrl: 'https://docs.rs/lz4_flex',
  },
  {
    name: 'lzokay-native',
    version: '0.1.0',
    description: 'LZO compression and decompression routines.',
    docsUrl: 'https://docs.rs/lzokay-native',
  },
  {
    name: 'snap',
    version: '1.1.1',
    description: 'Snappy compression and decompression helpers.',
    docsUrl: 'https://docs.rs/snap',
  },
  {
    name: 'zstd',
    version: '0.13.3',
    description: 'Zstandard compression and decompression support.',
    docsUrl: 'https://docs.rs/zstd',
  },
]

export function RustCargoLibrariesDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const handleOpen = useCallback(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  const handleClose = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  const libraryItems = RUST_CARGO_LIBRARIES.map((library) => (
    <li key={library.name} className="rounded-box border border-base-300 bg-base-200/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="link link-primary inline-flex items-center gap-1 font-medium break-all"
              href={library.docsUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span>{library.name}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="badge badge-outline">v{library.version}</span>
          </div>
          <p className="mt-1 text-sm text-base-content/70">{library.description}</p>
        </div>
      </div>
    </li>
  ))

  return (
    <>
      <button type="button" className="btn btn-sm btn-outline" onClick={handleOpen}>
        <BookOpen className="h-4 w-4" />
        Rust crates
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Rust cargo libraries</h2>
              <p className="mt-1 text-sm text-base-content/70">
                Compression crates used by the WebAssembly backend.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close dialog"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-4 space-y-2">{libraryItems}</ul>

          <div className="modal-action">
            <button type="button" className="btn btn-primary" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close dialog">close</button>
        </form>
      </dialog>
    </>
  )
}
