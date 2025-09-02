export type AIProvider = 'openai' | 'gemini';

export type AISettings = {
  provider: AIProvider;
  apiKey: string;
  model?: string; // opsiyonel model override
};

export function loadAISettings(): AISettings | null {
  try {
    const raw = localStorage.getItem('aiSettings');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAISettings(s: AISettings) {
  localStorage.setItem('aiSettings', JSON.stringify(s));
}

export async function aiComplete(opts: { system?: string; prompt: string; settings?: AISettings }): Promise<string> {
  const settings = opts.settings || loadAISettings();
  if (!settings) throw new Error('AI ayarları bulunamadı. Sağlayıcı ve API anahtarını girin.');
  if (settings.provider === 'openai') {
    return openAIChat({ prompt: opts.prompt, system: opts.system, apiKey: settings.apiKey, model: settings.model || 'gpt-4o-mini' });
  }
  return geminiGenerate({ prompt: opts.prompt, system: opts.system, apiKey: settings.apiKey, model: settings.model || 'gemini-1.5-flash' });
}

export type AIStreamController = { cancel: () => void };

export function aiStreamComplete(opts: { system?: string; prompt: string; settings?: AISettings; onDelta: (text: string) => void; onDone?: (full: string) => void; onError?: (err: any) => void; }): AIStreamController {
  const settings = opts.settings || loadAISettings();
  if (!settings) throw new Error('AI ayarları bulunamadı.');
  if (settings.provider === 'openai') {
    return openAIChatStream({ prompt: opts.prompt, system: opts.system, apiKey: settings.apiKey, model: settings.model || 'gpt-4o-mini', onDelta: opts.onDelta, onDone: opts.onDone, onError: opts.onError });
  }
  // Gemini için tarayıcıda basit fallback: tam yanıtı üretip tek seferde ilet
  let aborted = false;
  (async () => {
    try {
      const full = await geminiGenerate({ prompt: opts.prompt, system: opts.system, apiKey: settings.apiKey, model: settings.model || 'gemini-1.5-flash' });
      if (!aborted) {
        opts.onDelta(full);
        opts.onDone && opts.onDone(full);
      }
    } catch (e) {
      if (!aborted) opts.onError && opts.onError(e);
    }
  })();
  return { cancel: () => { aborted = true; } };
}

async function openAIChat({ prompt, system, apiKey, model }: { prompt: string; system?: string; apiKey: string; model: string; }) {
  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  } as any;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let bodyText = '';
    let bodyJson: any = null;
    try {
      bodyText = await res.text();
      bodyJson = JSON.parse(bodyText);
    } catch {}
    const errMsg = bodyJson?.error?.message || bodyText || 'Bilinmeyen hata';
    let friendly = `OpenAI hata: ${res.status}. `;
    if (res.status === 401) friendly += 'API anahtarı geçersiz ya da yetki reddedildi. Anahtarı kontrol edin ve başında/sonunda boşluk olmadığından emin olun.';
    else if (res.status === 429) friendly += 'Kota limitine ulaşıldı ya da istek hızı çok yüksek. Bir süre sonra tekrar deneyin.';
    else if (res.status >= 500) friendly += 'Sunucu tarafında geçici bir sorun oluştu.';
    else friendly += 'İstek işlenemedi.';
    throw new Error(`${friendly}\nDetay: ${errMsg}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function openAIChatStream({ prompt, system, apiKey, model, onDelta, onDone, onError }: { prompt: string; system?: string; apiKey: string; model: string; onDelta: (t: string) => void; onDone?: (t: string) => void; onError?: (e: any) => void; }): AIStreamController {
  const controller = new AbortController();
  const body = {
    model,
    stream: true,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  } as any;
  let full = '';
  fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => '');
      throw new Error(`OpenAI stream hata: ${res.status} ${t}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        const lines = part.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') { onDone && onDone(full); return; }
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) { full += delta; onDelta(delta); }
          } catch {}
        }
      }
    }
    onDone && onDone(full);
  }).catch(err => { onError && onError(err); });
  return { cancel: () => controller.abort() };
}

async function geminiGenerate({ prompt, system, apiKey, model }: { prompt: string; system?: string; apiKey: string; model: string; }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents: any[] = [];
  if (system) contents.push({ role: 'user', parts: [{ text: `Sistem kuralları: ${system}` }] });
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  const body = { contents, generationConfig: { temperature: 0.7 } } as any;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let bodyText = '';
    let bodyJson: any = null;
    try {
      bodyText = await res.text();
      bodyJson = JSON.parse(bodyText);
    } catch {}
    const errMsg = bodyJson?.error?.message || bodyText || 'Bilinmeyen hata';
    let friendly = `Gemini hata: ${res.status}. `;
    if (res.status === 401) friendly += 'API anahtarı geçersiz ya da yetki reddedildi. Anahtarı ve model adını kontrol edin.';
    else if (res.status === 429) friendly += 'Kota limitine ulaşıldı ya da istek hızı çok yüksek. Bir süre sonra tekrar deneyin.';
    else if (res.status >= 500) friendly += 'Sunucu tarafında geçici bir sorun oluştu.';
    else friendly += 'İstek işlenemedi.';
    throw new Error(`${friendly}\nDetay: ${errMsg}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  return text;
}
