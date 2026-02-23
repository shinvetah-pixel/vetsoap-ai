"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Samples ───────────────────────────────────────────────────────────────
const SAMPLES = {
  single: `獣医師: 今日はどうされましたか？
飼い主: ポチが3日前から食欲が落ちて、昨日2回吐きました。
獣医師: 嘔吐の内容は？
飼い主: 最初は食べたものが出て、2回目は黄色い液体でした。水は飲んでますけど少ない気がして。
獣医師: 排便は？
飼い主: 昨日から便が出ていないです。
獣医師: では触診しますね。体温39.1℃、心拍数180、呼吸数28、体重4.2kg（前回4.5kgから0.3kg減）。腹部右前に軽度の抵抗感と疼痛反応あり。皮膚ツルゴール低下、CRT2秒、粘膜やや乾燥。
獣医師: 軽度の脱水と腸閉塞が疑われます。X線と血液検査を実施しましょう。`,
  multi: `獣医師: 今日はどうされましたか？
飼い主A: ポチが3日前から食欲が落ちて、昨日2回吐きました。黄色い液体が出て。
獣医師: では触診します。体温39.1℃、心拍数180、体重4.2kg。腹部右前に疼痛反応あり。皮膚ツルゴール低下、CRT2秒。軽度の脱水が疑われます。X線と血液検査を実施しましょう。

次、タマちゃんで。

飼い主B: タマが2日前から右の後ろ足をひきずってて。急に。水をすごく飲むようになって、おしっこも多くて。
飼い主B: なんかやせてきた気がして。もう歳だから仕方ないですよね…
獣医師: 13歳でしたね。体重3.8kg（前回4.4kg）、体温38.9℃、心拍数92。右後肢の筋肉量低下、触ると疼痛あり。粘膜軽度蒼白、CRT2秒。心雑音グレード2が確認されます。血液検査：BUN 45mg/dL、クレアチニン2.8mg/dL、血糖値280mg/dL。糖尿病と慢性腎臓病が疑われます。インスリン0.5単位を1日2回、メロキシカム0.1mg/kgを1日1回2週間。1週間後に再検査。`
};

// ── Claude API ────────────────────────────────────────────────────────────

