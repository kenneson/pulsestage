// Sons do sorteio no telão, sintetizados com Web Audio (sem arquivos de áudio).
// Navegadores só tocam som depois de um clique ou tecla na página: `unlockAudio` é chamado no
// primeiro gesto e, até lá, a animação roda em silêncio. Módulo só de cliente.

let context: AudioContext | null = null;

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
}

export function audioReady(): boolean {
  return context?.state === "running";
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  { type = "triangle", volume = 0.15 }: { type?: OscillatorType; volume?: number } = {},
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noise(ctx: AudioContext, start: number, duration: number, volume: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 5000;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

/** Clique da roleta; `pitch` sobe um pouco a cada número para criar tensão. */
export function playTick(pitch = 0): void {
  if (!context || !audioReady()) return;
  tone(context, 900 + pitch * 40, context.currentTime, 0.04, { type: "square", volume: 0.04 });
}

/** Batida grave quando a roleta para. */
export function playThump(): void {
  if (!context || !audioReady()) return;
  const t = context.currentTime;
  tone(context, 110, t, 0.35, { type: "sine", volume: 0.35 });
  tone(context, 55, t, 0.5, { type: "sine", volume: 0.25 });
}

/** Fanfarra da revelação: arpejo maior, acorde final e um prato. */
export function playFanfare(): void {
  if (!context || !audioReady()) return;
  const t = context.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(context!, f, t + i * 0.11, 0.22, { volume: 0.16 }));
  for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(context, f, t + 0.48, 1.3, { volume: 0.1 });
  tone(context, 261.63, t + 0.48, 1.4, { type: "sawtooth", volume: 0.04 });
  noise(context, t + 0.48, 0.9, 0.12);
}
