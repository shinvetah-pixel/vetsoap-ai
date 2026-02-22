import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `あなたは日本の小動物臨床に精通した獣医師アシスタントです。
以下の診察音声トランスクリプトをSOAP形式に変換してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【分類ルール — 厳守してください】

■ S（Subjective / 稟告）に含めるもの：
  - 飼い主が「事実として述べた」主訴・経過のみ
  - 例: 「3日前から食欲が落ちた」「昨日2回吐いた」
  ✗ 含めないもの：
  - 飼い主の推測・感想（「気がする」「かもしれない」を含む発言）
  - 診察室での雑談・挨拶・世間話
  - 獣医師からの誘導質問への「はい/いいえ」のみの回答

■ O（Objective / 客観所見）に含めるもの：
  - 獣医師が実際に測定・観察・触診した数値と所見のみ
  ✗ 含めないもの：
  - 臨床推定値（「約○%の脱水」→ Aへ）
  - 飼い主報告の体重推移（→ Sへ）

■ A（Assessment / 評価）に含めるもの：
  - 主診断名（最も可能性が高いもの）を筆頭に記載
  - 鑑別疾患は「Rule-out: ○○」形式でリストアップ
  - 臨床推定（脱水度、疼痛スコアなど）もここに記載

■ P（Plan / 計画）に含めるもの：
  - 検査計画（実施する検査とその目的）
  - 処置・投薬（薬剤名・用量・投与経路を明記）
  - 飼い主への指示・説明事項
  - 再診・経過観察の指示

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【獣医療用語の正規化ルール】

  稟告（ひんこく）→ S欄の冒頭に「稟告:」として記載
  削痩（さくそう）→ O欄「体型評価」としてBCSスコアと併記
  跛行（はこう）  → O欄「歩様検査:」として患肢・程度を明記
  粘膜色・CRT    → O欄にセットで記載
  pd/pu（多飲多尿）→ Sに分類しつつO欄で尿比重と紐付け

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力形式】

必ず以下のJSON形式のみで出力してください。説明文・前置き・マークダウン記号は一切不要です。

{
  "patient": {
    "推定動物種": "",
    "推定品種": "",
    "推定年齢": "",
    "名前": ""
  },
  "S": {
    "主訴": "",
    "稟告詳細": [""],
    "除外した発言": [""]
  },
  "O": {
    "バイタル": { "体温": "", "心拍数": "", "呼吸数": "", "体重": "" },
    "身体検査": [""],
    "実施検査結果": [""]
  },
  "A": {
    "主診断": "",
    "鑑別疾患": [{ "疾患名": "", "根拠": "", "優先度": "high" }],
    "臨床推定": [""]
  },
  "P": {
    "検査計画": [""],
    "処置・投薬": [{ "内容": "", "用量": "", "経路": "" }],
    "飼い主指示": [""],
    "再診": ""
  }
}`;

export async function POST(request) {
  // APIキーの確認
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。Vercelの環境変数を確認してください。" },
      { status: 500 }
    );
  }

  let transcript;
  try {
    const body = await request.json();
    transcript = body.transcript;
    if (!transcript?.trim()) throw new Error("トランスクリプトが空です");
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下の診察トランスクリプトをSOAP形式に変換してください：\n\n${transcript}`,
        },
      ],
    });

    const raw = message.content.map((b) => b.text || "").join("");
    const jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let soap;
    try {
      soap = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        soap = JSON.parse(match[0]);
      } else {
        throw new Error("JSONパースに失敗しました");
      }
    }

    return Response.json({ soap });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
