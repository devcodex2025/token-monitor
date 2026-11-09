'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export default function TokenSearch() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function go(mint: string): void {
    if (!BASE58.test(mint)) {
      setError('Enter a valid Solana mint address (base58, 32–44 chars)')
      return
    }
    setError('')
    router.push(`/t/${mint}`)
  }

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          go(value.trim())
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError('')
          }}
          placeholder="Paste a Solana token mint (e.g. CSrw…pump)"
          aria-label="Token mint address"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Analyze token →
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
