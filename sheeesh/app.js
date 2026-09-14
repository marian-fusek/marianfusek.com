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
const spoilerToggle = $('#spoilerToggle');
const playerSearch = $('#playerSearch');
const playerSearchResult = $('#playerSearchResult');
const seasonLabel = $('#seasonLabel');
const weekLabel = $('#weekLabel');

let sessionToken = sessionStorage.getItem(SESSION_KEY) || '';
let leagueData = null;
const TEAM_ORDER_KEY = 'sheeesh-team-order-v1';
const SPOILER_FREE_KEY = 'sheeesh-spoiler-free-v1';
let spoilerFree = localStorage.getItem(SPOILER_FREE_KEY) === 'true';
const DEFENSE_CODE_BY_NAME = {
  falcons: 'ATL', bills: 'BUF', bears: 'CHI', bengals: 'CIN', browns: 'CLE',
  cowboys: 'DAL', broncos: 'DEN', lions: 'DET', packers: 'GB', titans: 'TEN',
  colts: 'IND', chiefs: 'KC', raiders: 'LV', rams: 'LAR', dolphins: 'MIA',
  vikings: 'MIN', patriots: 'NE', saints: 'NO', giants: 'NYG', jets: 'NYJ',
  eagles: 'PHI', cardinals: 'ARI', chargers: 'LAC', steelers: 'PIT',
  '49ers': 'SF', seahawks: 'SEA', buccaneers: 'TB', commanders: 'WAS',
  panthers: 'CAR', jaguars: 'JAX', ravens: 'BAL', texans: 'HOU'
};

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

function displayedTeamCode(player) {
  if (player.position !== 'DEF') return player.teamCode || '';
  const name = String(player.name || '').toLowerCase();
  const nickname = Object.keys(DEFENSE_CODE_BY_NAME).find(teamName => name.includes(teamName));
  return nickname ? DEFENSE_CODE_BY_NAME[nickname] : player.teamCode || '';
}

function displayedAvatar(player) {
  const teamCode = displayedTeamCode(player);
  return player.position === 'DEF' && teamCode
    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${encodeURIComponent(teamCode.toLowerCase())}.png`
    : player.avatar;
}

function gameMarkup(game) {
  if (!game) return '<span class="play-state unavailable">Game time unavailable</span>';
  const stateClass = game.state === 'post' ? 'played' : game.state === 'in' ? 'live' : 'upcoming';
  const opponent = game.opponent ? `vs ${esc(game.opponent)}` : '';
  const time = formatTime(game);
  if (spoilerFree) return `<span class="play-detail">${opponent}${opponent && time ? ' · ' : ''}${esc(time)}</span>`;
  return `<span class="play-state ${stateClass}">${esc(game.label || 'Not played')}</span><span class="play-detail">${opponent}${opponent && time ? ' · ' : ''}${esc(time)}</span>`;
}

function healthMarkup(health) {
  if (!health) return '';
  const safeClass = String(health).toLowerCase().replace(/[^a-z]+/g, '-');
  return `<span class="health health-${safeClass}">${esc(health)}</span>`;
}

function playerMarkup(player) {
  const teamCode = displayedTeamCode(player);
  const avatar = displayedAvatar(player);
  return `<article class="player-row">
    <div class="player-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" onerror="this.remove()">` : ''}<span class="avatar-fallback">${esc(initials(player.name))}</span></div>
    <div class="player-main">
      <div class="player-name">${esc(player.name)}</div>
      <div class="player-meta"><span>${esc(player.position || '—')}</span>${teamCode ? `<span>${esc(teamCode)}</span>` : ''}${player.lineupSlot && player.lineupSlot !== player.position ? `<span>${esc(player.lineupSlot)}</span>` : ''}</div>
      <div class="player-status">${gameMarkup(player.game)}</div>
      ${spoilerFree ? '' : healthMarkup(player.health)}
    </div>
  </article>`;
}

