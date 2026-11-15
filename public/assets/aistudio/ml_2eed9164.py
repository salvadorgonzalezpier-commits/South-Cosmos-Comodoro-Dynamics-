"""Dos modelos INDEPENDIENTES (ensambles de redes en numpy): 'clima' y 'similitud'."""
import numpy as np, pickle, os, json
from analogo import SITIOS
import db
NOMBRES = list(SITIOS)
CLIMA_Y = ["temperatura", "presion", "viento", "luz"]
SIM_Y = CLIMA_Y + ["total"]
TOPE_AUTONOMO = 0.4            # lo autónomo no pasa de ~40 % del peso total
CARPETA = os.environ.get("MODELOS", "modelos")

def _vec(v):  # [T, P, viento, luz] -> escala comparable
    return np.array([v[0] / 100, np.log10(max(v[1], 1e-12)) / 5, v[2] / 10, v[3] / 1000])

def feats_clima(x):
    f = 2 * np.pi * x["hora"] / SITIOS[x["sitio"]]["periodo"]
    return np.array([float(n == x["sitio"]) for n in NOMBRES] + [np.sin(f), np.cos(f)])

def feats_sim(x):
    a, b = _vec(x["a"]), _vec(x["b"]); return np.concatenate([a, b, np.abs(a - b)])

class MLP:
    def __init__(s, n_in, n_out, h=24, seed=0):
        r = np.random.default_rng(seed)
        s.P = [r.normal(0, .5, (n_in, h)), np.zeros(h), r.normal(0, .5, (h, n_out)), np.zeros(n_out)]
    def __call__(s, X): return np.tanh(X @ s.P[0] + s.P[1]) @ s.P[2] + s.P[3]
    def fit(s, X, Y, w, ep=1500, lr=0.02):          # Adam, pérdida MSE ponderada
        m = [np.zeros_like(p) for p in s.P]; v = [np.zeros_like(p) for p in s.P]
        w = (w / w.sum())[:, None]
        for t in range(1, ep + 1):
            H = np.tanh(X @ s.P[0] + s.P[1]); o = H @ s.P[2] + s.P[3]
            d = 2 * w * (o - Y); dH = (d @ s.P[2].T) * (1 - H ** 2)
            for i, g in enumerate([X.T @ dH, dH.sum(0), H.T @ d, d.sum(0)]):
                m[i] = .9 * m[i] + .1 * g; v[i] = .999 * v[i] + .001 * g * g
                s.P[i] -= lr * (m[i] / (1 - .9 ** t)) / (np.sqrt(v[i] / (1 - .999 ** t)) + 1e-8)
        return float((w * (o - Y) ** 2).sum())

class Ensamble:
    def __init__(s, tipo): s.tipo, s.ms = tipo, []
    def _y(s, y):
        if s.tipo == "clima":
            return [y["temperatura"], np.log10(max(y["presion"], 1e-12)), y["viento"], y["luz"]]
        return [y[k] for k in SIM_Y]
    def _inv(s, r):
        r = np.array(r, float)
        if s.tipo == "clima": r[..., 1] = 10 ** r[..., 1]
        return r
    def entrenar(s, filas, n_miembros=3):
        F = feats_clima if s.tipo == "clima" else feats_sim
        X = np.array([F(json.loads(r["x"])) for r in filas])
        Y = np.array([s._y(json.loads(r["y"])) for r in filas], float)
        ed = np.array([r["origen"] == "editor" for r in filas])
        w = np.where(ed, 1.0, 0.5 * np.array([r["confianza"] for r in filas]))
        if ed.any() and (~ed).any():                 # tope a lo autónomo
            w[~ed] *= min(1.0, TOPE_AUTONOMO / (1 - TOPE_AUTONOMO) * w[ed].sum() / w[~ed].sum())
        s.mu, s.sd = Y.mean(0), Y.std(0) + 1e-6
        s.ms = [MLP(X.shape[1], Y.shape[1], seed=k) for k in range(n_miembros)]
        perdidas = [m.fit(X, (Y - s.mu) / s.sd, w) for m in s.ms]
        return float(np.mean(perdidas)), int(ed.sum()), int((~ed).sum())
    def predecir(s, x):
        """Devuelve {variable: (valor, incertidumbre)}; incertidumbre = desacuerdo entre miembros."""
        f = (feats_clima if s.tipo == "clima" else feats_sim)(x)[None]
        P = np.array([s._inv(m(f)[0] * s.sd + s.mu) for m in s.ms])
        keys = CLIMA_Y if s.tipo == "clima" else SIM_Y
        if s.tipo != "clima": P = np.clip(P, 0, 100)      # similitud siempre en 0-100 %
        return {k: (float(P[:, i].mean()), float(P[:, i].std())) for i, k in enumerate(keys)}

def guardar_modelo(e):
    os.makedirs(CARPETA, exist_ok=True)
    pickle.dump(e, open(f"{CARPETA}/{e.tipo}.pkl", "wb"))

def cargar(tipo):
    p = f"{CARPETA}/{tipo}.pkl"
    return pickle.load(open(p, "rb")) if os.path.exists(p) else None

def entrenar_todo():
    out = {}
    for tipo in ("clima", "similitud"):
        fs = db.filas(tipo, "aprobado")
        if len(fs) < 10: out[tipo] = "pocos datos"; continue
        e = Ensamble(tipo); perd, ne, na = e.entrenar(fs)
        guardar_modelo(e); db.log_entrenamiento(tipo, ne, na, perd); out[tipo] = round(perd, 4)
    return out
