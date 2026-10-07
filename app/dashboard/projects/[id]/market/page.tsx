import ProjectControlPlane from "@/components/project-control-plane";
import { getPublicProjectContext } from "@/lib/control-plane/project";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectControlPlane projectId={id} initialContext={await getPublicProjectContext(id)} initialTab="market" />;
}
