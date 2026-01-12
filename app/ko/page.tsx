export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        Secret-Line
      </h1>

      <p style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 16 }}>
        배포가 최신 코드로 반영되었습니다. (App Router: <code>/app/page.tsx</code>)
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="/admin"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
          }}
        >
          /admin 이동
        </a>

        <a
          href="/api/health"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
          }}
        >
          /api/health 확인
        </a>
      </div>

      <hr style={{ margin: "18px 0" }} />

      <p style={{ color: "#666", fontSize: 13 }}>
        만약 이 화면이 보이면, “옛날 화면 문제”는 page.tsx 부재로 인한 라우팅/빌드 산출물 이슈였던 것입니다.
      </p>
    </main>
  );
}
