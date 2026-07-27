/**
 * Avatar — shows the owner's profile photo when set, otherwise a branded
 * initial tile. Used in the header, sidebar, and account page.
 */
export function Avatar({
  url,
  name,
  size = 40,
  className = '',
}: {
  url?: string | null
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase()
  const dim = { width: size, height: size }

  if (url) {
    return (
      <img
        src={url}
        alt={name || 'Profile photo'}
        loading="lazy"
        className={`rounded-full object-cover bg-surface-2 ring-1 ring-line/80 ${className}`}
        style={dim}
      />
    )
  }

  return (
    <span
      className={`rounded-full bg-gradient-to-br from-accent to-accent-strong text-accent-fg flex items-center justify-center font-bold ring-1 ring-accent/20 select-none ${className}`}
      style={{ ...dim, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  )
}

export default Avatar
