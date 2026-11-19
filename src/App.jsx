import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, CalendarDays,
  CheckCircle2, ChevronDown, CircleHelp, Clapperboard, Clock3, Command,
  Compass, FileText, Filter, FolderOpen, Gauge, Lightbulb, Menu, MoreHorizontal,
  Play, Plus, Search, Settings2, Sparkles, Target, TrendingUp, Video,
  WandSparkles, X, Youtube
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const categories = [
  { name: 'Sains & Alam', color: '#64d6c4', icon: '✦' },
  { name: 'Misteri Semesta', color: '#a78bfa', icon: '◉' },
  { name: 'Teknologi', color: '#60a5fa', icon: '⌘' },
  { name: 'Sejarah', color: '#e8b66c', icon: '◈' },
  { name: 'Fakta Unik', color: '#f28caa', icon: '✳' }
];
const initialVideos = [
  { id: 1, title: 'Apa yang Terjadi Jika Bumi Berhenti Berputar?', category: 'Sains & Alam', status: 'Ide', date: '—', duration: '08:30', color: '#64d6c4' },
  { id: 2, title: 'Sinyal Misterius dari Luar Angkasa yang Belum Terpecahkan', category: 'Misteri Semesta', status: 'Riset', date: '22 Nov 2026', duration: '12:10', color: '#a78bfa' },
  { id: 3, title: 'Teknologi Masa Depan yang Sudah Ada Hari Ini', category: 'Teknologi', status: 'Penulisan', date: '24 Nov 2026', duration: '09:45', color: '#60a5fa' },
  { id: 4, title: 'Perpustakaan Kuno yang Menyimpan Rahasia Sejarah', category: 'Sejarah', status: 'Editing', date: '20 Nov 2026', duration: '10:20', color: '#e8b66c' },
  { id: 5, title: 'Mengapa Kita Bermimpi? Sains di Balik Tidur', category: 'Sains & Alam', status: 'Terjadwal', date: '26 Nov 2026', duration: '07:50', color: '#64d6c4' }
];
const stages = ['Ide', 'Riset', 'Penulisan', 'Editing', 'Terjadwal', 'Terbit'];
const statusClass = s => s.toLowerCase().replaceAll(' ', '-');

