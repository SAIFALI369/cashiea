import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/Avatar'
import PageHeader from '../components/ui/PageHeader'
import {
  UserCog, Shield, Save, Loader2, Camera, Trash2, Mail, Phone, Building2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const isOwner = (role?: string) => role === 'owner'

// Read an image file, square-crop it, and shrink to a small JPEG avatar.
async function fileToAvatarBlob(file: File, size = 256): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('Could not read image'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Invalid image'))
    i.src = dataUrl
  })
  const min = Math.min(img.width, img.height)
  const sx = (img.width - min) / 2
  const sy = (img.height - min) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Resize failed'))), 'image/jpeg', 0.9)
  )
  return blob
}

export default function Account() {
  const { profile, user, refreshProfile } = useAuth()
  const owner = isOwner(profile?.role)

  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setCompany(profile?.company_name || '')
    setPhone(profile?.phone || '')
    setEmail(user?.email || '')
  }, [profile, user])

  const onPickFile = () => fileRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    setUploading(true)
    try {
      const blob = await fileToAvatarBlob(file)
      const path = `${user.id}/avatar.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${pub.publicUrl}?v=${Date.now()}`
      const { error: ue } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
      if (ue) throw ue
      await refreshProfile()
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload photo')
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async () => {
    if (!user || !profile?.avatar_url) return
    setUploading(true)
    try {
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`])
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Photo removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove photo')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, company_name: company, phone })
        .eq('id', profile!.id)
      if (error) throw error
      if (email && email !== user?.email) {
        const { error: ae } = await supabase.auth.updateUser({ email })
        if (ae) throw ae
        toast.success('Saved. Email change needs confirmation.')
      } else {
        toast.success('Profile saved')
      }
      await refreshProfile()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const displayName = fullName || email || 'Your account'

  return (
    <div className="animate-fade-in max-w-xl">
      <PageHeader
        title="Account"
        subtitle="Your shop, your identity — kept just the way you like it."
        icon={<UserCog className="w-5 h-5" />}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />

      {/* Identity card */}
      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <Avatar url={profile?.avatar_url} name={displayName} size={88} />
            {(
              <button
                onClick={onPickFile}
                disabled={uploading}
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-surface border border-line shadow-soft flex items-center justify-center text-fg hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-fg truncate">{displayName}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-soft text-accent text-[10px] font-semibold tracking-wide">
                <Shield className="w-3 h-3" /> Owner
              </span>
            </div>
            <p className="text-sm text-fg-muted mt-0.5 truncate">
              {company || 'Add your business name below'}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={onPickFile} disabled={uploading} className="btn-secondary text-xs h-8 px-3">
                <Camera className="w-3.5 h-3.5" /> {profile?.avatar_url ? 'Change photo' : 'Upload photo'}
              </button>
              {profile?.avatar_url && (
                <button
                  onClick={removePhoto}
                  disabled={uploading}
                  className="btn-ghost text-xs h-8 px-2 text-fg-muted hover:text-negative"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div className="card p-5 sm:p-6 mb-5">
        <h3 className="text-sm font-semibold text-fg mb-4">Contact details</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              disabled={!owner}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                className="input-field pl-10"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 …"
                inputMode="tel"
                disabled={!owner}
              />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                className="input-field pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@shop.com"
                inputMode="email"
                disabled={!owner}
              />
            </div>
          </div>
          <div>
            <label className="label">Business name</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                className="input-field pl-10"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Sharma General Store"
                disabled={!owner}
              />
            </div>
          </div>
        </div>
        {owner && (
          <button onClick={save} disabled={saving} className="btn-primary w-full mt-5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-fg-subtle">
        <Link to="/privacy" className="hover:text-fg transition-colors">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-fg transition-colors">Terms &amp; Conditions</Link>
      </div>
    </div>
  )
}
