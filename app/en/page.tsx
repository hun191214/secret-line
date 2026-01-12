export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Secret-Line (EN)</h1>
      <p>This is the English page.</p>

      <div style={{ display: "flex", gap: 12 }}>
        <a href="/">Root</a>
        <a href="/admin">Admin</a>
        <a href="/api/health">Health</a>
      </div>
    </main>
  );
}
