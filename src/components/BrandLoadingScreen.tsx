import compendiumIcon from "../assets/everend-compendium-icon.png";

export function BrandLoadingScreen({
  message = "Preparing the readable edition…",
}: {
  message?: string;
}) {
  return (
    <main
      className="brand-loading brand-loading-compendium"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="brand-loading-orbit" aria-hidden="true" />
      <div className="brand-loading-content">
        <div className="brand-loading-mark" aria-hidden="true">
          <span className="brand-loading-mark-glow" />
          <img src={compendiumIcon} alt="" />
        </div>
        <h1>Compendium</h1>
        <p>A readable edition of your universe</p>
        <div className="brand-loading-status">
          <span className="brand-loading-pulse" aria-hidden="true" />
          <span>{message}</span>
        </div>
      </div>
    </main>
  );
}
