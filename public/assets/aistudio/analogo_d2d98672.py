"""
analogo.py - Comparador de analogía ambiental entre terrenos (Tierra, Luna, Marte).

Entrega, en porcentaje (100 = idéntico):
  1. similitud por variable (viento, presión, temperatura, luz, gravedad, radiación)
  2. similitud de composición (aire y suelo)
  3. similitud total (media ponderada + penalización por variables críticas)
  4. todo lo anterior sobre una ventana de tiempo elegible (horas)

Los sitios incluidos usan valores APROXIMADOS de literatura (Curiosity/REMS, RAD,
Apollo/LRO, estaciones terrestres). Para precisión real, reemplaza `serie()` o
`composicion` por tus datos medidos (CSV de REMS, Diviner, NOAA, etc.).
Solo requiere numpy.
"""
import math
import numpy as np

# ------------------------------------------------------------------ sitios
# periodo = duración del día local (horas). Series: media + amplitud diaria.
SITIOS = {
    "Tierra (Atacama, 2400 m)": dict(
        periodo=24.0,
        T=(290, 12), P=(75000, 0.005), viento=(4, 0.5), luz=(1100, None),
        g=9.81, radiacion=0.05,   # µSv/h
        aire={"N2": .78, "O2": .21, "Ar": .0093, "CO2": .0004, "otros": .0003},
        suelo={"SiO2": .60, "Al2O3": .15, "Fe2O3": .06, "CaO": .05, "MgO": .03, "otros": .11},
        pendiente=5, rugosidad=0.03),
    "Marte (Cráter Gale)": dict(
        periodo=24.66,
        T=(218, 45), P=(750, 0.05), viento=(4, 0.6), luz=(500, None),
        g=3.71, radiacion=28,
        aire={"N2": .027, "O2": .0013, "Ar": .016, "CO2": .953, "otros": .0027},
        suelo={"SiO2": .43, "Al2O3": .09, "Fe2O3": .19, "CaO": .07, "MgO": .09, "otros": .13},
        pendiente=5, rugosidad=0.05),
    "Luna (ecuador, mare)": dict(
        periodo=708.7,
        T=(245, 145), P=(3e-10, 0.0), viento=(0, 0.0), luz=(1361, None),
        g=1.62, radiacion=60,
        aire={"N2": 0, "O2": 0, "Ar": .35, "CO2": 0, "otros": .65},  # exosfera (He, Ne, Ar)
        suelo={"SiO2": .45, "Al2O3": .14, "Fe2O3": .17, "CaO": .12, "MgO": .08, "otros": .04},
        pendiente=5, rugosidad=0.04),
}

# Variables continuas: (transformación, escala de tolerancia en esas unidades)
# Similitud = 1 - distancia/escala (mínimo 0). Ajusta a tu criterio.
VARIABLES = {
    "temperatura":  (lambda x: x,                       60.0),  # K
    "presion":      (lambda x: np.log10(np.maximum(x, 1e-12)), 3.0),  # décadas
    "viento":       (lambda x: x,                       15.0),  # m/s
    "luz":          (lambda x: x,                       700.0), # W/m²
    "gravedad":     (lambda x: x,                       9.81),  # m/s²
    "radiacion":    (lambda x: np.log10(np.maximum(x, 1e-4)), 2.0),
}
PESOS = {"temperatura": 2, "presion": 3, "viento": 1, "luz": 1.5, "gravedad": 2,
         "radiacion": 1.5, "aire": 3, "suelo": 2, "terreno": 1}
CRITICAS = ("presion", "gravedad", "aire")  # si una es muy baja, tira el total


def serie(sitio, horas, n=240):
    """Series sintéticas (n puntos) de cada variable sobre la ventana `horas`=(t0,t1)."""
    s = SITIOS[sitio]
    t = np.linspace(horas[0], horas[1], n)
    fase = 2 * math.pi * t / s["periodo"]
    c = -np.cos(fase)                      # -1 medianoche, +1 mediodía
    out = {
        "temperatura": s["T"][0] + s["T"][1] * c,
        "presion": s["P"][0] * (1 + s["P"][1] * c),
        "viento": np.maximum(0, s["viento"][0] * (1 + s["viento"][1] * np.sin(fase))),
        "luz": s["luz"][0] * np.maximum(0, c),
        "gravedad": np.full(n, s["g"]),
        "radiacion": np.full(n, s["radiacion"]),
    }
    return out


