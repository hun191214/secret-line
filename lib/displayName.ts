/**
 * 이름 표시 로직 일원화
 * 
 * 우선순위:
 * 1. CounselorProfile.activityName (displayName)
 * 2. User.nickname
 * 3. 이메일 앞자리 (이메일이 있다면)
 * 4. '사용자' (기본값)
 */

interface UserData {
  email?: string | null;
  nickname?: string | null;
  counselorProfile?: {
    displayName?: string | null;
  } | null;
}

export function getDisplayName(user: UserData | null | undefined): string {
  if (!user) {
    return '사용자';
  }

  // 1순위: CounselorProfile.displayName (activityName)
  if (user.counselorProfile?.displayName) {
    return user.counselorProfile.displayName;
  }

  // 2순위: User.nickname
  if (user.nickname) {
    return user.nickname;
  }

  // 3순위: 이메일 앞자리
  if (user.email) {
    const emailPrefix = user.email.split('@')[0];
    if (emailPrefix) {
      return emailPrefix;
    }
  }

  // 기본값
  return '사용자';
}

