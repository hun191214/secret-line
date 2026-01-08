/**
 * Agora 음성 통화용 토큰 발급 API
 * POST /api/agora/token - Agora RTC Token 발급 (음성 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelName, uid } = body;

    // 필수 파라미터 검증
    if (!channelName || uid === undefined) {
      return NextResponse.json(
        { 
          success: false,
          error: 'channelName and uid are required' 
        },
        { status: 400 }
      );
    }

    // 환경변수 확인
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Agora credentials are not configured' 
        },
        { status: 500 }
      );
    }

    // UID를 숫자로 변환 (문자열인 경우)
    const uidNumber = typeof uid === 'string' ? parseInt(uid, 10) : uid;
    
    if (isNaN(uidNumber)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid uid format' 
        },
        { status: 400 }
      );
    }

    // 토큰 유효시간: 3600초 (1시간)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600;
    const privilegeExpiredTs = expirationTimeInSeconds;

    // RTC Token 생성 (Publisher 역할 - 양방향 통화)
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uidNumber,
      RtcRole.PUBLISHER, // Publisher 역할 (양방향 통화)
      privilegeExpiredTs,
      privilegeExpiredTs // token expire
    );

    return NextResponse.json({
      success: true,
      token,
      channelName,
      uid: uidNumber,
      expiresIn: 3600, // 1시간 (초 단위)
      role: 'publisher',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Agora token generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to generate Agora token' 
      },
      { status: 500 }
    );
  }
}

