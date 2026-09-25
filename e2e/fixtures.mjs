// Synthetic Sleeper API fixtures: 32 teams, a realistic-ish roster per team,
// 2026 rookies, 2025 second-years, a retired player, injuries, and team aggregates.
const TEAMS = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC',
  'LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']
const SEASONS = ['2026','2025','2024','2023','2022','2021']

let seed = 42
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

export const players = {}
export const stats = Object.fromEntries(SEASONS.map((s) => [s, {}]))

let nextId = 1000
function addPlayer({ pos, team, depth, rookieYear, age, injury = null, first, last, rank }) {
  const id = String(nextId++)
  const yearsExp = 2026 - Number(rookieYear)
  players[id] = {
    player_id: id, first_name: first, last_name: last, full_name: `${first} ${last}`,
    position: pos, fantasy_positions: [pos], team, status: 'Active', injury_status: injury,
    years_exp: yearsExp, age, college: 'State U', height: String(70 + Math.floor(rnd() * 8)),
    weight: String(190 + Math.floor(rnd() * 50)), number: 10 + (nextId % 80),
    depth_chart_position: pos, depth_chart_order: depth, search_rank: rank,
    metadata: { rookie_year: rookieYear },
  }
  const talent = 0.4 + rnd() * 0.8
  for (const s of SEASONS) {
    if (Number(s) < Number(rookieYear)) continue
    const gp = s === '2026' ? 3 : Math.max(0, 17 - Math.floor(rnd() * 6))
    if (gp === 0) continue
    const ppg = ({ QB: 18, RB: 12, WR: 11, TE: 8 })[pos] * talent * (depth === 1 ? 1 : 0.5)
    stats[s][id] = {
      gp, pts_half_ppr: ppg * gp, pts_ppr: ppg * gp * 1.15, pts_std: ppg * gp * 0.85,
      pass_att: pos === 'QB' ? 34 * gp : 0, pass_yd: pos === 'QB' ? 250 * gp * talent : 0,
      pass_td: pos === 'QB' ? 1.7 * gp * talent : 0, pass_int: pos === 'QB' ? 0.7 * gp : 0,
      rush_att: pos === 'RB' ? 15 * gp * talent : pos === 'QB' ? 3 * gp : 0,
      rush_yd: pos === 'RB' ? 65 * gp * talent : 0, rush_td: pos === 'RB' ? 0.5 * gp : 0,
      rec_tgt: pos === 'WR' ? 8 * gp * talent : pos === 'TE' ? 5 * gp : pos === 'RB' ? 3 * gp : 0,
      rec: pos === 'WR' ? 5.5 * gp * talent : pos === 'TE' ? 3.5 * gp : pos === 'RB' ? 2 * gp : 0,
      rec_yd: pos === 'WR' ? 70 * gp * talent : pos === 'TE' ? 40 * gp : pos === 'RB' ? 15 * gp : 0,
      rec_td: pos === 'WR' ? 0.5 * gp : pos === 'TE' ? 0.3 * gp : 0,
      off_snp: 55 * gp,
    }
  }
  return id
}

const FIRST = ['Alex','Blake','Casey','Drew','Evan','Flynn','Grant','Hayes','Isaac','Jordan','Kai','Logan','Miles','Nico','Owen','Parker']
let n = 0
const name = () => [FIRST[n % FIRST.length], `Test${n++}`]

let rank = 1
for (const team of TEAMS) {
  for (const [pos, depth, count] of [['QB',1,1],['QB',2,1],['RB',1,1],['RB',2,1],['WR',1,1],['WR',2,1],['WR',3,1],['TE',1,1]]) {
    for (let c = 0; c < count; c++) {
      const [first, last] = name()
      addPlayer({ pos, team, depth, rookieYear: String(2018 + Math.floor(rnd() * 7)), age: 23 + Math.floor(rnd() * 10),
        first, last, rank: rank++, injury: rnd() < 0.06 ? (rnd() < 0.5 ? 'Questionable' : 'Out') : null })
    }
  }
  // DEF
  players[team] = {
    player_id: team, first_name: team, last_name: 'Defense', full_name: null, position: 'DEF',
    fantasy_positions: ['DEF'], team, status: 'Active', injury_status: null, years_exp: undefined,
    age: null, college: null, height: null, weight: null, number: null,
    depth_chart_position: null, depth_chart_order: null, search_rank: rank++, metadata: null,
  }
  for (const s of SEASONS) {
    const gp = s === '2026' ? 3 : 17
    const ppg = 5 + rnd() * 6
    stats[s][team] = { gp, pts_half_ppr: ppg * gp, pts_ppr: ppg * gp, pts_std: ppg * gp,
      sack: 2.5 * gp, int: 0.8 * gp, def_td: 0.2 * gp, pts_allow: 21 * gp }
    stats[s][`TEAM_${team}`] = { gp, pass_att: 34 * gp * (0.8 + rnd() * 0.4), pass_yd: 235 * gp * (0.8 + rnd() * 0.4),
      rush_att: 26 * gp, rush_yd: 115 * gp * (0.8 + rnd() * 0.4), rush_rz_att: 5 * gp, rz_att: 3.3 * gp,
      rz_conv: 1.9 * gp, rec_rz_tgt: 3.5 * gp, pass_air_yd: 110 * gp, pass_sack: 2.4 * gp }
  }
}

// 2026 rookie class (with 2026 games) and 2025 second-year class
export const rookieIds = []
for (let i = 0; i < 20; i++) {
  const [first, last] = name()
  rookieIds.push(addPlayer({ pos: ['QB','RB','WR','TE'][i % 4], team: TEAMS[i], depth: i % 3 === 0 ? 1 : 2,
    rookieYear: '2026', age: 21 + (i % 3), first: `Rookie${first}`, last, rank: 40 + i * 7 }))
}
for (let i = 0; i < 30; i++) {
  const [first, last] = name()
  addPlayer({ pos: ['QB','RB','WR','TE'][i % 4], team: TEAMS[(i + 5) % 32], depth: i % 2 ? 1 : 2,
    rookieYear: '2025', age: 22 + (i % 3), first: `Soph${first}`, last, rank: 60 + i * 5 })
}
// Retired: no team, no recent games → not scored, reachable only via URL / watchlist.
export const retiredId = addPlayer({ pos: 'WR', team: null, depth: null, rookieYear: '2010', age: 38,
  first: 'Retired', last: 'Veteran', rank: 9999999 })
for (const s of ['2026','2025','2024']) delete stats[s][retiredId]
// Non-scored position to confirm trimming.
players['K1'] = { ...players['1000'], player_id: 'K1', position: 'K', fantasy_positions: ['K'], full_name: 'Kicker Guy' }

export const nflState = {
  week: 3, display_week: 3, season_type: 'regular', season_start_date: '2026-09-10',
  season: '2026', previous_season: '2025', leg: 3, league_season: '2026',
}

export function trending(lookbackHours) {
  const ids = Object.keys(players).filter((id) => players[id].team).slice(0, 60)
  const scale = lookbackHours / 24
  return ids.map((id, i) => ({ player_id: id, count: Math.round((5000 - i * 60) * scale) + 1 }))
}
