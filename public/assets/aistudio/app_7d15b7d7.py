"""Panel web del editor. Ejecutar: EDITOR_CLAVE=xxx python app.py  (producción: gunicorn app:app)"""
import os, json, hmac, numpy as np
from flask import Flask, request, redirect, Response, render_template_string
import db, ml, ciclo
from analogo import SITIOS
app = Flask(__name__); db.iniciar()
CLAVE = os.environ.get("EDITOR_CLAVE", "")

@app.before_request
def auth():
    a = request.authorization
    if not CLAVE or not a or not hmac.compare_digest(a.password or "", CLAVE):
        return Response("Define EDITOR_CLAVE y entra con ella.", 401, {"WWW-Authenticate": 'Basic realm="Editor"'})

BASE = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Panel</title><style>body{font:15px system-ui;max-width:980px;margin:1.5rem auto;padding:0 1rem}
nav a{margin-right:1rem}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left;font-size:13px}
.s{overflow-x:auto}textarea,input,select{font:inherit;width:100%;box-sizing:border-box}button{font:inherit;margin:2px}
.warn{color:#a50}</style>
<nav><a href=/>Revisión</a><a href=/cargar>Cargar datos</a><a href=/predecir>Predicciones</a><a href=/historial>Historial</a></nav><hr>%%"""
def pagina(t, **k): return render_template_string(BASE.replace("%%", t), **k)

@app.route("/")
def revision():
    pend = db.filas(estado="pendiente")
    return pagina("""<h2>Pendientes de revisión ({{p|length}})</h2><div class=s><table>
    <tr><th>id<th>tipo<th>fuente<th>conf.<th>x<th>y<th></tr>{% for r in p %}<tr><td>{{r.id}}<td>{{r.tipo}}
    <td>{% if r.url %}<a href="{{r.url}}">{{r.fuente}}</a>{% else %}{{r.fuente}}{% endif %}<td>{{r.confianza}}
    <td>{{r.x}}<td>{{r.y}}<td><form method=post action=/estado/{{r.id}}>
    <button name=e value=aprobado>Aprobar</button><button name=e value=rechazado>Rechazar</button></form></tr>
    {% else %}<tr><td colspan=7>Nada pendiente.{% endfor %}</table></div>""", p=pend)

@app.post("/estado/<int:i>")
def estado(i):
    if request.form["e"] in ("aprobado", "rechazado"): db.cambiar_estado(i, request.form["e"])
    return redirect("/")

@app.route("/cargar", methods=["GET", "POST"])
def cargar():
    msg = ""
    if request.method == "POST":
        try:
            f = request.form
            msg = db.guardar(f["tipo"], json.loads(f["x"]), json.loads(f["y"]), "editor", f["fuente"] or "editor", "", 1.0)
        except (ValueError, KeyError) as e: msg = f"Error: {e}"
    return pagina("""<h2>Cargar dato (editor)</h2>{% if m %}<p class=warn>{{m}}</p>{% endif %}
    <form method=post><select name=tipo><option>clima<option>similitud</select>
    x (JSON) <textarea name=x rows=2 placeholder='clima: {"sitio":"Marte (Cráter Gale)","hora":12}  |  similitud: {"a":[T,P,viento,luz],"b":[...]}'></textarea>
    y (JSON) <textarea name=y rows=2 placeholder='clima: {"temperatura":250,"presion":740,"viento":4,"luz":300}  |  similitud: añade "total"'></textarea>
    fuente <input name=fuente><button>Guardar</button></form>""", m=msg)

@app.route("/predecir", methods=["GET", "POST"])
def predecir():
    res = None; f = request.form
    C, S = ml.cargar("clima"), ml.cargar("similitud")
    if request.method == "POST" and C and S:
        a, b, t0, t1 = f["a"], f["b"], float(f["t0"]), float(f["t1"])
        def clima(s):
            hs = np.linspace(t0, t1, 24); P = [C.predecir({"sitio": s, "hora": h}) for h in hs]
            return {k: (float(np.mean([p[k][0] for p in P])), float(np.mean([p[k][1] for p in P]))) for k in ml.CLIMA_Y}
        ca, cb = clima(a), clima(b)
        sim = S.predecir({"a": [ca[k][0] for k in ml.CLIMA_Y], "b": [cb[k][0] for k in ml.CLIMA_Y]})
        res = dict(a=a, b=b, ca=ca, cb=cb, sim=sim)
    return pagina("""<h2>Predicción</h2>{% if not ok %}<p class=warn>Aún no hay modelos entrenados (ejecuta ciclo.py).</p>{% endif %}
    <form method=post>Sitio A <select name=a>{% for s in S %}<option>{{s}}{% endfor %}</select>
    Sitio B <select name=b>{% for s in S %}<option>{{s}}{% endfor %}</select>
    Desde hora <input name=t0 value=0 type=number step=any> hasta <input name=t1 value=48 type=number step=any><button>Predecir</button></form>
    {% if r %}<h3>Clima medio en la ventana (valor ± incertidumbre)</h3><div class=s><table><tr><th><th>{{r.a}}<th>{{r.b}}</tr>
    {% for k in r.ca %}<tr><td>{{k}}<td>{{'%.4g'%r.ca[k][0]}} ± {{'%.2g'%r.ca[k][1]}}<td>{{'%.4g'%r.cb[k][0]}} ± {{'%.2g'%r.cb[k][1]}}</tr>{% endfor %}</table></div>
    <h3>Similitud climática A–B (%)</h3><table>{% for k,v in r.sim.items() %}<tr><td>{{k}}<td>{{'%.1f'%v[0]}} ± {{'%.1f'%v[1]}}</tr>{% endfor %}</table>{% endif %}""",
        r=res, S=list(SITIOS), ok=bool(C and S))

@app.route("/historial")
def historial():
    return pagina("""<h2>Entrenamientos</h2><table><tr><th>fecha<th>modelo<th>editor<th>autónomo<th>% autónomo<th>pérdida</tr>
    {% for h in H %}<tr><td>{{h.fecha|int}}<td>{{h.tipo}}<td>{{h.n_editor}}<td>{{h.n_autonomo}}
    <td>{{'%.0f'%(100*h.n_autonomo/((h.n_editor+h.n_autonomo) or 1))}}<td>{{'%.4f'%h.perdida}}</tr>{% endfor %}</table>""", H=db.historial())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
