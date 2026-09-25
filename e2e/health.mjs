/**
 * End-to-end health check: drives every page and control of the production build in
 * headless Chromium against synthetic Sleeper data (see fixtures.mjs), so it needs no
 * network access. Run with `npm run test:e2e` (builds first). Set BASE to test an
 * already-running server instead. Screenshots land in e2e/shots/.
 *
 * First run on a new machine: `npx playwright install chromium`.
 */
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'
import * as fx from './fixtures.mjs'

const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url))
mkdirSync(SHOTS, { recursive: true })

let server = null
let BASE = process.env.BASE
if (!BASE) {
  server = await preview({ root: fileURLToPath(new URL('..', import.meta.url)), preview: { port: 4173, strictPort: false } })
  BASE = server.resolvedUrls.local[0].replace(/\/$/, '')
}
const results = []
const consoleErrors = []

async function check(name, fn) {
  try {
    const note = await fn()
    results.push({ name, ok: true, note: note ?? '' })
  } catch (e) {
    results.push({ name, ok: false, note: String(e.message ?? e).split('\n')[0].slice(0, 300) })
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg) }

async function mockSleeper(ctx, { fail = false, statsDelayMs = 0 } = {}) {
  await ctx.route('https://api.sleeper.app/**', async (route) => {
    const url = new URL(route.request().url())
    if (fail) return route.fulfill({ status: 500, body: 'boom' })
    const p = url.pathname
    let body
    if (p === '/v1/state/nfl') body = fx.nflState
    else if (p === '/v1/players/nfl') body = fx.players
    else if (p.startsWith('/v1/stats/nfl/regular/')) {
      if (statsDelayMs) await new Promise((r) => setTimeout(r, statsDelayMs))
      body = fx.stats[p.split('/').pop()] ?? {}
    }
    else if (p.startsWith('/v1/players/nfl/trending/add')) body = fx.trending(Number(url.searchParams.get('lookback_hours')))
    else return route.fulfill({ status: 404, body: 'nf' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  // Player headshots: 404 to exercise the avatar fallback.
  await ctx.route('https://sleepercdn.com/**', (r) => r.fulfill({ status: 404, body: '' }))
}

function attachLogging(page, label) {
  page.on('pageerror', (e) => consoleErrors.push(`[${label}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${label}] console: ${m.text().slice(0, 300)}`) })
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await mockSleeper(ctx)
const page = await ctx.newPage()
attachLogging(page, 'desktop')

const bodyRows = () => page.locator('main table tbody tr')
const countLabel = async () => Number((await page.getByText(/^\d+ players$/).first().textContent()).split(' ')[0])
const firstColText = async (col) => page.locator(`main table tbody tr td:nth-child(${col})`).allTextContents()

// ─── Players page ──────────────────────────────────────────────────────────
await check('Root redirects to /players and table loads', async () => {
  await page.goto(BASE + '/')
  await page.waitForURL('**/players')
  await bodyRows().first().waitFor({ timeout: 15000 })
  return `${await bodyRows().count()} rows rendered initially`
})
await page.screenshot({ path: SHOTS + '01-players.png' })

await check('Player count excludes DEF by default and retired player', async () => {
  const c = await countLabel()
  const positions = await page.locator('main table tbody tr td:nth-child(4)').allTextContents()
  assert(!positions.includes('DEF'), 'DEF shown under All')
  return `${c} players`
})

await check('Infinite scroll loads more rows', async () => {
  const before = await bodyRows().count()
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 20000); await page.waitForTimeout(300) }
  const after = await bodyRows().count()
  assert(after > before, `rows stayed at ${before}`)
  await page.evaluate(() => window.scrollTo(0, 0))
  return `${before} -> ${after}`
})

await check('Trending strip renders cards and "See all" link', async () => {
  const cards = page.locator('main button:has-text("adds")')
  const n = await cards.count()
  assert(n === 8, `expected 8 cards, got ${n}`)
  await page.getByRole('link', { name: 'See all →' }).click()
  await page.waitForURL('**/trending')
  await page.goBack()
  await page.waitForURL('**/players')
  await bodyRows().first().waitFor()
})

await check('Trending strip card opens player page', async () => {
  await page.locator('main button:has-text("adds")').first().click()
  await page.waitForURL(/\/player\/[^/]+$/)
  await page.getByText('Value Score Breakdown').waitFor()
  await page.goBack(); await bodyRows().first().waitFor()
})

await check('Scoring format toggle changes PPG and persists', async () => {
  const ppgCol = 11
  const halfPpg = (await firstColText(ppgCol)).slice(0, 5).join(',')
  await page.getByRole('button', { name: 'PPR', exact: true }).click()
  await page.waitForTimeout(500)
  const ppr = (await firstColText(ppgCol)).slice(0, 5).join(',')
  assert(ppr !== halfPpg, 'PPG unchanged after switching to PPR')
  const stored = await page.evaluate(() => localStorage.getItem('ff-settings'))
  assert(stored?.includes('"ppr"'), 'format not persisted')
  await page.getByRole('button', { name: /Std|Standard/ }).first().click()
  await page.waitForTimeout(300)
  const std = (await firstColText(ppgCol)).slice(0, 5).join(',')
  assert(std !== ppr, 'PPG unchanged after switching to Std')
  await page.getByRole('button', { name: /Half/ }).first().click()
  return `half=[${halfPpg}] ppr=[${ppr}] std=[${std}]`
})

await check('Season toggle switches to 2026 wk 3 and back', async () => {
  const cur = page.getByRole('button', { name: /2026 · Week 3/ })
  await cur.click()
  await page.getByText(/3 games played/).waitFor()
  const warn = await page.getByText(/scores are volatile/).textContent()
  assert(/3 games played/.test(warn), `unexpected games text: ${warn}`)
  await page.getByRole('button', { name: /2025 · Full season/ }).click()
  await page.getByText(/scores are volatile/).waitFor({ state: 'detached' })
  return warn
})

await check('Position filter: single, multi, DEF, All', async () => {
  const pf = (n) => page.locator('main').getByRole('button', { name: n, exact: true }).first()
  await pf('QB').click(); await page.waitForTimeout(200)
  let pos = new Set(await page.locator('main table tbody tr td:nth-child(4)').allTextContents())
  assert(pos.size === 1 && pos.has('QB'), `QB filter shows ${[...pos]}`)
  const qb = await countLabel()
  await pf('RB').click(); await page.waitForTimeout(200)
  pos = new Set(await page.locator('main table tbody tr td:nth-child(4)').allTextContents())
  assert([...pos].every((p) => p === 'QB' || p === 'RB') && pos.size === 2, `QB+RB shows ${[...pos]}`)
  await pf('QB').click(); await pf('RB').click() // deselect both -> All
  await pf('DEF').click(); await page.waitForTimeout(200)
  const def = await countLabel()
  assert(def === 32, `DEF count ${def}`)
  await pf('All').click(); await page.waitForTimeout(200)
  const all = await countLabel()
  return `QB=${qb} DEF=${def} All=${all}`
})

await check('Include rookies checkbox changes count', async () => {
  const before = await countLabel()
  await page.getByLabel('Include rookies').uncheck()
  await page.waitForTimeout(200)
  const after = await countLabel()
  await page.getByLabel('Include rookies').check()
  assert(after < before, `count ${before} -> ${after}`)
  return `${before} -> ${after}`
})

await check('Name filter narrows table', async () => {
  await page.getByPlaceholder('Filter by name…').fill('Rookie')
  await page.waitForTimeout(200)
  const names = await page.locator('main table tbody tr td:nth-child(3)').allTextContents()
  assert(names.length > 0 && names.every((n) => n.includes('Rookie')), `bad filter results: ${names.slice(0, 3)}`)
  const footer = await page.getByText(/players loaded|Showing \d+ of/).textContent()
  await page.getByPlaceholder('Filter by name…').fill('')
  return `${names.length} matches; footer "${footer}"`
})

await check('Column sorting toggles on header click (Value, Age, PPG)', async () => {
  const vals = async () => (await firstColText(2)).slice(0, 10).map(Number)
  const d = await vals()
  assert(d.every((v, i) => i === 0 || d[i - 1] >= v), 'default not Value desc')
  await page.locator('thead').getByText('Value', { exact: true }).click()
  await page.waitForTimeout(200)
  const a = await vals()
  assert(a.every((v, i) => i === 0 || a[i - 1] <= v), `Value not asc after click: ${a}`)
  await page.locator('thead').getByText('Age', { exact: true }).click()
  await page.waitForTimeout(200)
  const ages = (await firstColText(6)).slice(0, 10).map(Number)
  const sortedAsc = ages.every((v, i) => i === 0 || ages[i - 1] <= v)
  const sortedDesc = ages.every((v, i) => i === 0 || ages[i - 1] >= v)
  assert(sortedAsc || sortedDesc, `Age not sorted: ${ages}`)
  // Restore Value desc
  await page.locator('thead').getByText('Value', { exact: true }).click()
  await page.locator('thead').getByText('Value', { exact: true }).click()
  await page.waitForTimeout(200)
  const r = await vals()
  return `Age first click -> ${sortedAsc ? 'asc' : 'desc'}; Value restored: ${r.slice(0, 3)}`
})

await check('Rank column reflects displayed order after sort', async () => {
  const ranks = (await firstColText(1)).slice(0, 5)
  assert(ranks.join(',') === '1,2,3,4,5', `ranks ${ranks}`)
})

await check('Value badge hover shows math tooltip', async () => {
  await page.locator('main table tbody tr').first().locator('td:nth-child(2) span[tabindex="0"]').hover()
  const tip = page.getByRole('tooltip')
  await tip.waitFor()
  const t = await tip.textContent()
  assert(/Player|Opportunity|Team/.test(t), 'tooltip missing grade rows')
  await page.mouse.move(0, 0)
  return t.slice(0, 120)
})
await check('Header tooltip (PPG) shows explanation', async () => {
  await page.locator('thead').getByText('PPG', { exact: true }).hover()
  const t = await page.getByRole('tooltip').textContent()
  await page.mouse.move(0, 0)
  return t.slice(0, 120)
})

let starredName
await check('Watchlist star toggles without navigating', async () => {
  const row = page.locator('main table tbody tr').nth(1)
  starredName = (await row.locator('td:nth-child(3) span').last().textContent()).trim()
  await row.getByTitle('Add to watchlist').click()
  assert(page.url().endsWith('/players'), 'star click navigated')
  await row.getByTitle('Remove from watchlist').waitFor({ timeout: 2000 })
  const stored = await page.evaluate(() => localStorage.getItem('ff-watchlist'))
  return `starred ${starredName}; storage=${stored}`
})

await check('Row click opens player detail', async () => {
  await page.locator('main table tbody tr').first().locator('td:nth-child(3) span').last().click()
  await page.waitForURL(/\/player\/[^/]+$/)
  await page.getByText('Season Log').waitFor()
})
await page.screenshot({ path: SHOTS + '02-player.png', fullPage: true })

// ─── Player detail ─────────────────────────────────────────────────────────
await check('Player detail: chart, breakdown, season log, avatar fallback', async () => {
  await page.goto(BASE + '/player/1000'); await page.getByText('Season Log').waitFor()
  const svgLines = await page.locator('.recharts-line').count()
  assert(svgLines >= 1, 'no PPG chart line')
  const logRows = await page.locator('table tbody tr').count()
  const avatarFallback = await page.locator('div.rounded-full:has-text("🏈")').count()
  assert(avatarFallback === 1, 'avatar fallback not shown on 404 image')
  return `${logRows} season log rows`
})
await check('Player detail: Watch toggle round-trips', async () => {
  const btn = page.getByRole('button', { name: /Watch/ })
  const before = await btn.textContent()
  await btn.click()
  const after = await btn.textContent()
  assert(before !== after, 'watch label unchanged')
  await btn.click()
  return `${before} -> ${after}`
})
await check('Player detail: Back button returns to Players', async () => {
  // History: /players -> /player/<row> -> /player/1000, so Back lands on the row's page
  await page.getByRole('button', { name: '← Back' }).click()
  await page.waitForURL((u) => /\/player\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith('/1000'))
  await page.getByRole('button', { name: '← Back' }).click()
  await page.waitForURL('**/players')
})

await check('Direct load of /player/:id (cold)', async () => {
  const p2 = await ctx.newPage(); attachLogging(p2, 'direct')
  await p2.goto(BASE + '/player/1000')
  await p2.getByText('Season Log').waitFor({ timeout: 15000 })
  await p2.close()
})
await check('Retired (unscored) player page', async () => {
  const p2 = await ctx.newPage(); attachLogging(p2, 'retired')
  await p2.goto(BASE + '/player/' + fx.retiredId)
  await p2.getByText('Not currently scored').waitFor({ timeout: 15000 })
  await p2.close()
})
await check('Unknown player id shows "Player not found" + back link', async () => {
  const p2 = await ctx.newPage(); attachLogging(p2, 'unknown')
  await p2.goto(BASE + '/player/doesnotexist')
  await p2.getByText('Player not found.').waitFor({ timeout: 15000 })
  await p2.getByRole('button', { name: '← Back to players' }).click()
  await p2.waitForURL('**/players')
  await p2.close()
})
await check('DEF player page', async () => {
  const p2 = await ctx.newPage(); attachLogging(p2, 'def')
  await p2.goto(BASE + '/player/KC')
  await p2.getByText('Season Log').waitFor({ timeout: 15000 })
  const heads = await p2.locator('table thead th').allTextContents()
  await p2.close()
  return heads.join(' | ')
})

// ─── Weights drawer ────────────────────────────────────────────────────────
const drawer = page.getByRole('dialog')
await check('Weights drawer opens; worked example + explanations render', async () => {
  await page.getByRole('button', { name: /Weights/ }).click()
  await drawer.waitFor()
  await drawer.getByText('What feeds each grade?').click()
  await drawer.getByText(/Team Grade/).first().waitFor()
  const opts = await drawer.locator('select option').count()
  assert(opts > 0, 'no example options')
  return `${opts} worked-example options`
})
await page.screenshot({ path: SHOTS + '03-weights.png' })

await check('Worked example select switches player', async () => {
  const sel = drawer.locator('select')
  const second = await sel.locator('option').nth(3).getAttribute('value')
  await sel.selectOption(second)
  assert((await sel.inputValue()) === second, 'select did not change')
})

await check('Presets change weights, show movers and "Custom weights" chip', async () => {
  const presets = drawer.locator('p:has-text("Presets") + div button')
  const labels = await presets.allTextContents()
  await presets.nth(1).click()
  await page.waitForTimeout(400)
  await drawer.getByText('Risers').waitFor()
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('ff-scoring-weights')))
  const w = stored.state.weights
  const active = await presets.nth(1).getAttribute('class')
  assert(active.includes('violet'), 'preset not highlighted')
  return `presets=[${labels.join(', ')}] → stored wPlayer=${w.wPlayer} wOpp=${w.wOpportunity} wTeam=${w.wTeam}`
})

