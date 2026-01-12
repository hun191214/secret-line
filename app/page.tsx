export default function RootLanding() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Secret-Line</h1>
      <p style={{ marginTop: 8 }}>언어를 선택하세요</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <a href="/ko" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }}>
          한국어 (KO)
        </a>
        <a href="/en" style={{ padding: 10, border: "1px solid #ccc", borderRadius: 10 }}>
          English (EN)
        </a>
      </div>
    </main>
  );
}