function teamLogoFallback(team) {
  if (team.logoFallback) return team.logoFallback;
  const players = [...(team.starters || []), ...(team.bench || [])];
  const defense = players.find(player => player.position === 'DEF' && player.teamCode);
  const teamCode = defense ? displayedTeamCode(defense) : '';
  return teamCode ? `https://a.espncdn.com/i/teamlogos/nfl/500/${encodeURIComponent(teamCode.toLowerCase())}.png` : '';
}

function teamLogoMarkup(team, className) {
  const fallback = teamLogoFallback(team);
  const source = team.logo || fallback;
  if (!source) return '';
  return `<img class="${className}" src="${esc(source)}" alt="" ${fallback ? `data-fallback="${esc(fallback)}"` : ''} onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback}else{this.remove()}">`;
}

function playerColumn(title, players) {
  return `<div class="player-column"><div class="column-heading">${title}</div>${players.length ? players.map(playerMarkup).join('') : '<div class="empty-column">No players listed</div>'}</div>`;
}

function renderTeams() {
  if (!leagueData) return;
  teamGrid.innerHTML = leagueData.teams.map(teamMarkup).join('');
  enableTeamDragging();
  updateReorderControls();
  updatePlayerSearch();
}

function teamMarkup(team) {
  const logo = teamLogoMarkup(team, 'team-logo-image');
  return `<article class="team-card" data-team-id="${esc(team.id)}">
    <header class="team-header">
      <div class="team-heading">
        <div class="team-logo">${logo}<span class="logo-fallback">${esc(initials(team.name))}</span></div>
        <div><h2>${esc(team.name)}</h2>${team.abbreviation ? `<div class="team-abbreviation">${esc(team.abbreviation)}</div>` : ''}</div>
      </div>
      <div class="team-reorder-controls" aria-label="Reorder ${esc(team.name)}">
        <button class="team-reorder-button" type="button" data-move-team="up" aria-label="Move ${esc(team.name)} up" title="Move up">↑</button>
        <button class="team-reorder-button" type="button" data-move-team="down" aria-label="Move ${esc(team.name)} down" title="Move down">↓</button>
      </div>
      <button class="team-drag-handle" type="button" aria-label="Drag to reorder ${esc(team.name)}" title="Drag to reorder">⠿</button>
    </header>
    <div class="team-columns">${playerColumn('Starters', team.starters || [])}${playerColumn('Bench', team.bench || [])}</div>
  </article>`;
}

function savedTeamOrder() {
  try {
    const value = JSON.parse(localStorage.getItem(TEAM_ORDER_KEY) || '[]');
    return Array.isArray(value) ? value.map(String) : [];
  } catch (_) {
    return [];
  }
}

function orderedTeams(teams) {
  const order = savedTeamOrder();
  if (!order.length) return [...teams];
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...teams].sort((left, right) => {
    const leftRank = rank.has(String(left.id)) ? rank.get(String(left.id)) : order.length;
    const rightRank = rank.has(String(right.id)) ? rank.get(String(right.id)) : order.length;
    return leftRank - rightRank;
  });
}

function saveTeamOrder() {
  const ids = [...teamGrid.querySelectorAll('.team-card')].map(card => card.dataset.teamId).filter(Boolean);
  localStorage.setItem(TEAM_ORDER_KEY, JSON.stringify(ids));
  if (leagueData) {
    const teamsById = new Map(leagueData.teams.map(team => [String(team.id), team]));
    leagueData.teams = ids.map(id => teamsById.get(String(id))).filter(Boolean);
  }
}

