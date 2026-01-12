import { getMessages } from "@/lib/messages";

export default async function KoHome() {
  const m = await getMessages("ko");

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{m["home.title"]}</h1>
      <p style={{ marginTop: 8 }}>{m["home.desc"]}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <a href="/">{m["nav.landing"]}</a>
        <a href="/en">{m["nav.en"]}</a>
      </div>
    </main>
  );
}
