'use client'

import { useEffect } from 'react'
import { useSettings } from '@/app/settings-provider'

/**
 * Dynamically sets the browser tab favicon based on the current
 * portal logo settings (uploaded image, emoji, or default OCD logo).
 * Uses dark/light logo variants based on system color scheme.
 */
export function DynamicFavicon() {
  const { settings } = useSettings()

  useEffect(() => {
    const emoji = settings.portalEmoji
    const icon = settings.portalIcon
    const accentColor = settings.accentColor
    const bgHidden = settings.iconBgHidden

    // Find or create the favicon link element
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    if (icon) {
      // Uploaded image — use directly as favicon
      link.href = icon
      link.type = 'image/jpeg'
      return
    }

    // No custom emoji override — use default OCD logo (theme-aware)
    if (!emoji) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      link.href = isDark ? '/ocd-logo-dark.png' : '/ocd-logo-light.png'
      link.type = 'image/png'

      // Listen for theme changes
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        if (!settings.portalIcon && !settings.portalEmoji) {
          link!.href = e.matches ? '/ocd-logo-dark.png' : '/ocd-logo-light.png'
        }
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    // Custom emoji — render to canvas
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!bgHidden) {
      // Draw colored background circle
      const color = accentColor ?? '#f5c518'
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw emoji centered
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${bgHidden ? 56 : 40}px serif`
    ctx.fillText(emoji, size / 2, size / 2 + 2)

    link.href = canvas.toDataURL('image/png')
    link.type = 'image/png'
  }, [settings.portalIcon, settings.portalEmoji, settings.accentColor, settings.iconBgHidden])

  return null
}
