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
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) return NextResponse.json({ success: false, message: 'DB 연결 실패' }, { status: 503 });

    const profile = await prisma.counselorProfile.findUnique({ where: { id }, include: { user: true } });
    if (!profile) return NextResponse.json({ success: false, message: '신청 없음' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.counselorProfile.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: guard.user.id } });
      await tx.user.update({ where: { id: profile.userId }, data: { role: 'COUNSELOR' } });
    });

    console.log(`✅ [상담사 승인] 관리자 ${guard.user.email}: ${profile.user.email} 승인 완료`);
    return NextResponse.json({ success: true, message: '승인 완료' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: '오류 발생' }, { status: 500 });
  }
}