function updateReorderControls() {
  const cards = [...teamGrid.querySelectorAll('.team-card')];
  cards.forEach((card, index) => {
    const up = card.querySelector('[data-move-team="up"]');
    const down = card.querySelector('[data-move-team="down"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === cards.length - 1;
  });
}

function moveTeamBy(teamId, direction) {
  const card = [...teamGrid.querySelectorAll('.team-card')]
    .find(item => item.dataset.teamId === String(teamId));
  if (!card) return;

  const sibling = direction === 'up' ? card.previousElementSibling : card.nextElementSibling;
  if (!sibling?.classList.contains('team-card')) return;

  if (direction === 'up') teamGrid.insertBefore(card, sibling);
  else teamGrid.insertBefore(sibling, card);

  saveTeamOrder();
  updateReorderControls();
}

function enableTeamDragging() {
  if (teamGrid.dataset.dragReady === 'true') return;
  teamGrid.dataset.dragReady = 'true';
  let dragState = null;

  const clearDragClasses = () => {
    teamGrid.querySelectorAll('.is-drag-over').forEach(item => item.classList.remove('is-drag-over'));
  };

  const targetAt = (event, card) => {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.team-card');
    return target && target !== card && teamGrid.contains(target) ? target : null;
  };

  const startFloatingCard = event => {
    if (!dragState || dragState.active) return;
    const { card } = dragState;
    const rect = card.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'team-drop-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.borderRadius = getComputedStyle(card).borderRadius;
    teamGrid.insertBefore(placeholder, card);
    dragState.placeholder = placeholder;
    dragState.active = true;
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    dragState.originalStyle = card.getAttribute('style') || '';
    card.style.width = `${rect.width}px`;
    card.style.height = `${rect.height}px`;
    card.style.position = 'fixed';
    card.style.left = '0';
    card.style.top = '0';
    card.style.zIndex = '20';
    card.style.pointerEvents = 'none';
  };

  const moveFloatingCard = event => {
    if (!dragState?.active) return;
    const { card } = dragState;
    card.style.transform = `translate(${event.clientX - dragState.offsetX}px, ${event.clientY - dragState.offsetY}px) rotate(1deg) scale(1.015)`;
  };

  const updateDropTarget = event => {
    if (!dragState) return;
    const target = targetAt(event, dragState.card);
    clearDragClasses();
    if (!target) {
      dragState.target = null;
      return;
    }
    // Team cards can be very tall. Use the header as the reorder zone so a
    // target is decided from the visible team position, not from the bottom
    // of a long player list.
    const rect = (target.querySelector('.team-header') || target).getBoundingClientRect();
    dragState.target = target;
    dragState.insertAfter = event.clientY > rect.top + rect.height / 2;
    target.classList.add('is-drag-over');
    const destination = dragState.insertAfter ? target.nextSibling : target;
    if (destination !== dragState.placeholder) teamGrid.insertBefore(dragState.placeholder, destination);
  };

  const finish = event => {
    if (!dragState || (event?.pointerId != null && event.pointerId !== dragState.pointerId)) return;
    if (event && dragState.active) {
      moveFloatingCard(event);
      updateDropTarget(event);
    }
    const { card, placeholder, source } = dragState;
    if (placeholder?.parentNode === teamGrid) {
      teamGrid.insertBefore(card, placeholder);
      placeholder.remove();
      if (dragState.active && dragState.moved) saveTeamOrder();
    }
    if (dragState.active) {
      if (dragState.originalStyle) card.setAttribute('style', dragState.originalStyle);
      else card.removeAttribute('style');
    }
    card.classList.remove('is-dragging');
    clearDragClasses();
    source.releasePointerCapture?.(dragState.pointerId);
    dragState = null;
  };

  const move = event => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.active && distance < 6) return;
    dragState.moved = true;
    startFloatingCard(event);
    moveFloatingCard(event);
    updateDropTarget(event);
  };

  teamGrid.addEventListener('pointerdown', event => {
    if (window.matchMedia('(max-width: 620px)').matches) return;
    if (event.button != null && event.button !== 0) return;
    const source = event.target.closest?.('.team-header');
    if (!source || !teamGrid.contains(source)) return;
    const card = source.closest('.team-card');
    if (!card) return;
    event.preventDefault();
    dragState = {
      card,
      source,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      target: null,
      insertAfter: false
    };
    card.classList.add('is-dragging');
    source.setPointerCapture?.(event.pointerId);
  });

  teamGrid.addEventListener('click', event => {
    if (!window.matchMedia('(max-width: 620px)').matches) return;
    const button = event.target.closest?.('[data-move-team]');
    if (!button || !teamGrid.contains(button)) return;
    event.preventDefault();
    moveTeamBy(button.closest('.team-card')?.dataset.teamId, button.dataset.moveTeam);
  });

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}