await check('Split bar: keyboard arrows move boundary; sum stays 100', async () => {
  const slider = drawer.getByRole('slider').first()
  const before = Number(await slider.getAttribute('aria-valuenow'))
  await slider.focus()
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight')
  const after = Number(await slider.getAttribute('aria-valuenow'))
  assert(after === before + 6, `slider ${before} -> ${after}`)
  const nums = (await drawer.locator('input[type=number]').evaluateAll((els) => els.slice(0, 3).map((e) => Number(e.value))))
  assert(nums.reduce((a, b) => a + b, 0) === 100, `sum=${nums}`)
  return `${before} -> ${after}; [${nums}]`
})

await check('Split bar: number input redistributes; sum stays 100', async () => {
  const input = drawer.getByLabel('Player percent').first()
  await input.fill('70'); await input.press('Enter')
  await page.waitForTimeout(300)
  const nums = await drawer.locator('input[type=number]').evaluateAll((els) => els.slice(0, 3).map((e) => Number(e.value)))
  assert(nums[0] === 70 && nums.reduce((a, b) => a + b, 0) === 100, `values ${nums}`)
  return `[${nums}]`
})

await check('Split bar: out-of-range input (150, -5) clamps', async () => {
  const input = drawer.getByLabel('Player percent').first()
  await input.fill('150'); await input.press('Enter')
  let nums = await drawer.locator('input[type=number]').evaluateAll((els) => els.slice(0, 3).map((e) => Number(e.value)))
  assert(nums[0] === 100 && nums.reduce((a, b) => a + b, 0) === 100, `after 150: ${nums}`)
  await input.fill('-5'); await input.press('Enter')
  nums = await drawer.locator('input[type=number]').evaluateAll((els) => els.slice(0, 3).map((e) => Number(e.value)))
  assert(nums.every((v) => v >= 0) && nums.reduce((a, b) => a + b, 0) === 100, `after -5: ${nums}`)
  return `[${nums}]`
})