function App() {
  const [active, setActive] = useState('Overview');
  const [videos, setVideos] = useState([]);
  const [authMode, setAuthMode] = useState('signup');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ title: '', category: 'Sains & Alam', status: 'Ide' });
  const [mobileNav, setMobileNav] = useState(false);
  const [profile, setProfile] = useState(null);
  const [categoryRows, setCategoryRows] = useState([]);

  useEffect(() => {
    if (!supabase) { setLoadingVideos(false); return; }
    supabase.auth.getUser().then(({ data }) => setProfile(data.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setProfile(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !profile) { setVideos([]); setLoadingVideos(false); return; }
    let alive = true;
    async function loadWorkspace() {
      setLoadingVideos(true);
      const [{ data: cats, error: catError }, { data, error }] = await Promise.all([
        supabase.from('categories').select('id,name,slug').order('name'),
        supabase.from('videos').select('id,title,status,scheduled_at,target_duration_seconds,category_id,categories(name)').order('created_at', { ascending: false })
      ]);
      if (!alive) return;
      if (catError || error) {
        notify('Gagal memuat data: ' + (catError?.message || error?.message));
      } else {
        setCategoryRows(cats || []);
        setVideos((data || []).map(v => ({
          id: v.id, title: v.title, category: v.categories?.name || 'Tanpa kategori',
          status: ({ idea:'Ide', research:'Riset', script:'Penulisan', production:'Editing', scheduled:'Terjadwal', published:'Terbit', archived:'Arsip' })[v.status] || 'Ide',
          date: v.scheduled_at ? new Date(v.scheduled_at).toLocaleDateString('id-ID') : '—',
          duration: v.target_duration_seconds ? Math.floor(v.target_duration_seconds/60)+':'+String(v.target_duration_seconds%60).padStart(2,'0') : '—',
          color: categories.find(c => c.name === (v.categories?.name || ''))?.color || '#64d6c4'
        })));
      }
      setLoadingVideos(false);
    }
    loadWorkspace();
    return () => { alive = false; };
  }, [profile]);

  const visible = useMemo(() => videos.filter(v =>
    (filter === 'Semua' || v.status === filter) &&
    (v.title.toLowerCase().includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase()))
  ), [videos, filter, search]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }
  async function addVideo(e) {
    e.preventDefault();
    if (!form.title.trim() || !profile) return;
    const category = categoryRows.find(c =>
      (form.category === 'Sains & Alam' && c.slug === 'sains') ||
      (form.category === 'Misteri Semesta' && c.slug === 'misteri-alam-semesta') ||
      c.name === form.category
    );
    const status = ({ 'Ide':'idea', 'Riset':'research', 'Penulisan':'script', 'Editing':'production', 'Terjadwal':'scheduled', 'Terbit':'published' })[form.status] || 'idea';
    const { data, error } = await supabase.from('videos').insert({
      user_id: profile.id, title: form.title.trim(), category_id: category?.id || null, status, format: 'long'
    }).select('id,title,status,scheduled_at,target_duration_seconds,categories(name)').single();
    if (error) { notify('Gagal menyimpan: ' + error.message); return; }
    setVideos(prev => [{ id:data.id, title:data.title, category:data.categories?.name || form.category, status:form.status, date:'—', duration:'—', color:categories.find(c=>c.name===form.category)?.color || '#64d6c4' }, ...prev]);
    setShowModal(false);
    setForm({ title: '', category: 'Sains & Alam', status: 'Ide' });
    notify('Konten berhasil disimpan ke Supabase');
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email: authForm.email.trim(), password: authForm.password })
      : await supabase.auth.signInWithPassword({ email: authForm.email.trim(), password: authForm.password });
    setAuthBusy(false);
    if (result.error) { notify(result.error.message); return; }
    if (authMode === 'signup' && !result.data.session) {
      notify('Akun dibuat. Periksa email untuk konfirmasi, lalu masuk.');
      setAuthMode('login');
    } else {
      setProfile(result.data.user);
      notify('Berhasil masuk ke RUANG FAKTA');
    }
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    notify('Sesi berhasil diakhiri');
  }

  const nav = [
    { group: 'WORKSPACE', items: [{ label: 'Overview', icon: Gauge }, { label: 'Konten Video', icon: Clapperboard }, { label: 'Kalender', icon: CalendarDays }, { label: 'Perpustakaan', icon: FolderOpen }] },
    { group: 'PRODUKSI', items: [{ label: 'Ide & Riset', icon: Lightbulb }, { label: 'Naskah', icon: FileText }, { label: 'Produksi', icon: Clapperboard }, { label: 'Analitik', icon: TrendingUp }] }
  ];
  const count = s => videos.filter(v => v.status === s).length;

  if (!isSupabaseConfigured) return <div className="auth-screen"><div className="auth-card"><div className="brand-name">RUANG<span>FAKTA</span></div><p>Konfigurasi Supabase belum tersedia. Periksa Variables and Secrets di Cloudflare.</p></div></div>;
  if (!profile) return <div className="auth-screen"><form className="auth-card" onSubmit={handleAuth}><div className="brand-name">RUANG<span>FAKTA</span></div><div className="brand-sub">CREATOR STUDIO</div><h1>{authMode === 'signup' ? 'Buat akun kreator' : 'Selamat datang kembali'}</h1><p>{authMode === 'signup' ? 'Daftarkan akun untuk mulai menyimpan ide dan naskah.' : 'Masuk untuk membuka workspace RUANG FAKTA.'}</p><label>Email<input type="email" required autoComplete="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="nama@email.com"/></label><label>Password<input type="password" required minLength={6} autoComplete={authMode==='signup'?'new-password':'current-password'} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="Minimal 6 karakter"/></label><button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? 'Memproses...' : authMode === 'signup' ? 'Buat akun' : 'Masuk'}</button><button className="auth-switch" type="button" onClick={()=>setAuthMode(authMode==='signup'?'login':'signup')}>{authMode==='signup'?'Sudah punya akun? Masuk':'Belum punya akun? Daftar'}</button></form>{toast && <div className="toast">{toast}</div>}</div>;
  if (loadingVideos) return <div className="auth-screen"><div className="auth-card">Memuat workspace RUANG FAKTA...</div></div>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><span>R</span><i /></div>
        <div><div className="brand-name">RUANG<span>FAKTA</span></div><div className="brand-sub">CREATOR STUDIO</div></div>
        <button className="icon-button close-nav" onClick={() => setMobileNav(false)}><X size={18}/></button>
      </div>
      <div className="channel-card">
        <div className="channel-avatar">RF</div>
        <div className="channel-info"><strong>Ruang Fakta</strong><span><span className="live-dot"/> Channel workspace</span></div>
        <ChevronDown size={15} className="muted"/>
      </div>
      <nav>
        {nav.map(group => <div className="nav-group" key={group.group}>
          <div className="nav-caption">{group.group}</div>
          {group.items.map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => { setActive(item.label); setMobileNav(false); }}>
            <item.icon size={17}/><span>{item.label}</span>{item.label === 'Konten Video' && <small>{videos.length}</small>}
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-icon"><Sparkles size={15}/></div><strong>Ruang berkembang</strong><p>Bangun ide hebat, satu video dalam satu waktu.</p><div className="plan-line"><span/></div><small>CREATOR MODE <b>ACTIVE</b></small></div>
        <button className="nav-item" onClick={() => notify('Pengaturan akan tersedia pada tahap berikutnya')}><Settings2 size={17}/>Pengaturan</button>
        <button className="nav-item" onClick={() => notify('Pusat bantuan RUANG FAKTA')}><CircleHelp size={17}/>Pusat bantuan</button>
        <div className="user-row"><div className="user-avatar">{profile?.email?.[0]?.toUpperCase() || 'R'}</div><div className="user-meta"><strong>{profile?.email || 'Creator'}</strong><span>{profile ? 'Authenticated' : 'Workspace owner'}</span></div><button className="icon-button" title="Keluar" onClick={signOut}><MoreHorizontal size={18}/></button></div>
      </div>
    </aside>

    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={19}/></button><span>Workspace</span><span className="crumb-slash">/</span><strong>{active}</strong></div>
        <div className="top-actions"><div className="status-pill"><span className="live-dot"/>{isSupabaseConfigured ? 'Database connected' : 'Preview mode'}</div><button className="icon-button notification" onClick={() => notify('Belum ada notifikasi baru')}><Bell size={18}/><i/></button><div className="top-avatar">RF</div></div>
      </header>

      <div className="page-content">
        {active === 'Overview' ? <>
          <section className="welcome-row"><div><div className="eyebrow"><span/> YOUR CREATIVE SPACE</div><h1>Selamat datang di <em>Ruang Fakta.</em></h1><p>Semua ide besar dimulai dari satu pertanyaan. Mari buat sesuatu yang bermakna.</p></div><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={17}/> Buat konten baru</button></section>
          <section className="hero-card">
            <div className="hero-glow"/><div className="hero-copy"><div className="hero-kicker"><WandSparkles size={14}/> CREATOR'S NOTE</div><h2>Rasa ingin tahu adalah<br/>awal dari <span>segalanya.</span></h2><p>Temukan fakta. Ceritakan dengan cara berbeda. Buka wawasan baru.</p><button className="hero-link" onClick={() => setActive('Ide & Riset')}>Jelajahi ruang ide <ArrowUpRight size={15}/></button></div>
            <div className="orbit-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><span>RF</span></div><div className="orbit-node node-a">✦</div><div className="orbit-node node-b">◉</div><div className="orbit-node node-c">⌘</div></div>
            <div className="hero-index">01 <span>/</span> 04</div>
          </section>
          <section className="section-heading"><div><h3>Studio overview</h3><p>Pantau perjalanan produksi kontenmu.</p></div><button className="subtle-button" onClick={() => setActive('Analitik')}>Lihat laporan <ArrowUpRight size={14}/></button></section>
          <section className="stats-grid">
            <Stat icon={Video} label="Total konten" value={videos.length} note="Dalam workspace" tone="blue"/>
            <Stat icon={Lightbulb} label="Dalam pengembangan" value={videos.filter(v => ['Ide','Riset','Penulisan'].includes(v.status)).length} note="Ide hingga naskah" tone="purple"/>
            <Stat icon={Clock3} label="Siap ditayangkan" value={count('Terjadwal')} note="Masuk jadwal publikasi" tone="amber"/>
            <Stat icon={Target} label="Sudah diterbitkan" value={count('Terbit')} note="Konten live" tone="green"/>
          </section>
          <section className="content-grid">
            <div className="panel video-panel">
              <div className="panel-heading"><div><h3>Konten terbaru</h3><p>Perjalanan setiap cerita dimulai di sini.</p></div><button className="icon-button" onClick={() => setActive('Konten Video')}><ArrowUpRight size={17}/></button></div>
              <div className="video-list">{videos.slice(0,4).map(v => <VideoRow key={v.id} video={v} onClick={() => {setActive('Konten Video');}}/>)}</div>
              <button className="view-all" onClick={() => setActive('Konten Video')}>Lihat semua konten <ArrowUpRight size={14}/></button>
            </div>
            <div className="panel pipeline-panel">
              <div className="panel-heading"><div><h3>Alur produksi</h3><p>Distribusi status konten.</p></div><Activity size={17} className="muted"/></div>
              <div className="pipeline">{stages.map((s,i) => <div className="pipeline-row" key={s}><div className="pipeline-label"><span className={`stage-dot stage-${i}`}/>{s}</div><div className="pipeline-track"><span style={{width: `${videos.length ? Math.max(5, count(s)/videos.length*100) : 0}%`}}/></div><strong>{count(s)}</strong></div>)}</div>
              <div className="pipeline-foot"><span className="live-dot"/> Alur kerja aktif <span className="pipeline-total">{videos.length} konten</span></div>
            </div>
          </section>
          <section className="bottom-grid">
            <div className="panel category-panel"><div className="panel-heading"><div><h3>Jelajahi kategori</h3><p>Ruang untuk setiap rasa ingin tahu.</p></div><Compass size={17} className="muted"/></div><div className="category-grid">{categories.map(c => <button key={c.name} className="category-chip" onClick={() => {setFilter('Semua');setSearch(c.name);setActive('Konten Video')}}><span style={{color:c.color}}>{c.icon}</span><strong>{c.name}</strong><ArrowUpRight size={13}/></button>)}</div></div>
            <div className="quote-panel"><div className="quote-mark">“</div><p>Konten yang baik bukan hanya memberi jawaban, tetapi membuat orang ingin bertanya lebih jauh.</p><span>FILOSOFI RUANG FAKTA</span><div className="quote-decoration">RF</div></div>
          </section>
        </> : active === 'Naskah' ? <ScriptWriter videos={videos} notify={notify}/> : active === 'Produksi' ? <ProductionStudio videos={videos} notify={notify} onCreate={() => setShowModal(true)}/> : <section className="list-page">
          <div className="eyebrow"><span/> RUANG KERJA</div><div className="list-title-row"><div><h1>{active}</h1><p>Kelola dan kembangkan setiap cerita RUANG FAKTA.</p></div><button className="primary-button" onClick={() => setShowModal(true)}><Plus size={17}/> Buat konten baru</button></div>
          <div className="panel list-panel"><div className="list-toolbar"><div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul atau kategori..."/></div><div className="filter-wrap"><Filter size={15}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Semua</option>{stages.map(s=><option key={s}>{s}</option>)}</select></div></div>
            <div className="table-head"><span>JUDUL KONTEN</span><span>KATEGORI</span><span>STATUS</span><span>JADWAL</span></div>
            {visible.length ? visible.map(v=><div className="table-row" key={v.id}><div className="table-title"><div className="video-thumb" style={{'--accent':v.color}}><Play size={14}/></div><div><strong>{v.title}</strong><small>Video • {v.duration}</small></div></div><span className="table-category">{v.category}</span><span><i className={`status-tag ${statusClass(v.status)}`}>{v.status}</i></span><span className="table-date">{v.date}</span></div>) : <div className="empty-state"><Search size={25}/><strong>Konten tidak ditemukan</strong><span>Coba kata kunci atau filter yang berbeda.</span></div>}
          </div>
          <div className="list-foot">{visible.length} dari {videos.length} konten ditampilkan</div>
        </section>}
        <footer><span>© 2026 RUANG FAKTA STUDIO</span><span>Dibuat untuk rasa ingin tahu. <b>✦</b></span></footer>
      </div>
    </main>

    {showModal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowModal(false)}}><form className="modal" onSubmit={addVideo}><div className="modal-head"><div><div className="eyebrow"><span/> NEW PROJECT</div><h2>Mulai sebuah cerita.</h2><p>Tambahkan ide konten baru ke workspace.</p></div><button type="button" className="icon-button" onClick={()=>setShowModal(false)}><X size={18}/></button></div><label>Judul konten<input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Contoh: Rahasia di balik..." /></label><div className="modal-fields"><label>Kategori<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Status awal<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{stages.map(s=><option key={s}>{s}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="subtle-button" onClick={()=>setShowModal(false)}>Batal</button><button className="primary-button" type="submit"><Plus size={16}/> Tambahkan konten</button></div></form></div>}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}


function ScriptWriter({ videos, notify }) {
  const [videoId, setVideoId] = useState(videos[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('8');
  const [style, setStyle] = useState('Dokumenter sinematik');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVideoId(videos[0]?.id || '');
  }, [videos.length]);

  useEffect(() => {
    let alive = true;
    async function loadDraft() {
      setDraft('');
      if (!videoId) return;
      const { data, error } = await supabase.from('video_scripts').select('body').eq('video_id', videoId).maybeSingle();
      if (alive && !error && data?.body) setDraft(data.body);
      if (alive && error) notify('Gagal memuat naskah: ' + error.message);
    }
    loadDraft();
    return () => { alive = false; };
  }, [videoId]);

  async function generate() {
    if (!topic.trim()) { notify('Masukkan ide atau topik video terlebih dahulu.'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('generate-script', {
      body: { topic: topic.trim(), duration: Number(duration), style }
    });
    setBusy(false);
    if (error) {
      let message = error.message || 'Gagal membuat naskah.';
      try { const payload = await error.context?.json(); if (payload?.error) message = payload.error; } catch {}
      notify(message);
      return;
    }
    if (!data?.script) { notify(data?.error || 'AI belum mengembalikan naskah.'); return; }
    setDraft(data.script);
    notify('Draft naskah berhasil dibuat. Periksa dan edit sebelum disimpan.');
  }

  async function saveDraft() {
    if (!videoId) { notify('Buat konten video terlebih dahulu.'); return; }
    if (!draft.trim()) { notify('Naskah masih kosong.'); return; }
    setSaving(true);
    const { error } = await supabase.from('video_scripts').upsert({
      video_id: videoId,
      body: draft.trim(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'video_id' });
    setSaving(false);
    if (error) { notify('Gagal menyimpan naskah: ' + error.message); return; }
    notify('Naskah berhasil disimpan ke Supabase.');
  }

  return <section className="script-page">
    <div className="eyebrow"><span/> AI-POWERED WORKSPACE</div>
    <div className="script-heading"><div><h1>AI Script Writer</h1><p>Ubah rasa ingin tahu menjadi naskah video yang siap dikembangkan.</p></div><span className="script-status"><Sparkles size={14}/> RUANG FAKTA AI</span></div>
    <div className="script-layout">
      <div className="panel script-controls">
        <div className="panel-heading"><div><h3>Konsep video</h3><p>Tentukan arah cerita sebelum menulis.</p></div><WandSparkles size={18} className="muted"/></div>
        <label>Hubungkan ke konten video
          <select value={videoId} onChange={e=>setVideoId(e.target.value)}>
            <option value="">Pilih konten video</option>
            {videos.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </label>
        <label>Ide atau topik video
          <textarea rows="4" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Contoh: Mengapa luar angkasa terdengar sunyi, dan apa yang sebenarnya terjadi di sana?"/>
        </label>
        <div className="script-fields">
          <label>Durasi target
            <select value={duration} onChange={e=>setDuration(e.target.value)}><option value="5">5 menit</option><option value="8">8 menit</option><option value="10">10 menit</option><option value="12">12 menit</option><option value="15">15 menit</option></select>
          </label>
          <label>Gaya bercerita
            <select value={style} onChange={e=>setStyle(e.target.value)}><option>Dokumenter sinematik</option><option>Edukasi ringan</option><option>Misteri menegangkan</option><option>Storytelling investigatif</option><option>Fakta cepat dan padat</option></select>
          </label>
        </div>
        <button className="primary-button script-generate" onClick={generate} disabled={busy}>
          <WandSparkles size={16}/>{busy ? 'Sedang menyusun naskah...' : 'Buat naskah dengan AI'}
        </button>
        <p className="script-hint"><CheckCircle2 size={13}/> Naskah dibuat dalam bahasa Indonesia. Selalu verifikasi fakta dan sumber sebelum publikasi.</p>
      </div>
      <div className="panel script-editor">
        <div className="panel-heading"><div><h3>Editor naskah</h3><p>Hasil AI bisa langsung kamu revisi di sini.</p></div><FileText size={18} className="muted"/></div>
        <textarea className="script-draft" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Naskah yang dihasilkan AI akan muncul di sini. Kamu juga bisa menulis atau menempelkan naskah sendiri."/>
        <div className="script-editor-foot"><span>{draft.trim() ? draft.trim().split(/\s+/).length.toLocaleString('id-ID') + ' kata' : 'Belum ada naskah'}</span><button className="primary-button" onClick={saveDraft} disabled={saving || !draft.trim() || !videoId}><CheckCircle2 size={15}/>{saving ? 'Menyimpan...' : 'Simpan naskah'}</button></div>
      </div>
    </div>
  </section>;
}

function ProductionStudio({ videos, notify, onCreate }) {
  const [videoId, setVideoId] = useState(videos[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('8');
  const [style, setStyle] = useState('Dokumenter sinematik');
  const [production, setProduction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVideoId(videos[0]?.id || '');
  }, [videos.length]);

  useEffect(() => {
    let alive = true;
    async function loadProduction() {
      setProduction(null);
      if (!videoId) return;
      const { data, error } = await supabase.from('video_productions')
        .select('package').eq('video_id', videoId).maybeSingle();
      if (!alive) return;
      if (error) notify('Gagal memuat paket produksi: ' + error.message);
      else if (data?.package) setProduction(data.package);
      const selected = videos.find(v => String(v.id) === String(videoId));
      if (selected) setTopic(selected.title);
    }
    loadProduction();
    return () => { alive = false; };
  }, [videoId]);

  async function generate() {
    if (!videoId) { notify('Buat konten video terlebih dahulu.'); return; }
    if (!topic.trim()) { notify('Masukkan topik video terlebih dahulu.'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('generate-production', {
      body: { topic: topic.trim(), duration: Number(duration), style }
    });
    setBusy(false);
    if (error) {
      let message = error.message || 'Gagal membuat paket produksi.';
      try { const payload = await error.context?.json(); if (payload?.error) message = payload.error; } catch {}
      notify(message);
      return;
    }
    if (!data?.production) { notify(data?.error || 'AI belum mengembalikan paket produksi.'); return; }
    setProduction(data.production);
    notify('Paket produksi berhasil dibuat. Periksa dan edit sebelum disimpan.');
  }

  async function saveProduction() {
    if (!videoId || !production) return;
    setSaving(true);
    const { error } = await supabase.from('video_productions').upsert({
      video_id: videoId,
      package: production,
      updated_at: new Date().toISOString()
    }, { onConflict: 'video_id' });
    setSaving(false);
    if (error) { notify('Gagal menyimpan paket produksi: ' + error.message); return; }
    notify('Paket produksi berhasil disimpan ke Supabase.');
  }

  function updateScene(index, field, value) {
    setProduction(prev => ({
      ...prev,
      scenes: prev.scenes.map((scene, i) => i === index ? { ...scene, [field]: value } : scene)
    }));
  }

  if (!videos.length) return <section className="production-page">
    <div className="eyebrow"><span/> AI VIDEO WORKFLOW</div>
    <div className="production-heading"><div><h1>AI Production Studio</h1><p>Buat konten video terlebih dahulu untuk memulai paket produksi.</p></div></div>
    <div className="panel production-empty"><Clapperboard size={30}/><h3>Belum ada konten video</h3><p>Tambahkan satu ide video ke workspace, lalu susun storyboard dan materi publikasinya.</p><button className="primary-button" onClick={onCreate}><Plus size={16}/> Buat konten video</button></div>
  </section>;

  return <section className="production-page">
    <div className="eyebrow"><span/> AI VIDEO WORKFLOW</div>
    <div className="production-heading"><div><h1>AI Production Studio</h1><p>Ubah satu naskah menjadi panduan produksi dan paket publikasi.</p></div><span className="script-status"><Sparkles size={14}/> RUANG FAKTA AI</span></div>
    <div className="production-layout">
      <div className="panel production-controls">
        <div className="panel-heading"><div><h3>Konsep produksi</h3><p>Tentukan konten yang akan dikembangkan.</p></div><WandSparkles size={18} className="muted"/></div>
        <label>Konten video
          <select value={videoId} onChange={e=>setVideoId(e.target.value)}>
            {videos.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </label>
        <label>Topik / ringkasan naskah
          <textarea rows="5" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Masukkan topik, sudut cerita, atau ringkasan naskah..."/>
        </label>
        <div className="production-fields">
          <label>Durasi target
            <select value={duration} onChange={e=>setDuration(e.target.value)}><option value="5">5 menit</option><option value="8">8 menit</option><option value="10">10 menit</option><option value="12">12 menit</option><option value="15">15 menit</option></select>
          </label>
          <label>Gaya visual
            <select value={style} onChange={e=>setStyle(e.target.value)}><option>Dokumenter sinematik</option><option>Ilustrasi edukasi</option><option>Misteri atmosferik</option><option>Realistis investigatif</option><option>Motion graphic modern</option></select>
          </label>
        </div>
        <button className="primary-button production-generate" onClick={generate} disabled={busy}>
          <WandSparkles size={16}/>{busy ? 'Menyusun paket produksi...' : 'Buat Paket Produksi'}
        </button>
        <p className="script-hint"><CheckCircle2 size={13}/> AI menyusun arahan produksi. Prompt gambar dapat digunakan di generator gambar pilihanmu; hasil gambar/video tidak dibuat otomatis di tahap ini.</p>
      </div>

      <div className="production-results">
        {!production ? <div className="panel production-placeholder"><Clapperboard size={28}/><h3>Ruang produksi siap</h3><p>Pilih konten, tulis topik, lalu buat paket produksi dengan AI.</p></div> : <>
          <div className="panel production-title-panel">
            <div className="production-result-head"><div><span className="production-kicker">WORKING TITLE</span><h2>{production.working_title || 'Paket produksi'}</h2></div><button className="primary-button production-save" onClick={saveProduction} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan paket'}</button></div>
            <div className="production-subhead">Pilihan judul YouTube</div>
            <div className="production-title-options">{(production.title_options || []).map((title,i)=><button key={i} onClick={()=>setProduction(p=>({...p,working_title:title}))}>{title}</button>)}</div>
          </div>

          <div className="panel production-section">
            <div className="panel-heading"><div><h3>Storyboard & voice-over</h3><p>{production.scenes?.length || 0} adegan • arahan visual, kamera, audio, dan narasi</p></div><span className="production-count">{production.scenes?.length || 0} SCENE</span></div>
            <div className="production-scenes">{(production.scenes || []).map((scene,i)=><article className="production-scene" key={scene.scene_number || i}>
              <div className="production-scene-top"><span>SCENE {String(scene.scene_number || i+1).padStart(2,'0')}</span><strong>{scene.section || 'Adegan'} · {scene.estimated_seconds || '—'} dtk</strong></div>
              <label>Arahan visual<textarea rows="2" value={scene.visual_direction || ''} onChange={e=>updateScene(i,'visual_direction',e.target.value)}/></label>
              <label>Prompt gambar<textarea rows="3" value={scene.image_prompt || ''} onChange={e=>updateScene(i,'image_prompt',e.target.value)}/></label>
              <div className="production-scene-meta"><span>KAMERA: {scene.camera_motion || '—'}</span><span>AUDIO: {scene.sound_design || '—'}</span></div>
              <label>Narasi voice-over<textarea rows="4" value={scene.voiceover || ''} onChange={e=>updateScene(i,'voiceover',e.target.value)}/></label>
            </article>)}</div>
          </div>

          <div className="panel production-section">
            <div className="panel-heading"><div><h3>Thumbnail & publikasi</h3><p>Materi visual dan metadata YouTube.</p></div><Sparkles size={17} className="muted"/></div>
            <div className="production-thumb">
              <div><span className="production-kicker">THUMBNAIL CONCEPT</span><h4>{production.thumbnail?.concept || 'Konsep thumbnail'}</h4><p>Teks thumbnail: <strong>{production.thumbnail?.text_overlay || '—'}</strong></p></div>
              <label>Prompt thumbnail<textarea rows="4" value={production.thumbnail?.image_prompt || ''} onChange={e=>setProduction(p=>({...p,thumbnail:{...p.thumbnail,image_prompt:e.target.value}}))}/></label>
            </div>
            <label className="production-description">Deskripsi YouTube<textarea rows="7" value={production.description || ''} onChange={e=>setProduction(p=>({...p,description:e.target.value}))}/></label>
            <div className="production-tags">{(production.tags || []).map((tag,i)=><span key={i}>#{String(tag).replace(/^#/,'')}</span>)}</div>
          </div>
          {production.production_notes?.length > 0 && <div className="panel production-section"><div className="panel-heading"><div><h3>Catatan produksi & verifikasi</h3><p>Periksa sebelum proses editing dan publikasi.</p></div></div><ul className="production-notes">{production.production_notes.map((note,i)=><li key={i}>{note}</li>)}</ul></div>}
        </>}
      </div>
    </div>
  </section>;
}

function Stat({icon:Icon,label,value,note,tone}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
function VideoRow({video,onClick}) { return <button className="video-row" onClick={onClick}><div className="video-thumb" style={{'--accent':video.color}}><Play size={14}/></div><div className="video-row-info"><strong>{video.title}</strong><span>{video.category} <i/> {video.duration}</span></div><i className={`status-tag ${statusClass(video.status)}`}>{video.status}</i><ArrowUpRight size={15} className="row-arrow"/></button>; }

export default App;