def _sim_serie(a, b, nombre):
    """Distancia de Wasserstein (cuantiles) en unidades transformadas -> %."""
    f, escala = VARIABLES[nombre]
    qa, qb = np.sort(f(a)), np.sort(f(b))
    d = np.mean(np.abs(qa - qb))
    return 100 * max(0.0, 1 - d / escala)


def _sim_forma(a, b):
    """Correlación temporal (¿suben y bajan a la vez?). None si alguna es constante."""
    if np.std(a) < 1e-12 or np.std(b) < 1e-12:
        return None
    return float(np.corrcoef(a, b)[0, 1])


def _sim_comp(p, q):
    """1 - distancia de variación total entre dos composiciones (fracciones)."""
    claves = set(p) | set(q)
    sp, sq = sum(p.values()) or 1, sum(q.values()) or 1
    tv = 0.5 * sum(abs(p.get(k, 0) / sp - q.get(k, 0) / sq) for k in claves)
    return 100 * (1 - tv)


def _sim_terreno(a, b):
    ds = abs(a["pendiente"] - b["pendiente"]) / 30
    dr = abs(a["rugosidad"] - b["rugosidad"]) / 0.2
    return 100 * max(0, 1 - 0.5 * (ds + dr))


def comparar(sitio_a, sitio_b, horas=(0, 48), modo="reloj", n=240):
    """
    horas: ventana de tiempo (t0, t1) en horas.
    modo : "reloj" -> ambas se miden durante las mismas horas absolutas.
           "ciclo" -> se compara cada cuerpo sobre su propio día local completo
                      (útil para Luna, cuyo día dura ~709 h).
    """
    if modo == "ciclo":
        A = serie(sitio_a, (0, SITIOS[sitio_a]["periodo"]), n)
        B = serie(sitio_b, (0, SITIOS[sitio_b]["periodo"]), n)
    else:
        A, B = serie(sitio_a, horas, n), serie(sitio_b, horas, n)

    a, b = SITIOS[sitio_a], SITIOS[sitio_b]
    res = {k: _sim_serie(A[k], B[k], k) for k in VARIABLES}
    forma = {k: _sim_forma(A[k], B[k]) for k in ("temperatura", "luz", "viento", "presion")}
    res["aire"] = _sim_comp(a["aire"], b["aire"])
    res["suelo"] = _sim_comp(a["suelo"], b["suelo"])
    res["terreno"] = _sim_terreno(a, b)

    media = sum(res[k] * PESOS[k] for k in res) / sum(PESOS.values())
    peor_critica = min(res[k] for k in CRITICAS)
    total = min(media, 0.5 * media + 0.5 * peor_critica)  # penaliza críticas bajas
    return dict(por_variable=res, correlacion_temporal=forma,
                total=total, media_simple=media, ventana=horas, modo=modo)


def informe(r, a, b):
    print(f"\n{a}  vs  {b}   | ventana {r['ventana']} h | modo {r['modo']}")
    print("-" * 62)
    for k, v in r["por_variable"].items():
        c = r["correlacion_temporal"].get(k)
        extra = f"  (forma temporal r={c:+.2f})" if c is not None else ""
        print(f"{k:<12}{v:6.1f} %{extra}")
    print("-" * 62)
    print(f"{'TOTAL':<12}{r['total']:6.1f} %   (media ponderada {r['media_simple']:.1f} %)")


if __name__ == "__main__":
    T, M, L = SITIOS.keys()
    informe(comparar(T, M, (0, 48)), T, M)
    informe(comparar(T, L, (0, 48)), T, L)
    informe(comparar(M, L, modo="ciclo"), M, L)
