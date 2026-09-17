import { APP_CONFIG } from './config.js';

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const first = (obj, keys) => {
  for (const key of keys) if (obj && obj[key] != null) return n(obj[key]);
  return 0;
};
const bucket = (value, rows) => {
  const v = n(value);
  const row = rows.find((item) => v <= item.max);
  return row ? row.pts : 0;
};

export function scoreStats(stats = {}, position = '') {
  const s = APP_CONFIG.scoring;
  const pos = String(position || stats.position || '').toUpperCase();

  if (pos === 'DEF') {
    const d = s.dst;
    const pointsAllowed = first(stats, ['pts_allow','points_allowed','def_pts_allow']);
    const yardsAllowed = first(stats, ['yds_allow','yards_allowed','def_yds_allow']);
    const defenseTd = first(stats, ['def_td','def_tds','int_ret_td','fum_ret_td','blk_kick_ret_td','kick_ret_td','punt_ret_td']);
    return round2(
      first(stats, ['def_sack','sacks']) * d.sack +
      first(stats, ['def_int','interceptions']) * d.interception +
      first(stats, ['def_fum_rec','fum_rec']) * d.fumbleRecovery +
      first(stats, ['def_safe','safe','safeties']) * d.safety +
      first(stats, ['blk_kick','blocked_kicks']) * d.blockedKick +
      defenseTd * d.touchdown +
      first(stats, ['def_2pt','two_pt_return']) * d.twoPtReturn +
      bucket(pointsAllowed, d.pointsAllowed) +
      bucket(yardsAllowed, d.yardsAllowed)
    );
  }

  const fieldGoalsShort = first(stats, ['fgm_0_19']) + first(stats, ['fgm_20_29']) + first(stats, ['fgm_30_39']) + first(stats, ['fgm_40_49']);
  const fieldGoalsLong = first(stats, ['fgm_50p','fgm_50_59']) + first(stats, ['fgm_60p']);

  return round2(
    first(stats, ['pass_yd']) * s.passYd +
    first(stats, ['pass_td']) * s.passTd +
    first(stats, ['pass_int']) * s.interceptionThrown +
    first(stats, ['rush_yd']) * s.rushYd +
    first(stats, ['rush_td']) * s.rushTd +
    first(stats, ['rec_yd']) * s.recYd +
    first(stats, ['rec']) * s.reception +
    first(stats, ['rec_td']) * s.recTd +
    first(stats, ['pass_2pt','rush_2pt','rec_2pt']) * s.twoPt +
    first(stats, ['fum_lost']) * s.fumbleLost +
    first(stats, ['kick_ret_td','punt_ret_td','fum_ret_td','int_ret_td']) * s.returnTd +
    first(stats, ['xpm']) * s.patMade +
    fieldGoalsShort * s.fg0to49 +
    fieldGoalsLong * s.fg50plus
  );
}

export function round2(value) {
  return Math.round((n(value) + Number.EPSILON) * 100) / 100;
}
