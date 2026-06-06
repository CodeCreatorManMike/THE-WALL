'use client'

import { useEffect, useRef } from 'react'
import { TongueApp } from '../lib/app'

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<TongueApp | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const app = new TongueApp(canvas)
    appRef.current = app
    app.start()

    return () => {
      app.destroy()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'block',
        cursor: 'none',
        touchAction: 'none',   // prevents browser from intercepting touch for scroll/zoom
      }}
    />
  )
}
