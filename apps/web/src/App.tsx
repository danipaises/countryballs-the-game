import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ArenaSnapshot } from '@countryballs/arena-2d';
import { countries } from '@countryballs/cloud-contracts';
import type { CloudAdmission, CloudRoom, CloudRosterEntry, CloudRoomVisibility, CountryCode } from '@countryballs/cloud-contracts';
import { backendProvider, gameServerProvider } from './providers.js';

const ArenaGame = lazy(async () => ({ default: (await import('./ArenaGame.js')).ArenaGame }));

type Page = 'home' | 'play' | 'servers';
type Profile = { name: string; country: CountryCode };
const labels: Record<CountryCode, string> = { BR: 'Brasil', PT: 'Portugal', AR: 'Argentina', US: 'Estados Unidos', JP: 'Japão', DE: 'Alemanha', FR: 'França', IT: 'Itália' };

function loadProfile(): Profile {
  try { return { name: localStorage.getItem('cb-name') || 'Jogador', country: (localStorage.getItem('cb-country') as CountryCode) || 'BR' }; }
  catch { return { name: 'Jogador', country: 'BR' }; }
}

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [profile, setProfile] = useState(loadProfile);
  const [admission, setAdmission] = useState<CloudAdmission | null>(null);
  const saveProfile = (next: Profile) => {
    setProfile(next); localStorage.setItem('cb-name', next.name); localStorage.setItem('cb-country', next.country);
  };
  if (admission) return <MatchScreen admission={admission} leave={() => setAdmission(null)} />;
  return <div className="app">
    <header className="topbar">
      <button className="brand" onClick={() => setPage('home')}><span className="brand-ball">CB</span><span>CountryBalls <b>Games</b></span></button>
      <nav>
        <button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>Início</button>
        <button className={page === 'play' ? 'active' : ''} onClick={() => setPage('play')}>Jogar</button>
        <button className={page === 'servers' ? 'active' : ''} onClick={() => setPage('servers')}>Salas</button>
        <button disabled title="Em breve">Amigos</button>
      </nav>
      <button className="profile-chip" onClick={() => setPage('play')}><span>{profile.country}</span>{profile.name}</button>
    </header>
    <main>
      {page === 'home' && <Home onPlay={() => setPage('play')} />}
      {page === 'play' && <Play profile={profile} saveProfile={saveProfile} enter={setAdmission} />}
      {page === 'servers' && <Servers profile={profile} enter={setAdmission} />}
    </main>
    <footer>Plataforma 0.2.0 · Protocolo 1 · Hospedado na rede Cloudflare</footer>
  </div>;
}

function Home({ onPlay }: { onPlay(): void }) {
  return <>
    <section className="hero">
      <div><p className="eyebrow">MULTIPLAYER NO NAVEGADOR</p><h1>Um mundo de jogos.<br /><em>Uma arena global.</em></h1>
        <p className="hero-copy">Entre com amigos, escolha seu CountryBall e dispute partidas rápidas em qualquer tela.</p>
        <div className="hero-actions"><button className="primary" onClick={onPlay}>Jogar agora <span>→</span></button><button className="secondary" onClick={onPlay}>Criar sala</button></div>
        <div className="feature-row"><span>⚡ Servidor autoritativo</span><span>☁ Cloudflare</span><span>▣ PWA</span></div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="planet planet-a">BR</div><div className="planet planet-b">JP</div><div className="orbit" /></div>
    </section>
    <section className="section"><div className="section-title"><div><p className="eyebrow">ESCOLHA SEU JOGO</p><h2>A competição começa aqui</h2></div><span>Arena disponível agora</span></div>
      <div className="game-grid"><GameCard name="CountryBalls Arena" meta="2D · 2–8 jogadores" playable onClick={onPlay} /><GameCard name="CountryBalls Kart" meta="3D · 2–8 jogadores" /><GameCard name="CountryBalls Football" meta="2D/3D · 2–8 jogadores" /><GameCard name="CountryBalls Party" meta="3D · 2–8 jogadores" /></div>
    </section>
  </>;
}

