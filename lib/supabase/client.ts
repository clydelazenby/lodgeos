<<<<<<< HEAD
=======
'use client'
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
<<<<<<< HEAD
}
=======
}
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
