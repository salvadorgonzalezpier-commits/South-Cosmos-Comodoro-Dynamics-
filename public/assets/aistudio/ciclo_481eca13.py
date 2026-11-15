"""Tarea autónoma (cron: 0 */6 * * *  ->  python ciclo.py). Conectores se agregan luego a CONECTORES."""
import numpy as np, time
import db, ml
from analogo import SITIOS, serie, _sim_serie, PESOS

class Conector:
    nombre = "base"                      # debe coincidir con db.OFICIALES para auto-aprobarse
    def buscar(self):
        """Devuelve lista de {tipo, x, y, url, confianza}."""
        raise NotImplementedError
CONECTORES = []                          # <- aquí irán tus conectores

def sembrar(seed=0):
    """Datos iniciales (origen editor) generados con analogo.py, para poder arrancar."""
    r = np.random.default_rng(seed); nombres = list(SITIOS)
    for s in nombres:
        for h in r.uniform(0, 100, 60):
            ser = serie(s, (h, h), 1)
            y = {k: float(ser[k][0] * (1 + r.normal(0, .01))) for k in ml.CLIMA_Y}
            db.guardar("clima", {"sitio": s, "hora": float(h)}, y, "editor", "semilla analogo.py", "", 1.0)
    for a in nombres:
        for b in nombres:
            for _ in range(15):
                t0 = r.uniform(0, 200); ven = (t0, t0 + r.uniform(24, 72))
                A, B = serie(a, ven), serie(b, ven)
                y = {k: _sim_serie(A[k], B[k], k) for k in ml.CLIMA_Y}
                y["total"] = sum(y[k] * PESOS[k] for k in ml.CLIMA_Y) / sum(PESOS[k] for k in ml.CLIMA_Y)
                x = {"a": [float(A[k].mean()) for k in ml.CLIMA_Y], "b": [float(B[k].mean()) for k in ml.CLIMA_Y]}
                db.guardar("similitud", x, y, "editor", "semilla analogo.py", "", 1.0)

def ejecutar():
    db.iniciar(); nuevos = 0
    for c in CONECTORES:
        try:
            for d in c.buscar():
                est = db.guardar(d["tipo"], d["x"], d["y"], "autonomo", c.nombre, d.get("url", ""), d.get("confianza", .5))
                nuevos += est != "duplicado"
        except Exception as e:           # un conector que falla no detiene el ciclo
            print(f"[{time.ctime()}] {c.nombre} falló: {e}")
    print(f"[{time.ctime()}] nuevos={nuevos} entrenamiento={ml.entrenar_todo()}")

if __name__ == "__main__":
    ejecutar()
