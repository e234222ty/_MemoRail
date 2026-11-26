# MemoRail morphological analysis components

- The supplied morphological_analysis.py is preserved verbatim. Only its sample text assignment is parameterized when compiling its Python AST.
- Pyodide 0.27.7 (CPython/WebAssembly), https://github.com/pyodide/pyodide/tree/0.27.7 . Unmodified runtime assets. See licenses/Pyodide-LICENSE.txt and licenses/Python-LICENSE.txt.
- Sudachi WASM wrapper: https://github.com/f3liz-casa/sudachi-wasm , commit e26175377378f20d8e4449f9ff0ab87a0b94e78d, Apache-2.0.
- Sudachi.rs fork: https://github.com/nyanrus/sudachi.rs , commit 42a5f2debb9785794eac9cd5eb0b730a47be0f97. Original Sudachi copyright Works Applications Co., Ltd. See licenses/Apache-2.0.txt.
- rsmarisa: https://github.com/nyanrus/rsmarisa , commit 5b62583fecc37c1212fea79a963f33bbd88d8b57, BSD-2-Clause. Copyright 2026 rust-marisa contributors and 2010–2025 Susumu Yata. See licenses/rsmarisa-LICENSE.txt.
- Full Sudachi dictionary 20260428, https://github.com/WorksApplications/SudachiDict . Converted to MARISA/zstd storage without dropping vocabulary, POS or costs. The optional reverse-reading index is omitted; it is only for kana/kanji reverse lookup, not morphological analysis. See licenses/SudachiDict-LEGAL.txt and licenses/SudachiDict-LICENSE.txt.
- Browser adapter python-bridge.py provides the SudachiPy API subset used by the supplied script and delegates tokenization to the real Sudachi analysis engine. It does not replace noun extraction with Intl.Segmenter or a heuristic.
- Native parity baseline: SudachiPy 0.6.11 and SudachiDict-full 20260428.

Local performance modification: connection matrix row stripes are retained after decompression, bounded to one matrix. This does not change vocabulary, costs or tokenization rules. The complete source patch is scripts/sudachi-matrix-cache.patch. Apply that patch inside the pinned sudachi.rs submodule before rebuilding.

Rebuild the WASM wrapper from the pinned repositories using their Cargo.lock:
`cargo build --release --lib --target wasm32-unknown-unknown --locked`, then
wasm-bindgen 0.2.114 with `--target web`. Run its dic_converter on the full
system.dic, then scripts/package-morphology-dictionary.py. The converter reports
30328790 bytes for this build's optional reading index. Dictionary chunks are
gzip-compressed, 4 MiB before compression, and verified against a SHA-256 manifest.
The original Python extraction code executes inside the site's local Worker.
