import { VacoderAppShell } from '@/components/vacoder-app-shell';
import { Workspace } from '@/components/workspace';

export default function StudioPage() {
  return (
    <VacoderAppShell>
      <section className="va-page-heading">
        <div>
          <span className="va-eyebrow">PANTALLA 2 · BUILD STUDIO</span>
          <h1>Studio</h1>
          <p>
            Scanner, builder, agentes, código, diff, terminal y profesor en vivo.
            Todo el workspace original de VACoder continúa disponible aquí.
          </p>
        </div>
        <span className="va-page-badge">● workspace activo</span>
      </section>

      <Workspace embedded />
    </VacoderAppShell>
  );
}
