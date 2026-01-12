export default function KoHome() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>KO 홈</h1>
      <p style={{ marginTop: 8 }}>이 페이지는 /ko 입니다.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <a href="/">/ (랜딩)</a>
        <a href="/en">/en</a>
      </div>
    </main>
  );
}