await check('Split bar: pointer drag moves boundary', async () => {
  const slider = drawer.getByRole('slider').nth(2) // Player sub-weights first handle
  const before = Number(await slider.getAttribute('aria-valuenow'))
  const box = await slider.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const after = Number(await slider.getAttribute('aria-valuenow'))
  assert(after < before, `drag did not move: ${before} -> ${after}`)
  return `${before} -> ${after}`
})

await check('Recency + Opportunity split bars present and labelled', async () => {
  const labels = await drawer.getByRole('slider').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  assert(labels.length === 2 + 2 + 3 + 2, `slider count ${labels.length}`)
  assert(labels.some((l) => l.includes('2026 (to date)') || l.includes('2025')), 'recency labels missing seasons')
  return labels.slice(-2).join(' / ')
})

await check('Esc closes drawer; "Custom weights · Reset" chip resets', async () => {
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'detached' })
  const chip = page.getByRole('button', { name: 'Custom weights · Reset' })
  await chip.waitFor()
  await chip.click()
  await chip.waitFor({ state: 'detached' })
})

await check('Drawer: backdrop click closes; ✕ closes; Reset to defaults works', async () => {
  await page.getByRole('button', { name: /Weights/ }).click()
  await drawer.waitFor()
  await drawer.locator('p:has-text("Presets") + div button').nth(2).click()
  await page.waitForTimeout(300)
  await drawer.getByRole('button', { name: 'Reset to defaults' }).click()
  await page.waitForTimeout(300)
  const w = JSON.parse(await page.evaluate(() => localStorage.getItem('ff-scoring-weights'))).state.weights
  assert(w.wPlayer === 0.55 && w.wOpportunity === 0.2 && w.wTeam === 0.25, `not defaults: ${JSON.stringify(w)}`)
  await page.getByLabel('Close weights panel').click()
  await drawer.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /Weights/ }).click()
  await drawer.waitFor()
  await page.mouse.click(50, 450)
  await drawer.waitFor({ state: 'detached' })
})

