'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useHaptics } from '@/hooks/use-haptics'
import { useKeyboard } from '@/hooks/use-keyboard'
import { isNativePlatform, isIOS, isAndroid, getPlatform, storage, cache } from '@/lib/capacitor'

export function MobileTest() {
  const [platform, setPlatform] = useState<string>('loading...')
  const [storageTest, setStorageTest] = useState<string>('')
  const [cacheTest, setCacheTest] = useState<any>(null)
  const haptics = useHaptics()
  const { isKeyboardVisible } = useKeyboard({ autoScroll: true })

  useEffect(() => {
    setPlatform(getPlatform())
    
    // Test storage
    const testStorage = async () => {
      await storage.set('test-key', 'Hello Mobile!')
      const value = await storage.get('test-key')
      setStorageTest(value || 'Failed')
      
      // Test cache
      await cache.setJSON('test-cache', { message: 'Cache works!', timestamp: Date.now() })
      const cached = await cache.getJSON('test-cache')
      setCacheTest(cached)
    }
    
    testStorage()
  }, [])

  return (
    <div className="p-4 space-y-4 safe-area">
      <Card>
        <CardHeader>
          <CardTitle>Mobile Platform Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Platform:</strong> {platform}
            </div>
            <div>
              <strong>Native:</strong> {isNativePlatform() ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>iOS:</strong> {isIOS() ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Android:</strong> {isAndroid() ? 'Yes' : 'No'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Haptic Feedback Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => haptics.light()} size="sm">
              Light
            </Button>
            <Button onClick={() => haptics.medium()} size="sm">
              Medium
            </Button>
            <Button onClick={() => haptics.heavy()} size="sm">
              Heavy
            </Button>
            <Button onClick={() => haptics.success()} size="sm">
              Success
            </Button>
            <Button onClick={() => haptics.warning()} size="sm" variant="outline">
              Warning
            </Button>
            <Button onClick={() => haptics.error()} size="sm" variant="destructive">
              Error
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Storage Value:</strong> {storageTest}
          </div>
          <div>
            <strong>Cache Value:</strong> {cacheTest ? JSON.stringify(cacheTest) : 'Loading...'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Keyboard Visible:</strong> {isKeyboardVisible ? 'Yes' : 'No'}
          </div>
          <Input placeholder="Type here to test keyboard handling..." />
          <Input placeholder="Another input to test auto-scroll..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safe Area Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="safe-top bg-blue-100 p-2 rounded">
              Safe Top Area
            </div>
            <div className="safe-bottom bg-green-100 p-2 rounded">
              Safe Bottom Area
            </div>
            <div className="safe-area bg-yellow-100 p-2 rounded">
              All Safe Areas
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
