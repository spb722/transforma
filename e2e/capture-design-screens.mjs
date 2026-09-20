#!/usr/bin/env node
/* Capture a read-only mobile UI reference pack from the current local instance.
 *
 * The helper authenticates exactly like e2e/as-user.mjs and only navigates or opens
 * editor controls. It never publishes, saves, cancels, reschedules, or ends coaching.
 *
 * Captures all four viewports required by the responsive-ui-redesign feature
 * (specs/002-responsive-ui-redesign/): 360x800 and 390x844 for the mobile client/trainer
 * screen sets, 768x1024 and 1440x900 for the representative desktop-web set. The
 * pre-existing 390x844/1440x900 filenames are kept unsuffixed for backward compatibility
 * with the design guide's screenshot manifest; the two added viewports write to a
 * viewport-suffixed filename so nothing is overwritten.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'design', 'ui-audit', 'current-mobile')
const clientOutput = path.join(output, 'client')
const trainerOutput = path.join(output, 'trainer')
const webOutput = path.join(root, 'design', 'ui-audit', 'current-web')
const base = process.env.E2E_BASE || 'http://localhost:8080'
const relationshipId = 'a141b1c1-93f6-4dda-9549-4064b18b663c'

for (const directory of [clientOutput, trainerOutput, webOutput]) fs.mkdirSync(directory, { recursive: true })

const users = JSON.parse(fs.readFileSync(path.join(root, 'data', 'db.json'), 'utf8')).users
const secret = fs.readFileSync(path.join(root, 'data', 'secret'), 'utf8').trim()

// Suffix is '' for the pre-existing viewport in each class (keeps current filenames
// stable) and '@WxH' for the newly added one, per constitution Principle II's four
// required viewports (360x800, 390x844, 768x1024, 1440x900).
const MOBILE_VIEWPORTS = [
  { suffix: '', width: 390, height: 844, deviceScaleFactor: 3 },
  { suffix: '@360x800', width: 360, height: 800, deviceScaleFactor: 3 }
]
const WEB_VIEWPORTS = [
  { suffix: '', width: 1440, height: 900, deviceScaleFactor: 1 },
  { suffix: '@768x1024', width: 768, height: 1024, deviceScaleFactor: 1 }
]

function authCookie(name) {
  const user = users.find(item => item.name === name)
  if (!user) throw new Error(`Account not found: ${name}`)
  const payload = `${user.id}:${Date.now() + 86_400_000}:${user.sv || 0}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

async function makePage(browser, accountName, { desktop = false, viewport } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: !desktop,
    hasTouch: !desktop,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    colorScheme: 'dark'
  })
  await context.addCookies([{ name: 'gymsid', value: authCookie(accountName), url: base }])
  const page = await context.newPage()
  page.on('console', message => {
    if (message.type() === 'error') console.error(`[${accountName}${viewport.suffix}] ${message.text()}`)
  })
  return { context, page }
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => document.querySelector('#app')?.innerText?.trim().length > 0)
  await page.waitForTimeout(650)
}

async function capture(page, directory, name, viewportSuffix, { pathName, scrollY = 0, before } = {}) {
  if (pathName) {
    await page.goto(`${base}/#${pathName}`)
    await settle(page)
  }
  if (before) await before(page)
  if (scrollY) {
    await page.evaluate(value => window.scrollTo(0, value), scrollY)
    await page.waitForTimeout(250)
  }
  const target = path.join(directory, `${name}${viewportSuffix}.png`)
  await page.screenshot({ path: target, animations: 'disabled' })
  console.log(path.relative(root, target))
}

// Step data extracted from the original inline capture() calls so each viewport
// pass replays the identical navigation without duplicating ~30 call sites per size.
const clientSteps = [
  { name: '01-personal-home', pathName: '/home' },
  { name: '02-coach-assigned-plan', pathName: '/plan' },
  { name: '03-start-workout', pathName: '/workout' },
  { name: '04-personal-stats-top', pathName: '/stats' },
  { name: '05-personal-stats-lower', scrollY: 1100 },
  { name: '06-exercise-library', pathName: '/library' },
  {
    name: '07-exercise-details',
    before: async page => {
      const rows = page.locator('.item')
      if (await rows.count() > 1) {
        await rows.nth(1).click()
        await page.waitForTimeout(300)
      }
    }
  },
  { name: '08-settings', pathName: '/settings' },
  { name: '09-coaching-overview', pathName: '/coaching' },
  { name: '10-client-workspace-top', pathName: `/coaching/${relationshipId}` },
  { name: '11-client-workspace-schedule', scrollY: 560 },
  { name: '12-weekly-check-in', pathName: `/coaching/${relationshipId}/check-in` },
  { name: '13-client-progress', pathName: `/coaching/${relationshipId}/progress` },
  { name: '14-client-fees', pathName: `/coaching/${relationshipId}/fees` }
]

const trainerSteps = [
  { name: '01-client-overview', pathName: '/studio' },
  { name: '02-invitations', pathName: '/studio/invitations' },
  { name: '03-studio-settings', pathName: '/studio/settings' },
  { name: '04-client-workspace-top', pathName: `/studio/clients/${relationshipId}` },
  { name: '05-client-workspace-schedule', scrollY: 520 },
  { name: '06-current-workout-plan', pathName: `/studio/clients/${relationshipId}/workout` },
  {
    name: '07-recurring-plan-editor-source',
    before: async page => {
      await page.getByRole('button', { name: 'Edit recurring plan' }).click()
      await page.waitForTimeout(300)
    }
  },
  { name: '08-recurring-plan-editor-days', scrollY: 500 },
  {
    name: '09-schedule-manager',
    before: async page => {
      const schedule = page.getByRole('heading', { name: 'Schedule manager' })
      await schedule.scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
    }
  },
  {
    name: '10-manage-one-workout',
    before: async page => {
      const manage = page.getByRole('button', { name: 'Manage' }).first()
      if (await manage.count()) {
        await manage.click()
        await page.waitForTimeout(250)
        await manage.scrollIntoViewIfNeeded()
      }
    }
  },
  {
    name: '11-one-day-workout-editor',
    before: async page => {
      const edit = page.getByRole('button', { name: 'Edit this workout' }).first()
      if (await edit.count()) {
        await edit.click()
        await page.waitForTimeout(300)
        await page.getByRole('heading', { name: /^Edit / }).scrollIntoViewIfNeeded()
      }
    }
  },
  { name: '12-diet-plan', pathName: `/studio/clients/${relationshipId}/diet` },
  { name: '13-check-in-review', pathName: `/studio/clients/${relationshipId}/check-in` },
  { name: '14-client-progress', pathName: `/studio/clients/${relationshipId}/progress` },
  { name: '15-fee-management', pathName: `/studio/clients/${relationshipId}/fees` }
]

const clientWebSteps = [
  { name: '01-client-personal-home', pathName: '/home' },
  { name: '02-client-coach-assigned-plan', pathName: '/plan' },
  { name: '03-client-coaching-workspace', pathName: `/coaching/${relationshipId}` }
]

const trainerWebSteps = [
  { name: '04-trainer-client-overview', pathName: '/studio' },
  { name: '05-trainer-client-workspace', pathName: `/studio/clients/${relationshipId}` },
  { name: '06-trainer-workout-plan', pathName: `/studio/clients/${relationshipId}/workout` },
  {
    name: '07-trainer-recurring-plan-editor',
    before: async page => {
      await page.getByRole('button', { name: 'Edit recurring plan' }).click()
      await page.waitForTimeout(300)
    }
  },
  {
    name: '08-trainer-schedule-manager',
    before: async page => {
      await page.getByRole('heading', { name: 'Schedule manager' }).scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
    }
  }
]

async function runSteps(browser, accountName, directory, steps, viewport, opts = {}) {
  const { context, page } = await makePage(browser, accountName, { ...opts, viewport })
  for (const step of steps) await capture(page, directory, step.name, viewport.suffix, step)
  await context.close()
}

const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of MOBILE_VIEWPORTS) {
    await runSteps(browser, 'test_1', clientOutput, clientSteps, viewport)
    await runSteps(browser, 'sachin_trainer', trainerOutput, trainerSteps, viewport)
  }

  for (const viewport of WEB_VIEWPORTS) {
    await runSteps(browser, 'test_1', webOutput, clientWebSteps, viewport, { desktop: true })
    await runSteps(browser, 'sachin_trainer', webOutput, trainerWebSteps, viewport, { desktop: true })
  }
} finally {
  await browser.close()
}
