'use client'
import { useState } from 'react'
import { authApi } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendOtp = async () => {
    setLoading(true); setError('')
    try {
      await authApi.sendOtp(phone)
      setStep('otp')
    } catch { setError('Could not send OTP. Check the number.') }
    finally { setLoading(false) }
  }

  const verifyOtp = async () => {
    setLoading(true); setError('')
    try {
      const res = await authApi.verifyOtp(phone, code, 'BUSINESS')
      localStorage.setItem('sc_token', res.data.token)
      router.push('/dashboard')
    } catch { setError('Invalid or expired OTP.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">S</div>
          <span className="text-xl font-bold text-gray-900">ServiConnect</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">Business login</h1>
        <p className="text-gray-500 text-sm mb-8">We'll send a 6-digit OTP to your phone</p>

        {step === 'phone' ? (
          <>
            <input type="tel" placeholder="e.g. 082 555 0000" value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={sendOtp} disabled={loading || !phone}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">OTP sent to {phone}</p>
            <input type="text" maxLength={6} placeholder="000000" value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-sm mb-4 text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={verifyOtp} disabled={loading || code.length !== 6}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button onClick={() => setStep('phone')} className="w-full mt-3 text-sm text-gray-500">← Change number</button>
          </>
        )}
        {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
      </div>
    </div>
  )
}
