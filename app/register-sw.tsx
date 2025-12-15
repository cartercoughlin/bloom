'use client'

import { useEffect } from 'react'

export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration)
          
          // Check for updates every 30 seconds
          setInterval(() => {
            registration.update()
          }, 30000)
          
          // Listen for new service worker waiting
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available, auto-refresh after 3 seconds
                  console.log('New version detected, refreshing in 3 seconds...')
                  setTimeout(() => {
                    window.location.reload()
                  }, 3000)
                }
              })
            }
          })
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error)
        })
    }
  }, [])

  return null
}
