import React from 'react';
import { ResultadoComparacion, SitioAmbiental } from '../lib/analogo';

interface CompositionPanelProps {
  sitioA: SitioAmbiental;
  sitioB: SitioAmbiental;
  resultado: ResultadoComparacion;
}

const CompBlock: React.FC<{
  titulo: string;
  subtitulo: string;
  compA: Record<string, number>;
  compB: Record<string, number>;
  similitud: number;
  tv: number;
  nombreA: string;
  nombreB: string;
}> = ({ titulo, subtitulo, compA, compB, similitud, tv, nombreA, nombreB }) => {
  const claves = Array.from(new Set([...Object.keys(compA), ...Object.keys(compB)]));
  const sumA = Object.values(compA).reduce((a, b) => a + b, 0) || 1;
  const sumB = Object.values(compB).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <div className="text-xl font-semibold text-slate-900">
            {similitud.toFixed(1)}
            <span className="text-xs text-slate-500 ml-1">%</span>
          </div>
          <div className="text-[11px] text-slate-500">
            TV = {tv.toFixed(3)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {claves.map((k) => {
          const pctA = ((compA[k] ?? 0) / sumA) * 100;
          const pctB = ((compB[k] ?? 0) / sumB) * 100;
          const diff = Math.abs(pctA - pctB);

          return (
            <div key={k} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-medium text-slate-800">{k}</span>
                <div className="font-mono tabular-nums text-slate-600 flex items-center gap-3">
                  <span className="text-blue-700">{pctA.toFixed(2)}%</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-amber-700">{pctB.toFixed(2)}%</span>
                  <span className="text-slate-400 w-16 text-right">
                    Δ {diff.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="h-2 w-full bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${Math.min(100, pctA)}%` }}
                    title={`${nombreA}: ${pctA.toFixed(2)}%`}
                  />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-amber-600"
                    style={{ width: `${Math.min(100, pctB)}%` }}
                    title={`${nombreB}: ${pctB.toFixed(2)}%`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CompositionPanel: React.FC<CompositionPanelProps> = ({
  sitioA,
  sitioB,
  resultado,
}) => {
  return (
    <section id="composicion" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CompBlock
        titulo="Composición atmosférica / exosfera"
        subtitulo="Distancia de variación total sobre fracciones molares normalizadas"
        compA={sitioA.aire}
        compB={sitioB.aire}
        similitud={resultado.porVariable.aire}
        tv={resultado.tvAire}
        nombreA={sitioA.nombre}
        nombreB={sitioB.nombre}
      />
      <CompBlock
        titulo="Composición de suelo / regolito"
        subtitulo="Óxidos mayoritarios (% en peso normalizado)"
        compA={sitioA.suelo}
        compB={sitioB.suelo}
        similitud={resultado.porVariable.suelo}
        tv={resultado.tvSuelo}
        nombreA={sitioA.nombre}
        nombreB={sitioB.nombre}
      />
    </section>
  );
};
