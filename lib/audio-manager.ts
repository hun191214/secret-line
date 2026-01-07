/**
 * 싱글톤 오디오 매니저
 * 모든 오디오 재생을 중앙 집중식으로 관리하여 중첩 방지 및 브라우저 정책 준수
 * 
 * 특징:
 * - 단일 AudioContext 인스턴스 유지
 * - 3-5초 단위 고품질 알림음 반복 재생
 * - 브라우저 자동 재생 정책 준수
 * - 신비롭고 은밀한 분위기의 사운드 톤
 */

type SoundType = 'heartbeat' | 'gift' | 'connecting';

interface SoundConfig {
  frequency: number;
  duration: number;
  volume: number;
  type: OscillatorType;
  fadeIn?: number;
  fadeOut?: number;
}

class AudioManager {
  private static instance: AudioManager | null = null;
  private audioContext: AudioContext | null = null;
  private currentSound: {
    type: SoundType;
    gainNode: GainNode | null;
    intervalId: NodeJS.Timeout | null;
    oscillator: OscillatorNode | null;
  } | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // 싱글톤: 외부에서 직접 생성 불가
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * 오디오 컨텍스트 초기화 (사용자 인터랙션 후 호출)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.audioContext) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // AudioContext 생성 (브라우저 호환성)
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
        
        // suspended 상태면 resume
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        this.isInitialized = true;
        console.log('🎵 [AudioManager] 초기화 완료');
      } catch (error) {
        console.error('❌ [AudioManager] 초기화 실패:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * 현재 재생 중인 소리 정지
   */
  private stopCurrentSound(): void {
    if (!this.currentSound) return;

    try {
      // 인터벌 정지
      if (this.currentSound.intervalId) {
        clearInterval(this.currentSound.intervalId);
        this.currentSound.intervalId = null;
      }

      // 오실레이터 정지
      if (this.currentSound.oscillator) {
        try {
          this.currentSound.oscillator.stop();
        } catch (e) {
          // 이미 정지된 경우 무시
        }
        this.currentSound.oscillator = null;
      }

      // Gain Node 페이드아웃 후 정리
      if (this.currentSound.gainNode && this.audioContext) {
        const gainNode = this.currentSound.gainNode;
        const currentTime = this.audioContext.currentTime;
        
        // 0.3초 동안 페이드아웃
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.3);
        
        setTimeout(() => {
          try {
            gainNode.disconnect();
          } catch (e) {
            // 이미 연결 해제된 경우 무시
          }
        }, 300);
      }

      this.currentSound = null;
      console.log('🔇 [AudioManager] 현재 소리 정지 완료');
    } catch (error) {
      console.error('❌ [AudioManager] 소리 정지 오류:', error);
    }
  }

  /**
   * 연결 대기 알림음 재생 (3-5초 단위 반복)
   * 신비롭고 은밀한 분위기의 심장 박동 소리
   */
  async playConnectingSound(): Promise<void> {
    // 기존 소리 정지
    this.stopCurrentSound();

    if (!this.audioContext) {
      await this.initialize();
    }

    if (!this.audioContext) {
      console.error('❌ [AudioManager] AudioContext 초기화 실패');
      return;
    }

    try {
      // Gain Node 생성 (볼륨 제어)
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.audioContext.destination);
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

      // 0.2초 페이드인
      gainNode.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + 0.2);

      // 심장 박동 소리 생성 함수
      const createHeartbeat = () => {
        if (!this.audioContext || !this.currentSound) return;

        const now = this.audioContext.currentTime;
        
        // 첫 번째 박동 (40Hz 저음)
        const osc1 = this.audioContext.createOscillator();
        const gain1 = this.audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(gainNode);
        
        osc1.frequency.setValueAtTime(40, now);
        osc1.type = 'sine';
        
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.8, now + 0.05);
        gain1.gain.linearRampToValueAtTime(0, now + 0.18);
        
        osc1.start(now);
        osc1.stop(now + 0.2);

        // 두 번째 박동 (약간 더 높은 음, 150ms 후)
        setTimeout(() => {
          if (!this.audioContext || !this.currentSound) return;
          
          const now2 = this.audioContext.currentTime;
          const osc2 = this.audioContext.createOscillator();
          const gain2 = this.audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(gainNode);
          
          osc2.frequency.setValueAtTime(45, now2);
          osc2.type = 'sine';
          
          gain2.gain.setValueAtTime(0, now2);
          gain2.gain.linearRampToValueAtTime(0.6, now2 + 0.04);
          gain2.gain.linearRampToValueAtTime(0, now2 + 0.16);
          
          osc2.start(now2);
          osc2.stop(now2 + 0.2);
        }, 150);
      };

      // 초기 재생
      createHeartbeat();

      // 4초마다 반복 재생 (3-5초 범위 내)
      const intervalId = setInterval(() => {
        if (!this.currentSound || this.currentSound.type !== 'connecting') {
          clearInterval(intervalId);
          return;
        }

        // AudioContext 상태 확인
        if (this.audioContext?.state === 'suspended') {
          this.audioContext.resume().catch(console.error);
        }

        createHeartbeat();
      }, 4000); // 4초 간격

      this.currentSound = {
        type: 'connecting',
        gainNode,
        intervalId,
        oscillator: null, // 심장 박동은 일시적 오실레이터 사용
      };

      console.log('💓 [AudioManager] 연결 대기 알림음 재생 시작 (4초 간격 반복)');
    } catch (error) {
      console.error('❌ [AudioManager] 연결 대기 소리 재생 오류:', error);
    }
  }

  /**
   * 선물 수신 알림음 재생 (한 번만 재생)
   */
  async playGiftSound(): Promise<void> {
    // 연결 대기 소리는 유지하고 선물 알림만 재생
    if (!this.audioContext) {
      await this.initialize();
    }

    if (!this.audioContext) {
      console.error('❌ [AudioManager] AudioContext 초기화 실패');
      return;
    }

    try {
      const now = this.audioContext.currentTime;
      const gainNode = this.audioContext.createGain();
      gainNode.connect(this.audioContext.destination);
      
      // 고품질 선물 알림음 (띵동 - 두 음)
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(gainNode);
      
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.type = 'sine';
      
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      
      osc1.start(now);
      osc1.stop(now + 0.3);

      // 두 번째 음 (200ms 후)
      setTimeout(() => {
        if (!this.audioContext) return;
        
        const now2 = this.audioContext.currentTime;
        const osc2 = this.audioContext.createOscillator();
        const gain2 = this.audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(gainNode);
        
        osc2.frequency.setValueAtTime(1100, now2);
        osc2.type = 'sine';
        
        gain2.gain.setValueAtTime(0, now2);
        gain2.gain.linearRampToValueAtTime(0.5, now2 + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.25);
        
        osc2.start(now2);
        osc2.stop(now2 + 0.3);
      }, 200);

      console.log('🎁 [AudioManager] 선물 알림음 재생 완료');
    } catch (error) {
      console.error('❌ [AudioManager] 선물 소리 재생 오류:', error);
    }
  }

  /**
   * 모든 소리 정지 및 정리
   */
  stop(): void {
    this.stopCurrentSound();
    console.log('🔇 [AudioManager] 모든 소리 정지');
  }

  /**
   * 페이드아웃 후 정지 (부드러운 종료)
   */
  fadeOut(duration: number = 1.0): void {
    if (!this.currentSound?.gainNode || !this.audioContext) {
      this.stop();
      return;
    }

    try {
      const gainNode = this.currentSound.gainNode;
      const currentTime = this.audioContext.currentTime;

      gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

      setTimeout(() => {
        this.stop();
      }, duration * 1000 + 100);

      console.log(`🔇 [AudioManager] 페이드아웃 시작 (${duration}초)`);
    } catch (error) {
      console.error('❌ [AudioManager] 페이드아웃 오류:', error);
      this.stop();
    }
  }

  /**
   * 완전 정리 (컴포넌트 언마운트 시)
   */
  clear(): void {
    this.stop();
    this.isInitialized = false;
    this.audioContext = null;
    this.currentSound = null;
    console.log('🧹 [AudioManager] 완전 정리 완료');
  }

  /**
   * 현재 재생 중인 소리 타입 반환
   */
  getCurrentSoundType(): SoundType | null {
    return this.currentSound?.type || null;
  }
}

// 싱글톤 인스턴스 export
export const audioManager = AudioManager.getInstance();

