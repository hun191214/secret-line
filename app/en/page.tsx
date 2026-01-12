export default function EnHome() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>EN Home</h1>
      <p style={{ marginTop: 8 }}>This page is /en.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <a href="/">/ (Landing)</a>
        <a href="/ko">/ko</a>
      </div>
    </main>
  );
}
