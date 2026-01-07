/**
 * Agora 토큰 생성 API
 * POST /api/calls/agora-token - Agora RTC 토큰 발급
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAgoraToken } from '@/lib/agora';
import { RtcRole } from 'agora-token';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelName, uid, role = 'publisher' } = body;

    if (!channelName || uid === undefined) {
      return NextResponse.json(
        { error: 'channelName and uid are required' },
        { status: 400 }
      );
    }

    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const token = generateAgoraToken(channelName, uid, rtcRole);

    return NextResponse.json({
      token,
      channelName,
      uid: typeof uid === 'string' ? parseInt(uid, 10) : uid,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Agora token generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}