// ─── Navbar search ─────────────────────────────────────────────────────────
const search = page.getByRole('combobox')
await check('Navbar search: 1 char shows nothing, 2+ chars show ≤8 results', async () => {
  await search.fill('R')
  await page.waitForTimeout(300)
  assert(await page.getByRole('listbox').count() === 0, 'results for 1 char')
  await search.fill('Rookie')
  await page.getByRole('listbox').waitFor()
  const n = await page.getByRole('option').count()
  assert(n > 0 && n <= 8, `results ${n}`)
  return `${n} results`
})
await check('Navbar search: ArrowDown + Enter opens highlighted player', async () => {
  const second = (await page.getByRole('option').nth(1).locator('div.text-sm').textContent()).trim()
  await search.press('ArrowDown'); await search.press('ArrowDown')
  assert((await page.getByRole('option').nth(1).getAttribute('aria-selected')) === 'true', 'second not highlighted')
  await search.press('Enter')
  await page.waitForURL(/\/player\/[^/]+$/)
  await page.getByText('Season Log').waitFor()
  const h1 = (await page.locator('h1').textContent()).trim()
  assert(h1 === second, `opened ${h1}, expected ${second}`)
  assert((await search.inputValue()) === '', 'search not cleared')
})
await check('Navbar search: Escape closes; mouse click opens', async () => {
  await page.waitForTimeout(300)
  await search.click(); await search.fill('Test1')
  await page.getByRole('listbox').waitFor()
  await search.press('Escape')
  await page.getByRole('listbox').waitFor({ state: 'detached' })
  await page.waitForTimeout(300)
  await search.click(); await search.fill('Test2')
  await page.getByRole('listbox').waitFor()
  await page.getByRole('option').first().click()
  await page.waitForURL(/\/player\/[^/]+$/)
})
await check('Navbar search: typing right after picking a result reopens the dropdown', async () => {
  await search.click(); await search.fill('Test3')
  await page.getByRole('listbox').waitFor()
  await search.press('Enter')
  await page.waitForURL(/\/player\/[^/]+$/)
  await search.fill('Test4') // within the old 150ms blur window
  await page.waitForTimeout(400)
  assert(await page.getByRole('listbox').count() === 1, 'dropdown stayed hidden')
  await search.press('Escape')
})
await check('Navbar search: no-match query shows no dropdown', async () => {
  await page.waitForTimeout(300)
  await search.click()
  await search.fill('zzzzqqq'); await page.waitForTimeout(300)
  assert(await page.getByRole('listbox').count() === 0, 'dropdown for no-match')
  await search.fill('')
})

