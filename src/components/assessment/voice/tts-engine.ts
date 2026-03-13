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
  /** Resolves when a new buffer is added to playQueue (for pipelined playback) */
  private bufferReadyResolve: (() => void) | null = null;
  /** Whether all chunks have been fetched (for pipelined playback) */
  private allChunksFetched = false;
  /** Session-level audio cache keyed by text content — stores text for SpeechSynthesis fallback */
  private audioCache = new Map<string, { text: string; buffers: AudioBuffer[] }>();

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

  private async ensureAudioContext(): Promise<AudioContext> {
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
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn("[TTS] AudioContext resume failed:", err);
      }
    }
    return this.audioContext;
  }

  /**
   * Speak the given text via ElevenLabs TTS.
   * Returns a promise that resolves when all audio has finished playing.
   *
   * @param onPlaybackStart Optional callback fired when audio playback begins,
   *   receives the total audio duration in seconds. Use this to synchronize
   *   word reveal timing with actual audio length.
   */
  async speak(text: string, token: string, onPlaybackStart?: (totalDurationSec: number) => void, preSplit = false): Promise<void> {
    this.stop();

    if (this.fallbackActive) {
      return this.speakFallback(text, onPlaybackStart);
    }

    // Check session cache first
    const cached = this.audioCache.get(text);
    if (cached && cached.buffers.length > 0) {
      return this.playCachedBuffers(cached, onPlaybackStart);
    }

    // When preSplit is true, the caller already split text into individual sentences —
    // don't re-split internally (avoids breaking on decimals, units, abbreviations)
    const chunks = preSplit ? [text] : chunkText(text);
    if (chunks.length === 0) return;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const ctx = await this.ensureAudioContext();

      if (ctx.state === "suspended") {
        this.fallbackActive = true;
        this.onFallback();
        return this.speakFallback(text, onPlaybackStart);
      }

      // Pipeline: fetch+decode chunk 0, start playback, then fetch remaining in background
      this.playQueue = [];
      this.allChunksFetched = false;
      const allBuffers: AudioBuffer[] = [];

      const firstBuffer = await this.fetchAndDecodeChunk(chunks[0], token, ctx, signal);
      if (signal.aborted) return;

      if (!firstBuffer) {
        // First chunk failed — fall back entirely
        this.fallbackActive = true;
        this.onFallback();
        return this.speakFallback(text, onPlaybackStart);
      }

      allBuffers.push(firstBuffer);

      // Estimate total duration from first chunk for onPlaybackStart
      const estimatedDuration = firstBuffer.duration * chunks.length;
      onPlaybackStart?.(estimatedDuration);

      // Start playback of first chunk immediately
      this.playQueue.push(firstBuffer);
      this.isPlaying = true;
      this.onStateChange(true);
      this.startAmplitudeLoop();

      // Fetch remaining chunks in background, feeding them to playQueue as they arrive
      const fetchRemaining = async () => {
        for (let i = 1; i < chunks.length; i++) {
          if (signal.aborted) return;
          const buf = await this.fetchAndDecodeChunk(chunks[i], token, ctx, signal);
          if (signal.aborted) return;
          if (buf) {
            allBuffers.push(buf);
            this.playQueue.push(buf);
            // Signal playNext() that a new buffer is available
            this.bufferReadyResolve?.();
          }
        }
        this.allChunksFetched = true;
        this.bufferReadyResolve?.();
        // Cache for potential replay (store text for SpeechSynthesis fallback)
        if (allBuffers.length > 0) {
          this.audioCache.set(text, { text, buffers: allBuffers });
        }
      };

      // Start background fetch (don't await — playback runs in parallel)
      const fetchPromise = fetchRemaining();

      // Play the pipelined queue
      await this.playNext();

      // Ensure fetch completes even if playback finishes first
      await fetchPromise;
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[TTS] Error:", err);
        this.fallbackActive = true;
        this.onFallback();
        return this.speakFallback(text, onPlaybackStart);
      }
    }
  }

  /** Fetch and decode a single TTS chunk. Returns null on failure. */
  private async fetchAndDecodeChunk(
    chunk: string,
    token: string,
    ctx: AudioContext,
    signal: AbortSignal,
  ): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(`/api/assess/${token}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
        signal,
      });

      if (!res.ok) {
        try {
          const err = await res.json();
          if (err.fallback) return null;
        } catch { /* ignore */ }
        console.error(`[TTS] Chunk fetch failed: ${res.status}`);
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (signal.aborted) return null;

      if (arrayBuffer.byteLength < 100) {
        console.warn("[TTS] Response too small to be audio, skipping chunk");
        return null;
      }

      return await ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[TTS] Failed to fetch/decode chunk:", err);
      }
      return null;
    }
  }

  /** Play pre-cached audio buffers directly */
  private async playCachedBuffers(
    cached: { text: string; buffers: AudioBuffer[] },
    onPlaybackStart?: (totalDurationSec: number) => void,
  ): Promise<void> {
    const ctx = await this.ensureAudioContext();
    if (ctx.state === "suspended") {
      console.warn("[TTS] AudioContext suspended during cached playback, falling back to SpeechSynthesis");
      return this.speakFallback(cached.text, onPlaybackStart);
    }
    const totalDuration = cached.buffers.reduce((sum, b) => sum + b.duration, 0);
    onPlaybackStart?.(totalDuration);
    this.playQueue = [...cached.buffers];
    this.allChunksFetched = true;
    this.isPlaying = true;
    this.onStateChange(true);
    this.startAmplitudeLoop();
    await this.playNext();
  }

  /**
   * Pre-fetch and decode audio for a text, storing in the session cache.
   * Call this while previous audio is playing to eliminate inter-sentence latency.
   */
  async prefetch(text: string, token: string): Promise<void> {
    if (this.fallbackActive || this.audioCache.has(text)) return;


    const chunks = chunkText(text);
    if (chunks.length === 0) return;

    try {
      const ctx = await this.ensureAudioContext();
      if (ctx.state === "suspended") return;

      const buffers: AudioBuffer[] = [];
      for (const chunk of chunks) {
        const buf = await this.fetchAndDecodeChunk(chunk, token, ctx, AbortSignal.timeout(15_000));
        if (buf) buffers.push(buf);
      }
      if (buffers.length > 0) {
        this.audioCache.set(text, { text, buffers });
      }
    } catch {
      // Pre-fetch is best-effort
    }
  }

  private async playNext(): Promise<void> {
    let buffer = this.playQueue.shift();

    // If queue is empty but more chunks are coming, wait for them
    while (!buffer && !this.allChunksFetched) {
      await new Promise<void>((r) => {
        this.bufferReadyResolve = r;
      });
      this.bufferReadyResolve = null;
      buffer = this.playQueue.shift();
    }

    if (!buffer || !this.audioContext || !this.gainNode) {
      this.isPlaying = false;
      this.onStateChange(false);
      this.stopAmplitudeLoop();
      return;
    }

    await new Promise<void>((resolve) => {
      const source = this.audioContext!.createBufferSource();
      source.buffer = buffer!;
      source.connect(this.gainNode!);
      this.currentSource = source;

      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(safetyTimeout);
        this.currentSource = null;
        resolve();
      };

      source.onended = done;

      // Safety timeout: if onended never fires (e.g. suspended context), move on
      const safetyTimeout = setTimeout(done, (buffer!.duration + 2) * 1000);

      source.start(0);
    });

    await this.playNext();
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
  private speakFallback(text: string, onPlaybackStart?: (totalDurationSec: number) => void): Promise<void> {
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

      // Estimate duration for fallback: ~150 words/min = ~0.4s/word
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = wordCount * 0.4;
      onPlaybackStart?.(estimatedDuration);

      utterance.onend = () => {
        this.isPlaying = false;
        this.onStateChange(false);
        resolve();
      };

      utterance.onerror = (ev) => {
        console.warn("[TTS] SpeechSynthesis error:", (ev as SpeechSynthesisErrorEvent).error);
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

  /**
   * Pre-initialize and resume the AudioContext.
   * Call this from a user gesture (click/touch/keydown) to unlock Web Audio
   * before the first speak() call — avoids suspended-context fallback.
   *
   * If the context was previously suspended (causing fallbackActive = true),
   * successfully resuming it will clear the fallback flag so that subsequent
   * speak() calls use ElevenLabs instead of the robotic browser voice.
   */
  async resumeContext(): Promise<void> {
    try {
      const ctx = await this.ensureAudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      // If context is now running, clear the fallback flag — ElevenLabs is usable
      if (ctx.state === "running" && this.fallbackActive) {
        this.fallbackActive = false;
      }
    } catch {
      // Best-effort — speak() will fall back if still suspended
    }
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
    this.allChunksFetched = true; // Unblock any waiting playNext()
    this.bufferReadyResolve?.();
    this.bufferReadyResolve = null;
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
