# Cloudflare 운영 가이드 (Secret-Line)

## 1. DNS 프록시 및 실제 IP 은폐
- 도메인 A 레코드(예: api.yourdomain.com)는 반드시 Cloudflare 프록시(주황색 구름)로 활성화
- 서버 실제 IP는 외부에 노출하지 않도록 방화벽에서 80/443 포트는 Cloudflare IP Range만 허용
- 서버 SSH 등 관리 포트는 별도 화이트리스트로 제한

## 2. WAF(웹 방화벽) 필수 규칙
- OWASP Top 10 룰셋 활성화
- Webhook 엔드포인트(예: /api/payment/webhook)는 다음 조건을 추가:
  - User-Agent, Referer, Origin 등 헤더 검사
  - WEBHOOK_SECRET 일치 여부 확인
  - Rate Limit(분당 10회 이하)
- SQLi, XSS, L7 DDoS, Bot 차단 룰 활성화

## 3. 운영 체크리스트
- Cloudflare Analytics로 실시간 트래픽/공격 모니터링
- WAF 로그 주기적 검토 및 False Positive 튜닝
- 긴급시 "Under Attack Mode" 즉시 활성화

---

# Zero-Downtime 배포 전략

1. 무중단 롤링 배포
   - docker-compose up -d --build 사용 (기존 컨테이너 유지)
   - healthcheck 통과 후 트래픽 전환
2. DB 마이그레이션은 배포 전 별도 실행 (prisma migrate deploy)
3. Redis 장애 시 graceful fallback 로직 필수
4. Cloudflare 프록시/방화벽 정책 변경은 사전 테스트 후 적용
5. 장애 발생 시 롤백(docker-compose down && up -d 이전 이미지) 절차 문서화
