### 1. 汎用可逆圧縮アルゴリズム（処理速度と圧縮率のトレードオフ）

リーダーボードとして比較する際、最も直接的な比較対象となるグループです。
- **LZ4**: 圧縮速度と展開速度が極めて速い（特に展開速度）。圧縮率は低めですが、リアルタイム通信やインメモリデータベースでの利用指標として不可欠です。
- **Snappy**: Googleが開発した高速な圧縮アルゴリズム。LZ4と同様に速度を重視しており、ビッグデータ基盤（Hadoop, Sparkなど）で広く利用されています。
- **gzip (DEFLATE)**: 実質的なWebやシステムの標準。`deflate` アルゴリズムにヘッダとチェックサムを付与したフォーマットです。ベースラインとして比較に用いるべきです。
- **bzip2**: ブロックソート（Burrows-Wheeler変換）を用いるアルゴリズム。gzipよりも高い圧縮率を誇りますが、処理速度は遅いです。
- **xz (LZMA2)**: `lzma` の後継。非常に高い圧縮率を実現しますが、圧縮時の計算コストとメモリ消費量が大きいです。配布用パッケージの圧縮などに適しています。
### 2. エンコーディング（バイナリテキスト化）

`deflate+b64` のように、圧縮後のバイナリデータをテキストベースのプロトコル（HTTPヘッダ、JSON内部など）に乗せるための変換手法です。エンコーディング単体ではサイズは増加します。
- **Base64**: サイズが約33%増加します（6bitを8bit文字で表現）。
- **Base85 (Ascii85)**: サイズが約25%の増加に留まり、Base64よりも効率的です。GitのバイナリパッチやPDFの内部などで使用されています。比較対象として `deflate+base85` などを設けると技術的な深みが出ます。
### 3. API設計におけるリーダーボードの評価指標

圧縮フォーマットをフラットに比較・評価するためには、圧縮率だけでなく以下のメトリクスをAPIのレスポンスに含める必要があります。

- **Compressed Size**: 圧縮後のバイト数
- **Ratio**: 圧縮率（Compressed Size / Original Size）
- **Compression Time**: 圧縮に要した時間（ミリ秒/マイクロ秒）
- **Decompression Time**: 展開に要した時間（ミリ秒/マイクロ秒）
- **Throughput**: 1秒あたりの処理バイト数（MB/s）

特に `zstd` や `brotli` は、圧縮レベル（例: zstdのレベル1〜22）によって時間とサイズのトレードオフが劇的に変化するため、APIのパラメータとして `level` を指定できる設計にし、同一アルゴリズム内でのレベル別の比較を可能にすると、リーダーボードとしての価値が向上します。

提案された2ペイン型のUIレイアウトは、入力から結果の分析までを単一画面で完結させるSPA（Single Page Application）として合理的な構造です。

フロントエンドで複数の圧縮アルゴリズムを同期的に実行すると、処理時間の長いアルゴリズム（LZMAや高レベルのZstdなど）がブラウザのメインスレッドをブロックし、UIがフリーズする問題が発生します。設計の前提として、**圧縮処理はすべてWeb Workerへ委譲する非同期アーキテクチャ**を採用する必要があります。

以下にUIの詳細設計と、ブラウザ環境（JavaScript/WebAssembly）で利用可能な関連ライブラリを整理します。

### 1. UIレイアウトと機能要件の詳細

#### 左ペイン：入力・設定モジュール

入力ソースの定義と、比較条件の構築を行います。

- **入力エリア (Input Source)**
    - トグルによる「テキスト入力 (Textarea)」と「ファイルアップロード (File Input)」の排他選択。        
    - 現在の入力サイズ（Original Size）をリアルタイムで表示するラベル。
- アルゴリズム選択リスト (Presets)**
    - ドロップダウン等で一括設定を提供。
    - チェックボックスによる複数選択。
	    - デフォルトでいくつかのプリセットを用意しておく(gzip low, gzip highなど)
    - `+` ボタン（またはアコーディオン型のトグル）：クリック時に対象アルゴリズム固有のパラメータ（Compression Level, Window Size, Dictionaryなど）をインラインで展開し数値入力で調整可能にする。
		- **エンコーディング/フォーマット修飾 (Pipeline / Modifiers)**
		    - アルゴリズムとは別に、パイプラインの後処理として適用するオプション。
		    - 例: `Base64` などのトグルスイッチ。
- **実行コントロール (Execution)**
    - 「実行 (Run)」ボタン。        
    - 処理中はボタンをローディング状態（無効化）にし、処理を中断するための「キャンセル」ボタンへ切り替える機能が推奨されます。
        

#### 右ペイン：結果出力・分析モジュール

視覚的な比較と、詳細な数値データの確認を提供します。