// ── PDF ───────────────────────────────────────────────────────────────────
// ── PDF（印刷方式・日本語完全対応） ──────────────────────────────────────
function todayStr() { const d=new Date(); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`; }

function downloadPDF(results) {
  const NAVY="#1a3a5c", BLUE="#2563b8", GREEN="#059669";
  const SC = { S:GREEN, O:BLUE, A:"#b45309", P:"#7c3aed" };

  const patientsHTML = results.map((r, idx) => {
    const { soap, seg } = r;
    const nm = soap?.patient?.名前 || `患者 ${idx+1}`;
    const sub = [soap?.patient?.推定動物種, soap?.patient?.推定品種, soap?.patient?.推定年齢].filter(Boolean).join(" / ");
    const vit = soap?.O?.バイタル || {};
    const vitals = [["体温",vit.体温],["心拍数",vit.心拍数],["呼吸数",vit.呼吸数],["体重",vit.体重]].filter(x=>x[1]);

    const vitHTML = vitals.length > 0
      ? `<div class="vitals">${vitals.map(([k,v])=>`<div class="vit-box"><div class="vit-label">${k}</div><div class="vit-val">${v}</div></div>`).join("")}</div>` : "";

    const ddxHTML = (soap?.A?.鑑別疾患||[]).map(d => {
      const pc = {high:"🔴 優先",mid:"🟡 中",low:"⚪ 低"};
      return `<div class="ddx-row"><span class="ddx-pri ${d.優先度}">${pc[d.優先度]||d.優先度}</span><span class="ddx-name">${d.疾患名}</span>${d.根拠?`<span class="ddx-reason">（${d.根拠}）</span>`:""}</div>`;
    }).join("");

    const rxHTML = (soap?.P?.["処置・投薬"]||[]).map(d =>
      `<li>${d.内容}${d.用量?` <span class="badge">${d.用量}</span>`:""}${d.経路?` <span class="badge muted">${d.経路}</span>`:""}</li>`
    ).join("");

    return `
    <div class="patient" style="break-before:${idx===0?"avoid":"page"}">
      <div class="pat-header">
        <div class="pat-num">${idx+1}</div>
        <div>
          <div class="pat-name">${nm}</div>
          <div class="pat-sub">${sub}</div>
        </div>
      </div>

      <div class="section">
        <div class="sec-label" style="color:${SC.S}">S — 稟告（Subjective）</div>
        ${soap?.S?.主訴 ? `<div class="chief">${soap.S.主訴}</div>` : ""}
        ${(soap?.S?.稟告詳細||[]).map(t=>`<div class="item">• ${t}</div>`).join("")}
        ${(soap?.S?.除外した発言||[]).length>0?`<div class="excluded">除外: ${soap.S.除外した発言.join("、")}</div>`:""}
      </div>

      <div class="section">
        <div class="sec-label" style="color:${SC.O}">O — 客観所見（Objective）</div>
        ${vitHTML}
        ${[...(soap?.O?.身体検査||[]),...(soap?.O?.実施検査結果||[])].map(t=>`<div class="item">• ${t}</div>`).join("")}
      </div>

      <div class="section">
        <div class="sec-label" style="color:${SC.A}">A — 評価（Assessment）</div>
        ${soap?.A?.主診断 ? `<div class="diagnosis">主診断：${soap.A.主診断}</div>` : ""}
        ${ddxHTML ? `<div class="ddx">${ddxHTML}</div>` : ""}
        ${(soap?.A?.臨床推定||[]).map(t=>`<div class="item">• ${t}</div>`).join("")}
      </div>

      <div class="section">
        <div class="sec-label" style="color:${SC.P}">P — 治療計画（Plan）</div>
        ${(soap?.P?.検査計画||[]).length>0?`<div class="sub-label">検査計画</div>${soap.P.検査計画.map(t=>`<div class="item">• ${t}</div>`).join("")}`:""}
        ${rxHTML ? `<div class="sub-label">処置・投薬</div><ul class="rx">${rxHTML}</ul>` : ""}
        ${(soap?.P?.飼い主指示||[]).length>0?`<div class="sub-label">飼い主指示</div>${soap.P.飼い主指示.map(t=>`<div class="item">• ${t}</div>`).join("")}`:""}
        ${soap?.P?.IC ? `<div class="ic"><span class="ic-label">IC / 飼い主の心理的背景：</span>${soap.P.IC}</div>` : ""}
        ${soap?.P?.再診 ? `<div class="followup">📅 再診：${soap.P.再診}</div>` : ""}
      </div>

      <div class="raw-wrap">
        <div class="raw-label">原文（文字起こし）</div>
        <div class="raw">${seg.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
      </div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Sans JP',sans-serif;font-size:10pt;color:#1e2a3a;background:#fff;padding:0}
  .cover{background:${NAVY};color:#fff;padding:28px 24px 22px;margin-bottom:0}
  .cover-title{font-size:9pt;opacity:.8;margin-bottom:4px}
  .cover-main{font-size:22pt;font-weight:700;margin-bottom:10px}
  .cover-meta{font-size:9pt;opacity:.7}
  .security{background:#f0fff4;border:1px solid #a7f3d0;padding:10px 14px;margin:14px 24px;border-radius:6px;font-size:8.5pt;color:#065f46}
  .patient{padding:16px 24px 20px;border-bottom:2px solid #e4e8f0}
  .pat-header{display:flex;align-items:center;gap:10px;background:${NAVY};color:#fff;padding:10px 14px;border-radius:8px;margin-bottom:14px}
  .pat-num{width:28px;height:28px;background:${BLUE};border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13pt;flex-shrink:0}
  .pat-name{font-size:14pt;font-weight:700}
  .pat-sub{font-size:8.5pt;opacity:.7;margin-top:2px}
  .section{margin-bottom:13px}
  .sec-label{font-size:9pt;font-weight:700;margin-bottom:7px;padding:4px 8px;border-radius:4px;background:rgba(0,0,0,0.04)}
  .sub-label{font-size:8pt;font-weight:700;color:#5a6a80;margin:6px 0 3px 4px}
  .chief{background:#f0fdf4;border:1px solid #a7f3d0;padding:7px 10px;border-radius:6px;font-weight:700;font-size:11pt;margin-bottom:6px}
  .item{font-size:9.5pt;padding:3px 6px;line-height:1.7}
  .excluded{font-size:8pt;color:#dc2626;margin-top:4px;font-style:italic}
  .vitals{display:flex;gap:8px;margin-bottom:8px}
  .vit-box{flex:1;border:1px solid #e4e8f0;border-radius:6px;padding:6px;text-align:center;background:#f8fafc}
  .vit-label{font-size:7.5pt;color:#9aa5b8;margin-bottom:3px}
  .vit-val{font-size:12pt;font-weight:700;color:${BLUE}}
  .diagnosis{background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:6px;font-size:11pt;font-weight:700;margin-bottom:7px}
  .ddx{margin-bottom:6px}
  .ddx-row{display:flex;align-items:baseline;gap:8px;padding:3px 4px;font-size:9pt}
  .ddx-pri{font-size:8pt;white-space:nowrap}
  .ddx-name{font-weight:700}
  .ddx-reason{color:#6b7280;font-size:8.5pt}
  .rx{padding-left:18px}
  .rx li{font-size:9.5pt;padding:2px 0;line-height:1.7}
  .badge{background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 6px;font-size:8pt;margin-left:4px}
  .badge.muted{background:#f1f5f9;color:#64748b}
  .ic{background:#faf5ff;border:1px solid #ddd6fe;padding:8px 12px;border-radius:6px;font-size:9pt;margin-top:6px}
  .ic-label{font-weight:700;color:#7c3aed;margin-right:6px}
  .followup{background:#eff6ff;border:1px solid #bfdbfe;padding:7px 12px;border-radius:6px;font-size:9.5pt;margin-top:6px}
  .raw-wrap{margin-top:10px;border:1px solid #e4e8f0;border-radius:6px;overflow:hidden}
  .raw-label{background:#f1f5f9;padding:5px 10px;font-size:8pt;font-weight:700;color:#64748b}
  .raw{padding:8px 10px;font-size:8pt;line-height:1.8;color:#64748b;white-space:pre-wrap;max-height:120pt;overflow:hidden}
  .footer{text-align:center;padding:10px;font-size:7.5pt;color:#9aa5b8;border-top:1px solid #e4e8f0}
  @media print{
    @page{size:A4;margin:10mm 8mm}
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  }
</style>
</head>
<body>
<div class="cover">
  <div class="cover-title">VetSOAP AI</div>
  <div class="cover-main">診察カルテ</div>
  <div class="cover-meta">${todayStr()}　${results.length}頭分</div>
</div>
<div class="security">🔒 このPDFはクラウドに送信されていません。クラウド未送信・端末に直接ダウンロードされます。診察内容は院内で適切に管理してください。</div>
${patientsHTML}
<div class="footer">VetSOAP AI — ${todayStr()} 出力　院内管理資料</div>
</body></html>`;

  // html2pdf.js で直接PDFダウンロード
  const loadHtml2Pdf = () => new Promise((res, rej) => {
    if (window.html2pdf) { res(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  loadHtml2Pdf().then(() => {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px";
    document.body.appendChild(container);

    const filename = `VetSOAP_${todayStr().replace(/年|月/g,"-").replace("日","")}_${results.length}頭.pdf`;
    html2pdf()
      .set({
        margin: [10, 8, 10, 8],
        filename,
        image: { type:"jpeg", quality:0.95 },
        html2canvas: { scale:2, useCORS:true, logging:false },
        jsPDF: { unit:"mm", format:"a4", orientation:"portrait" },
        pagebreak: { mode:["avoid-all","css"] }
      })
      .from(container)
      .save()
      .then(() => document.body.removeChild(container));
  });
}


// ── Design tokens (Light theme) ───────────────────────────────────────────
const T = {
  bg:       "#f7f8fa",
  surface:  "#ffffff",
  border:   "#e4e8f0",
  borderMd: "#c8d0de",
  navy:     "#1a3a5c",
  blue:     "#2563b8",
  textPri:  "#1e2a3a",
  textSec:  "#5a6a80",
  textMut:  "#9aa5b8",
  green:    "#059669",
  greenBg:  "rgba(5,150,105,0.07)",
  greenBd:  "rgba(5,150,105,0.2)",
};

const CARD = {
  S:{accent:"#059669",bg:"rgba(5,150,105,0.05)",  border:"rgba(5,150,105,0.18)", label:"S — 稟告",   icon:"💬"},
  O:{accent:"#2563b8",bg:"rgba(37,99,184,0.05)",   border:"rgba(37,99,184,0.18)",  label:"O — 客観所見",icon:"🔬"},
  A:{accent:"#b45309",bg:"rgba(180,83,9,0.05)",    border:"rgba(180,83,9,0.18)",   label:"A — 評価",   icon:"📋"},
  P:{accent:"#7c3aed",bg:"rgba(124,58,237,0.05)",  border:"rgba(124,58,237,0.18)", label:"P — 計画",   icon:"💊"},
};
const PAT_COLORS = ["#059669","#2563b8","#b45309","#dc2626","#7c3aed"];

// ── UI Primitives ─────────────────────────────────────────────────────────
function Pill({text,accent}){return(<div style={{display:"flex",gap:9,padding:"7px 12px",borderRadius:9,background:"#f8fafc",border:`1px solid ${T.border}`,alignItems:"flex-start"}}><div style={{width:5,height:5,borderRadius:"50%",background:accent,flexShrink:0,marginTop:6}}/><span style={{fontSize:12,color:T.textPri,lineHeight:1.65}}>{text}</span></div>);}
function Badge({children,color}){return(<span style={{fontSize:9,fontFamily:"monospace",padding:"2px 7px",borderRadius:999,background:`${color}15`,border:`1px solid ${color}35`,color,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>);}
function SLabel({text}){return(<div style={{fontSize:9,color:T.textMut,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{text}</div>);}
function Divider(){return(<div style={{height:1,background:T.border,margin:"2px 0"}}/>);}

function CardWrap({c,children}){return(<div style={{border:`1px solid ${c.border}`,borderRadius:14,background:c.bg,padding:15,display:"flex",flexDirection:"column",gap:9,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><div style={{display:"flex",alignItems:"center",gap:7,paddingBottom:9,borderBottom:`1px solid ${c.border}`}}><span style={{fontSize:15}}>{c.icon}</span><span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:c.accent,letterSpacing:.8}}>{c.label}</span></div>{children}</div>);}

function SCard({soap}){const c=CARD.S;const[show,setShow]=useState(false);const excl=soap.S?.除外した発言||[];return(<CardWrap c={c}>{soap.S?.主訴&&(<div style={{padding:"8px 12px",borderRadius:9,background:`${c.accent}0d`,border:`1px solid ${c.accent}25`}}><div style={{fontSize:9,color:c.accent,fontFamily:"monospace",marginBottom:2}}>主訴</div><div style={{fontSize:12.5,color:T.textPri,fontWeight:600}}>{soap.S.主訴}</div></div>)}{(soap.S?.稟告詳細||[]).map((t,i)=><Pill key={i} text={t} accent={c.accent}/>)}{excl.length>0&&(<div><button onClick={()=>setShow(v=>!v)} style={{background:"transparent",border:"1px solid rgba(220,38,38,0.25)",borderRadius:6,color:"#dc2626",fontSize:9,padding:"2px 9px",cursor:"pointer",fontFamily:"monospace"}}>⚠️ 除外 {excl.length}件 {show?"▲":"▼"}</button>{show&&(<div style={{marginTop:6,padding:9,borderRadius:8,background:"rgba(220,38,38,0.04)",border:"1px solid rgba(220,38,38,0.12)",display:"flex",flexDirection:"column",gap:4}}>{excl.map((t,i)=>(<div key={i} style={{display:"flex",gap:6}}><span style={{color:"#dc2626",fontSize:10}}>✗</span><span style={{fontSize:10,color:T.textSec,fontStyle:"italic"}}>「{t}」</span></div>))}</div>)}</div>)}</CardWrap>);}
function OCard({soap}){const c=CARD.O;const v=soap.O?.バイタル||{};const vit=[["体温",v.体温],["心拍数",v.心拍数],["呼吸数",v.呼吸数],["体重",v.体重]].filter(x=>x[1]);return(<CardWrap c={c}>{vit.length>0&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{vit.map(([k,val])=>(<div key={k} style={{padding:"7px 10px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`,textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}><div style={{fontSize:8.5,color:T.textMut,fontFamily:"monospace",marginBottom:3}}>{k}</div><div style={{fontSize:13,fontWeight:700,color:c.accent,fontFamily:"monospace"}}>{val}</div></div>))}</div>)}{[...(soap.O?.身体検査||[]),...(soap.O?.実施検査結果||[])].map((t,i)=><Pill key={i} text={t} accent={c.accent}/>)}</CardWrap>);}
function ACard({soap}){const c=CARD.A;const pc={high:"#dc2626",mid:"#b45309",low:"#6b7280"};const pl={high:"優先",mid:"中",low:"低"};return(<CardWrap c={c}>{soap.A?.主診断&&(<div style={{padding:"8px 12px",borderRadius:9,background:`${c.accent}0d`,border:`1px solid ${c.accent}30`}}><div style={{fontSize:9,color:c.accent,fontFamily:"monospace",marginBottom:2}}>主診断</div><div style={{fontSize:13,fontWeight:700,color:T.textPri}}>{soap.A.主診断}</div></div>)}{(soap.A?.鑑別疾患||[]).length>0&&(<div style={{display:"flex",flexDirection:"column",gap:5}}><SLabel text="鑑別疾患（DDx）"/>{soap.A.鑑別疾患.map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:7,padding:"7px 10px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`}}><Badge color={pc[d.優先度]||"#6b7280"}>{pl[d.優先度]||d.優先度}</Badge><div><div style={{fontSize:11.5,color:T.textPri,fontWeight:600}}>{d.疾患名}</div>{d.根拠&&<div style={{fontSize:10,color:T.textSec,marginTop:1}}>{d.根拠}</div>}</div></div>))}</div>)}{(soap.A?.臨床推定||[]).map((t,i)=><Pill key={i} text={t} accent={c.accent}/>)}</CardWrap>);}
function PCard({soap}){const c=CARD.P;return(<CardWrap c={c}>{(soap.P?.検査計画||[]).length>0&&(<div style={{display:"flex",flexDirection:"column",gap:5}}><SLabel text="検査計画"/>{soap.P.検査計画.map((t,i)=><Pill key={i} text={t} accent={c.accent}/>)}</div>)}{(soap.P?.["処置・投薬"]||[]).length>0&&(<div style={{display:"flex",flexDirection:"column",gap:5,marginTop:3}}><SLabel text="処置・投薬"/>{soap.P["処置・投薬"].map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:5,padding:"7px 10px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`}}><span style={{fontSize:11.5,color:T.textPri,flex:1}}>{d.内容}</span>{d.用量&&<Badge color={c.accent}>{d.用量}</Badge>}{d.経路&&<Badge color={T.textMut}>{d.経路}</Badge>}</div>))}</div>)}{(soap.P?.飼い主指示||[]).length>0&&(<div style={{display:"flex",flexDirection:"column",gap:5,marginTop:3}}><SLabel text="飼い主指示"/>{soap.P.飼い主指示.map((t,i)=><Pill key={i} text={t} accent={c.accent}/>)}</div>)}{soap.P?.IC&&(<div style={{marginTop:3,padding:"9px 12px",borderRadius:9,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.18)"}}><div style={{fontSize:9,color:"#7c3aed",fontFamily:"monospace",marginBottom:2}}>IC / 飼い主の心理的背景</div><div style={{fontSize:11.5,color:T.textPri}}>{soap.P.IC}</div></div>)}{soap.P?.再診&&(<div style={{padding:"8px 12px",borderRadius:9,background:"rgba(37,99,184,0.06)",border:"1px solid rgba(37,99,184,0.18)",display:"flex",alignItems:"center",gap:7}}><span>📅</span><span style={{fontSize:11.5,color:T.textPri}}>{soap.P.再診}</span></div>)}</CardWrap>);}

// ── Speech Recognition ────────────────────────────────────────────────────
function useSpeechRec(onResult, onEnd) {
  const recRef = useRef(null);
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setSrError] = useState(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) setAvailable(true);
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSrError("このブラウザは音声認識に対応していません（Chrome推奨）"); return; }
    setSrError(null);
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      onResult(final, interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setSrError("マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。");
      else if (e.error === "no-speech") setSrError("音声が検出されませんでした。");
      else setSrError(`エラー: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => { setListening(false); onEnd?.(); };
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [onResult, onEnd]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { available, listening, error: error, start, stop };
}

// ── Waveform ──────────────────────────────────────────────────────────────
function Waveform({ active }) {
  const [h, setH] = useState(Array(18).fill(4));
  useEffect(() => {
    if (!active) { setH(Array(18).fill(4)); return; }
    const id = setInterval(() => setH(Array(18).fill(0).map(() => Math.random()*28+4)), 130);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display:"flex",alignItems:"center",gap:3,height:40 }}>
      {h.map((v,i) => (
        <div key={i} style={{ width:3,height:`${v}px`,borderRadius:2,transition:"height 0.1s ease",
          background: active ? `rgba(5,150,105,${0.4+(i%3)*0.2})` : T.border }} />
      ))}
    </div>
  );
}

// ── Patient block ─────────────────────────────────────────────────────────
function PatientBlock({ result, index, onDownload, downloading }) {
  const [tab, setTab] = useState("soap");
  const { soap, seg } = result;
  const accent = PAT_COLORS[index % PAT_COLORS.length];
  const sp = soap?.patient?.推定動物種||"";
  const emoji = sp.includes("猫")?"🐱":sp.includes("犬")?"🐶":sp.includes("うさぎ")?"🐰":"🐾";
  return (
    <div style={{ marginBottom:24,animation:"fadeUp .4s both",animationDelay:`${index*0.07}s` }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:12,
        background:T.surface,border:`1px solid ${T.border}`,marginBottom:12,
        boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ width:38,height:38,borderRadius:11,
          background:`${accent}12`,border:`1px solid ${accent}30`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{emoji}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.textPri }}>
            {soap?.patient?.名前||`患者 ${index+1}`}
            <span style={{ fontSize:10,color:T.textMut,fontWeight:400,marginLeft:7 }}>
              {[soap?.patient?.推定動物種,soap?.patient?.推定品種,soap?.patient?.推定年齢].filter(Boolean).join(" / ")}
            </span>
          </div>
          <div style={{ fontSize:9,color:T.textMut,fontFamily:"monospace",marginTop:2 }}>セグメント {index+1} — AI解析完了</div>
        </div>
        <button onClick={onDownload} disabled={downloading} style={{ padding:"6px 14px",borderRadius:8,border:"none",
          cursor:downloading?"not-allowed":"pointer",
          background:downloading?T.border:`linear-gradient(135deg,${T.green},#047857)`,
          color:downloading?T.textMut:"white",fontSize:11,fontWeight:700,whiteSpace:"nowrap",
          boxShadow:downloading?"none":"0 2px 8px rgba(5,150,105,0.25)" }}>
          {downloading?"生成中...":"📄 PDF保存"}
        </button>
      </div>
      <div style={{ display:"flex",gap:4,marginBottom:11 }}>
        {[["soap","📋 SOAP"],["raw","📝 原文"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"5px 13px",borderRadius:7,border:"none",
            cursor:"pointer",fontSize:11,fontWeight:600,
            background:tab===id?`${accent}12`:"transparent",
            color:tab===id?accent:T.textMut,
            borderBottom:tab===id?`2px solid ${accent}`:`2px solid transparent` }}>{label}</button>
        ))}
      </div>
      {tab==="soap"&&soap&&(<div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}><SCard soap={soap}/><OCard soap={soap}/><ACard soap={soap}/><PCard soap={soap}/></div>)}
      {tab==="raw"&&(<pre style={{ padding:14,borderRadius:11,background:T.surface,border:`1px solid ${T.border}`,fontSize:11,color:T.textSec,lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"monospace",margin:0,boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>{seg}</pre>)}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("record");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [screen, setScreen] = useState("input");
  const [results, setResults] = useState([]);
  const [errMsg, setErrMsg] = useState("");
  const [dots, setDots] = useState("");
  const [procMsg, setProcMsg] = useState("");
  const [dlAll, setDlAll] = useState(false);
  const [dlIdx, setDlIdx] = useState(null);
  const [dur, setDur] = useState(0);
  const durRef = useRef(null);

  const handleResult = useCallback((final, interim) => {
    if (final) setTranscript(prev => prev + (prev ? "\n" : "") + final);
    setInterimText(interim);
  }, []);

  const handleEnd = useCallback(() => {
    setInterimText("");
    clearInterval(durRef.current);
  }, []);

  const sr = useSpeechRec(handleResult, handleEnd);

  const startRec = () => {
    setTranscript(""); setInterimText(""); setDur(0);
    sr.start();
    durRef.current = setInterval(() => setDur(d => d+1), 1000);
  };

  const stopRec = () => {
    sr.stop();
    clearInterval(durRef.current);
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  useEffect(() => {
    if (screen !== "processing") return;
    const msgs = ["雑談・挨拶を除外中","稟告を分類中","バイタルを抽出中","鑑別診断を整理中","SOAPを構造化中"];
    let d=0,mi=0; setProcMsg(msgs[0]);
    const id=setInterval(()=>{d=(d+1)%4;setDots(".".repeat(d));mi=(mi+1)%msgs.length;setProcMsg(msgs[mi]);},700);
    return()=>clearInterval(id);
  },[screen]);

  const generate = async () => {
    const src = transcript.trim(); if (!src) return;
    setScreen("processing"); setResults([]); setErrMsg("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: src })
      });
      if (!res.ok) { const err = await res.text(); throw new Error(`APIエラー: ${res.status}`); }
      const data = await res.json();
      if (!data.results || data.results.length === 0) throw new Error("結果が空です");
      setResults(data.results.map(r => ({ soap: r.soap, seg: r.transcript })));
      setScreen("result");
    } catch(e) { setErrMsg(e.message); setScreen("error"); }
  };

  const reset = () => { setScreen("input"); setResults([]); setTranscript(""); setInterimText(""); setDur(0); clearInterval(durRef.current); };
  const handleDlAll = async () => { setDlAll(true); try { await downloadPDF(results); } finally { setDlAll(false); } };
  const handleDlOne = async (i) => { setDlIdx(i); try { await downloadPDF([results[i]]); } finally { setDlIdx(null); } };

  const isRecording = sr.listening;
  const hasSpeech = transcript.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh",background:T.bg,color:T.textPri,fontFamily:"'Noto Sans JP',sans-serif",display:"flex",flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
        *{box-sizing:border-box;margin:0;padding:0}
        textarea{resize:vertical}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:#d1d8e4;border-radius:3px}
        button:focus{outline:none}
      `}</style>

      {/* Nav */}
      <nav style={{ height:52,background:T.surface,borderBottom:`1px solid ${T.border}`,
        padding:"0 22px",display:"flex",alignItems:"center",gap:10,
        position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ width:28,height:28,borderRadius:8,
          background:`linear-gradient(135deg,${T.green},${T.blue})`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>🐾</div>
        <span style={{ fontFamily:"monospace",fontSize:13,fontWeight:700,color:T.navy }}>
          VetSOAP<span style={{ color:T.green }}>AI</span>
        </span>
        <span style={{ fontSize:9,color:T.green,padding:"2px 7px",
          border:`1px solid ${T.greenBd}`,borderRadius:4,fontFamily:"monospace",background:T.greenBg }}>
          v2.1 多頭対応
        </span>
        <div style={{ flex:1 }}/>
        {screen==="result"&&(
          <button onClick={reset} style={{ padding:"5px 13px",borderRadius:7,
            border:`1px solid ${T.border}`,background:"transparent",
            color:T.textSec,cursor:"pointer",fontSize:11 }}>← 新規</button>
        )}
      </nav>

      {/* ── INPUT ── */}
      {screen==="input"&&(
        <div style={{ maxWidth:740,width:"100%",margin:"0 auto",padding:"28px 20px",display:"flex",flexDirection:"column",gap:18 }}>
          <div>
            <h1 style={{ fontSize:21,fontWeight:700,color:T.navy,marginBottom:5 }}>診察音声 → SOAP 自動変換</h1>
            <p style={{ fontSize:12,color:T.textSec,lineHeight:1.85 }}>
              音声認識またはテキスト入力で診察内容を入力。
              <span style={{ color:T.green,fontWeight:500 }}>「次、〇〇で」「おしまい」</span>で複数頭を自動分割します。
            </p>
          </div>

          {/* Security */}
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,
            background:T.greenBg,border:`1px solid ${T.greenBd}` }}>
            <span style={{ fontSize:16 }}>🔒</span>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:T.green }}>ローカル保存モード</div>
              <div style={{ fontSize:10,color:T.textSec }}>PDFはクラウドに送信されません。端末のダウンロードフォルダに直接保存されます。</div>
            </div>
          </div>

          {/* Mode tabs */}
          <div style={{ display:"flex",gap:4,padding:4,background:T.surface,
            border:`1px solid ${T.border}`,borderRadius:11,width:"fit-content",
            boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
            {[["record","🎙️ 音声認識"],["text","📝 テキスト"]].map(([id,label])=>(
              <button key={id} onClick={()=>setMode(id)} style={{ padding:"7px 18px",borderRadius:8,
                border:"none",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.18s",
                background:mode===id?T.greenBg:"transparent",
                color:mode===id?T.green:T.textMut,
                borderBottom:mode===id?`2px solid ${T.green}`:"2px solid transparent" }}>{label}</button>
            ))}
          </div>

          {/* ── Record mode ── */}
          {mode==="record"&&(
            <div style={{ border:`1px solid ${T.border}`,borderRadius:14,background:T.surface,
              overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ padding:"20px 20px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:14 }}>
                <Waveform active={isRecording}/>
                <div style={{ fontFamily:"monospace",fontSize:28,fontWeight:700,
                  color:isRecording?T.green:T.textMut }}>{fmt(dur)}</div>

                {/* Status */}
                <div style={{ fontSize:11,color:T.textSec,fontFamily:"monospace",textAlign:"center" }}>
                  {!sr.available && <span style={{ color:"#dc2626" }}>⚠️ このブラウザは音声認識に非対応です（Chrome推奨）</span>}
                  {sr.available && !isRecording && !hasSpeech && "待機中 — 録音ボタンを押してください"}
                  {sr.available && isRecording && <span style={{ animation:"pulse 1.5s infinite",display:"inline-block",color:T.green }}>● 録音中 — 話しかけてください</span>}
                  {sr.available && !isRecording && hasSpeech && <span style={{ color:T.green }}>✓ 録音完了 — テキストを確認してSOAPを生成してください</span>}
                </div>
                {sr.error && (
                  <div style={{ fontSize:11,color:"#dc2626",padding:"7px 14px",
                    background:"rgba(220,38,38,0.06)",borderRadius:8,border:"1px solid rgba(220,38,38,0.15)",
                    textAlign:"center",maxWidth:460 }}>{sr.error}</div>
                )}

                {/* Controls */}
                <div style={{ display:"flex",gap:9 }}>
                  {!isRecording&&!hasSpeech&&(
                    <button onClick={startRec} disabled={!sr.available} style={{ padding:"10px 24px",borderRadius:10,border:"none",
                      cursor:sr.available?"pointer":"not-allowed",
                      background:sr.available?`linear-gradient(135deg,${T.green},#047857)`:"#e5e7eb",
                      color:sr.available?"white":T.textMut,fontSize:13,fontWeight:700,
                      boxShadow:sr.available?"0 3px 10px rgba(5,150,105,0.3)":"none" }}>
                      ● 録音開始
                    </button>
                  )}
                  {isRecording&&(
                    <button onClick={stopRec} style={{ padding:"10px 24px",borderRadius:10,border:"none",cursor:"pointer",
                      background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"white",
                      fontSize:13,fontWeight:700,boxShadow:"0 3px 10px rgba(220,38,38,0.3)" }}>
                      ■ 録音停止
                    </button>
                  )}
                  {!isRecording&&hasSpeech&&(
                    <button onClick={()=>{setTranscript("");setDur(0);}} style={{ padding:"10px 18px",borderRadius:10,
                      border:`1px solid ${T.border}`,background:"transparent",color:T.textSec,cursor:"pointer",fontSize:12 }}>
                      ↺ やり直す
                    </button>
                  )}
                </div>

                {/* Split keyword hint */}
                <div style={{ width:"100%",padding:"10px 14px",borderRadius:9,
                  background:T.greenBg,border:`1px solid ${T.greenBd}` }}>
                  <div style={{ fontSize:10,color:T.green,fontFamily:"monospace",marginBottom:6 }}>
                    💡 複数頭の診察 — 以下のキーワードで自動分割されます
                  </div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {["「次、〇〇で」","「別の〇〇で」","「〇〇はおしまい」"].map(kw=>(
                      <span key={kw} style={{ fontSize:10,padding:"2px 9px",borderRadius:5,
                        background:T.greenBg,border:`1px solid ${T.greenBd}`,color:T.green,fontFamily:"monospace" }}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live transcript display */}
              {(hasSpeech || interimText) && (
                <div style={{ borderTop:`1px solid ${T.border}` }}>
                  <div style={{ padding:"8px 14px",display:"flex",alignItems:"center",gap:8,
                    borderBottom:`1px solid ${T.border}`,background:"#f8fafc" }}>
                    <span style={{ fontSize:10,color:T.textMut,fontFamily:"monospace" }}>📝 認識テキスト</span>
                    <div style={{ flex:1 }}/>
                    <button onClick={()=>setTranscript(SAMPLES.single)} style={{ fontSize:10,color:T.blue,
                      background:"transparent",border:`1px solid rgba(37,99,184,0.3)`,
                      borderRadius:5,padding:"2px 8px",cursor:"pointer" }}>1頭サンプル</button>
                    <button onClick={()=>setTranscript(SAMPLES.multi)} style={{ fontSize:10,color:T.blue,
                      background:"transparent",border:`1px solid rgba(37,99,184,0.3)`,
                      borderRadius:5,padding:"2px 8px",cursor:"pointer" }}>2頭サンプル</button>
                  </div>
                  <div style={{ padding:"12px 14px",minHeight:80,maxHeight:200,overflowY:"auto",
                    fontSize:12,lineHeight:1.9,color:T.textPri }}>
                    {transcript}
                    {interimText&&<span style={{ color:T.textMut,fontStyle:"italic" }}>{interimText}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Text mode ── */}
          {mode==="text"&&(
            <div style={{ border:`1px solid ${T.border}`,borderRadius:14,background:T.surface,
              overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ padding:"9px 14px",borderBottom:`1px solid ${T.border}`,background:"#f8fafc",
                display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:11,color:T.textMut,fontFamily:"monospace" }}>📝 トランスクリプト</span>
                <div style={{ flex:1 }}/>
                <button onClick={()=>setTranscript(SAMPLES.single)} style={{ fontSize:10,color:T.green,
                  background:"transparent",border:`1px solid ${T.greenBd}`,borderRadius:5,padding:"2px 8px",cursor:"pointer" }}>1頭</button>
                <button onClick={()=>setTranscript(SAMPLES.multi)} style={{ fontSize:10,color:T.blue,
                  background:"transparent",border:`1px solid rgba(37,99,184,0.3)`,borderRadius:5,padding:"2px 8px",cursor:"pointer" }}>2頭（分割デモ）</button>
                <button onClick={()=>setTranscript("")} style={{ fontSize:10,color:T.textMut,background:"transparent",border:"none",cursor:"pointer" }}>クリア</button>
              </div>
              <textarea value={transcript} onChange={e=>setTranscript(e.target.value)}
                placeholder={"診察音声の書き起こしを貼り付けてください。\n複数頭の場合：「次、タマちゃんで」のように書くと自動分割されます。"}
                style={{ width:"100%",minHeight:180,background:"transparent",border:"none",outline:"none",
                  color:T.textPri,fontSize:12,lineHeight:1.9,padding:"12px 14px",fontFamily:"inherit" }}/>
              <div style={{ padding:"8px 14px",borderTop:`1px solid ${T.border}`,background:"#f8fafc",
                display:"flex",gap:5,flexWrap:"wrap",alignItems:"center" }}>
                <span style={{ fontSize:10,color:T.textMut,fontFamily:"monospace" }}>分割KW:</span>
                {["「次、〇〇で」","「別の〇〇で」","「おしまい」"].map(kw=>(
                  <span key={kw} style={{ fontSize:10,padding:"2px 8px",borderRadius:5,
                    background:T.greenBg,border:`1px solid ${T.greenBd}`,color:T.green,fontFamily:"monospace" }}>{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Generate */}
          <button onClick={generate} disabled={!transcript.trim()} style={{ padding:"13px 24px",borderRadius:11,border:"none",
            background:transcript.trim()?`linear-gradient(135deg,${T.green},${T.blue})`:"#e5e7eb",
            color:transcript.trim()?"white":T.textMut,cursor:transcript.trim()?"pointer":"not-allowed",
            fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            boxShadow:transcript.trim()?"0 6px 18px rgba(5,150,105,0.22)":"none",transition:"all 0.18s" }}>
            ✨ SOAP を生成する
          </button>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {screen==="processing"&&(
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:22,padding:48 }}>
          <div style={{ width:70,height:70,borderRadius:20,
            background:`linear-gradient(135deg,${T.greenBg},rgba(37,99,184,0.08))`,
            border:`1px solid ${T.greenBd}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,
            animation:"spin 3s linear infinite" }}>🐾</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:15,fontWeight:600,color:T.navy,marginBottom:6 }}>解析中{dots}</div>
            <div style={{ fontSize:11,color:T.textSec,fontFamily:"monospace" }}>{procMsg}</div>
          </div>
          <div style={{ display:"flex",gap:7 }}>
            {["S","O","A","P"].map((k,i)=>{const c=Object.values(CARD)[i];return(<div key={k} style={{width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,fontFamily:"monospace",background:c.bg,border:`1px solid ${c.border}`,color:c.accent}}>{k}</div>);})}
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {screen==="error"&&(
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:48 }}>
          <div style={{ fontSize:34 }}>⚠️</div>
          <div style={{ fontSize:14,fontWeight:600,color:"#dc2626" }}>生成に失敗しました</div>
          <div style={{ fontSize:11,color:T.textSec,maxWidth:360,textAlign:"center" }}>{errMsg}</div>
          <button onClick={reset} style={{ padding:"8px 20px",borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",color:T.textSec,cursor:"pointer",fontSize:12 }}>← 戻る</button>
        </div>
      )}

      {/* ── RESULT ── */}
      {screen==="result"&&(
        <div style={{ maxWidth:880,width:"100%",margin:"0 auto",padding:"24px 20px 56px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 18px",borderRadius:12,
            background:T.greenBg,border:`1px solid ${T.greenBd}`,marginBottom:24,
            boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize:18 }}>✅</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:700,color:T.navy }}>{results.length}頭分のSOAPを生成しました</div>
              <div style={{ fontSize:10,color:T.textSec,fontFamily:"monospace",marginTop:2 }}>🔒 PDFはダウンロードフォルダに直接保存されます（クラウド送信なし）</div>
            </div>
            <button onClick={handleDlAll} disabled={dlAll} style={{ padding:"8px 16px",borderRadius:9,border:"none",
              cursor:dlAll?"not-allowed":"pointer",
              background:dlAll?"#e5e7eb":`linear-gradient(135deg,${T.green},#047857)`,
              color:dlAll?T.textMut:"white",fontSize:12,fontWeight:700,whiteSpace:"nowrap",
              boxShadow:dlAll?"none":"0 2px 8px rgba(5,150,105,0.25)" }}>
              {dlAll?"生成中...":"📄 全頭まとめてPDF保存"}
            </button>
          </div>
          {results.map((r,i)=>(
            <PatientBlock key={i} result={r} index={i} onDownload={()=>handleDlOne(i)} downloading={dlIdx===i}/>
          ))}
        </div>
      )}
    </div>
  );
}
