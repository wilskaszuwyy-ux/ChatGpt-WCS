# Dashboard de valorizacion de obra - abril 2026

Proyecto con dos herramientas offline para la supervision y valorizacion de obras por administracion directa segun **Directiva 017-2023-CG** de la Contraloria General de la Republica.

---

## Herramienta 1: Dashboard de supervision (informe fijo)

Visualizacion del informe mensual de la IOARR con CUI 2713723 — abril 2026.

Abra `index.html` en el navegador o ejecute:

```bash
npm start
```

Luego visite `http://localhost:4173`.

El PDF fuente esta embebido en `src/pdfData.js` para consulta local desde el panel **Documento fuente**.

---

## Herramienta 2: Valorizacion automatica (ingreso de datos)

Herramienta interactiva para **crear y calcular valorizaciones mensuales** de cualquier obra por administracion directa.

Abra `valorization.html` en el navegador o visite `http://localhost:4173/valorization.html`.

### Funcionalidades

| Funcion | Descripcion |
|---|---|
| Ficha tecnica | Datos de entidad, proyecto, ubicacion y responsables |
| Presupuesto base | Ingreso de partidas con metrado y precio unitario; `Parcial = Metrado × P.U.` se calcula solo |
| Valorizacion mensual | Ingrese el metrado ejecutado por partida; importe, acumulados y avance % se actualizan al instante |
| Costos indirectos | Gastos generales y supervision calculados como % del costo directo |
| Cronograma comparado | Tabla de % programado/ejecutado fisico y financiero; Curva S generada automaticamente |
| Personal | Registro del equipo tecnico por cargo y documento de vinculacion |
| Presupuesto analitico | Control de ejecucion por especifica de gasto |
| Resumen ejecutivo | Indicadores de avance acumulado, brecha fisica y Curva S visual |
| Exportar a Excel | Genera un libro `.xls` con portada, hojas de valorizacion, cronograma, personal, presupuesto analitico y lista de control normativo |
| Guardar / cargar JSON | Guarda el proyecto completo como archivo JSON para reusarlo en futuras sesiones |
| Auto-guardado | El estado se persiste en `localStorage` del navegador automaticamente |

### Flujo recomendado

1. **Proyecto** — Complete los datos de la entidad, obra y responsables.
2. **Presupuesto** — Ingrese las partidas del expediente tecnico con sus unidades, metrados y precios unitarios. Configure el porcentaje de gastos generales y supervision.
3. **Cronograma** — Agregue los periodos del cronograma con su porcentaje programado mensual.
4. **Personal** — Registre al equipo asignado.
5. **Presupuesto analitico** — Ingrese las especificas de gasto.
6. Pulse **+ Nueva val.** en la barra superior para crear la primera valorizacion mensual.
7. **Valorizacion** — Ingrese el metrado ejecutado para cada partida. Los importes se calculan automaticamente.
8. **Resumen** — Revise los indicadores y la Curva S generada.
9. Pulse **Exportar Excel** para descargar el libro con todas las hojas.

### Formatos generados en el Excel

El archivo `.xls` exportado incluye:

- **Portada** — Ficha tecnica completa del proyecto
- **Val N°X** — Una hoja por cada valorizacion mensual con detalle de partidas y resumen
- **Cronograma-CurvaS** — Tabla de avance programado vs ejecutado fisico y financiero
- **Personal** — Cuadro de personal propuesto y presente
- **Pres.Analitico** — Presupuesto analitico con ejecucion acumulada
- **Control 017** — Lista de verificacion normativa Directiva 017-2023-CG

---

## Sin internet, sin instalacion

Ambas herramientas funcionan completamente offline. No usan CDN ni dependencias externas.

---

## Verificacion

```bash
npm test
```
