import { VacoderAppShell } from '@/components/vacoder-app-shell';
import SupremeRuntimeCenter from '@/components/supreme-runtime-center';

export default function RuntimePage() {
  return (
    <VacoderAppShell>
      <section className="va-page-heading">
        <div>
          <span className="va-eyebrow">PANTALLA 3 · RUNTIME & QA</span>
          <h1>Runtime</h1>
          <p>
            Ejecuta, monitorea, compila, valida y depura proyectos. El motor Supreme Runtime
            se mantiene intacto dentro de la nueva interfaz.
          </p>
        </div>
        <span className="va-page-badge success">● E2B · LIVE-4</span>
      </section>

      <div className="va-runtime-host">
        <SupremeRuntimeCenter />
      </div>
    </VacoderAppShell>
  );
}
