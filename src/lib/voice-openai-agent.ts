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

  stopSpeaking() {
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
  }

  close(reason = "close_requested") {
    if (this.closed) return;
    this.closed = true;
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.audio.srcObject = null;
    this.events.onSpeaking?.(false);
    this.events.onListening?.(false);
    this.events.onClosed?.(reason);
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
        this.events.onListening?.(true);
        break;
      case "input_audio_buffer.speech_stopped":
        this.events.onListening?.(false);
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const text = e.transcript?.trim();
        if (text && !isNoise(text)) this.heard.push(text);
        break;
      }
      case "response.output_audio_transcript.done":
        if (e.transcript?.trim()) this.said.push(e.transcript.trim());
        break;
      case "response.function_call_arguments.done": {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(e.arguments || "{}");
        } catch {}
        const output = await this.events.onTool(e.name ?? "", args).catch(() => ({ error: "No se pudo guardar" }));
        this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: JSON.stringify(output) } });
        // Después de anotar sigue la plática; al terminar ya se despidió, no hace falta que hable más.
        if (e.name !== "terminar_entrevista") this.send({ type: "response.create" });
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
        // Fin de un turno de ella: queda escrito lo que se dijo.
        const owner = this.heard.join(" ").trim();
        const said = this.said.join(" ").trim();
        this.heard = [];
        this.said = [];
        if (owner || said) this.events.onTurn?.(owner, said);
        break;
      }
      case "error":
        console.error("Voz (OpenAI):", e.error?.message);
        break;
    }
  }
}
