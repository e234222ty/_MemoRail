"""
日本語文章に対して形態素解析を行うPythonプログラム。
竹葉さん用

2026/05/12 Tatsuro Kudo make this file.
"""

from sudachipy import dictionary
from sudachipy import tokenizer

# Sudachiの辞書のセットアップ（dictは"small","core","full"があり、fullのほうが最新のタレント名なども含むがデータが重い）
tokenizer_obj = dictionary.Dictionary(dict="full").create()
# sudachiの分割モードの設定（A→Cにいくほど長い文字数で１つの単語とみなす）
tokenize_mode = tokenizer.Tokenizer.SplitMode.C

# textに日本語文章入れる（形態素解析の対象）
text = """大学２年の夏休み、バックパックを背負って敢行した初めての一人旅が、私の学生時代を大きく変えました。言葉も通じない異国の地に身を置き、時刻表通りに来ない列車を待ちながら、それまで自分がどれほど恵まれた環境にいたかを痛感しました。現地で出会った旅人や親切な地元の人々との交流を通じて、多様な価値観に触れ、物事を広い視野で捉えられるようになりました。
トラブルに見舞われ、自力で解決する中で、精神的にもたくましく成長できたと感じています。ガイドブックには載っていない美しい夕日を異郷の地で一人眺めた時、湧き上がってきた不思議な高揚感と解放感は、今も私の心の原動力になっています。"""

# resultに対象の品詞のみが入る
result = []

## ------------------形態素解析------------------ ##
# まず文章を分割
tokens = tokenizer_obj.tokenize(text, tokenize_mode)
# 分割された形態素でループ
for t in tokens:
    # 現在処理中の形態素の品詞を取得
    pos = t.part_of_speech()
    # 必要な品詞だった場合のみ配列に加える（以下は名詞、の中でも固有名詞と普通名詞）
    if pos[0] in ["名詞"] and pos[1] in ["固有名詞","普通名詞","数詞"]:
        # 配列に追加
        result.append(t)
    else:
        continue

## 結果を表示
print(result)