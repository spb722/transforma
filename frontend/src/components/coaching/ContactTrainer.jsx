import { useState } from 'react'
import { Button } from '../ui.jsx'

export function whatsAppUrl(number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

export default function ContactTrainer({ number }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const url = whatsAppUrl(number)
  if (!url) return <p className="coaching-muted">Your trainer has not added a contact number yet.</p>
  const copy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(number)
      setCopied(true)
    } catch {
      setCopied(false)
      setError('Could not copy the number. Select and copy it below.')
    }
  }
  return <><div className="coaching-actions">
    <Button variant="primary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Open WhatsApp</Button>
    <Button onClick={copy}>{copied ? 'Copied' : 'Copy number'}</Button>
  </div><p className="coaching-muted">{number}</p>{error&&<p role="alert" className="coaching-error">{error}</p>}</>
}
