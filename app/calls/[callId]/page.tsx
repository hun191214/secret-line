/**
 * 통화 페이지
 * /calls/[callId] - 실시간 음성 통화 화면
 */

export default function CallPage({
  params,
}: {
  params: { callId: string };
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">통화 화면</h1>
        <p className="text-xl">통화 ID: {params.callId}</p>
        <p className="text-sm mt-4 opacity-75">
          Agora SDK 통합이 필요합니다
        </p>
      </div>
    </div>
  );
}

