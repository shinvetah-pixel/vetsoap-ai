"use client";
import { useState, useRef } from "react";

// ── Sample transcript ──────────────────────────────────────────────────────
const SAMPLE = `[診察開始]
獣医師: こんにちは、今日はどうされましたか？
飼い主: あ、先生こんにちは。今日はムギのことで…最近ちょっと心配で。
獣医師: そうですか、どんな様子ですか？
飼い主: 3日前から急にご飯を食べなくなっちゃって。昨日は2回吐きました。
獣医師: 嘔吐の内容は？
飼い主: 最初は食べたものが出て、2回目は黄色い液体でした。
獣医師: 水は飲んでますか？
飼い主: 飲んでるんですけど、なんか少ない気がして…。いつもと違う気がするだけかもしれませんけど。
獣医師: 排便・排尿は？
飼い主: 昨日から便が出ていないです。おしっこはしてます。
獣医師: 元気はありますか？
飼い主: なんか以前より大人しいような…でもよく分からないです。あ、あと関係ないかもですけど先週引っ越したんですよ。
獣医師: それは少しストレスになってるかもしれませんね。では触診しますね。

[身体検査]
体温は39.1度。心拍数180。呼吸数28。
腹部を触ると右前腹部に軽度の抵抗感、疼痛反応あり。
皮膚ツルゴール低下を認める。口腔粘膜はやや乾燥、CRT2秒。
体重は4.2kg、前回から0.3kg減少。
聴診では心肺音に異常なし。リンパ節腫脹なし。

獣医師: 少し脱水気味ですね。腸の動きも少し弱いです。
飼い主: 大丈夫ですか？重大な病気じゃないですよね？
獣医師: まず検査してみましょう。X線と血液検査をとります。
[診察終了]`;

// ── Color config ──────────────────────────────────────────────────────────
const C = {
  S: { accent:"#34d399", bg:"rgba(52,211,153,0.07)", border:"rgba(52,211,153,0.2)", label:"S — Subjective（稟告）", icon:"💬" },
  O: { accent:"#60a5fa", bg:"rgba(96,165,250,0.07)", border:"rgba(96,165,250,0.2)", label:"O — Objective（客観所見）", icon:"🔬" },
  A: { accent:"#fbbf24", bg:"rgba(251,191,36,0.07)",  border:"rgba(251,191,36,0.2)",  label:"A — Assessment（評価）", icon:"📋" },
  P: { accent:"#c084fc", bg:"rgba(192,132,252,0.07)", border:"rgba(192,132,252,0.2)", label:"P — Plan（治療計画）", icon:"💊" },
};