// ─── Nav tabs ──────────────────────────────────────────────────────────────
await check('Desktop nav tabs route and highlight', async () => {
  for (const t of ['Trending', 'Rookies', 'Watchlist', 'Players']) {
    await page.getByRole('navigation').getByRole('link', { name: t }).click()
    await page.waitForURL(`**/${t.toLowerCase()}`)
    await page.waitForTimeout(300)
    const cls = await page.getByRole('navigation').getByRole('link', { name: t }).getAttribute('class')
    assert(cls.includes('bg-slate-700'), `${t} not highlighted`)
  }
})

// ─── Trending page ─────────────────────────────────────────────────────────
await check('Trending page: table + 2h / 24h / 7d lookback', async () => {
  await page.goto(BASE + '/trending')
  await page.locator('main table tbody tr').first().waitFor({ timeout: 15000 })
  const out = []
  for (const lb of ['2h', '7d', '24h']) {
    await page.getByRole('button', { name: lb, exact: true }).click()
    await page.waitForTimeout(400)
    const top = await page.locator('main table tbody tr td:nth-child(4)').first().textContent()
    const rows = await page.locator('main table tbody tr').count()
    assert((await page.getByRole('button', { name: lb, exact: true }).getAttribute('data-active')) === 'true', `${lb} not active`)
    out.push(`${lb}: ${rows} rows, top ${top}`)
  }
  return out.join('; ')
})
await page.screenshot({ path: SHOTS + '04-trending.png' })
await check('Trending page: row click opens player', async () => {
  await page.locator('main table tbody tr').first().click()
  await page.waitForURL(/\/player\/[^/]+$/)
})

