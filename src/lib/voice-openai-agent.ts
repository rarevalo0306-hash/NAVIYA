// Entrevista por voz con OpenAI Realtime "todo en uno" (solo navegador): OpenAI escucha, piensa y
// habla con las reglas de Nuna, y anota con las herramientas. Mismo contrato que GeminiVoice.
// La llave temporal, las instrucciones y las herramientas las pone el servidor (startVoice).
import type { AgentEvents } from "@/lib/voice-gemini";
import { isNoise } from "@/lib/voice-realtime";

export class OpenAIAgentVoice {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audio = new Audio();
  private heard: string[] = [];
  private said: string[] = [];
  private quiet: (() => void) | null = null;
  private closed = false;
  private talking = false; // el dueño está hablando
  private bargeIn: ReturnType<typeof setTimeout> | null = null;
  private reply: ReturnType<typeof setTimeout> | null = null;
  // Por respuesta de ella: si ya hizo su pregunta, si anotó algo, si sigue abierta y cuántas herramientas faltan.
  private asked = false;
  private saved = false;
  private open = false;
  private calls = 0;
  private wantReply = false; // el dueño habló mientras ella seguía respondiendo: contesta al terminar
  speaking = false;

  // Se crea con el toque del dueño: así el navegador deja reproducir audio.
  constructor(private events: AgentEvents) {
    this.audio.autoplay = true;
  }

  async connect(key: string, greeting: string) {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    pc.ontrack = (e) => {
      this.audio.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) this.close(pc.connectionState);
    };
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    pc.addTrack(this.mic.getTracks()[0], this.mic);
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => void this.handle(e.data);
    const opened = new Promise<void>((resolve, reject) => {
      dc.onopen = () => resolve();
      setTimeout(() => reject(new Error("La voz tardó demasiado en conectar")), 15_000);
    });
    await pc.setLocalDescription(await pc.createOffer());
    const sdp = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/sdp" },
      body: pc.localDescription?.sdp,
    });
    if (!sdp.ok) throw new Error(`OpenAI no aceptó la conexión (${sdp.status})`);
    await pc.setRemoteDescription({ type: "answer", sdp: await sdp.text() });
    await opened;
    // Ella empieza: el "hola" no lo dijo el dueño, es la señal para que salude.
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: greeting }] } });
    this.send({ type: "response.create" });
  }

  whenQuiet(fn: () => void) {
    if (this.speaking) this.quiet = fn;
    else fn();
  }

  // Lo que el dueño escribe (o el resumen de un archivo que adjunta) mientras platican: entra a la misma plática.
  sendText(text: string) {
    this.heard.push(text);
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    if (this.open || this.calls) this.wantReply = true;
    else this.send({ type: "response.create" });
  }

  // Silenciar el micrófono (botón de micrófono, como en ChatGPT).
  setMuted(muted: boolean) {
    this.mic?.getTracks().forEach((t) => (t.enabled = !muted));
  }

  stopSpeaking() {
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
  }

  close(reason = "close_requested") {
    if (this.closed) return;
    this.closed = true;
    if (this.bargeIn) clearTimeout(this.bargeIn);
    if (this.reply) clearTimeout(this.reply);
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.audio.srcObject = null;
    this.events.onSpeaking?.(false);
    this.events.onListening?.(false);
    this.events.onClosed?.(reason);
  }

  // Después de anotar, ella sigue hablando solo si en esa respuesta todavía no hizo su pregunta.
  private followUp() {
    if (this.open || this.calls) return;
    if (this.wantReply) this.wantReply = false;
    else if (!this.saved || this.asked) return;
    this.saved = false;
    this.send({ type: "response.create" });
  }

  private send(event: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  private async handle(raw: string) {
    let e: { type?: string; transcript?: string; call_id?: string; name?: string; arguments?: string; error?: { message?: string } };
    try {
      e = JSON.parse(raw);
    } catch {
      return;
    }
    switch (e.type) {
      case "input_audio_buffer.speech_started":
        this.talking = true;
        if (this.reply) clearTimeout(this.reply);
        // Si ella está hablando, se calla solo si el dueño sigue hablando 0.7 s (un ruido corto no la corta).
        if (this.speaking && !this.bargeIn)
          this.bargeIn = setTimeout(() => {
            this.bargeIn = null;
            if (this.talking && this.speaking) this.stopSpeaking();
          }, 700);
        this.events.onListening?.(true);
        break;
      case "input_audio_buffer.speech_stopped":
        this.talking = false;
        if (this.bargeIn) clearTimeout(this.bargeIn);
        this.bargeIn = null;
        this.events.onListening?.(false);
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const text = e.transcript?.trim();
        if (!text || isNoise(text)) break; // ruido: no contesta
        this.heard.push(text);
        // Contesta cuando el dueño de verdad terminó (si sigue hablando tras una pausa, espera).
        if (this.reply) clearTimeout(this.reply);
        this.reply = setTimeout(() => {
          this.reply = null;
          if (this.talking) return;
          if (this.open || this.calls) this.wantReply = true;
          else this.send({ type: "response.create" });
        }, 500);
        break;
      }
      case "response.created":
        this.open = true;
        this.asked = false;
        break;
      case "response.output_audio_transcript.done":
        if (e.transcript?.trim()) this.said.push(e.transcript.trim());
        if (e.transcript?.includes("?")) this.asked = true;
        break;
      case "response.function_call_arguments.done": {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(e.arguments || "{}");
        } catch {}
        this.calls++;
        if (e.name === "anotar") this.saved = true;
        const output = await this.events.onTool(e.name ?? "", args).catch(() => ({ error: "No se pudo guardar" }));
        this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: JSON.stringify(output) } });
        this.calls--;
        this.followUp();
        break;
      }
      case "output_audio_buffer.started":
        this.speaking = true;
        this.events.onSpeaking?.(true);
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared": {
        this.speaking = false;
        this.events.onSpeaking?.(false);
        const fn = this.quiet;
        this.quiet = null;
        fn?.();
        break;
      }
      case "response.done": {
        this.open = false;
        // Fin de un turno de ella: queda escrito lo que se dijo.
        const owner = this.heard.join(" ").trim();
        const said = this.said.join(" ").trim();
        this.heard = [];
        this.said = [];
        if (owner || said) this.events.onTurn?.(owner, said);
        this.followUp();
        break;
      }
      case "error":
        console.error("Voz (OpenAI):", e.error?.message);
        break;
    }
  }
}
