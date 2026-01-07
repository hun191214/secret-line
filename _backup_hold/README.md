# 백업 정보

**백업 일시**: 2025-01-06
**백업 사유**: 대규모 업데이트 전 세이브 포인트 (다국어 시스템 도입 및 DB 스키마 확장 전)

## 백업된 파일 목록

1. **prisma/schema.prisma** - 데이터베이스 스키마 정의 (Prisma 6.2.0)
2. **app_api/** - 모든 API 엔드포인트
   - 통화 관련: match, accept, reject, end, status, billing, gift, incoming
   - 인증 관련: login, logout, register, session
   - 상담사 관련: stats, status
   - 결제 관련: balance, deposit
   - 사용자 관련: coins
   - 기타: admin, referrals, settlement 등
3. **app/components/** - 주요 컴포넌트
   - CallOverlay.tsx (통화 오버레이, 릴레이 매칭 로직 포함)
   - Header.tsx
4. **app/page.tsx** - 메인 페이지
5. **app/mypage_page.tsx** - 마이페이지
6. **app/counselor_dashboard_page.tsx** - 상담사 대시보드
7. **lib/** - 핵심 라이브러리 파일
   - prisma.ts (DB 연결)
   - agora.ts (WebRTC)
   - nowpayments.ts (결제)
   - constants.ts (상수 정의)
   - settlement.ts (정산 로직)
8. **package.json** - 프로젝트 의존성 정보

## 주요 기능 현황

### 완료된 기능
- ✅ 실시간 코인 관리 시스템 (DB 기반)
- ✅ 통화 매칭 및 릴레이 시스템 (10초 순환, 최대 10명)
- ✅ 실시간 과금 엔진 (14코인/분, 60/40 배분)
- ✅ 상담사 거절 시 자동 릴레이 매칭
- ✅ 선물 시스템 (60/30/10 또는 60/40 배분)
- ✅ 15초 미만 통화 과금 제외 로직
- ✅ 상담 수익 + 선물 수익 통합 대시보드
- ✅ 양방향 실시간 동기화 (사용자 ↔ 상담사)
- ✅ 페이지 간 데이터 정합성 보장

### 데이터 정합성
- ✅ DB 기반 코인 잔액 관리 (`user.coins` 필드)
- ✅ Prisma 6.2.0 버전 고정
- ✅ 페이지 간 데이터 일치 보장 (mypage ↔ dashboard)
- ✅ 15초 미만 통화 과금 제외 확인

### 통화 관련 로직
- ✅ 최소 과금 시간: 15초 (MIN_BILLING_SECONDS)
- ✅ 통화 비용: 14코인/분
- ✅ 상담사 수익: 8코인/분 (60%)
- ✅ 플랫폼 수익: 6코인/분 (40%)
- ✅ 선물 배분: 상담사 60%, 회사 30%, 추천인 10% (또는 회사 40%)

## 복원 방법

필요시 다음 파일들을 원래 위치로 복사하세요:

```powershell
# 스키마 복원
Copy-Item "_backup_hold\schema.prisma" "prisma\schema.prisma" -Force

# API 복원
Copy-Item "_backup_hold\app_api\*" "app\api\" -Recurse -Force

# 컴포넌트 복원
Copy-Item "_backup_hold\app\components\*" "app\components\" -Recurse -Force

# 페이지 복원
Copy-Item "_backup_hold\app\page.tsx" "app\page.tsx" -Force
Copy-Item "_backup_hold\app\mypage_page.tsx" "app\mypage\page.tsx" -Force
Copy-Item "_backup_hold\app\counselor_dashboard_page.tsx" "app\counselor\dashboard\page.tsx" -Force

# 라이브러리 복원
Copy-Item "_backup_hold\lib\*" "lib\" -Recurse -Force
```

## 주의사항

- 이 백업은 **다국어 시스템 도입 전**의 상태입니다.
- DB 스키마 확장 작업 전에 이 백업을 기준으로 복원 가능합니다.
- Prisma 버전은 **6.2.0**으로 고정되어 있습니다.

