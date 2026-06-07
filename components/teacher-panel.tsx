'use client';

import type { TeacherMessage } from '@/lib/types';

interface TeacherPanelProps {
  status: string;
  messages: TeacherMessage[];
  plan?: {
    title: string;
    steps: string[];
  };
}

export function TeacherPanel({ status, messages, plan }: TeacherPanelProps) {
  return (
    <section className="lesson-card">
      <div className="panel-header">
        <div>
          <h2>Profesor</h2>
          <p>Explica decisiones, riesgos, trade-offs y próximos pasos sin humo.</p>
        </div>
        <span className="pill neutral">{status}</span>
      </div>

      {plan ? (
        <div className="plan-card" style={{ marginBottom: 14 }}>
          <div className="mini-row" style={{ justifyContent: 'space-between' }}>
            <strong>{plan.title}</strong>
            <span className="pill success">plan</span>
          </div>
          <ol className="plan-list">
            {plan.steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="timeline-card">
        <div className="mini-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>Feed de enseñanza</strong>
          <span className="pill neutral">{messages.length} nota(s)</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Cada tarjeta documenta una decisión concreta para que el sistema no sea una caja negra.
        </p>

        <div className="lesson-list" style={{ marginTop: 12 }}>
          {messages.length === 0 ? <div className="empty-state">Todavía no hay explicaciones del profesor.</div> : null}
          {messages.map((message) => (
            <article key={message.id} className="lesson-item">
              <div className="mini-row" style={{ justifyContent: 'space-between' }}>
                <strong>{message.title}</strong>
                {message.concept ? <span className="pill success">{message.concept}</span> : null}
              </div>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
