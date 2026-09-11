const CONFIG = window.WN_CONFIG || {};
const FUNCTION_URL = CONFIG.supabaseUrl ? `${CONFIG.supabaseUrl.replace(/\/$/, '')}/functions/v1/sheeesh` : '';
const PUBLISHABLE_KEY = CONFIG.supabasePublishableKey || CONFIG.supabaseAnonKey || '';
const SESSION_KEY = 'sheeesh-session-v1';

const $ = selector => document.querySelector(selector);
const loginCard = $('#loginCard');
const loginForm = $('#loginForm');
const passwordInput = $('#passwordInput');
const loginMessage = $('#loginMessage');
const message = $('#message');
const teamGrid = $('#teamGrid');
const refreshButton = $('#refreshButton');
const leagueTools = $('#leagueTools');
const lastRefreshed = $('#lastRefreshed');
const seasonLabel = $('#seasonLabel');
const weekLabel = $('#weekLabel');

let sessionToken = sessionStorage.getItem(SESSION_KEY) || '';

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '—';
}

function formatTime(game) {
  if (!game) return '';
  const date = new Date(game.date);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

function gameMarkup(game) {
  if (!game) return '<span class="play-state upcoming">Schedule TBD</span>';
  const stateClass = game.state === 'post' ? 'played' : game.state === 'in' ? 'live' : 'upcoming';
  const opponent = game.opponent ? `vs ${esc(game.opponent)}` : '';
  const time = formatTime(game);
  return `<span class="play-state ${stateClass}">${esc(game.label || 'Not played')}</span><span class="play-detail">${opponent}${opponent && time ? ' · ' : ''}${esc(time)}</span>`;
}

function healthMarkup(health) {
  if (!health) return '';
  const safeClass = String(health).toLowerCase().replace(/[^a-z]+/g, '-');
  return `<span class="health health-${safeClass}">${esc(health)}</span>`;
}

function playerMarkup(player) {
  return `<article class="player-row">
    <div class="player-avatar"><span>${esc(initials(player.name))}</span><img src="${esc(player.avatar || '')}" alt="" onerror="this.remove()"></div>
    <div class="player-main">
      <div class="player-name">${esc(player.name)}</div>
      <div class="player-meta"><span>${esc(player.position || '—')}</span>${player.teamCode ? `<span>${esc(player.teamCode)}</span>` : ''}${player.lineupSlot && player.lineupSlot !== player.position ? `<span>${esc(player.lineupSlot)}</span>` : ''}</div>
      <div class="player-status">${gameMarkup(player.game)}</div>
      ${healthMarkup(player.health)}
    </div>
  </article>`;
}

function playerColumn(title, players) {
  return `<div class="player-column"><div class="column-heading">${title}</div>${players.length ? players.map(playerMarkup).join('') : '<div class="empty-column">No players listed</div>'}</div>`;
}

function teamMarkup(team) {
  return `<article class="team-card">
    <header class="team-header">
      <div class="team-heading">
        <div class="team-logo"><span>${esc(initials(team.name))}</span>${team.logo ? `<img src="${esc(team.logo)}" alt="" onerror="this.remove()">` : ''}</div>
        <div><h2>${esc(team.name)}</h2>${team.abbreviation ? `<div class="team-abbreviation">${esc(team.abbreviation)}</div>` : ''}</div>
      </div>
    </header>
    <div class="team-columns">${playerColumn('Starters', team.starters || [])}${playerColumn('Bench', team.bench || [])}</div>
  </article>`;
}

function setMessage(text = '', isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
  message.hidden = !text;
}

function setBusy(busy) {
  if (!refreshButton) return;
  refreshButton.disabled = busy;
  refreshButton.textContent = busy ? 'Refreshing…' : 'Refresh';
}

async function callFunction(method, body = null) {
  const headers = {};
  if (PUBLISHABLE_KEY) {
    headers.apikey = PUBLISHABLE_KEY;
  }
  if (sessionToken) headers['x-sheeesh-session'] = sessionToken;
  if (body) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(FUNCTION_URL, { method, cache: 'no-store', headers, body: body ? JSON.stringify(body) : undefined });
  } catch (_) {
    throw new Error('Sheeesh is not live yet. Upload the /sheeesh folder and deploy the Supabase function first.');
  }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function login(event) {
  event.preventDefault();
  loginMessage.textContent = 'Checking…';
  try {
    const { response, data } = await callFunction('POST', { password: passwordInput.value });
    if (!response.ok) throw new Error(data.error || 'Password rejected.');
    sessionToken = data.token;
    sessionStorage.setItem(SESSION_KEY, sessionToken);
    passwordInput.value = '';
    loginMessage.textContent = '';
    await loadLeague();
  } catch (error) {
    loginMessage.textContent = error.message || 'Could not open Sheeesh.';
  }
}

async function loadLeague() {
  if (!FUNCTION_URL) {
    setMessage('Sheeesh is not connected to Supabase yet.', true);
    return;
  }
  setBusy(true);
  setMessage('Loading league…');
  try {
    const { response, data } = await callFunction('GET');
    if (response.status === 401) {
      sessionToken = '';
      sessionStorage.removeItem(SESSION_KEY);
      loginCard.hidden = false;
      teamGrid.hidden = true;
      if (refreshButton) refreshButton.hidden = true;
      if (leagueTools) leagueTools.hidden = true;
      throw new Error('Session expired. Enter the password again.');
    }
    if (!response.ok) throw new Error(data.error || `Connection failed (${response.status})`);
    seasonLabel.textContent = data.season || '2026';
    weekLabel.textContent = data.week ? `Week ${data.week}` : 'Current week';
    teamGrid.innerHTML = (data.teams || []).map(teamMarkup).join('');
    teamGrid.hidden = false;
    loginCard.hidden = true;
    if (refreshButton) refreshButton.hidden = false;
    if (leagueTools) leagueTools.hidden = false;
    setMessage(data.teams?.length ? '' : 'No ESPN teams were returned.', !data.teams?.length);
    const refreshed = data.refreshedAt ? new Date(data.refreshedAt) : new Date();
    lastRefreshed.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(refreshed)}`;
    lastRefreshed.title = refreshed.toLocaleString();
  } catch (error) {
    if (!sessionToken) teamGrid.hidden = true;
    setMessage(error.message || 'Sheeesh could not refresh.', true);
  } finally {
    setBusy(false);
  }
}

loginForm.addEventListener('submit', login);
refreshButton.addEventListener('click', loadLeague);
if (sessionToken) loadLeague();