// ── Small UI helpers ──────────────────────────────────────────────────────
function Pill({ text, accent }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 14px",
      borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ width:5, height:5, borderRadius:"50%", background:accent, marginTop:6, flexShrink:0 }} />
      <span style={{ fontSize:13, color:"#ccd6e8", lineHeight:1.6 }}>{text}</span>
    </div>
  );
}
function Tag({ children, color }) {
  return (
    <span style={{ fontSize:10, fontFamily:"monospace", padding:"2px 8px", borderRadius:999,
      background:`${color}22`, border:`1px solid ${color}44`, color, fontWeight:700, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}
function CardShell({ c, children }) {
  return (
    <div style={{ border:`1px solid ${c.border}`, borderRadius:16, background:c.bg,
      padding:18, display:"flex", flexDirection:"column", gap:12, animation:"fadeUp .45s both" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8,
        paddingBottom:12, borderBottom:`1px solid ${c.border}` }}>
        <span style={{ fontSize:18 }}>{c.icon}</span>
        <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:c.accent, letterSpacing:1 }}>{c.label}</span>
      </div>
      {children}
    </div>
  );
}

// ── Section cards ─────────────────────────────────────────────────────────
function SCard({ soap }) {
  const c = C.S;
  const [show, setShow] = useState(false);
  const excluded = soap.S?.除外した発言 || [];
  return (
    <CardShell c={c}>
      {soap.S?.主訴 && (
        <div style={{ padding:"10px 14px", borderRadius:10, background:`${c.accent}15`,
          border:`1px solid ${c.accent}33`, marginBottom:4 }}>
          <span style={{ fontSize:11, color:c.accent, fontFamily:"monospace", display:"block", marginBottom:4 }}>主訴</span>
          <span style={{ fontSize:14, color:"#e8f4f0", fontWeight:600 }}>{soap.S.主訴}</span>
        </div>
      )}
      {(soap.S?.稟告詳細||[]).map((t,i) => <Pill key={i} text={t} accent={c.accent} />)}
      {excluded.length > 0 && (
        <div style={{ marginTop:4 }}>
          <button onClick={() => setShow(!show)} style={{
            background:"transparent", border:"1px solid rgba(239,68,68,0.25)", borderRadius:8,
            color:"#f87171", fontSize:11, padding:"4px 12px", cursor:"pointer", fontFamily:"monospace" }}>
            ⚠️ 除外した発言 {excluded.length}件 {show?"▲":"▼"}
          </button>
          {show && (
            <div style={{ marginTop:8, padding:12, borderRadius:10,
              background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.15)",
              display:"flex", flexDirection:"column", gap:6 }}>
              <p style={{ fontSize:11, color:"#f87171", fontFamily:"monospace", margin:"0 0 6px" }}>雑談・推測として除外</p>
              {excluded.map((t,i) => (
                <div key={i} style={{ display:"flex", gap:8 }}>
                  <span style={{ color:"#f87171", fontSize:12 }}>✗</span>
                  <span style={{ fontSize:12, color:"#99a0b8", fontStyle:"italic" }}>「{t}」</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}
function OCard({ soap }) {
  const c = C.O;
  const v = soap.O?.バイタル||{};
  const vitals = [["体温",v.体温],["心拍数",v.心拍数],["呼吸数",v.呼吸数],["体重",v.体重]].filter(x=>x[1]);
  return (
    <CardShell c={c}>
      {vitals.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:4 }}>
          {vitals.map(([k,val]) => (
            <div key={k} style={{ padding:"10px 12px", borderRadius:10,
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#6677aa", fontFamily:"monospace", marginBottom:4 }}>{k}</div>
              <div style={{ fontSize:16, fontWeight:700, color:c.accent, fontFamily:"monospace" }}>{val}</div>
            </div>
          ))}
        </div>
      )}
      {[...(soap.O?.身体検査||[]), ...(soap.O?.実施検査結果||[])].map((t,i) => <Pill key={i} text={t} accent={c.accent} />)}
    </CardShell>
  );
}
function ACard({ soap }) {
  const c = C.A;
  const pc = { high:"#f87171", mid:"#fbbf24", low:"#6677aa" };
  const pl = { high:"優先", mid:"中", low:"低" };
  return (
    <CardShell c={c}>
      {soap.A?.主診断 && (
        <div style={{ padding:"12px 14px", borderRadius:10, background:`${c.accent}15`,
          border:`1px solid ${c.accent}44`, marginBottom:4 }}>
          <span style={{ fontSize:11, color:c.accent, fontFamily:"monospace", display:"block", marginBottom:4 }}>主診断</span>
          <span style={{ fontSize:15, fontWeight:700, color:"#e8f4f0" }}>{soap.A.主診断}</span>
        </div>
      )}
      {(soap.A?.鑑別疾患||[]).length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <span style={{ fontSize:10, color:"#6677aa", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:1 }}>鑑別疾患（Rule-out）</span>
          {soap.A.鑑別疾患.map((d,i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px",
              borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <Tag color={pc[d.優先度]||"#6677aa"}>{pl[d.優先度]||d.優先度}</Tag>
              <div>
                <div style={{ fontSize:13, color:"#ccd6e8", fontWeight:600, marginBottom:2 }}>{d.疾患名}</div>
                {d.根拠 && <div style={{ fontSize:12, color:"#6677aa" }}>{d.根拠}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {(soap.A?.臨床推定||[]).map((t,i) => <Pill key={i} text={t} accent={c.accent} />)}
    </CardShell>
  );
}
function PCard({ soap }) {
  const c = C.P;
  return (
    <CardShell c={c}>
      {(soap.P?.検査計画||[]).length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <span style={{ fontSize:10, color:"#6677aa", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:1 }}>検査計画</span>
          {soap.P.検査計画.map((t,i) => <Pill key={i} text={t} accent={c.accent} />)}
        </div>
      )}
      {(soap.P?.["処置・投薬"]||[]).length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
          <span style={{ fontSize:10, color:"#6677aa", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:1 }}>処置・投薬</span>
          {soap.P["処置・投薬"].map((d,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:8, padding:"9px 12px",
              borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize:13, color:"#ccd6e8", flex:1 }}>{d.内容}</span>
              {d.用量 && <Tag color={c.accent}>{d.用量}</Tag>}
              {d.経路 && <Tag color="#94a3b8">{d.経路}</Tag>}
            </div>
          ))}
        </div>
      )}
      {(soap.P?.飼い主指示||[]).length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
          <span style={{ fontSize:10, color:"#6677aa", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:1 }}>飼い主指示</span>
          {soap.P.飼い主指示.map((t,i) => <Pill key={i} text={t} accent={c.accent} />)}
        </div>
      )}
      {soap.P?.再診 && (
        <div style={{ marginTop:8, padding:"10px 14px", borderRadius:10,
          background:`${c.accent}10`, border:`1px solid ${c.accent}30`,
          display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:16 }}>📅</span>
          <span style={{ fontSize:13, color:"#ccd6e8" }}>{soap.P.再診}</span>
        </div>
      )}
    </CardShell>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Page() {
  const [screen, setScreen]     = useState("upload");
  const [transcript, setTranscript] = useState(SAMPLE);
  const [soap, setSoap]         = useState(null);
  const [error, setError]       = useState(null);
  const [dots, setDots]         = useState("");
  const [tab, setTab]           = useState("soap");
  const timer = useRef(null);

  const generate = async () => {
    if (!transcript.trim()) return;
    setScreen("processing"); setSoap(null); setError(null);
    let d = 0;
    timer.current = setInterval(() => { d=(d+1)%4; setDots(".".repeat(d)); }, 400);
    try {
      const res  = await fetch("/api/generate", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "APIエラー");
      setSoap(data.soap);
      setScreen("result");
    } catch(e) {
      setError(e.message);
      setScreen("error");
    } finally {
      clearInterval(timer.current);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {/* Nav */}
      <nav style={{ height:52, background:"rgba(8,16,26,0.95)", backdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"0 24px",
        display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ width:26, height:26, borderRadius:8,
          background:"linear-gradient(135deg,#34d399,#0ea5e9)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🐾</div>
        <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:600, color:"#e8f4f0", letterSpacing:1 }}>
          VetSOAP<span style={{ color:"#34d399" }}>AI</span>
          <span style={{ fontSize:10, color:"#34d399", marginLeft:8, padding:"2px 6px",
            border:"1px solid rgba(52,211,153,0.3)", borderRadius:4 }}>獣医師監修プロンプト v2</span>
        </span>
        <div style={{ flex:1 }} />
        {screen==="result" && (
          <button onClick={() => setScreen("upload")} style={{ padding:"6px 14px", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.1)", background:"transparent",
            color:"#8899aa", cursor:"pointer", fontSize:12 }}>← 新規</button>
        )}
      </nav>

      {/* ── Upload ── */}
      {screen==="upload" && (
        <div style={{ maxWidth:760, width:"100%", margin:"0 auto", padding:"36px 24px", display:"flex", flexDirection:"column", gap:20 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:"#e8f4f0", marginBottom:6 }}>診察トランスクリプトを入力</h1>
            <p style={{ fontSize:13, color:"#6677aa", lineHeight:1.7 }}>
              音声書き起こしテキストを貼り付けてください。AIが雑談・推測を除外しSOAPに変換します。
            </p>
          </div>
          <div style={{ border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, overflow:"hidden", background:"rgba(255,255,255,0.02)" }}>
            <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)",
              display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, color:"#6677aa", fontFamily:"monospace" }}>📝 トランスクリプト</span>
              <div style={{ flex:1 }} />
              <button onClick={() => setTranscript(SAMPLE)} style={{ fontSize:11, color:"#34d399",
                background:"transparent", border:"1px solid rgba(52,211,153,0.3)", borderRadius:6, padding:"3px 10px", cursor:"pointer" }}>
                サンプルを読み込む
              </button>
              <button onClick={() => setTranscript("")} style={{ fontSize:11, color:"#6677aa",
                background:"transparent", border:"none", cursor:"pointer" }}>クリア</button>
            </div>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
              placeholder="診察音声の書き起こしテキストをここに貼り付けてください..."
              style={{ width:"100%", minHeight:260, background:"transparent", border:"none", outline:"none",
                color:"#ccd6e8", fontSize:13, lineHeight:1.8, padding:16, fontFamily:"inherit" }} />
          </div>
          <button onClick={generate} disabled={!transcript.trim()} style={{
            padding:"14px 28px", borderRadius:12, border:"none",
            background: transcript.trim() ? "linear-gradient(135deg,#34d399,#0ea5e9)" : "#1e3045",
            color: transcript.trim() ? "#0b1520" : "#445566",
            cursor: transcript.trim() ? "pointer" : "not-allowed",
            fontSize:15, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            ✨ SOAP を生成する
          </button>
        </div>
      )}

      {/* ── Processing ── */}
      {screen==="processing" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:48 }}>
          <div style={{ width:72, height:72, borderRadius:20,
            background:"linear-gradient(135deg,rgba(52,211,153,0.15),rgba(14,165,233,0.15))",
            border:"1px solid rgba(52,211,153,0.2)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
            animation:"spin 3s linear infinite" }}>🐾</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:600, color:"#e8f4f0", marginBottom:8 }}>解析中{dots}</div>
            <div style={{ fontSize:13, color:"#6677aa" }}>雑談を除外してSOAPを生成しています</div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {screen==="error" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:48 }}>
          <div style={{ fontSize:40 }}>⚠️</div>
          <div style={{ fontSize:16, fontWeight:600, color:"#f87171" }}>生成に失敗しました</div>
          <div style={{ fontSize:13, color:"#6677aa", maxWidth:400, textAlign:"center" }}>{error}</div>
          <button onClick={() => setScreen("upload")} style={{ padding:"10px 24px", borderRadius:10,
            border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#ccd6e8", cursor:"pointer", fontSize:13 }}>← 戻る</button>
        </div>
      )}

      {/* ── Result ── */}
      {screen==="result" && soap && (
        <div style={{ maxWidth:900, width:"100%", margin:"0 auto", padding:"28px 24px 60px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 20px",
            borderRadius:14, background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.07)", marginBottom:24 }}>
            <span style={{ fontSize:28 }}>
              {soap.patient?.推定動物種?.includes("猫") ? "🐱" : soap.patient?.推定動物種?.includes("犬") ? "🐶" : "🐾"}
            </span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700, color:"#e8f4f0", marginBottom:3 }}>
                {soap.patient?.名前||"患者"}{" "}
                <span style={{ fontSize:13, color:"#6677aa", fontWeight:400 }}>
                  {[soap.patient?.推定動物種, soap.patient?.推定品種, soap.patient?.推定年齢].filter(Boolean).join(" / ")}
                </span>
              </div>
              <div style={{ fontSize:12, color:"#445566", fontFamily:"monospace" }}>AI解析完了</div>
            </div>
            <button style={{ padding:"8px 18px", borderRadius:10, border:"none",
              background:"#34d399", color:"#0b1520", cursor:"pointer", fontSize:13, fontWeight:700 }}>💾 カルテ保存</button>
          </div>

          <div style={{ display:"flex", gap:4, marginBottom:20 }}>
            {[["soap","📋 SOAP"],["raw","📝 原文"]].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding:"7px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
                background: tab===id ? "rgba(52,211,153,0.15)" : "transparent",
                color: tab===id ? "#34d399" : "#6677aa",
                borderBottom: tab===id ? "2px solid #34d399" : "2px solid transparent",
                transition:"all 0.2s" }}>{label}</button>
            ))}
          </div>

          {tab==="soap" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <SCard soap={soap} />
              <OCard soap={soap} />
              <ACard soap={soap} />
              <PCard soap={soap} />
            </div>
          )}
          {tab==="raw" && (
            <pre style={{ padding:20, borderRadius:14, background:"rgba(255,255,255,0.02)",
              border:"1px solid rgba(255,255,255,0.07)", fontSize:13, color:"#8899aa",
              lineHeight:1.8, whiteSpace:"pre-wrap", fontFamily:"monospace" }}>
              {transcript}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
