import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { requireAdmin } from '@/app/api/admin/_auth';

export const runtime = 'nodejs';
type RouteParams = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
    if (!guard.authorized) return NextResponse.json({ success: false, message: guard.message }, { status: guard.status });

    const { id } = await params;
    const { reason } = await request.json();
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) return NextResponse.json({ success: false, message: 'DB 연결 실패' }, { status: 503 });

    await prisma.counselorProfile.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectedReason: reason } });

    console.log(`❌ [상담사 거절] 관리자 ${guard.user.email}: 대상 ID ${id} 거절 완료`);
    return NextResponse.json({ success: true, message: '거절 완료' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 });
  }
}