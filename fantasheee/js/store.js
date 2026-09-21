import { APP_CONFIG } from './config.js?v=11';

const LOCAL_KEY = 'fantasheee.state.v1';
const LOCAL_STATE_VERSION = 2;
let supabase = null;

export function selectedTeamId() {
  return localStorage.getItem('fantasheee.teamId') || '';
}
export function selectTeam(id) {
  localStorage.setItem('fantasheee.teamId', id);
}
export function clearSelectedTeam() {
  localStorage.removeItem('fantasheee.teamId');
}

export async function initStore() {
  if (APP_CONFIG.supabase.url && APP_CONFIG.supabase.anonKey) {
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      supabase = createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      return { mode: 'cloud', supabase };
    } catch (error) {
      console.warn('Supabase unavailable, using local mode.', error);
    }
  }
  ensureLocalState();
  return { mode: 'local', supabase: null };
}

function ensureLocalState() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(emptyLocalState()));
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeLocalState(parsed);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
  } catch (_) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(emptyLocalState()));
  }
}

function emptyLocalState() {
  const state = {
    version: LOCAL_STATE_VERSION,
    teams: APP_CONFIG.teams.map((t,i) => ({ ...t, wins: 0, losses: 0, waiver_priority: i + 1 })),
    roster: {},
    lineups: {},
    claims: [],
    transactions: [],
    matchups: {},
    week: APP_CONFIG.currentWeekFallback
  };
  APP_CONFIG.teams.forEach((t) => { state.roster[t.id] = []; state.lineups[t.id] = {}; });
  return state;
}

function normalizeLocalState(value) {
  const base = emptyLocalState();
  if (!value || typeof value !== 'object') return base;
  const savedTeams = Array.isArray(value.teams) ? value.teams : [];
  base.teams = APP_CONFIG.teams.map((team, index) => {
    const saved = savedTeams.find((candidate) => candidate?.id === team.id) || {};
    return {
      ...team,
      ...saved,
      wins: Number(saved.wins || 0),
      losses: Number(saved.losses || 0),
      waiver_priority: Number(saved.waiver_priority || index + 1)
    };
  });
  APP_CONFIG.teams.forEach((team) => {
    const roster = Array.isArray(value.roster?.[team.id])
      ? [...new Set(value.roster[team.id].map((id) => String(id)).filter(Boolean))]
      : [];
    const lineups = value.lineups?.[team.id] && typeof value.lineups[team.id] === 'object'
      ? Object.fromEntries(Object.entries(value.lineups[team.id]).filter(([id, slot]) => roster.includes(id) && typeof slot === 'string'))
      : {};
    base.roster[team.id] = roster;
    base.lineups[team.id] = lineups;
  });
  base.claims = Array.isArray(value.claims) ? value.claims : [];
  base.transactions = Array.isArray(value.transactions) ? value.transactions : [];
  base.matchups = value.matchups && typeof value.matchups === 'object' ? value.matchups : {};
  base.week = Number(value.week || APP_CONFIG.currentWeekFallback);
  return base;
}

function readLocal() { ensureLocalState(); return JSON.parse(localStorage.getItem(LOCAL_KEY)); }

export async function loadLeague(week) {
  if (!supabase) {
    return readLocal();
  }
  const [teams, roster, lineups, claims, transactions, matchups] = await Promise.all([
    supabase.from('fantasheee_teams').select('*').order('waiver_priority'),
    supabase.from('fantasheee_roster').select('*'),
    supabase.from('fantasheee_lineups').select('*').eq('week', week),
    supabase.from('fantasheee_waiver_claims').select('*').eq('week', week).order('created_at'),
    supabase.from('fantasheee_transactions').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('fantasheee_matchups').select('*').eq('week', week)
  ]);
  [teams, roster, lineups, claims, transactions, matchups].forEach((r) => { if (r.error) throw r.error; });
  const league = { teams: teams.data, roster: {}, lineups: {}, claims: claims.data, transactions: transactions.data, matchups: {} };
  teams.data.forEach((t) => { league.roster[t.id] = []; league.lineups[t.id] = {}; });
  roster.data.forEach((r) => league.roster[r.team_id]?.push(r.player_id));
  lineups.data.forEach((r) => { league.lineups[r.team_id][r.player_id] = r.slot; });
  matchups.data.forEach((m) => { league.matchups[m.team_a] = m.team_b; league.matchups[m.team_b] = m.team_a; });
  return league;
}

export async function subscribeLeague(onChange) {
  if (!supabase) {
    window.addEventListener('storage', onChange);
    return () => window.removeEventListener('storage', onChange);
  }
  const channel = supabase.channel('fantasheee-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasheee_roster' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasheee_lineups' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasheee_waiver_claims' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasheee_transactions' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
