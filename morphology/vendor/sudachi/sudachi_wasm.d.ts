/* tslint:disable */
/* eslint-disable */

/**
 * A Sudachi tokenizer that holds a loaded dictionary.
 *
 * Construct with `new Tokenizer(dictBytes)` where `dictBytes` is a `Uint8Array`
 * containing the raw bytes of a Sudachi system dictionary (`.dic` file).
 */
export class Tokenizer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Perform POS-aware Kana-Kanji Conversion on hiragana text.
     *
     * The dictionary's main trie is reading-keyed (hiragana), so the Viterbi
     * lattice search directly considers kanji candidates during segmentation
     * and path selection. Each morpheme's word_info surface is the kanji form
     * chosen by the language model (connection costs + word costs).
     *
     * Functional POS (助詞, 助動詞, etc.) naturally remain in hiragana because
     * their word_info surfaces are hiragana.
     *
     * @param text  - Hiragana input text to convert.
     * @param mode  - Split mode: `"A"`, `"B"`, or `"C"` (default).
     * @returns     Array of `{ kkcSurface, originalSurface, readingForm,
     *              dictionaryForm, normalizedForm, partOfSpeech, isOov,
     *              candidates, begin, end }` objects.
     *
     * ```js
     * const result = tokenizer.kkc_convert("きょうはいいてんきですね。", "C");
     * const converted = result.map(m => m.kkcSurface).join("");
     * // → "今日はいい天気ですね。"
     * ```
     */
    kkc_convert(text: string, mode: string): any;
    /**
     * Look up all dictionary entries whose reading matches `hiragana` and return
     * them as a ranked list of KKC candidates.
     *
     * This is the core of KKC (Kana-Kanji Conversion): given a hiragana reading,
     * enumerate every word in the dictionary that has that reading, then sort by
     * word cost so the most likely kanji surface appears first.
     *
     * @param hiragana - Hiragana reading to look up (e.g. `"あめ"`).
     * @returns Array of `{ surface, dictionaryForm, readingForm, partOfSpeech, cost }`
     *          sorted by cost ascending (lower = higher priority).
     *
     * ```js
     * const candidates = tokenizer.lookup_by_reading("あめ");
     * // → [{ surface: "雨", dictionaryForm: "雨", cost: 5432, … },
     * //    { surface: "飴", dictionaryForm: "飴", cost: 6789, … }, …]
     * ```
     */
    lookup_by_reading(hiragana: string): any;
    /**
     * Create a tokenizer from the raw bytes of a Sudachi system dictionary.
     *
     * ```js
     * const response = await fetch("system_core.dic");
     * const dictBytes = new Uint8Array(await response.arrayBuffer());
     * const tokenizer = new Tokenizer(dictBytes);
     * ```
     */
    constructor(dict_bytes: Uint8Array);
    /**
     * Tokenize Japanese text and return an array of morpheme objects.
     *
     * @param text  - Input Japanese text.
     * @param mode  - Split mode: `"A"` (short), `"B"` (middle), or `"C"` (default, named-entity).
     * @returns     Array of `{ surface, dictionaryForm, readingForm, normalizedForm,
     *              partOfSpeech, isOov, begin, end }` objects.
     *
     * ```js
     * const morphemes = tokenizer.tokenize("今日はいい天気ですね。", "C");
     * for (const m of morphemes) {
     *   console.log(m.surface, m.readingForm, m.partOfSpeech.join("-"));
     * }
     * ```
     */
    tokenize(text: string, mode: string): any;
}

/**
 * Install a panic hook that forwards Rust panics to `console.error` in JS.
 */
export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_tokenizer_free: (a: number, b: number) => void;
    readonly start: () => void;
    readonly tokenizer_kkc_convert: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly tokenizer_lookup_by_reading: (a: number, b: number, c: number) => [number, number, number];
    readonly tokenizer_new: (a: number, b: number) => [number, number, number];
    readonly tokenizer_tokenize: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
