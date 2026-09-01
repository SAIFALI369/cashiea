#!/usr/bin/env node
/**
 * Builds the 24fps .webm face-loop videos for Meraj's screen from the
 * PNG frame sequences produced by scripts/generate-meraj-faces.py.
 *
 * Output: public/meraj/{neutral,happy,sad,listening,thinking,speaking}.webm
 * Codec: VP9 (libvpx-vp9) with alpha (yuva420p) — transparent outside
 * the rounded screen, so the body stays a crisp static render.
 *
 * Usage: node scripts/build-meraj-videos.mjs
 * Requires: @ffmpeg-installer/ffmpeg (devDependency).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRAMES = join(ROOT, 'scripts', 'video-frames')
const OUT = join(ROOT, 'public', 'meraj')
const STATES = ['neutral', 'happy', 'sad', 'listening', 'thinking', 'speaking']

const ffmpeg = (() => {
  try {
    return require('@ffmpeg-installer/ffmpeg').path
  } catch {
    return 'ffmpeg' // fall back to a system ffmpeg if present
  }
})()

mkdirSync(OUT, { recursive: true })

for (const state of STATES) {
  const dir = join(FRAMES, state)
  if (!existsSync(dir)) {
    console.error(`missing frames for ${state} — run scripts/generate-meraj-faces.py first`)
    process.exitCode = 1
    continue
  }
  const out = join(OUT, `${state}.webm`)
  const args = [
    '-y',
    '-framerate', '24',
    '-i', join(dir, 'frame_%02d.png'),
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',   // alpha channel (transparent rounded corners)
    '-crf', '34',
    '-b:v', '0',              // pure quality mode for flat cartoon art
    '-an',
    out,
  ]
  console.log(`encoding ${state}.webm …`)
  try {
    execFileSync(ffmpeg, args, { stdio: 'pipe' })
    console.log(`  → ${out}`)
  } catch (e) {
    console.error(`  ✗ ${state}: ${(e.stderr || e.message || '').toString().slice(-300)}`)
    process.exitCode = 1
  }
}