// ─── Rookies page ──────────────────────────────────────────────────────────
await check('Rookies page: rookie class + second-year sections render', async () => {
  await page.goto(BASE + '/rookies')
  await page.getByText('2026 Rookie Class').waitFor({ timeout: 15000 })
  await page.getByText('2025 Second-Year Players').waitFor()
  const rc = await page.locator('section').nth(0).locator('tbody tr').count()
  const sy = await page.locator('section').nth(1).locator('tbody tr').count()
  assert(rc === 20, `rookie rows ${rc}`)
  assert(sy === 25, `second-year rows ${sy} (expected top 25 of 30)`)
  const ytd = await page.locator('section').nth(0).locator('tbody tr td:nth-child(9)').allTextContents()
  return `rookies=${rc}, second-year=${sy}, YTD PPG sample=${ytd.slice(0, 4)}`
})
await page.screenshot({ path: SHOTS + '05-rookies.png', fullPage: true })
const rsec = page.locator('section').nth(0)
await check('Rookies: position chips filter', async () => {
  const out = []
  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    await rsec.getByRole('button', { name: pos, exact: true }).click()
    const ps = new Set(await rsec.locator('tbody tr td:nth-child(3)').allTextContents())
    assert(ps.size === 1 && ps.has(pos), `${pos} filter shows ${[...ps]}`)
    out.push(`${pos}=${await rsec.locator('tbody tr').count()}`)
  }
  await rsec.getByRole('button', { name: 'All', exact: true }).click()
  return out.join(' ')
})
await check('Rookies: Starters only', async () => {
  await rsec.getByLabel('Starters only').check()
  const dcs = new Set(await rsec.locator('tbody tr td:nth-child(7)').allTextContents())
  await rsec.getByLabel('Starters only').uncheck()
  assert(dcs.size === 1 && dcs.has('DC1'), `starters show ${[...dcs]}`)
  return `${[...dcs]}`
})
await check('Rookies: header sort (Age) and empty-filter message', async () => {
  await rsec.locator('thead').getByText('Age', { exact: true }).click()
  const ages = (await rsec.locator('tbody tr td:nth-child(5)').allTextContents()).map(Number)
  assert(ages.every((v, i) => i === 0 || ages[i - 1] <= v) || ages.every((v, i) => i === 0 || ages[i - 1] >= v), `ages ${ages}`)
  await rsec.getByRole('button', { name: 'QB', exact: true }).click()
  await rsec.getByLabel('Starters only').check()
  const msg = await rsec.getByText(/No rookies match|players/).first().textContent()
  await rsec.getByLabel('Starters only').uncheck()
  await rsec.getByRole('button', { name: 'All', exact: true }).click()
  return msg
})
await check('Second-year: Show all / Show top 25 toggle', async () => {
  const sec = page.locator('section').nth(1)
  await sec.getByRole('button', { name: /Show all 30/ }).click()
  assert((await sec.locator('tbody tr').count()) === 30, 'not 30')
  await sec.getByRole('button', { name: 'Show top 25' }).click()
  assert((await sec.locator('tbody tr').count()) === 25, 'not 25')
})
await check('Rookies: YTD PPG in "completed" season mode uses live 2026 stats', async () => {
  const ytd = await rsec.locator('tbody tr td:nth-child(9)').allTextContents()
  assert(ytd.some((v) => /\d/.test(v)), `no YTD values: ${ytd.slice(0, 5)}`)
})
await check('Rookies: row click opens player', async () => {
  await rsec.locator('tbody tr').first().click()
  await page.waitForURL(/\/player\/[^/]+$/)
})

