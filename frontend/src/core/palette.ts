/**
 * Chart colours, per theme.
 *
 * Series identity uses a teal-blue/coral pair from the merged theme
 * (styles/merged-theme.css): the cool and warm ends of a LearnUI-style ramp
 * from the brand teal to amber, snapped in lightness and chroma until it passed
 * the colour-vision validator against the card - CVD delta-E 18.3 light, 19.0
 * dark, normal-vision 30.3 / 28.9, and 3:1 against the surface. The ramp's own
 * endpoints failed: the teal reads grey in a chart and the amber is too pale on
 * white (22 Oct 2026).
 *
 * The brand colour is the accent, not a series colour: it marks the one thing a
 * chart is about (a single-series trend, a sparkline), never "series 3".
 * Status colours (good / warn / bad) are reserved for status and live in the
 * CSS tokens, never here.
 */
import { useTheme } from './theme'

export interface ChartPalette {
  primary: string      // brand green: single-series marks, sparklines
  female: string       // categorical slot 1
  male: string         // categorical slot 2
  // A two-series chart that is NOT about sex (e.g. entering vs leaving) uses
  // this pair, so it never borrows the female or male colour. Teal and indigo
  // from the merged ramp, validated as a pair: CVD dE 16.8 light, both themes pass.
  series1: string
  series2: string
  /** The cohort flow, in the Octet palette (Es, 23 Oct 2026): Enamelled Jewel
   *  for entering, Retro Lime for leaving, the other swatches for the rest. */
  flowIn: string; flowAgain: string; flowOut: string; flowCare: string
  stock: string; stockFill: string
  unknown: string      // data gap, deliberately recessive
  provisional: string  // a period that has not finished happening
}

export const PALETTE_LIGHT: ChartPalette = {
  primary: '#055B65',   // Octet deep teal
  female: '#0073a1',    // merged ramp, cool end - validated: CVD dE 18.3, normal 30.3, >= 3:1
  male: '#de6129',      // merged ramp, warm end
  series1: '#008d6c',
  series2: '#5e5bb6',
  flowIn: '#055b65',       // Enamelled Jewel - entered
  flowAgain: '#45828b',    // Wish Upon a Star - entered again
  flowOut: '#1bd488',      // Retro Lime - left, re-suppressed
  flowCare: '#b2c9c5',     // Light Teal - left care before a repeat VL
  stock: '#055b65',
  stockFill: '#b2c9c5',
  unknown: '#d5dbdf',
  provisional: '#8794a0',
}

export const PALETTE_DARK: ChartPalette = {
  primary: '#1BD488',   // Octet vivid green
  female: '#008cc0',    // validated on the dark card: CVD dE 19.0, normal 28.9
  male: '#e06b39',
  series1: '#20a89b',
  series2: '#8081d8',
  flowIn: '#3f9aa5',       // the jewel, lifted to read on the dark card
  flowAgain: '#b2c9c5',
  flowOut: '#1bd488',
  flowCare: '#5f7a7d',
  stock: '#b2c9c5',
  stockFill: '#45828b',
  unknown: '#3a4145',
  provisional: '#8f9aa3',
}

/** The palette for the current theme. Its identity changes with the theme,
 *  so a chart config memoised on it is rebuilt when the theme flips. */
export function useChartPalette(): ChartPalette {
  const { theme } = useTheme()
  return theme === 'dark' ? PALETTE_DARK : PALETTE_LIGHT
}

/** A CSS custom property's current value, for chart chrome that follows the
 *  page tokens (axis text, gridlines), resolved to rgba(). */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw ? toRgba(raw) : fallback
}

let probe: CanvasRenderingContext2D | null | undefined

/**
 * Any CSS colour as rgba(), via a one-pixel canvas.
 *
 * The theme tokens are oklch. Chart.js re-parses colours with its own library,
 * which does not read oklch's alpha: the dark theme's 10%-white gridline came
 * out solid white (22 Oct 2026). Resolving through the browser first gives
 * Chart.js a format it handles. Falls back to the input where there is no
 * canvas (tests).
 */
export function toRgba(css: string): string {
  if (probe === undefined) {
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 1
      probe = c.getContext('2d', { willReadFrequently: true })
    } catch { probe = null }
  }
  if (!probe) return css
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'           // reset, so an unparseable value is caught below
  probe.fillStyle = css
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a ?? 255) / 255 * 1000) / 1000})`
}
