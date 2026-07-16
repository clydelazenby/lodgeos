import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Uploads a profile avatar. Deliberately uses the user's OWN session
 * client (createClient()), not the service-role client — the storage
 * RLS policies from migration 007 already enforce "you can only write
 * to your own {user_id}/ folder," so there's no need to bypass RLS
 * with elevated privileges for an action the user is fully authorized
 * to perform themselves. Using the service client here would be a
 * needless widening of what this route could technically do.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient() // note: async, per lib/supabase/server.ts — a bare `createClient()` without await here would silently return a Promise instead of a client and every call below would fail
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 })
    }
    const MAX_SIZE = 5 * 1024 * 1024 // matches the bucket's file_size_limit in migration 007 — checked here too so the user gets a clear error message instead of a raw storage-layer rejection
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    // Path must start with the user's own id to satisfy the storage
    // RLS policy's (storage.foldername(name))[1] = auth.uid() check.
    // A fixed filename ("photo.{ext}") rather than a random one is
    // intentional: re-uploading naturally replaces the old avatar via
    // upsert, instead of accumulating orphaned old files in storage
    // every time someone changes their photo.
    const path = `${user.id}/photo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust the public URL with a timestamp query param — the
    // underlying storage path is stable (upsert overwrites the same
    // file), so without this a browser or CDN could keep showing a
    // cached old photo after a new upload even though the file itself
    // changed.
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, avatarUrl })
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