// ─── Watchlist ─────────────────────────────────────────────────────────────
await check('Watchlist shows starred player; stale & unknown ids listed with Remove', async () => {
  await page.evaluate((retired) => {
    const s = JSON.parse(localStorage.getItem('ff-watchlist'))
    s.state.playerIds.push(retired, 'ghost-id')
    localStorage.setItem('ff-watchlist', JSON.stringify(s))
  }, fx.retiredId)
  await page.goto(BASE + '/watchlist')
  await page.getByText('No longer active').waitFor({ timeout: 15000 })
  const tableNames = await page.locator('main table tbody tr td:nth-child(3)').allTextContents()
  assert(tableNames.some((n) => n.includes(starredName)), `starred ${starredName} missing: ${tableNames}`)
  await page.getByText('Unknown player (ghost-id)').waitFor()
  const hdr = await page.getByText(/^\d+ players$/).textContent()
  return `${hdr}; table=${tableNames.length}`
})
await page.screenshot({ path: SHOTS + '06-watchlist.png' })
await check('Watchlist: Remove buttons + unstar in table → empty state', async () => {
  await page.getByRole('button', { name: 'Remove' }).first().click()
  await page.getByRole('button', { name: 'Remove' }).first().click()
  assert(await page.getByText('No longer active').count() === 0, 'stale list still shown')
  await page.locator('main table tbody tr').first().getByTitle('Remove from watchlist').click()
  await page.getByText('No players on your watchlist yet.').waitFor()
})

// ─── Persistence ───────────────────────────────────────────────────────────
await check('Settings persist across reload (format, season mode)', async () => {
  await page.goto(BASE + '/players')
  await page.getByRole('button', { name: 'PPR', exact: true }).click()
  await page.getByRole('button', { name: /2026 · Week 3/ }).click()
  await page.reload()
  await bodyRows().first().waitFor({ timeout: 15000 })
  assert((await page.getByRole('button', { name: 'PPR', exact: true }).getAttribute('data-active')) === 'true', 'PPR not persisted')
  assert((await page.getByRole('button', { name: /2026 · Week 3/ }).getAttribute('data-active')) === 'true', 'season not persisted')
  await page.getByRole('button', { name: /Half/ }).first().click()
  await page.getByRole('button', { name: /2025 · Full season/ }).click()
})
await check('Unknown route shows "Page not found" with a way back', async () => {
  await page.goto(BASE + '/nope')
  await page.getByText('Page not found.').waitFor({ timeout: 15000 })
  await page.getByRole('link', { name: '← Back to players' }).click()
  await page.waitForURL('**/players')
})
await check('Trend sparklines never show a "−0.0" drop for flat seasons', async () => {
  await page.goto(BASE + '/players')
  await bodyRows().first().waitFor({ timeout: 15000 })
  const deltas = await page.locator('main table tbody tr td:nth-child(12)').allTextContents()
  const bad = deltas.filter((d) => d.includes('−0.0'))
  assert(bad.length === 0, `${bad.length} rows show −0.0`)
  return `${deltas.length} sparklines checked`
})
await check('Weights drawer split-bar labels are not truncated', async () => {
  await page.getByRole('button', { name: /Weights/ }).click()
  await drawer.waitFor()
  const clipped = await drawer.locator('input[type=number]').evaluateAll((inputs) => inputs
    .map((i) => i.closest('label').querySelector('span.truncate'))
    .filter((el) => el.scrollWidth > el.clientWidth)
    .map((el) => el.textContent))
  await page.keyboard.press('Escape')
  assert(clipped.length === 0, `truncated: ${clipped.join(', ')}`)
})
await check('Season banner has no "0 games played" flash while stats load', async () => {
  const slow = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await mockSleeper(slow, { statsDelayMs: 1500 })
  const sp = await slow.newPage(); attachLogging(sp, 'slow-stats')
  await sp.goto(BASE + '/players')
  await sp.locator('main table tbody tr').first().waitFor({ timeout: 20000 })
  await sp.getByRole('button', { name: /2026 · Week 3/ }).click()
  await sp.waitForTimeout(300)
  const during = await sp.getByText(/scores are volatile/).textContent()
  await sp.getByText(/3 games played/).waitFor({ timeout: 10000 })
  await slow.close()
  assert(!/0 games/.test(during), `while loading: ${during}`)
  return `while loading: "${during}"`
})

