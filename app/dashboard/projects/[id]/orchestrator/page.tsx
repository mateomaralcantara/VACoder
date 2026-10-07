import JobOrchestrator from "@/components/job-orchestrator";
import { getPublicProjectContext } from "@/lib/control-plane/project";

export const dynamic = "force-dynamic";

export default async function OrchestratorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getPublicProjectContext(id);
  return <JobOrchestrator projectId={id} projectName={context.project.name} />;
}
