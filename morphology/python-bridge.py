"""SudachiPy API subset for the supplied program, backed by real Sudachi WASM.

The supplied noun filtering code runs in CPython unchanged. This bridge only
adapts its native tokenizer calls for the browser, using the full dictionary.
"""
import ast
import contextlib
import io
import json
import sys
import types
import _memorail_native


class _Morpheme:
    def __init__(self, value):
        self.value = value

    def part_of_speech(self):
        return tuple(self.value["partOfSpeech"])

    def surface(self):
        return self.value["surface"]

    def begin(self):
        return self.value["begin"]

    def end(self):
        return self.value["end"]


class _Tokenizer:
    class SplitMode:
        A = "A"
        B = "B"
        C = "C"

    def tokenize(self, text, mode="C"):
        return [_Morpheme(value) for value in json.loads(_memorail_native.tokenizeJson(text, mode))]


class _Dictionary:
    def __init__(self, dict="full"):
        if dict != "full":
            raise ValueError("Only the supplied full dictionary is installed.")

    def create(self):
        return _Tokenizer()


_sudachipy = types.ModuleType("sudachipy")
_sudachipy.dictionary = types.SimpleNamespace(Dictionary=_Dictionary)
_sudachipy.tokenizer = types.SimpleNamespace(Tokenizer=_Tokenizer)
sys.modules["sudachipy"] = _sudachipy


def _memo_install(source):
    global _memo_code
    tree = ast.parse(source, filename="morphological_analysis.py")
    replacements = 0
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "text" for target in node.targets):
            node.value = ast.Name(id="_memo_input", ctx=ast.Load())
            replacements += 1
    if replacements != 1:
        raise ValueError("Expected exactly one sample input assignment.")
    _memo_code = compile(ast.fix_missing_locations(tree), "morphological_analysis.py", "exec")


def _memo_analyze_json(text):
    namespace = {"_memo_input": text}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(_memo_code, namespace)
    selected = {(token.begin(), token.end()) for token in namespace["result"]}
    output = []
    cursor = 0
    for token in namespace["tokens"]:
        start, end = token.begin(), token.end()
        if start < cursor or end <= start or end > len(text):
            raise ValueError("Invalid token offsets.")
        if start > cursor:
            output.append({"text": text[cursor:start], "word": False})
        output.append({"text": text[start:end], "word": (start, end) in selected})
        cursor = end
    if cursor < len(text):
        output.append({"text": text[cursor:], "word": False})
    if "".join(token["text"] for token in output) != text:
        raise ValueError("Tokenization must preserve the input.")
    return json.dumps(output, ensure_ascii=False)
