import "./globals.css";

export const metadata = {
  title: "VetSOAP AI — 動物病院向けSOAP自動生成",
  description: "診察音声をAIがSOAP形式に自動変換するクラウドサービス",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
