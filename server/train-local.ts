import * as ciclo from './ciclo.ts';
import * as ml from './ml.ts';

async function main() {
  const epocasArg = Number(process.argv[2] ?? 1200);
  const epocas = Number.isFinite(epocasArg) && epocasArg >= 200 ? epocasArg : 1200;

  console.log('=== Entrenamiento Neuronal Local (Análogo Planetario) ===');
  console.log(`Modo: 100% local (CPU + SQLite conocimiento.db, sin llamadas externas)`);
  console.log(`Sitios registrados (${ml.NOMBRES.length}): ${ml.NOMBRES.join(', ')}`);
  console.log(`Épocas por MLP: ${epocas} | Ensambles: 2 × 3 MLP (24 tanh, Adam MSE)`);

  const res = await ciclo.ejecutarCiclo({
    sembrarSiVacio: true,
    incluirNasa: false,
    epocas,
    miembros: 3,
    ocultas: 24,
  });

  console.log('');
  console.log(`Registros sembrados nuevos: ${res.nuevosSemilla}`);
  console.log(
    `Base de conocimiento: ${res.conteos.aprobados} aprobados (${res.conteos.porTipo.clima.editor + res.conteos.porTipo.clima.autonomo} clima, ${res.conteos.porTipo.similitud.editor + res.conteos.porTipo.similitud.autonomo} similitud)`
  );
  console.log(`MSE final clima:     ${res.entrenamiento.clima}`);
  console.log(`MSE final similitud: ${res.entrenamiento.similitud}`);
  console.log(`Tiempo total CPU:    ${res.entrenamiento.duracionMs} ms`);

  const C = ml.cargarModelo('clima');
  const S = ml.cargarModelo('similitud');
  if (C && S) {
    const pares: Array<[string, string]> = [
      ['Tierra (Atacama, 2400 m)', 'Marte (Cráter Gale · PDS MSL/REMS)'],
      ['Tierra (Atacama, 2400 m)', 'Luna (Polo Sur Shackleton · LRO PDS)'],
      ['Marte (Cráter Jezero · PDS MEDA)', 'Luna (Mare Tranquillitatis · LRO PDS)'],
    ];
    console.log('');
    console.log('Validación de inferencia local (ventana 0–48 h):');
    for (const [a, b] of pares) {
      const vecA = C.predecir({ sitio: a, hora: 12 });
      const vecB = C.predecir({ sitio: b, hora: 12 });
      const sim = S.predecir({
        a: ml.CLIMA_Y.map((k) => vecA[k].valor),
        b: ml.CLIMA_Y.map((k) => vecB[k].valor),
      });
      console.log(
        `  - ${a} vs ${b} -> Similitud climática total = ${sim.total.valor.toFixed(1)}% ± ${sim.total.incertidumbre.toFixed(1)}%`
      );
    }
  }
}

main().catch((err) => {
  console.error('Error en entrenamiento local:', err);
  process.exit(1);
});
