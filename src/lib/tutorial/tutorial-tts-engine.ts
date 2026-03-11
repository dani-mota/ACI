export class TutorialTTSEngine {
  private segment: string;

  constructor(segment: string) {
    this.segment = segment;
  }

  async speakStep(
    stepId: string,
    text: string,
    onPlaybackStart: (durationSec: number) => void
  ): Promise<void> {
    const url = `/audio/tutorial/${this.segment}/${stepId}.mp3`;
    const audio = new Audio(url);

    return new Promise((resolve) => {
      const tryFallback = () => {
        this.fallback(text, onPlaybackStart, resolve);
      };

      audio.onloadedmetadata = () => {
        onPlaybackStart(audio.duration);
        audio.play().catch(tryFallback);
        audio.onended = () => resolve();
        audio.onerror = tryFallback;
      };

      audio.onerror = tryFallback;
      audio.load();
    });
  }

  private fallback(
    text: string,
    onPlaybackStart: (durationSec: number) => void,
    resolve: () => void
  ): void {
    // Estimate duration: ~150 words/min, so words * 0.4s
    const estimatedDuration = text.split(/\s+/).length * 0.4;
    onPlaybackStart(estimatedDuration);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      // No TTS available — just wait estimated duration
      setTimeout(resolve, estimatedDuration * 1000);
    }
  }

  stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}
