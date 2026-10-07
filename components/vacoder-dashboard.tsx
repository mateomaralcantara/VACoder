import Link from 'next/link';

const metrics = [
  {
    icon: '▣',
    label: 'Proyectos activos',
    value: '1',
    trend: 'Repositorio maestro',
    tone: 'blue',
    spark: [32, 42, 38, 58, 64, 82, 78],
  },
  {
    icon: '▶',
    label: 'Jobs en ejecución',
    value: '0',
    trend: 'Cola durable lista',
    tone: 'purple',
    spark: [20, 32, 26, 48, 42, 62, 70],
  },
  {
    icon: '✓',
    label: 'Build certificado',
    value: '1',
    trend: 'LIVE-4 · 100%',
    tone: 'green',
    spark: [28, 30, 46, 44, 58, 72, 88],
  },
  {
    icon: '☁',
    label: 'Cloud Runtime',
    value: 'E2B',
    trend: 'Node 22 operativo',
    tone: 'cyan',
    spark: [18, 36, 32, 54, 48, 68, 84],
  },
  {
    icon: '!',
    label: 'Errores críticos',
    value: '0',
    trend: 'Pipeline estable',
    tone: 'red',
    spark: [70, 56, 42, 38, 26, 20, 14],
  },
];

const activity = [
  [12, 8, 5],
  [10, 7, 4],
  [16, 10, 8],
  [19, 12, 11],
  [18, 10, 14],
  [24, 14, 22],
  [26, 20, 36],
];

const jobs = [
  {
    id: '12e7d229',
    project: 'VACoder',
    type: 'Cloud Quality',
    agent: 'cloud-worker',
    status: 'Completado',
    duration: '22 s',
    progress: '100%',
  },
  {
    id: 'LIVE-4',
    project: 'VACoder',
    type: 'Runtime',
    agent: 'E2B',
    status: 'Certificado',
    duration: 'Node 22',
    progress: '4/4',
  },
  {
    id: 'B3',
    project: 'VACoder',
    type: 'Orchestrator',
    agent: 'durable-worker',
    status: 'Completado',
    duration: 'persistente',
    progress: '100%',
  },
];

const projects = [
  {
    name: 'VACoder',
    description: 'Agent OS · App Factory autónoma',
    meta: 'LIVE-4 certificado',
    files: 'Cloud Runtime',
    color: 'blue',
  },
  {
    name: 'Studio',
    description: 'Scanner, builder, agentes, diff y profesor',
    meta: 'workspace activo',
    files: 'IDE',
    color: 'purple',
  },
  {
    name: 'Runtime',
    description: 'Build, tests, E2B, logs y verificación',
    meta: 'Node 22',
    files: 'E2B',
    color: 'green',
  },
];

