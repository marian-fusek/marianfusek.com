export const APP_CONFIG = {
  appName: 'Fantasheee',
  leagueName: 'Sheeesh',
  season: 2026,
  currentWeekFallback: 2,
  // No login by design. Each person taps a team logo on the front screen.
  teams: [
    { id: 'team-1', name: 'Team 1', abbr: 'T1', logo: '' },
    { id: 'team-2', name: 'Team 2', abbr: 'T2', logo: '' },
    { id: 'team-3', name: 'Team 3', abbr: 'T3', logo: '' },
    { id: 'team-4', name: 'Team 4', abbr: 'T4', logo: '' },
    { id: 'team-5', name: 'Team 5', abbr: 'T5', logo: '' },
    { id: 'team-6', name: 'Team 6', abbr: 'T6', logo: '' }
  ],
  // Replace only these values when copying the exact ESPN roster configuration.
  rosterSlots: ['QB','RB','RB','WR','WR','TE','FLEX','K','DEF','BE','BE','BE','BE','BE','BE','IR'],
  // Current known ESPN league scoring. Keep every scoring change in this single file.
  scoring: {
    passYd: 0.04,
    passTd: 4,
    interceptionThrown: -2,
    rushYd: 0.1,
    rushTd: 6,
    recYd: 0.1,
    reception: 1,
    recTd: 6,
    twoPt: 2,
    fumbleLost: -2,
    returnTd: 6,
    patMade: 1,
    fg0to49: 3,
    fg50plus: 5,
    dst: {
      sack: 1,
      blockedKick: 2,
      interception: 2,
      fumbleRecovery: 2,
      safety: 2,
      touchdown: 6,
      twoPtReturn: 2,
      pointsAllowed: [
        { max: 0, pts: 10 },
        { max: 6, pts: 7 },
        { max: 13, pts: 4 },
        { max: 17, pts: 1 },
        { max: 27, pts: 1 },
        { max: 34, pts: -1 },
        { max: 45, pts: -4 },
        { max: Infinity, pts: -4 }
      ],
      yardsAllowed: [
        { max: 99, pts: 5 },
        { max: 199, pts: 2 },
        { max: 299, pts: 1 },
        { max: 399, pts: 0 },
        { max: 449, pts: -1 },
        { max: 499, pts: -3 },
        { max: 549, pts: -5 },
        { max: 599, pts: -6 },
        { max: Infinity, pts: -7 }
      ]
    }
  },
  data: {
    sleeperAppBase: 'https://api.sleeper.app',
    sleeperStatsBase: 'https://api.sleeper.com',
    playerPositions: ['QB','RB','WR','TE','K','DEF']
  },
  // Fantasheee stays passwordless. The existing Sheeesh page establishes a
  // short-lived session; this app reuses that session without receiving ESPN
  // cookies or credentials. Local preview still works when no session exists.
  espnSync: {
    enabled: true,
    functionUrl: 'https://lnyatvbbmlktoimpgalu.supabase.co/functions/v1/sheeesh',
    publishableKey: 'sb_publishable_rkHOZpeo13-HgISB6QT7Fg_PPGKAMXz',
    sessionKey: 'sheeesh-session-v1',
    // Read-only league data may be requested directly by Fantasheee from the
    // trusted preview and production origins. ESPN cookies stay server-side.
    passwordlessRead: true,
    allowedOrigins: [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://marianfusek.com',
      'https://www.marianfusek.com'
    ],
    connectionUrl: 'https://marianfusek.com/sheeesh/'
  },
  supabase: {
    // Fill these two strings after running supabase/schema.sql.
    url: '',
    anonKey: ''
  }
};
