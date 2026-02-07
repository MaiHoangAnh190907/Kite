import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'

async function startApp(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    const { worker } = await import('./mocks/browser.ts')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void startApp()
