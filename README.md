🚨 [경고] Prisma 버전을 절대로 7.0.0 이상으로 올리지 마십시오. (P1012 파싱 에러 및 시스템 마비 위험)

# Secret Line - 익명 음성 상담 플랫폼

익명 음성 상담 플랫폼 'secret-line' 프로젝트입니다.

## 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **프로그래밍 언어**: TypeScript
- **스타일링**: Tailwind CSS
- **PWA**: Progressive Web App 지원
- **음성 통화**: Agora SDK
- **결제 시스템**: NOWPayments
- **데이터베이스**: PostgreSQL + Prisma ORM

## 비즈니스 로직

### 수익 배분 정책
- **기본 배분** (추천인이 있는 경우):
  - 상담사: **60%**
  - 남성 회원 추천인: **10%**
  - 회사: **30%**

- **추천인 없는 경우**:
  - 상담사: **60%**
  - 회사: **40%**

### 과금 정책
- **통화료**: 분당 **$0.14** 고정 과금

### 용어 원칙
법적 안전성을 위해 다음 용어만 사용합니다:
- 상담
- 연결
- 콘텐츠
- 통화료

## 프로젝트 구조

```
secret-line/
├── app/
│   ├── api/                    # API 라우트
│   │   ├── payments/          # 결제 API
│   │   ├── calls/             # 상담/통화 API
│   │   ├── settlement/        # 정산 API
│   │   └── referrals/         # 추천인 API
│   └── calls/                 # 통화 페이지
├── lib/                       # 유틸리티 함수
├── components/                # React 컴포넌트
├── types/                     # TypeScript 타입 정의
├── hooks/                     # Custom React Hooks
└── prisma/
    └── schema.prisma          # 데이터베이스 스키마
```

## 환경 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# 데이터베이스
DATABASE_URL="postgresql://user:password@localhost:5432/secretline"

# Agora SDK
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate

# NOWPayments
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret
NOWPAYMENTS_SANDBOX=true

# 기타
NODE_ENV=development
```

## 개발 가이드

### 설치
```bash
npm install
```

### 데이터베이스 설정
```bash
# Prisma 마이그레이션
npx prisma migrate dev

# Prisma Studio (선택)
npx prisma studio
```

### 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 빌드
```bash
npm run build
npm start
```

## 주요 기능

### 1. 결제 시스템 (Payments)
- NOWPayments를 통한 암호화폐 결제
- 웹훅을 통한 결제 상태 확인
- 결제 검증 및 영수증 발행

### 2. 상담/통화 (Calls)
- Agora SDK를 활용한 실시간 음성 통화
- 통화 시작/종료 관리
- 통화 시간 추적 및 과금 계산

### 3. 정산 시스템 (Settlement)
- 상담사별 정산 내역 관리
- 추천인 수익 배분 계산
- 회사 수익 정산

### 4. 추천인 시스템 (Referrals)
- 추천인 코드 생성 및 관리
- 추천인별 수익 추적
- 추천인 보상 계산

## 라이센스

이 프로젝트는 비공개 프로젝트입니다.