function GameCard({ name, meta, playable = false, onClick }: { name: string; meta: string; playable?: boolean; onClick?: () => void }) {
  return <article className={`game-card ${playable ? 'playable' : ''}`}><div className="game-visual"><span>{name.split(' ')[1]?.slice(0, 1)}</span></div><div><h3>{name}</h3><p>{meta}</p></div>{playable ? <button onClick={onClick}>Jogar →</button> : <span className="soon">Em breve</span>}</article>;
}

function ProfileFields({ profile, change }: { profile: Profile; change(profile: Profile): void }) {
  return <div className="profile-fields"><label>Seu nome<input maxLength={20} value={profile.name} onChange={event => change({ ...profile, name: event.target.value })} /></label><label>CountryBall<select value={profile.country} onChange={event => change({ ...profile, country: event.target.value as CountryCode })}>{countries.map(country => <option key={country} value={country}>{country} · {labels[country]}</option>)}</select></label></div>;
}

function Play({ profile, saveProfile, enter }: { profile: Profile; saveProfile(profile: Profile): void; enter(value: CloudAdmission): void }) {
  const [draft, setDraft] = useState(profile); const [roomName, setRoomName] = useState('Arena de ' + profile.name); const [visibility, setVisibility] = useState<CloudRoomVisibility>('public'); const [maxPlayers, setMaxPlayers] = useState(8); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async (operation: () => Promise<CloudAdmission>) => { setBusy(true); setError(''); try { saveProfile(draft); enter(await operation()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.'); } finally { setBusy(false); } };
  const valid = draft.name.trim().length >= 2;
  return <section className="panel-page"><div className="page-heading"><p className="eyebrow">JOGAR</p><h1>Prepare sua partida</h1><p>Crie uma arena na Cloudflare ou entre com um código privado.</p></div>
    <div className="setup-grid"><article className="panel"><h2>1. Seu jogador</h2><ProfileFields profile={draft} change={setDraft} /></article>
      <article className="panel"><h2>2. Criar sala</h2><label>Nome da sala<input maxLength={30} value={roomName} onChange={event => setRoomName(event.target.value)} /></label><div className="inline-fields"><label>Visibilidade<select value={visibility} onChange={event => setVisibility(event.target.value as CloudRoomVisibility)}><option value="public">Pública</option><option value="private">Privada</option></select></label><label>Jogadores<select value={maxPlayers} onChange={event => setMaxPlayers(Number(event.target.value))}>{[2,3,4,5,6,7,8].map(value => <option key={value}>{value}</option>)}</select></label></div><button className="primary wide" disabled={busy || !valid || roomName.trim().length < 3} onClick={() => run(() => backendProvider.createRoom({ roomName: roomName.trim(), playerName: draft.name.trim(), country: draft.country, visibility, maxPlayers }))}>Criar e entrar</button></article>
      <article className="panel accent-panel"><h2>Entrar por código</h2><p>Use o código enviado por quem criou uma sala privada.</p><label>Código da sala<input className="code-input" placeholder="CB-XXXXXX" value={code} onChange={event => setCode(event.target.value.toUpperCase())} /></label><button className="secondary wide" disabled={busy || !valid || code.trim().length < 4} onClick={() => run(() => backendProvider.joinByCode(draft.name.trim(), draft.country, code))}>Entrar na sala</button></article></div>{error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}

function Servers({ profile, enter }: { profile: Profile; enter(value: CloudAdmission): void }) {
  const [rooms, setRooms] = useState<CloudRoom[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = useCallback(async () => { setLoading(true); try { setRooms(await backendProvider.listRooms()); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao listar salas.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 10_000); return () => clearInterval(timer); }, [refresh]);
  const join = async (room: CloudRoom) => { try { enter(await backendProvider.joinRoom(room.id, { playerName: profile.name, country: profile.country })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.'); } };
  return <section className="panel-page"><div className="page-heading split"><div><p className="eyebrow">SALAS PÚBLICAS</p><h1>Arenas disponíveis</h1><p>Lista atualizada automaticamente.</p></div><button className="secondary" onClick={() => void refresh()}>Atualizar</button></div>
    {error && <p className="error-message">{error}</p>}{loading && rooms.length === 0 ? <div className="empty">Procurando salas…</div> : rooms.length === 0 ? <div className="empty"><b>Nenhuma sala pública agora.</b><span>Crie a primeira e convide alguém para jogar.</span></div> : <div className="room-list">{rooms.map(room => <article className="room-row" key={room.id}><span className="online-dot" /><div><h3>{room.name}</h3><p>CountryBalls Arena · versão {room.gameVersion}</p></div><span className="status-pill">{room.status === 'lobby' ? 'No lobby' : 'Em partida'}</span><strong>{room.playerCount}/{room.maxPlayers}</strong><button onClick={() => void join(room)} disabled={room.status !== 'lobby'}>Entrar</button></article>)}</div>}
  </section>;
}

function MatchScreen({ admission, leave }: { admission: CloudAdmission; leave(): void }) {
  const client = useMemo(() => gameServerProvider.connect(admission), [admission]); const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null); const [roster, setRoster] = useState<CloudRosterEntry[]>([]); const [connection, setConnection] = useState('Conectando…'); const [error, setError] = useState('');
  useEffect(() => { const unsubscribe = client.subscribe(event => { if (event.type === 'connected') setConnection('Conectado'); if (event.type === 'state') setSnapshot(event.snapshot); if (event.type === 'roster') setRoster(event.roster); if (event.type === 'error') setError(event.message); if (event.type === 'closed') setConnection(event.message); }); client.connect(); return () => { unsubscribe(); client.close(); }; }, [client]);
  const local = snapshot?.players.find(player => player[0] === admission.playerId); const remaining = snapshot ? Math.ceil(snapshot.remainingTicks / 30) : 0; const minutes = Math.floor(remaining / 60); const seconds = String(remaining % 60).padStart(2, '0');
  return <div className="match-page"><header className="match-header"><button className="back-button" onClick={leave}>← Sair</button><div><b>{admission.room.name}</b><span>{connection}</span></div>{admission.room.code && <div className="room-code"><small>CÓDIGO</small><strong>{admission.room.code}</strong></div>}<div className="match-stat"><small>JOGADORES</small><strong>{roster.length}/{admission.room.maxPlayers}</strong></div></header>
    <div className="match-layout"><main className="game-column"><div className="hud"><span>❤ {local?.[3] ?? 100} HP</span><strong>{snapshot?.phase === 'running' ? `${minutes}:${seconds}` : snapshot?.phase === 'ended' ? 'FIM' : 'LOBBY'}</strong><span>★ {local?.[4] ?? 0}</span></div><Suspense fallback={<div className="game-loading">Carregando arena…</div>}><ArenaGame client={client} snapshot={snapshot} roster={roster} /></Suspense><p className="controls-hint">WASD ou setas para mover · Espaço para atacar</p></main>
      <aside className="scoreboard"><h2>Jogadores</h2>{roster.map(player => { const state = snapshot?.players.find(value => value[0] === player.playerId); return <div className="player-row" key={player.playerId}><span className="flag-token">{player.country}</span><div><b>{player.name}{player.playerId === admission.playerId ? ' (você)' : ''}</b><small>{state?.[6] ? 'Pronto' : snapshot?.phase === 'running' ? `${state?.[3] ?? 100} HP` : 'No lobby'}</small></div><strong>{state?.[4] ?? 0}</strong></div>; })}
        {snapshot?.phase === 'lobby' && <button className="primary wide" onClick={() => client.command('ready')}>Estou pronto</button>}{snapshot?.phase === 'ended' && <><div className="winner">🏆 {snapshot.winnerId ? `${roster.find(player => player.playerId === snapshot.winnerId)?.name ?? 'Jogador'} venceu!` : 'Partida encerrada'}</div><button className="primary wide" onClick={() => client.command('rematch')}>Quero revanche</button></>}{!snapshot && <p className="muted">Sincronizando arena…</p>}{error && <p className="error-message">{error}</p>}
      </aside></div>
  </div>;
}
