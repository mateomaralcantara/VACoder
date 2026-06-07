import type { VirtualFile } from '@/lib/types';

export const SAMPLE_FILES: VirtualFile[] = [
  {
    id: 'app-page',
    path: 'app/page.tsx',
    language: 'tsx',
    description: 'Página inicial del proyecto demo',
    content: `export default function HomePage() {\n  return (\n    <main style={{ padding: 32 }}>\n      <h1>Proyecto demo</h1>\n      <p>Este archivo puede ser modificado por el agente.</p>\n    </main>\n  );\n}\n`,
  },
  {
    id: 'component-card',
    path: 'components/demo-card.tsx',
    language: 'tsx',
    description: 'Componente reutilizable de ejemplo',
    content: `type DemoCardProps = {\n  title: string;\n  body: string;\n};\n\nexport function DemoCard({ title, body }: DemoCardProps) {\n  return (\n    <article>\n      <h2>{title}</h2>\n      <p>{body}</p>\n    </article>\n  );\n}\n`,
  },
  {
    id: 'package-json',
    path: 'package.json',
    language: 'json',
    description: 'Dependencias y scripts del proyecto demo',
    content: `{"scripts":{"dev":"next dev","build":"next build","lint":"next lint"},"dependencies":{"next":"latest","react":"latest","react-dom":"latest"},"devDependencies":{"typescript":"latest","@types/node":"latest","@types/react":"latest","@types/react-dom":"latest"}}\n`,
  },
].map((file) => ({ ...file, originalContent: file.content, dirty: false }));
