/**
 * 서버 메모리 기반 사용자 정보 저장소 (Mock Mode)
 * 서버가 재시작되면 데이터가 초기화됩니다.
 */

interface UserInfo {
  email: string;
  role: 'MEMBER' | 'COUNSELOR';
  registeredAt: number;
}

// 전역 사용자 정보 저장소
const userStore = new Map<string, UserInfo>();

/**
 * 사용자 정보 저장
 */
export function saveUser(email: string, role: 'MEMBER' | 'COUNSELOR'): void {
  userStore.set(email.toLowerCase(), {
    email: email.toLowerCase(),
    role,
    registeredAt: Date.now(),
  });
}

/**
 * 사용자 정보 조회
 */
export function getUser(email: string): UserInfo | null {
  return userStore.get(email.toLowerCase()) || null;
}

/**
 * 사용자 존재 여부 확인
 */
export function hasUser(email: string): boolean {
  return userStore.has(email.toLowerCase());
}

/**
 * 모든 사용자 정보 조회 (디버깅용)
 */
export function getAllUsers(): UserInfo[] {
  return Array.from(userStore.values());
}

