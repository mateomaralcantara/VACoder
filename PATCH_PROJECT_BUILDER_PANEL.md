# Integración mínima en tu Project Builder

En el componente donde tienes el builder, importa el panel:

```tsx
import { ProductionRunPanel } from '@/components/production-run-panel';
```

Y debajo del bloque donde aparecen "Generar preview / Crear en disco / Ejecutar build", agrega:

```tsx
<ProductionRunPanel
  defaultCwd={projectPath || 'C:\\Users\\martin\\Desktop\\VSC\\APPS\\migrahoy'}
  defaultPort={3001}
/>
```

Si tu estado usa otros nombres, cambia `projectPath` por la variable donde guardas la ruta real del proyecto creado.

## Flujo recomendado de botones

Reemplaza mentalmente:

- Generar preview
- Crear en disco
- Ejecutar build

Por:

- Crear app completa
- Crear + validar + reparar
- Subir cuando esté limpia

Este paquete implementa el botón "Crear + validar + reparar".
