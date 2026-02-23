import Anthropic from "@anthropic-ai/sdk";

// ── System prompt (獣医師監修 v2.1) ────────────────────────────────────────
const SYSTEM_PROMPT = `あなたは日本の小動物臨床に精通した獣医師アシスタントです。
以下の診察音声トランスクリプトをSOAP形式に変換してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【分類ルール — 厳守してください】

■ 除外する情報（SOAPに一切含めないこと）
  - 挨拶・天気・世間話などの社交的発言
  - 料金・会計・次回予約調整の会話
  - 獣医師・スタッフの業務連絡（「〇〇持ってきて」等）

■ S（Subjective / 稟告）
  - 飼い主が「事実として述べた」主訴・経過のみ
  - 飼い主の推測・感想（「気がする」「かもしれない」）は除外した発言として列挙
  - 獣医師の誘導質問への「はい/いいえ」のみの回答は除外
  - 飼い主の言葉は「削痩の稟告あり」「右後肢跛行の稟告あり」など獣医用語に変換すること

■ O（Objective / 客観所見）
  - 獣医師・看護師が実際に測定・観察・触診した数値と所見のみ
  - 数値は単位を必ず付記（例: BW 4.2kg, BT 38.9℃）
  - 飼い主報告の体重推移 → Sへ

■ A（Assessment / 評価）
  - 主診断名を筆頭に記載
  - 鑑別疾患は「疾患名・根拠・優先度(high/mid/low)」で列挙
  - 臨床推定（脱水度、疼痛スコア等）もここに記載

■ P（Plan / 計画）
  - 検査計画・処置投薬・飼い主指示・再診指示をカテゴリ別に記載
  - 薬剤は「内容・用量・経路」を明記
  - IC欄：飼い主への説明内容・同意の有無・飼い主の心理的背景
    （「もう歳だから仕方ない」等の発言も飼い主の心理状態として記録し、
     治療継続の動機づけが必要かを示す）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【獣医療用語の正規化】
  「やせてきた」         → 削痩の稟告あり
  「足をひきずる」       → 右後肢跛行の稟告あり（患肢・程度を明記）
  「水をよく飲む/尿が多い」→ 多飲多尿（PD/PU）の稟告あり
  削痩はO欄でBCSスコアと併記
  跛行はO欄で患肢・程度を明記
  粘膜色・CRTはO欄にセットで記載

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
    "IC": "",
    "再診": ""
  }
}`;

// ── 多頭分割ロジック ────────────────────────────────────────────────────────
// 以下のパターンで患者の区切りを検出する
const SPLIT_PATTERNS = [
  /次[、,\s　]*(?:の子は?|に?)?[、,\s　]*/i,
  /別の[、,\s　]*/i,
  /(?:は|が)?おしまい[。\s]*/i,
  /次の患者[、,\s　]*/i,
  /続いて[、,\s　]*/i,
];

function splitByPatient(transcript) {
  const lines = transcript.split("\n");
  const segments = [];
  let current = [];
  let splitFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isSplitLine = SPLIT_PATTERNS.some(p => p.test(trimmed));

    if (isSplitLine && current.length > 0) {
      segments.push(current.join("\n").trim());
      current = [];
      splitFound = true;
      // 区切り行自体を次のセグメントのヒントとして含める場合はここに追加
      // current.push(line); // 不要なら削除
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    segments.push(current.join("\n").trim());
  }

  // 分割が発生しなかった場合は全体を1つのセグメントとして扱う
  return splitFound ? segments.filter(s => s.length > 20) : [transcript];
}

// ── SOAP生成（1セグメント） ──────────────────────────────────────────────────
async function generateSoap(client, segmentText) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `以下の診察トランスクリプトをSOAP形式に変換してください：\n\n${segmentText}`,
    }],
  });

  const raw = message.content.map(b => b.text || "").join("");
  const jsonStr = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("JSONパースに失敗しました");
  }
}

// ── API handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
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

    // 多頭分割
    const segments = splitByPatient(transcript);

    // 各セグメントのSOAPを並列生成
    const results = await Promise.all(
      segments.map(async (seg) => {
        const soap = await generateSoap(client, seg);
        return { soap, transcript: seg };
      })
    );

    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