export function VacoderDashboard() {
  return (
    <div className="va-dashboard">
      <section className="va-dashboard-header">
        <div>
          <span className="va-eyebrow">AGENT OS · CONTROL CENTER</span>
          <h1>VACoder Agent OS</h1>
          <p>
            Construye, valida y ejecuta software con scanner, jobs durables, cloud runtime,
            terminal, diff y agentes desde una sola consola.
          </p>
        </div>

        <Link className="va-primary-action" href="/dashboard/projects/new">
          <span>＋</span>
          Nuevo proyecto
          <b>⌄</b>
        </Link>
      </section>

      <section className="va-metrics-grid" aria-label="Resumen de plataforma">
        {metrics.map((metric) => (
          <article className={`va-metric va-tone-${metric.tone}`} key={metric.label}>
            <div className="va-metric-main">
              <span className="va-metric-icon">{metric.icon}</span>
              <div>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </div>
            </div>
            <div className="va-metric-bottom">
              <span>↑ {metric.trend}</span>
              <div className="va-sparkline" aria-hidden="true">
                {metric.spark.map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="va-dashboard-grid">
        <article className="va-card va-activity-card">
          <header className="va-card-header">
            <div>
              <span className="va-card-icon">◈</span>
              <h2>Actividad de la plataforma</h2>
            </div>
            <div className="va-card-filters">
              <button className="active" type="button">Proyectos</button>
              <button type="button">Jobs</button>
              <button type="button">Ejecuciones</button>
              <span>▣ Últimos 7 días ⌄</span>
            </div>
          </header>

          <div className="va-chart">
            <div className="va-chart-y">
              <span>40</span><span>30</span><span>20</span><span>10</span><span>0</span>
            </div>
            <div className="va-chart-stage">
              {[40, 30, 20, 10].map((line) => <i className="va-grid-line" key={line} />)}
              {activity.map((group, index) => (
                <div className="va-bar-group" key={index}>
                  <div className="va-bars">
                    <span style={{ height: `${group[0] * 2.1}px` }} />
                    <span style={{ height: `${group[1] * 2.1}px` }} />
                    <span style={{ height: `${group[2] * 2.1}px` }} />
                  </div>
                  <small>{6 + index} oct.</small>
                </div>
              ))}
            </div>
          </div>

          <div className="va-chart-legend">
            <span><i className="blue" /> Proyectos escaneados</span>
            <span><i className="purple" /> Jobs ejecutados</span>
            <span><i className="green" /> Builds exitosos</span>
          </div>
        </article>

        <article className="va-card va-system-card">
          <header className="va-card-header">
            <div>
              <span className="va-card-icon green">▦</span>
              <h2>Estado del sistema</h2>
            </div>
            <span className="va-operational">● Operativo</span>
          </header>

          <div className="va-system-list">
            {[
              ['Scanner de proyectos', 'En línea', 'listo'],
              ['Orchestrator', 'Operativo', 'durable'],
              ['Cloud Runtime', 'E2B', 'Node 22'],
              ['Workspace Snapshot', 'Privado', 'Supabase'],
              ['Build & Typecheck', 'Operativo', '100%'],
              ['Base de datos', 'Operativa', 'RLS'],
            ].map(([name, state, meta]) => (
              <div className="va-system-row" key={name}>
                <span className="va-system-symbol">◉</span>
                <strong>{name}</strong>
                <span className="va-system-state"><i />{state}</span>
                <small>{meta}</small>
                <b>›</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="va-launch-grid" aria-label="Tres pantallas principales">
        <Link href="/" className="va-launch-card dashboard active">
          <span className="va-launch-icon">▥</span>
          <div>
            <h3>Dashboard</h3>
            <p>Vista general, métricas, jobs y estado de la plataforma.</p>
            <strong>Estás aquí →</strong>
          </div>
          <div className="va-mini-preview">
            <i /><i /><i /><i />
          </div>
        </Link>

        <Link href="/studio" className="va-launch-card studio">
          <span className="va-launch-icon">&lt;/&gt;</span>
          <div>
            <h3>Studio</h3>
            <p>Scanner, builder, prompts, código, diff, profesor y herramientas.</p>
            <strong>Abrir Studio →</strong>
          </div>
          <div className="va-code-preview">
            <i /><i /><i /><i /><i />
          </div>
        </Link>

        <Link href="/runtime" className="va-launch-card runtime">
          <span className="va-launch-icon">▶</span>
          <div>
            <h3>Runtime</h3>
            <p>Ejecuta, monitorea, compila, prueba y depura en tiempo real.</p>
            <strong>Abrir Runtime →</strong>
          </div>
          <div className="va-runtime-preview">
            <i /><i /><i />
          </div>
        </Link>
      </section>

      <section className="va-bottom-grid">
        <article className="va-card va-jobs-card">
          <header className="va-card-header">
            <div>
              <span className="va-card-icon">◷</span>
              <h2>Jobs recientes</h2>
            </div>
            <Link href="/dashboard/projects">Ver todos →</Link>
          </header>

          <div className="va-table-wrap">
            <table className="va-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Proyecto</th>
                  <th>Tipo</th>
                  <th>Agente</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                  <th>Progreso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td><b>▣</b> {job.project}</td>
                    <td>{job.type}</td>
                    <td>{job.agent}</td>
                    <td><span className="va-status success">{job.status}</span></td>
                    <td>{job.duration}</td>
                    <td>{job.progress}</td>
                    <td>•••</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="va-card va-projects-card">
          <header className="va-card-header">
            <div>
              <span className="va-card-icon">□</span>
              <h2>Espacios principales</h2>
            </div>
            <Link href="/dashboard/projects">Ver proyectos →</Link>
          </header>

          <div className="va-project-list">
            {projects.map((project) => (
              <div className="va-project-row" key={project.name}>
                <span className={`va-folder ${project.color}`}>■</span>
                <div>
                  <strong>{project.name}</strong>
                  <small>{project.description}</small>
                </div>
                <span>{project.meta}</span>
                <b>{project.files}</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