- **グラフ領域 (Chart Area)**
    - **X軸**: 選択されたアルゴリズム（およびパラメータのバリエーション）。
    - **Y軸**: 動的に切り替え可能。
    - **メトリクス選択セレクタ**: グラフ上部に配置し、以下の項目を切り替える。
        - `Compression Ratio` (棒グラフ: 低いほど優秀)
        - `Compression Time` 
        - `Throughput (MB/s)
- **データテーブル (Data Grid)**
    - グラフの下部に配置。ソート機能を備えたテーブル。
    - **カラム構成**: `Algorithm`, `Level/Params`, `Original Size`, `Compressed Size`, `Ratio`, `Encode Time`, `Throughput`。
    - 各行に「バイナリダウンロード」または「Base64出力コピー」のユーティリティボタンを配置。

## 4. 技術スタック制約

- **フレームワーク**: React (Single File Component)
	- コンポーネントを分割すること
- **スタイリング**: Tailwind CSS, DaisyUI
- **状態管理**: `useState`, `useEffect`, `useRef`
- **外部ライブラリ**:  Lucide-React 
- **グラフライブラリ**: **Recharts**
- 圧縮機構: Rust + WebWorker + coi-serviceworker

### 圧縮
### 1. Rustクレート（ライブラリ）の選定

WASM (`wasm32-unknown-unknown` ターゲット) にコンパイルするためには、C言語の依存を持たない**ピュアRust実装**のクレートを選択することがビルドの安定性において最も重要です。Cバインディングを含むクレート（標準の `zstd` など）は、WASM向けのCコンパイラチェーン（clang/LLVM）の設定が必要になり、ビルドが複雑化します。

- **Gzip / Deflate**: `flate2`
    - `Cargo.toml` で `features = ["rust_backend"]` を指定し、Cライブラリ（miniz）への依存を排除します。        
- **Brotli**: `brotli`
    - ピュアRust実装が存在し、WASMへ問題なくコンパイル可能です。
- **LZ4**: `lz4_flex`
    - 非常に高速なピュアRust実装です。
- **LZMA / XZ**: `lzma-rs`
    - ピュアRust実装。圧縮・展開の両方をサポートします。
- **Snappy**: `snap`
    - ピュアRust実装。
- **Zstd**: `zstd` (注意が必要)
    - Zstdは公式のC実装が非常に強力であり、ピュアRustの完全な実装（特にエンコーダ）は発展途上です。標準の `zstd` クレートを利用する場合、WASMビルド時にCコードもWASMにクロスコンパイルされるよう環境構築（`CC=clang` など）を整える必要があります。
- **エンコーディング**: `base64`, `hex`
### 2. Rust側（wasm-bindgen）のAPI設計

WASMの境界（JSとRustの間）を越えるデータのやり取りはオーバーヘッドになるため、APIは「入力バイト列」を受け取り、「圧縮結果のバイト列」と「メタデータ（処理時間など）」を含む構造体を一度に返す設計にします。

Rust

```
// src/lib.rs
use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;
use web_sys::Performance;

#[wasm_bindgen]
pub enum CompressionAlgorithm {
    Deflate,
    Gzip,
    Brotli,
    Lz4,
    Zstd,
    Lzma,
}

#[wasm_bindgen]
pub struct CompressionResult {
    output: Vec<u8>,
    duration_ms: f64,
    ratio: f64,
}

#[wasm_bindgen]
impl CompressionResult {
    #[wasm_bindgen(getter)]
    pub fn output(&self) -> Uint8Array {
        Uint8Array::from(self.output.as_slice())
    }
    
    #[wasm_bindgen(getter)]
    pub fn duration_ms(&self) -> f64 { self.duration_ms }
    
    #[wasm_bindgen(getter)]
    pub fn ratio(&self) -> f64 { self.ratio }
}

#[wasm_bindgen]
pub fn run_compression(
    algorithm: CompressionAlgorithm,
    input: &[u8],
    level: u32,
) -> Result<CompressionResult, JsValue> {
    let window = web_sys::window().expect("should have a window in this context");
    let performance = window.performance().expect("performance should be available");
    
    let start = performance.now();
    
    // ここで各アルゴリズムへのディスパッチと圧縮処理を実行
    let output_data = match algorithm {
        CompressionAlgorithm::Deflate => compress_deflate(input, level),
        // ... 他のアルゴリズム
    };

    let end = performance.now();
    
    Ok(CompressionResult {
        ratio: output_data.len() as f64 / input.len() as f64,
        output: output_data,
        duration_ms: end - start,
    })
}
```

_注: WASM環境（特にWeb Worker内）では標準の `std::time::Instant` が機能しないため、`web_sys::Performance` (`performance.now()`) を使用して計測します。_

### 3. フロントエンドの実行アーキテクチャ

単一のWASMバイナリにまとめた場合でも、「メインスレッドのブロック」という問題は残ります。巨大なファイルの圧縮や、重いアルゴリズム（LZMAなど）を実行するとUIがフリーズするため、**Web Worker内でWASMをロードし、実行する**構成が必須です。

#### Web Workerの処理フロー

1. **メインスレッド (UI)**: ユーザーが「実行」をクリックすると、選択されたアルゴリズムのリストと元データ（`ArrayBuffer`）をWeb Workerへ `postMessage` で送信する。
2. **Workerスレッド**:
    - 初期化時に `wasm-pack` で生成された `.js` ラッパーをインポートし、`.wasm` ファイルをロード・インスタンス化しておく。
    - メッセージを受信すると、Rustの `run_compression` 関数を呼び出す。        
    - 処理が完了するごとに、進捗（Progress）や完了したアルゴリズムの `CompressionResult` をメインスレッドへ `postMessage` で返却する。
        
3. **メインスレッド (UI)**: Workerからのメッセージを受信し、右ペインのグラフやテーブルを動的に更新する。
### 4. 開発ツールチェーン
- **wasm-pack**: RustコードをWASMにコンパイルし、JSから呼び出しやすいラッパーコード（ES Modules互換）を自動生成する標準ツールです。
- **Vite / Webpack**: `vite-plugin-wasm` などのプラグインを使用することで、Web Worker内でのWASMのロードや、フロントエンドのビルドプロセスへの統合が容易になります。

この設計により、JS側は純粋なUIレンダリングとWorkerとの通信処理のみを担保し、複雑な状態管理や計算リソースをRust-WASMに完全にカプセル化させることができます。