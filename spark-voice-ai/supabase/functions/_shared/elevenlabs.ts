// Camada ElevenLabs isolada (Etapa 2/3). Registra/clona voz (Instant Voice Clone,
// D2) e sintetiza áudio. Suporta MOCK para dev local sem gastar créditos:
// defina SPARK_TTS_MOCK=1.

import { conf } from './config.ts';

const API = 'https://api.elevenlabs.io/v1';

function apiKey(): string {
  const k = conf('ELEVENLABS_API_KEY');
  if (!k) throw new Error('elevenlabs_key_missing');
  return k;
}

function isMock(): boolean {
  return conf('SPARK_TTS_MOCK') === '1';
}

// ElevenLabs cobra ~US$0,30/1k caracteres no plano padrão (estimativa MVP).
const COST_PER_CHAR = 0.0003;
export function estimateCost(characters: number): number {
  return Number((characters * COST_PER_CHAR).toFixed(4));
}

/** Instant Voice Clone: sobe um sample e retorna o provider_voice_id. */
export async function cloneVoice(name: string, sample: Uint8Array): Promise<{ voiceId: string }> {
  if (isMock()) return { voiceId: `mock_${crypto.randomUUID().slice(0, 8)}` };
  const form = new FormData();
  form.append('name', name);
  form.append('files', new Blob([sample], { type: 'audio/mpeg' }), 'sample.mp3');
  const res = await fetch(`${API}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey() },
    body: form,
  });
  if (!res.ok) throw new Error(`elevenlabs_clone_${res.status}:${await res.text()}`);
  const data = (await res.json()) as { voice_id: string };
  return { voiceId: data.voice_id };
}

/** Sintetiza texto → MP3 (bytes). No mock, gera um MP3 silencioso curto. */
export async function synthesize(voiceId: string, text: string): Promise<Uint8Array> {
  if (isMock()) return mockMp3();
  const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`elevenlabs_tts_${res.status}:${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Frame MP3 mínimo (silêncio) só para o fluxo de dev fechar ponta a ponta.
function mockMp3(): Uint8Array {
  const header = [0xff, 0xfb, 0x90, 0x64];
  const frame = new Uint8Array(417).fill(0);
  frame.set(header, 0);
  return frame;
}
