import { useState, useRef, useCallback } from 'react'
import type { KeyboardEvent, ClipboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'

const CODE_LENGTH = 6

export function Mfa(): React.JSX.Element {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { verifyMfa } = useAuth()
  const navigate = useNavigate()

  const submitCode = useCallback(
    async (code: string) => {
      setError('')
      setLoading(true)
      try {
        await verifyMfa(code)
        navigate('/')
      } catch {
        setError('Invalid verification code')
        setDigits(Array(CODE_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
      } finally {
        setLoading(false)
      }
    },
    [verifyMfa, navigate],
  )

  function handleChange(index: number, value: string): void {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...digits]
    newDigits[index] = value.slice(-1)
    setDigits(newDigits)

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (value && index === CODE_LENGTH - 1) {
      const code = newDigits.join('')
      if (code.length === CODE_LENGTH) {
        void submitCode(code)
      }
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>): void {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return

    const newDigits = Array(CODE_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i]
    }
    setDigits(newDigits)

    if (pasted.length === CODE_LENGTH) {
      void submitCode(pasted)
    } else {
      inputRefs.current[pasted.length]?.focus()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm">
        <div className="rounded-lg bg-bg-card p-8 shadow-md">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-text-primary">
              Two-Factor Authentication
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <div className="mb-6 flex justify-center gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={loading}
                className="h-12 w-10 rounded-md border border-border text-center text-lg font-semibold text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-center text-sm text-flag-red">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              const code = digits.join('')
              if (code.length === CODE_LENGTH) void submitCode(code)
            }}
            disabled={loading || digits.join('').length < CODE_LENGTH}
            className="w-full rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <div className="mt-4 text-center">
            <a
              href="/login"
              className="text-sm text-brand-primary hover:text-brand-hover"
            >
              Back to login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
