import { VacoderAppShell } from '@/components/vacoder-app-shell';
import { VacoderDashboard } from '@/components/vacoder-dashboard';

export default function HomePage() {
  return (
    <VacoderAppShell>
      <VacoderDashboard />
    </VacoderAppShell>
  );
}