function searchLogoMarkup(team) {
  const logo = teamLogoMarkup(team, 'search-logo-image');
  return `<div class="search-result-logo">${logo}<span class="logo-fallback">${esc(initials(team.name))}</span></div>`;
}

function updatePlayerSearch() {
  if (!playerSearch || !playerSearchResult) return;
  const query = playerSearch.value.trim().toLowerCase();
  if (!query || !leagueData?.teams?.length) {
    playerSearchResult.hidden = true;
    playerSearchResult.innerHTML = '';
    return;
  }
  const matches = [];
  for (const team of leagueData.teams) {
    for (const player of [...(team.starters || []), ...(team.bench || [])]) {
      if (player.name.toLowerCase().includes(query)) matches.push({ team, player });
    }
  }
  if (!matches.length) {
    playerSearchResult.innerHTML = '<span class="search-empty">No player found</span>';
    playerSearchResult.hidden = false;
    return;
  }
  playerSearchResult.innerHTML = matches.slice(0, 6).map(({ team, player }) => `<div class="search-hit">
    ${searchLogoMarkup(team)}
    <div><strong>${esc(team.name)}</strong><span>${esc(player.name)} · ${esc(player.position || 'Player')}</span></div>
  </div>`).join('');
  playerSearchResult.hidden = false;
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
  if (busy && lastRefreshed) lastRefreshed.textContent = 'Loading league…';
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
  try {
    const { response, data } = await callFunction('GET');
    if (response.status === 401) {
      sessionToken = '';
      sessionStorage.removeItem(SESSION_KEY);
      document.documentElement.classList.remove('has-sheeesh-session');
      loginCard.hidden = false;
      teamGrid.hidden = true;
      if (refreshButton) refreshButton.hidden = true;
      if (leagueTools) leagueTools.hidden = true;
      leagueData = null;
      if (playerSearch) playerSearch.value = '';
      if (playerSearchResult) {
        playerSearchResult.hidden = true;
        playerSearchResult.innerHTML = '';
      }
      throw new Error('Session expired. Enter the password again.');
    }
    if (!response.ok) throw new Error(data.error || `Connection failed (${response.status})`);
    leagueData = { ...data, teams: orderedTeams(data.teams || []) };
    seasonLabel.textContent = data.season || '2026';
    weekLabel.textContent = data.week ? `Week ${data.week}` : 'Current week';
    renderTeams();
    teamGrid.hidden = false;
    loginCard.hidden = true;
    if (refreshButton) refreshButton.hidden = false;
    if (leagueTools) leagueTools.hidden = false;
    setMessage(leagueData.teams.length ? '' : 'No ESPN teams were returned.', !leagueData.teams.length);
    const refreshed = data.refreshedAt ? new Date(data.refreshedAt) : new Date();
    lastRefreshed.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(refreshed)}`;
    lastRefreshed.title = refreshed.toLocaleString();
    updatePlayerSearch();
  } catch (error) {
    if (!sessionToken) teamGrid.hidden = true;
    setMessage(error.message || 'Sheeesh could not refresh.', true);
  } finally {
    setBusy(false);
  }
}

loginForm.addEventListener('submit', login);
refreshButton.addEventListener('click', loadLeague);
if (playerSearch) playerSearch.addEventListener('input', updatePlayerSearch);
if (spoilerToggle) {
  spoilerToggle.checked = spoilerFree;
  spoilerToggle.addEventListener('change', () => {
    spoilerFree = spoilerToggle.checked;
    localStorage.setItem(SPOILER_FREE_KEY, String(spoilerFree));
    renderTeams();
  });
}
if (sessionToken) {
  loginCard.hidden = true;
  loadLeague();
}
