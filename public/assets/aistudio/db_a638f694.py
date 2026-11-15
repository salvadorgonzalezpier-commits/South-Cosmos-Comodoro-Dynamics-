"""Base de datos (SQLite). TODO el SQL vive aquí: migrar a PostgreSQL = tocar solo este archivo."""
import sqlite3, json, time, hashlib, os
RUTA = os.environ.get("DB_RUTA", "conocimiento.db")
OFICIALES = {"NASA", "NOAA", "USGS", "ESA"}          # fuentes que se aprueban solas
LIMITES = {"temperatura": (0, 1000), "presion": (0, 1e7), "viento": (0, 150), "luz": (0, 1500)}

def con():
    c = sqlite3.connect(RUTA); c.row_factory = sqlite3.Row; return c

def iniciar():
    with con() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS registros(id INTEGER PRIMARY KEY, tipo TEXT, x TEXT, y TEXT,
          origen TEXT CHECK(origen IN('editor','autonomo')), fuente TEXT, url TEXT, confianza REAL,
          estado TEXT DEFAULT 'pendiente' CHECK(estado IN('pendiente','aprobado','rechazado')),
          fecha REAL, hash TEXT UNIQUE);
        CREATE TABLE IF NOT EXISTS entrenamientos(id INTEGER PRIMARY KEY, fecha REAL, tipo TEXT,
          n_editor INT, n_autonomo INT, perdida REAL);""")

def validar(tipo, y):
    """Rechaza valores físicamente imposibles (evita contaminar el entrenamiento)."""
    for k, v in y.items():
        lo, hi = LIMITES.get(k, (0, 100))
        if not (isinstance(v, (int, float)) and lo <= v <= hi):
            raise ValueError(f"{k}={v} fuera de rango [{lo}, {hi}]")

def guardar(tipo, x, y, origen, fuente, url="", confianza=0.5):
    """Editor -> aprobado. Autónomo -> aprobado solo si la fuente es oficial; si no, pendiente."""
    validar(tipo, y)
    estado = "aprobado" if (origen == "editor" or fuente in OFICIALES) else "pendiente"
    h = hashlib.sha1(json.dumps([tipo, x, y, fuente], sort_keys=True).encode()).hexdigest()
    try:
        with con() as c:
            c.execute("INSERT INTO registros(tipo,x,y,origen,fuente,url,confianza,estado,fecha,hash)"
                      " VALUES(?,?,?,?,?,?,?,?,?,?)",
                      (tipo, json.dumps(x), json.dumps(y), origen, fuente, url, confianza, estado, time.time(), h))
        return estado
    except sqlite3.IntegrityError:
        return "duplicado"

def filas(tipo=None, estado=None):
    q, a = "SELECT * FROM registros WHERE 1=1", []
    if tipo: q += " AND tipo=?"; a.append(tipo)
    if estado: q += " AND estado=?"; a.append(estado)
    with con() as c: return c.execute(q + " ORDER BY id", a).fetchall()

def cambiar_estado(id_, estado):
    with con() as c: c.execute("UPDATE registros SET estado=? WHERE id=?", (estado, id_))

def log_entrenamiento(tipo, n_ed, n_au, perdida):
    with con() as c:
        c.execute("INSERT INTO entrenamientos(fecha,tipo,n_editor,n_autonomo,perdida) VALUES(?,?,?,?,?)",
                  (time.time(), tipo, n_ed, n_au, perdida))

def historial(n=15):
    with con() as c: return c.execute("SELECT * FROM entrenamientos ORDER BY id DESC LIMIT ?", (n,)).fetchall()
