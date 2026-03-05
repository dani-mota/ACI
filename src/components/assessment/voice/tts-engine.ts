/**
 * ElevenLabs streaming TTS engine with Web Audio API for playback and amplitude extraction.
 *
 * Handles:
 * - Sentence-level chunking of streamed text
 * - Fetching audio from the server-proxied TTS endpoint
 * - Gapless audio playback via AudioContext + AudioBufferSourceNode
 * - Real-time amplitude extraction via AnalyserNode for orb sync
 * - Fallback to browser SpeechSynthesis when ElevenLabs is unavailable
 */

type AmplitudeCallback = (amplitude: number) => void;
type StateCallback = (playing: boolean) => void;
type FallbackCallback = () => void;

// Split text into sentences for chunked TTS
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    // Find sentence boundary (period, question mark, exclamation)
    const match = remaining.match(/^.+?[.!?](?:\s|$)/);
    if (match) {
      chunks.push(match[0].trim());
      remaining = remaining.slice(match[0].length).trim();
    } else if (remaining.length > 80) {
      // No sentence boundary — split at word boundary near 80 chars
      const breakIdx = remaining.lastIndexOf(" ", 80);
      const idx = breakIdx > 20 ? breakIdx : 80;
      chunks.push(remaining.slice(0, idx).trim());
      remaining = remaining.slice(idx).trim();
    } else {
      chunks.push(remaining);
      remaining = "";
    }
  }

  return chunks;
}

export class TTSEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private amplitudeData: Uint8Array<ArrayBuffer> | null = null;
  private amplitudeRaf: number = 0;
  private playQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private abortController: AbortController | null = null;
  private fallbackActive = false;

  private onAmplitude: AmplitudeCallback;
  private onStateChange: StateCallback;
  private onFallback: FallbackCallback;

  constructor(
    onAmplitude: AmplitudeCallback,
    onStateChange: StateCallback,
    onFallback: FallbackCallback,
  ) {
    this.onAmplitude = onAmplitude;
    this.onStateChange = onStateChange;
    this.onFallback = onFallback;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Speak the given text via ElevenLabs TTS.
   * Returns a promise that resolves when all audio has finished playing.
   */
  async speak(text: string, token: string): Promise<void> {
    this.stop();

    if (this.fallbackActive) {
      return this.speakFallback(text);
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) return;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const ctx = this.ensureAudioContext();

      // Fetch and decode all chunks
      const buffers: AudioBuffer[] = [];
      for (const chunk of chunks) {
        if (signal.aborted) return;

        const res = await fetch(`/api/assess/${token}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk }),
          signal,
        });

        if (!res.ok) {
          // Check for fallback signal
          try {
            const err = await res.json();
            if (err.fallback) {
              this.fallbackActive = true;
              this.onFallback();
              return this.speakFallback(text);
            }
          } catch { /* ignore parse errors */ }
          console.error(`[TTS] Chunk fetch failed: ${res.status}`);
          continue;
        }

        const arrayBuffer = await res.arrayBuffer();
        if (signal.aborted) return;

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        buffers.push(audioBuffer);
      }

      if (buffers.length === 0 || signal.aborted) return;

      // Play buffers sequentially
      this.playQueue = buffers;
      this.isPlaying = true;
      this.onStateChange(true);
      this.startAmplitudeLoop();
      await this.playNext();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[TTS] Error:", err);
        // Fall back to browser speech
        this.fallbackActive = true;
        this.onFallback();
        return this.speakFallback(text);
      }
    }
  }

  private playNext(): Promise<void> {
    return new Promise((resolve) => {
      const buffer = this.playQueue.shift();
      if (!buffer || !this.audioContext || !this.gainNode) {
        this.isPlaying = false;
        this.onStateChange(false);
        this.stopAmplitudeLoop();
        resolve();
        return;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      this.currentSource = source;

      source.onended = () => {
        this.currentSource = null;
        this.playNext().then(resolve);
      };

      source.start(0);
    });
  }

  private startAmplitudeLoop() {
    const loop = () => {
      if (!this.isPlaying) return;
      this.amplitudeRaf = requestAnimationFrame(loop);

      if (this.analyser && this.amplitudeData) {
        this.analyser.getByteFrequencyData(this.amplitudeData);
        let sum = 0;
        for (let i = 0; i < this.amplitudeData.length; i++) {
          sum += this.amplitudeData[i];
        }
        const avg = sum / this.amplitudeData.length / 255;
        this.onAmplitude(avg);
      }
    };
    this.amplitudeRaf = requestAnimationFrame(loop);
  }

  private stopAmplitudeLoop() {
    cancelAnimationFrame(this.amplitudeRaf);
    this.onAmplitude(0);
  }

  /** Browser SpeechSynthesis fallback */
  private speakFallback(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      this.isPlaying = true;
      this.onStateChange(true);

      utterance.onend = () => {
        this.isPlaying = false;
        this.onStateChange(false);
        resolve();
      };

      utterance.onerror = () => {
        this.isPlaying = false;
        this.onStateChange(false);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /** Get current playback state */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /** Get whether fallback is active */
  isFallback(): boolean {
    return this.fallbackActive;
  }

  /** Stop all playback immediately */
  stop() {
    this.abortController?.abort();
    this.abortController = null;

    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* already stopped */ }
      this.currentSource = null;
    }

    this.playQueue = [];
    this.isPlaying = false;
    this.stopAmplitudeLoop();
    this.onStateChange(false);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /** Clean up all resources */
  destroy() {
    this.stop();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
  }
}
