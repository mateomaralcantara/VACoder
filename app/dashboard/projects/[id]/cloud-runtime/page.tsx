import CloudRuntimePanel from "@/components/cloud-runtime-panel";
import { getPublicProjectContext } from "@/lib/control-plane/project";

export const dynamic = "force-dynamic";

export default async function CloudRuntimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getPublicProjectContext(id);

  return (
    <CloudRuntimePanel
      projectId={id}
      projectName={context.project.name}
    />
  );
}
