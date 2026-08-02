// Shown while a storefront page's server data loads. The header and footer
// come from the layout, so navigation feels instant instead of frozen.
export default function StoreLoading() {
  return (
    <main aria-busy="true" aria-label="頁面載入中" className="section store-loading">
      <div className="store-loading-heading">
        <span className="store-loading-bar" style={{ width: '9rem' }} />
        <span className="store-loading-bar" style={{ width: '18rem', height: '2.2rem' }} />
      </div>
      <div className="store-loading-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="store-loading-card" key={index}>
            <span className="store-loading-media" />
            <span className="store-loading-bar" style={{ width: '72%' }} />
            <span className="store-loading-bar" style={{ width: '38%' }} />
          </div>
        ))}
      </div>
    </main>
  )
}
