'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/custom-questions') }, [router])
  return null
}
