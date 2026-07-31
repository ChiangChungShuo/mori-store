export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <rect height="17" rx="5" width="17" x="3.5" y="3.5" />
      <circle cx="12" cy="12" r="4" />
      <circle className="instagram-icon-dot" cx="17.4" cy="6.7" r="1" />
    </svg>
  )
}
