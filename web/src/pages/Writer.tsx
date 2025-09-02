import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { aiComplete, aiStreamComplete, loadAISettings, saveAISettings, type AISettings, type AIStreamController } from '../ai/aiClient'

// Tipler
type OutlineItem = { title: string; summary: string }
type ChapterDoc = { index: number; draft: string; outlineSummary?: string; approved?: boolean }
type Character = { name: string; age?: string | number; personality?: string; backstory?: string; motivation?: string; relationships?: string[]; voice?: string }
type World = { locations?: Array<{ name: string; detail: string }>; rules?: string[] }
type GlossaryItem = { term: string; definition: string }

const systemPrompt = 'Sen deneyimli bir Türkçe editör ve ROMAN yazım asistanısın. Senaryo/sahne formatından özellikle kaçın. "Sahne" veya "Scene" gibi başlıklar ve numaralı sahne alt başlıkları kullanma. Bölümler tek parça, akıcı, romansı anlatımla yazılır; gerektiğinde doğal paragraflar ve diyaloglarla akış sağlanır.'

export default function Writer() {
  const { id } = useParams<{ id: string }>()
  // Query param ?ch= to open a specific chapter
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search)
    const ch = parseInt(usp.get('ch') || '0', 10)
    if (Number.isFinite(ch) && ch > 0) setChapterIndex(ch)
  }, [])

  // Meta / plan
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [mainIdea, setMainIdea] = useState('')
  const [themes, setThemes] = useState('')
  const [message, setMessage] = useState('')
  const [genre, setGenre] = useState('roman')
  const [audience, setAudience] = useState('genel')
  const [language, setLanguage] = useState('tr')
  const [tone, setTone] = useState('sade')
  const [style, setStyle] = useState('')
  const [length, setLength] = useState('')
  const [outlineMode, setOutlineMode] = useState<'kronolojik' | 'tematik'>('kronolojik')
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [rollingSummary, setRollingSummary] = useState('')

  // Dünya ve sözlük
  const [charList, setCharList] = useState<Character[]>([])
  const [world, setWorld] = useState<World>({})
  const [glossary, setGlossary] = useState<GlossaryItem[]>([])

  // Bölümler
  const [chapters, setChapters] = useState<ChapterDoc[]>([])
  const [chapterIndex, setChapterIndex] = useState(1)
  const [chapterDraft, setChapterDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saveTimer = useRef<number | null>(null)

  // Çıktılar
  const [quickConsistency, setQuickConsistency] = useState('')
  const [consistency, setConsistency] = useState('')
  const [manuscript, setManuscript] = useState('')
  const [revision, setRevision] = useState('')
  const [blurb, setBlurb] = useState<{ backCover?: string; short?: string }>({})

  // AI
  const [aiSettings, setAISettings] = useState<AISettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const streamRef = useRef<AIStreamController | null>(null)

  useEffect(() => {
    setAISettings(loadAISettings())
  }, [])

  // Plan/metayı yükle
  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const planRef = doc(db, 'books', id, 'meta', 'plan')
        const snap = await getDoc(planRef)
        if (snap.exists()) {
          const d = snap.data() as any
          setTitle(d.title || '')
          setTopic(d.topic || '')
          setMainIdea(d.mainIdea || '')
          setThemes(d.themes || '')
          setMessage(d.message || '')
          setGenre(d.genre || genre)
          setAudience(d.audience || audience)
          setLanguage(d.language || language)
          setTone(d.tone || tone)
          setStyle(d.style || '')
          setLength(d.length || '')
          setOutlineMode(d.outlineMode || 'kronolojik')
          setOutline(Array.isArray(d.outline) ? d.outline : [])
          setRollingSummary(d.rollingSummary || '')
        }
      } catch (e) {
        // ignore
      }
    })()
  }, [id])

  // Bölümler + dünya + sözlük
  useEffect(() => {
    if (!id) return
    refreshChapters()
    ;(async () => {
      try {
        const worldRef = doc(db, 'books', id, 'meta', 'world')
        const wsnap = await getDoc(worldRef)
        if (wsnap.exists()) {
          const d = wsnap.data() as any
          setCharList(Array.isArray(d.characters) ? d.characters : [])
          setWorld({ locations: d.locations || [], rules: d.rules || [] })
        }
        const glRef = doc(db, 'books', id, 'meta', 'glossary')
        const gsnap = await getDoc(glRef)
        if (gsnap.exists()) {
          const d = gsnap.data() as any
          setGlossary(Array.isArray(d.items) ? d.items : [])
        }
      } catch (e) {
        // ignore
      }
    })()
  }, [id])

  async function refreshChapters() {
    if (!id) return
    const qy = query(collection(db, 'books', id, 'chapters'), orderBy('index', 'asc'))
    const snap = await getDocs(qy)
    const list = snap.docs.map(d => d.data() as ChapterDoc)
    setChapters(list)
    const current = list.find(c => c.index === chapterIndex)
    if (current) setChapterDraft(current.draft || '')
  }

  const chapterTitle = (i: number) => {
    const item = outline[i - 1]
    return item ? `${i}. ${item.title}` : `Bölüm ${i}`
  }

  function selectChapter(i: number) {
    setChapterIndex(i)
    const ch = chapters.find(c => c.index === i)
    setChapterDraft(ch?.draft || '')
  }

  function buildContext(lastN = 5) {
    const prev = chapters
      .filter(c => c.index < chapterIndex)
      .slice(-lastN)
      .map(c => `# Bölüm ${c.index}\n${c.draft || ''}`)
      .join('\n\n')
    const meta = `Başlık: ${title}\nTür: ${genre}\nKitle: ${audience}\nDil: ${language}\nTon: ${tone}`
    const out = outline.map((o, i) => `${i + 1}. ${o.title} — ${o.summary}`).join('\n')
    const chars = charList.map(c => `${c.name}: ${c.personality || ''}`).join('\n')
    const locs = (world.locations || []).map(l => `${l.name}: ${l.detail}`).join('\n')
    const rules = (world.rules || []).join('\n')
    const gloss = glossary.map(g => `${g.term}: ${g.definition}`).join('\n')
    return [
      meta,
      'Outline:\n' + out,
      'Karakterler:\n' + chars,
      'Mekanlar:\n' + locs,
      'Kurallar:\n' + rules,
      'Sözlük:\n' + gloss,
      'Önceki Bölümler:\n' + prev,
    ].join('\n\n')
  }

  async function generateOutline() {
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const prompt = `Aşağıdaki bilgilere göre ${outlineMode} bir bölüm planı üret. Sadece JSON dizi ver: [{"title":"...","summary":"..."}].\n\nBaşlık: ${title}\nKonu: ${topic}\nAna fikir: ${mainIdea}\nTemalar: ${themes}\nMesaj: ${message}`
      const raw = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      const jsonStr = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
      let arr: OutlineItem[] = []
      try { arr = JSON.parse(jsonStr) } catch {
        arr = raw.split('\n').filter(Boolean).map((line: string) => ({ title: line.replace(/^[-*\d\.\s]+/, ''), summary: '' }))
      }
      setOutline(arr)
      if (id) await setDoc(doc(db, 'books', id, 'meta', 'plan'), { title, topic, mainIdea, themes, message, genre, audience, language, tone, style, length, outlineMode, outline: arr, updatedAt: serverTimestamp() }, { merge: true })
    } catch (e: any) {
      setError(e.message || 'Outline oluşturulamadı')
    } finally { setLoading(false) }
  }

  async function writeChapter() {
    if (!id) return
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const ctx = buildContext(5)
      const o = outline[chapterIndex - 1]
  const prompt = `Bağlamı dikkate alarak ${chapterIndex}. bölüm taslağını ROMAN biçeminde yaz. Senaryo/sahne formatı kullanma; 'Sahne' ya da numaralı alt başlıklar ekleme. Başlangıçtan sona tek parça, akıcı bir anlatı olsun. Bölüm başlığı: ${o?.title || 'Bölüm ' + chapterIndex}. Bölüm özeti: ${o?.summary || ''}.\n\nBAĞLAM\n${ctx}`
      // Stream destekli yazım
      setChapterDraft('')
      setStreaming(true)
      streamRef.current = aiStreamComplete({
        system: systemPrompt,
        prompt,
        settings: aiSettings,
        onDelta: (t) => setChapterDraft(prev => prev + t),
        onDone: async (full) => {
          setStreaming(false)
          streamRef.current = null
          await setDoc(doc(db, 'books', id, 'chapters', String(chapterIndex)), { index: chapterIndex, draft: full, outlineSummary: o?.summary || '', updatedAt: serverTimestamp() }, { merge: true })
          await refreshChapters()
        },
        onError: (e) => { setError(e?.message || 'Akış hatası'); setStreaming(false); streamRef.current = null },
      })
    } catch (e: any) {
      setError(e.message || 'Bölüm yazılamadı')
    } finally { setLoading(false) }
  }

  function stopStreaming() {
    streamRef.current?.cancel()
    streamRef.current = null
    setStreaming(false)
  }

  async function generateCharactersWorld() {
    if (!id) return
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const prompt = `Aşağıdaki plan ve temalara göre kısa bir karakter listesi (5-8 kişi) ve dünya bilgisi üret. Sadece JSON ver:\n{"characters":[{"name":"...","age":"...","personality":"...","backstory":"...","motivation":"...","relationships":["..."],"voice":"..."}],"locations":[{"name":"...","detail":"..."}],"rules":["..."]}.\n\nBaşlık: ${title}\nTemalar: ${themes}\nOutline:\n${outline.map((o,i)=>`${i+1}. ${o.title} — ${o.summary}`).join('\n')}`
      const raw = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      const objStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const obj = JSON.parse(objStr || '{}')
      setCharList(Array.isArray(obj.characters) ? obj.characters : [])
      setWorld({ locations: obj.locations || [], rules: obj.rules || [] })
      await setDoc(doc(db, 'books', id, 'meta', 'world'), { characters: obj.characters || [], locations: obj.locations || [], rules: obj.rules || [], updatedAt: serverTimestamp() }, { merge: true })
    } catch (e: any) {
      setError(e.message || 'Karakter/dünya üretilemedi')
    } finally { setLoading(false) }
  }

  async function generateGlossary() {
    if (!id) return
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const prompt = `Aşağıdaki bağlam için terimler sözlüğü üret (8-15 madde). Sadece JSON ver: [{"term":"...","definition":"..."}]\n\n${buildContext(3)}`
      const raw = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      const arrStr = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
      const items: GlossaryItem[] = JSON.parse(arrStr || '[]')
      setGlossary(items)
      await setDoc(doc(db, 'books', id, 'meta', 'glossary'), { items, updatedAt: serverTimestamp() }, { merge: true })
    } catch (e: any) {
      setError(e.message || 'Sözlük üretilemedi')
    } finally { setLoading(false) }
  }

  async function quickCheckConsistency() {
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const ctx = buildContext(3)
      const prompt = `Aşağıdaki bağlam ve bölüm taslağı için hızlı tutarlılık notları ver (madde madde): isimler, olay örgüsü, motivasyonlar, zaman çizelgesi, ton.\n\nBAĞLAM\n${ctx}\n\nBÖLÜM TASLAĞI\n${chapterDraft}`
      const report = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      setQuickConsistency(report)
    } catch (e: any) {
      setError(e.message || 'Hızlı kontrol başarısız')
    } finally { setLoading(false) }
  }

  async function checkConsistency() {
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const ctx = buildContext(8)
      const prompt = `Aşağıdaki tüm bağlamı kapsayan kapsamlı tutarlılık analizi yap ve improv önerileri ver. Bölüm isimleriyle başlıklandır.\n\n${ctx}`
      const report = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      setConsistency(report)
    } catch (e: any) {
      setError(e.message || 'Tutarlılık raporu alınamadı')
    } finally { setLoading(false) }
  }

  async function buildManuscript() {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const qy = query(collection(db, 'books', id, 'chapters'), orderBy('index', 'asc'))
      const snap = await getDocs(qy)
      const parts = snap.docs.map(d => d.data() as any)
      const content = `Başlık: ${title}\nTür: ${genre}\nKitle: ${audience}\nDil: ${language}\nTon: ${tone}\n\n` +
        parts.map((p: any) => `# Bölüm ${p.index}\n\n${p.draft || ''}\n`).join('\n')
      setManuscript(content)
      await setDoc(doc(db, 'books', id, 'meta', 'manuscript'), { text: content, updatedAt: serverTimestamp() }, { merge: true })
    } catch (e: any) {
      setError(e.message || 'Manuskript oluşturulamadı')
    } finally { setLoading(false) }
  }

  async function styleRevisionPass() {
    if (!id) return
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const text = manuscript || (await (async () => {
        const ms = await getDoc(doc(db, 'books', id, 'meta', 'manuscript'))
        return (ms.exists() && (ms.data() as any).text) || ''
      })())
  const prompt = `Aşağıdaki metin üzerinde stil ve dil revizyonu yap: cümleleri sadeleştir, tempo akışını ayarla, tekrarları azalt; teknik terimleri tutarlı kullan. ROMAN biçemi korunmalı; varsa 'Sahne' veya sahne benzeri alt başlıkları kaldır ve doğal paragraf akışıyla sun. Metni aynı bölüm başlıklarıyla geri ver.\n\n${text}`
      const rev = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      setRevision(rev)
      await setDoc(doc(db, 'books', id, 'meta', 'revision'), { text: rev, updatedAt: serverTimestamp() }, { merge: true })
    } catch (e: any) {
      setError(e.message || 'Revizyon başarısız')
    } finally { setLoading(false) }
  }

  async function finalReviewAndBlurb() {
    if (!id) return
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const text = revision || manuscript
      const prompt = `Metin için kısa bir son okuma notu (madde listesi) ver ve ayrıca iki metin üret: 1) Arka kapak yazısı (150-200 kelime), 2) Kısa özet (2-3 cümle). JSON döndür: {"notes":["..."],"backCover":"...","short":"..."}.\n\n${text}`
      const raw = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      const objStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const obj = JSON.parse(objStr || '{}')
      setBlurb({ backCover: obj.backCover, short: obj.short })
      await setDoc(doc(db, 'books', id, 'meta', 'blurb'), { backCover: obj.backCover, short: obj.short, notes: obj.notes || [], updatedAt: serverTimestamp() }, { merge: true })
    } catch (e: any) {
      setError(e.message || 'Final değerlendirme başarısız')
    } finally { setLoading(false) }
  }

  function downloadFile(name: string, content: string, type = 'text/plain') {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function archiveUniverse() {
    if (!id) return
    const payload = {
      plan: { title, topic, characters: '', length, style, genre, audience, language, tone, mainIdea, themes, message, outlineMode, outline, rollingSummary },
      world: { characters: charList, ...world },
      glossary,
      blurb,
      createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'books', id, 'archive'), payload)
  }

  async function approveChapter() {
    if (!id) return
    const idx = Math.max(1, Math.min(outline.length || chapterIndex, chapterIndex))
    await updateDoc(doc(db, 'books', id, 'chapters', String(idx)), { approved: true, approvedAt: serverTimestamp() })
    await refreshChapters()
  }

  const onSaveAI = (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiSettings) return
    saveAISettings(aiSettings)
  }

  async function saveChapter() {
    if (!id) return
    const idx = Math.max(1, chapterIndex)
    setIsSaving(true)
    await setDoc(doc(db, 'books', id, 'chapters', String(idx)), {
      index: idx,
      draft: chapterDraft,
      outlineSummary: outline[idx - 1]?.summary || '',
      updatedAt: serverTimestamp(),
    }, { merge: true })
    await refreshChapters()
    setIsSaving(false)
  }

  // Autosave (debounce 1200ms) when chapterDraft changes
  useEffect(() => {
    if (!id) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      // only save if there is content or an existing chapter entry
      const hasContent = (chapterDraft || '').trim().length > 0
      const exists = chapters.some(c => c.index === chapterIndex)
      if (hasContent || exists) saveChapter()
    }, 1200)
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  }, [chapterDraft, chapterIndex, id])

  // Sağ panel AI yardımcı
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantOutput, setAssistantOutput] = useState('')
  const [assistantMode, setAssistantMode] = useState<'oner' | 'uygula'>('oner')

  async function runAssistant() {
    if (!aiSettings) { setError('Önce AI ayarlarını girin.'); return }
    setLoading(true); setError(null)
    try {
      const ctx = buildContext(6)
      const prompt = assistantMode === 'uygula'
        ? `Aşağıdaki talimata göre BÖLÜM TASLAĞINI roman biçeminde tamamen yeniden yaz ve sadece nihai metni ver. Senaryo/sahne formatı ve 'Sahne' başlıkları kullanma; doğal paragraf akışıyla yaz.\nTalimat: ${assistantInput}\n\nBÖLÜM TASLAĞI\n${chapterDraft}\n\nBAĞLAM\n${ctx}`
        : `Aşağıdaki talimata göre BÖLÜM TASLAĞI için öneriler ver ve roman biçeminde kısa örnek pasajlar üret. Senaryo/sahne başlıkları verme.\nTalimat: ${assistantInput}\n\nBÖLÜM TASLAĞI\n${chapterDraft}\n\nBAĞLAM\n${ctx}`
      const out = await aiComplete({ system: systemPrompt, prompt, settings: aiSettings })
      setAssistantOutput(out)
      if (assistantMode === 'uygula') setChapterDraft(out)
    } catch (e: any) {
      setError(e.message || 'AI yardımcı çalışmadı')
    } finally { setLoading(false) }
  }

  function applyAssistantAppend() {
    if (!assistantOutput) return
    const sep = chapterDraft.endsWith('\n') ? '' : '\n\n'
    const updated = chapterDraft + sep + assistantOutput
    setChapterDraft(updated)
    // Kaydı tetikle
    saveChapter()
  }

  function applyAssistantReplace() {
    if (!assistantOutput) return
    setChapterDraft(assistantOutput)
    saveChapter()
  }

  // UI
  return (
    <div className="writer-shell">
      {/* Sol: Bölümler */}
      <aside className="writer-sidebar">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Bölümler</h3>
          <div className="chapter-list">
            {Array.from({ length: Math.max(outline.length, chapters.length || 0) }, (_, i) => i + 1).map(i => {
              const ch = chapters.find(c => c.index === i)
              const active = i === chapterIndex
              return (
                <button key={i} className={`chapter-item ${active ? 'is-active' : ''}`} onClick={() => selectChapter(i)}>
                  <div className="chapter-title">{chapterTitle(i)}</div>
                  <div className="chapter-meta">{ch?.approved ? 'Onaylı' : ch?.draft ? 'Taslak' : 'Boş'}</div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => {
              const ni = outline.length + 1
              const newOutline = [...outline, { title: `Yeni Bölüm ${ni}`, summary: '' }]
              setOutline(newOutline)
              if (id) setDoc(doc(db, 'books', id, 'meta', 'plan'), { outline: newOutline, updatedAt: serverTimestamp() }, { merge: true })
            }}>Bölüm Ekle</button>
          </div>
        </div>
      </aside>

      {/* Orta: Editör */}
      <main className="writer-editor">
        <div className="panel">
          <div className="row-header">
            <h3 style={{ margin: 0 }}>{chapterTitle(chapterIndex)}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {!streaming ? (
                <button className="btn" disabled={loading || !aiSettings} onClick={writeChapter}>Bölümü Oluştur</button>
              ) : (
                <button className="btn btn-ghost" onClick={stopStreaming}>Durdur</button>
              )}
              <button className="btn btn-ghost" disabled={loading} onClick={saveChapter}>Kaydet</button>
              <button className="btn btn-ghost" disabled={loading} onClick={approveChapter}>Onayla</button>
              {isSaving && <span className="muted" style={{ alignSelf: 'center' }}>Kaydediliyor…</span>}
            </div>
          </div>
          <textarea className="input" rows={22} value={chapterDraft} onChange={(e) => setChapterDraft(e.target.value)} />
        </div>

        {/* Kalite ve çıktılar */}
        <div className="panel" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" disabled={loading} onClick={quickCheckConsistency}>Hızlı Kontrol</button>
            <button className="btn btn-ghost" disabled={loading} onClick={checkConsistency}>Kapsamlı Tutarlılık</button>
            <button className="btn btn-ghost" disabled={loading} onClick={buildManuscript}>Manuskript</button>
            <button className="btn btn-ghost" disabled={loading} onClick={styleRevisionPass}>Stil/Dil Revizyonu</button>
            <button className="btn btn-ghost" disabled={loading} onClick={finalReviewAndBlurb}>Final + Arka Kapak</button>
            {/* Exports */}
            <button className="btn btn-ghost" disabled={!manuscript} onClick={() => exportDocx(manuscript || revision || '')}>DOCX</button>
            <button className="btn btn-ghost" disabled={!manuscript} onClick={() => exportEpub(manuscript || revision || '')}>EPUB</button>
            <button className="btn btn-ghost" disabled={!manuscript} onClick={() => exportPdf(manuscript || revision || '')}>PDF</button>
          </div>
          {quickConsistency && (<pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{quickConsistency}</pre>)}
          {consistency && (<pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{consistency}</pre>)}
        </div>

        {manuscript && (
          <div className="panel" style={{ marginTop: 10 }}>
            <h4 style={{ marginTop: 0 }}>Manuskript (Önizleme)</h4>
            <textarea className="input" rows={12} value={manuscript} onChange={(e)=>setManuscript(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn btn-ghost" onClick={() => downloadFile(`${title || 'kitap'}.txt`, manuscript)}>TXT İndir</button>
            </div>
          </div>
        )}

        {revision && (
          <div className="panel" style={{ marginTop: 10 }}>
            <h4 style={{ marginTop: 0 }}>Revizyon</h4>
            <textarea className="input" rows={12} value={revision} onChange={(e)=>setRevision(e.target.value)} />
          </div>
        )}

        {(blurb.backCover || blurb.short) && (
          <div className="panel" style={{ marginTop: 10 }}>
            <h4 style={{ marginTop: 0 }}>Özet & Arka Kapak</h4>
            {blurb.backCover && (<>
              <strong>Arka Kapak</strong>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{blurb.backCover}</p>
            </>)}
            {blurb.short && (<>
              <strong>Kısa Özet</strong>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{blurb.short}</p>
            </>)}
          </div>
        )}
      </main>

      {/* Sağ: Ayarlar & AI yardımcı */}
      <aside className="writer-right">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>AI Ayarları</h3>
          <form className="form" onSubmit={onSaveAI}>
            <label>Sağlayıcı
              <select className="input" value={aiSettings?.provider || 'openai'} onChange={(e) => setAISettings({ ...(aiSettings || { apiKey: '', model: '' as any }), provider: e.target.value as any })}>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </label>
            <label>Model
              <input className="input" placeholder="gpt-4o-mini / gemini-1.5-flash" value={aiSettings?.model || ''} onChange={(e) => setAISettings({ ...(aiSettings || { provider: 'openai', apiKey: '' }), model: e.target.value })} />
            </label>
            <label>API Key
              <input className="input" placeholder="Anahtar" value={aiSettings?.apiKey || ''} onChange={(e) => setAISettings({ ...(aiSettings || { provider: 'openai' }), apiKey: e.target.value })} />
            </label>
            <button className="btn" type="submit">Kaydet</button>
          </form>
        </div>

        <div className="panel" style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 0 }}>Meta & Outline</h3>
          <div className="muted" style={{ fontSize: 12 }}>Başlık: {title} • Tür: {genre} • Kitle: {audience} • Dil: {language} • Ton: {tone}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" disabled={loading} onClick={generateOutline}>Outline Oluştur</button>
            <button className="btn btn-ghost" disabled={loading} onClick={generateCharactersWorld}>Karakter & Dünya</button>
            <button className="btn btn-ghost" disabled={loading} onClick={generateGlossary}>Sözlük</button>
          </div>
          <details style={{ marginTop: 6 }}>
            <summary>Meta düzenle</summary>
            <div className="form" style={{ marginTop: 6 }}>
              <label>Başlık<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label>Konu<textarea className="input" rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
              <label>Ana fikir<textarea className="input" rows={2} value={mainIdea} onChange={(e) => setMainIdea(e.target.value)} /></label>
              <label>Temalar<textarea className="input" rows={2} value={themes} onChange={(e) => setThemes(e.target.value)} /></label>
              <label>Mesaj<textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
              <div className="row">
                <label>Hedef uzunluk<input className="input" value={length} onChange={(e) => setLength(e.target.value)} /></label>
                <label>Yazım stili<input className="input" value={style} onChange={(e) => setStyle(e.target.value)} /></label>
              </div>
              <label>Yapı
                <select className="input" value={outlineMode} onChange={(e) => setOutlineMode(e.target.value as any)}>
                  <option value="kronolojik">Kronolojik</option>
                  <option value="tematik">Tematik</option>
                </select>
              </label>
              <button className="btn btn-ghost" onClick={() => id && setDoc(doc(db, 'books', id, 'meta', 'plan'), { title, topic, mainIdea, themes, message, genre, audience, language, tone, style, length, outlineMode, updatedAt: serverTimestamp() }, { merge: true })}>Kaydet</button>
            </div>
          </details>
        </div>

        <div className="panel" style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 0 }}>AI Yardımcısı</h3>
          <div className="row">
            <label>Mod
              <select className="input" value={assistantMode} onChange={(e) => setAssistantMode(e.target.value as any)}>
                <option value="oner">Öneri üret</option>
                <option value="uygula">Bölümü yeniden yaz</option>
              </select>
            </label>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Öneri üret: Metin önerileri/analiz verir. Aşağıdaki butonlarla taslağa ekleyebilir ya da taslağın yerine geçirebilirsiniz.
          </div>
          <textarea className="input" rows={5} placeholder="Talimatı yaz (örn: Diyalogları karakter sesine göre iyileştir, tempo artır)" value={assistantInput} onChange={(e) => setAssistantInput(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn" disabled={loading || !aiSettings} onClick={runAssistant}>Çalıştır</button>
            {loading && <span className="muted" style={{ alignSelf: 'center' }}>Çalıştırılıyor…</span>}
          </div>
          {assistantOutput && (
            <div className="panel" style={{ marginTop: 8 }}>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{assistantOutput}</pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={applyAssistantAppend}>Taslağa ekle</button>
                <button className="btn btn-ghost" onClick={applyAssistantReplace}>Taslağı bu metinle değiştir</button>
              </div>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 0 }}>Arşiv</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => archiveUniverse()}>Evreni Arşivle</button>
            <button className="btn btn-ghost" onClick={() => blurb.short && downloadFile(`${title || 'kitap'}-blurb.json`, JSON.stringify(blurb, null, 2), 'application/json')}>Blurb’i İndir</button>
          </div>
        </div>
      </aside>

      {error && <div className="danger" style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.4)', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
    </div>
  )
}

// Simple client-side exporters
function exportDocx(text: string) {
  // Minimal DOCX via Word 2003 XML fallback so Word/Google Docs can open
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<?mso-application progid="Word.Document"?>` +
    `<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">` +
    `<w:body><w:p><w:r><w:t>${escapeXml(text).replace(/\n/g, '</w:t></w:r></w:p><w:p><w:r><w:t>')}</w:t></w:r></w:p></w:body></w:wordDocument>`
  const blob = new Blob([xml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  triggerDownload('manuscript.docx', blob)
}

function exportEpub(text: string) {
  // Extremely simplified EPUB-like zip is complex; export as HTML zipped fallback
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Manuskript</title></head><body><pre>${escapeHtml(text)}</pre></body></html>`
  const blob = new Blob([html], { type: 'application/epub+zip' })
  triggerDownload('manuscript.epub', blob)
}

function exportPdf(text: string) {
  // Use browser print-to-PDF via new window (client-side only)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PDF</title></head><body><pre style="white-space: pre-wrap; font-family: system-ui, sans-serif">${escapeHtml(text)}</pre><script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script></body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const wnd = window.open(url, '_blank')
  if (!wnd) alert('Pop-up engellendi. Lütfen bu site için pop-up izni verin.')
}

function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"] /g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', ' ': ' ' }[c] as string))
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}