// ─── Mobile ────────────────────────────────────────────────────────────────
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
await mockSleeper(m)
const mp = await m.newPage(); attachLogging(mp, 'mobile')
await check('Mobile: hamburger menu navigates', async () => {
  await mp.goto(BASE + '/players')
  await mp.locator('main table tbody tr').first().waitFor({ timeout: 15000 })
  await mp.getByLabel('Open navigation menu').click()
  await mp.getByRole('link', { name: 'Rookies' }).click()
  await mp.waitForURL('**/rookies')
  assert(await mp.getByRole('link', { name: 'Trending' }).count() === 0, 'menu stayed open')
})
await check('Mobile: search icon expands and focuses input, finds, ✕ closes', async () => {
  await mp.getByLabel('Search players').tap()
  const focused = await mp.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox')
  assert(focused, 'search input not focused after tapping the icon')
  await mp.keyboard.type('Rookie')
  await mp.getByRole('listbox').waitFor()
  await mp.getByLabel('Close search').click()
  await mp.getByLabel('Search players').waitFor()
  await mp.getByLabel('Search players').click()
  await mp.waitForTimeout(300)
  await mp.getByRole('combobox').tap(); await mp.getByRole('combobox').pressSequentially('Soph', { delay: 30 })
  await mp.getByRole('option').first().tap()
  await mp.waitForURL(/\/player\/[^/]+$/)
})
await check('Mobile: no horizontal page overflow on key pages', async () => {
  const out = []
  for (const r of ['/players', '/trending', '/rookies', '/watchlist']) {
    await mp.goto(BASE + r); await mp.waitForTimeout(1500)
    const o = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    out.push(`${r}:${o}`)
  }
  const bad = out.filter((x) => Number(x.split(':')[1]) > 0)
  assert(bad.length === 0, `overflow px → ${bad.join(', ')}`)
  return out.join(' ')
})
await mp.goto(BASE + '/players'); await mp.waitForTimeout(1500)
await mp.screenshot({ path: SHOTS + '07-mobile-players.png' })
await check('Mobile: weights drawer full width and closable', async () => {
  await mp.getByRole('button', { name: /Weights/ }).click()
  const box = await mp.getByRole('dialog').boundingBox()
  assert(Math.round(box.width) === 390, `drawer width ${box.width}`)
  await mp.getByLabel('Close weights panel').click()
})

// ─── API failure ───────────────────────────────────────────────────────────
const f = await browser.newContext()
await mockSleeper(f, { fail: true })
const fp = await f.newPage(); attachLogging(fp, 'api-down')
await check('API down: Players shows error message (after retries)', async () => {
  await fp.goto(BASE + '/players')
  await fp.getByText(/Failed to load player data/).waitFor({ timeout: 30000 })
})
await check('API down: Trending shows error message', async () => {
  await fp.goto(BASE + '/trending')
  await fp.getByText(/Failed to load trending data/).waitFor({ timeout: 30000 })
})
await check('API down: Player detail shows error + back', async () => {
  await fp.goto(BASE + '/player/1000')
  await fp.getByText(/Couldn't load this player/).waitFor({ timeout: 30000 })
})

await check('No uncaught page errors', async () => {
  const pageErrors = consoleErrors.filter((e) => e.includes('pageerror'))
  assert(pageErrors.length === 0, pageErrors.join(' | '))
})

await browser.close()
await server?.close()

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.name, 78)} ${r.note}`)
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`)
const uniq = [...new Set(consoleErrors)]
console.log(`\nConsole/page errors (${uniq.length} unique):`)
for (const e of uniq.slice(0, 40)) console.log('  ' + e)
console.log('(404s are the intentionally missing headshots; 500s come from the API-down checks.)')
process.exit(results.every((r) => r.ok) ? 0 : 1)
