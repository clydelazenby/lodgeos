import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
<<<<<<< HEAD
  const supabase = createClient()
=======
  const supabase = await createClient()
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}
