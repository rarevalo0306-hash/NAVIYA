// Entrevista por voz con Gemini Live (solo navegador): Gemini escucha, piensa y habla en tiempo
// real. Aquí se manda el micrófono, se reproduce su voz y se atienden sus herramientas (anotar,
// terminar). La llave temporal y las instrucciones las pone el servidor (startGeminiVoice).
import { FunctionResponseScheduling, GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

export type GeminiEvents = {
  onSpeaking?: (speaking: boolean) => void;
  onListening?: (listening: boolean) => void;
  onTool: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onTurn?: (owner: string, nuna: string) => void; // lo que se dijo en el turno, ya transcrito
  onClosed?: (reason: string) => void;
};

function toBase64(pcm: Int16Array) {
  const bytes = new Uint8Array(pcm.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(data: string) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export class GeminiVoice {
  private session: Session | null = null;
  private mic: MediaStream | null = null;
  private inCtx: AudioContext;
  private outCtx: AudioContext;
  private speaker = new Audio();
  private out: MediaStreamAudioDestinationNode;
  private proc: ScriptProcessorNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private playAt = 0;
  private muted = false; // "Callar": se descarta el resto de lo que iba a decir en este turno
  private heard = "";
  private said = "";
  private quiet: (() => void) | null = null;
  private closed = false;

  // Se crea con el toque del dueño: así el navegador deja reproducir audio (sobre todo iPhone).
  constructor(private events: GeminiEvents) {
    this.inCtx = new AudioContext();
    this.outCtx = new AudioContext({ sampleRate: 24000 }); // Gemini habla en PCM de 24 kHz
    // Su voz sale por un <audio> (no directo de Web Audio) para que el cancelador de eco del
    // navegador la reconozca y Gemini no se escuche a sí misma.
    this.out = this.outCtx.createMediaStreamDestination();
    this.speaker.srcObject = this.out.stream;
    void this.speaker.play().catch(() => {});
  }

  async connect(token: string, model: string, greeting: string) {
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
    this.session = await ai.live.connect({
      model,
      config: { responseModalities: [Modality.AUDIO] }, // lo demás quedó fijo en la llave
      callbacks: {
        onmessage: (m) => void this.handle(m),
        onerror: () => this.close("error"),
        onclose: (e) => this.close(e.reason || "closed"),
      },
    });
    if (this.closed) return;
    await Promise.all([this.inCtx.resume(), this.outCtx.resume()]);

    // Micrófono en PCM de 16 bits a la frecuencia del navegador (Gemini la convierte).
    // shortcut: ScriptProcessor está obsoleto pero funciona en todos lados; cambiar a AudioWorklet si algún navegador lo quita.
    const source = this.inCtx.createMediaStreamSource(this.mic);
    this.proc = this.inCtx.createScriptProcessor(4096, 1, 1);
    const mimeType = `audio/pcm;rate=${this.inCtx.sampleRate}`;
    this.proc.onaudioprocess = (e) => {
      const f = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
      this.session?.sendRealtimeInput({ audio: { data: toBase64(pcm), mimeType } });
    };
    source.connect(this.proc);
    this.proc.connect(this.inCtx.destination);
    this.session.sendClientContent({ turns: greeting, turnComplete: true });
  }

  get speaking() {
    return this.playing.size > 0;
  }

  // Llama `fn` cuando termine de sonar lo que está diciendo.
  whenQuiet(fn: () => void) {
    if (this.speaking) this.quiet = fn;
    else fn();
  }

  stopSpeaking() {
    this.muted = true;
    this.stopAudio();
  }

  close(reason = "close_requested") {
    if (this.closed) return;
    this.closed = true;
    this.stopAudio();
    this.proc?.disconnect();
    this.session?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.speaker.srcObject = null;
    void this.inCtx.close().catch(() => {});
    void this.outCtx.close().catch(() => {});
    this.events.onListening?.(false);
    this.events.onClosed?.(reason);
  }

  private stopAudio() {
    this.playing.forEach((s) => {
      s.onended = null;
      s.stop();
    });
    this.playing.clear();
    this.playAt = 0;
    this.events.onSpeaking?.(false);
  }

  private play(data: string) {
    const pcm = fromBase64(data);
    const buffer = this.outCtx.createBuffer(1, pcm.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = this.outCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.out);
    this.playAt = Math.max(this.playAt, this.outCtx.currentTime + 0.05);
    src.start(this.playAt);
    this.playAt += buffer.duration;
    if (!this.playing.size) this.events.onSpeaking?.(true);
    this.playing.add(src);
    src.onended = () => {
      this.playing.delete(src);
      if (this.playing.size) return;
      this.events.onSpeaking?.(false);
      const fn = this.quiet;
      this.quiet = null;
      fn?.();
    };
  }

  private async handle(m: LiveServerMessage) {
    const c = m.serverContent;
    if (c) {
      if (c.interrupted) this.stopAudio(); // el dueño le habló encima: se calla
      for (const part of c.modelTurn?.parts ?? []) if (part.inlineData?.data && !this.muted) this.play(part.inlineData.data);
      if (c.inputTranscription?.text) {
        this.heard += c.inputTranscription.text;
        this.events.onListening?.(true);
      }
      if (c.outputTranscription?.text) this.said += c.outputTranscription.text;
      if (c.turnComplete) {
        const owner = this.heard.replace(/\s+/g, " ").trim();
        const said = this.said.replace(/\s+/g, " ").trim();
        this.heard = "";
        this.said = "";
        this.muted = false;
        this.events.onListening?.(false);
        if (owner || said) this.events.onTurn?.(owner, said);
      }
    }
    for (const call of m.toolCall?.functionCalls ?? []) {
      const response = await this.events.onTool(call.name ?? "", call.args ?? {}).catch(() => ({ error: "No se pudo guardar" }));
      this.session?.sendToolResponse({
        functionResponses: [{ id: call.id, name: call.name, response, scheduling: FunctionResponseScheduling.SILENT }],
      });
    }
    if (m.goAway) this.close("go_away");
  }
}
