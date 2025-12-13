import { MobileTest } from '@/components/mobile-test'

export default function MobileTestPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl">
        <div className="safe-top p-4">
          <h1 className="text-2xl font-bold mb-4">Mobile Features Test</h1>
          <p className="text-muted-foreground mb-6">
            Test all mobile features to ensure they're working correctly.
          </p>
        </div>
        <MobileTest />
      </div>
    </div>
  )
}
