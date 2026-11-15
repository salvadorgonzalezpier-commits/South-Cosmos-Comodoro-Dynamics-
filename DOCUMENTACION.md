# Documentación Técnica Integral — Análogo Planetario

> **Proyecto:** Análogo Planetario (`react-example` / Full-Stack TypeScript + Express + SQLite + Firebase + Gemini Grounding)  
> **Fecha de análisis y respaldo:** 15 de noviembre de 2026  
> **Puerto de ejecución:** `3000` (`tsx server.ts` en desarrollo / `node server.ts` en producción)

---

## 1. Visión general de la arquitectura

**Análogo Planetario** es una aplicación full-stack orientada a la planetología comparada. Permite cuantificar la similitud ambiental entre sitios calibrados de la **Tierra** (15 ubicaciones NASA Earthdata), **Marte** (13 ubicaciones NASA PDS) y la **Luna** (13 ubicaciones LRO/PDS), entrenar redes neuronales locales en CPU sin dependencias externas obligatorias, ingestar y verificar nuevas observaciones científicas mediante una lista blanca oficial o **Google Search / Google Maps Grounding**, y explorar los 41 entornos en un simulador 2D interactivo (**Misión Rover**).

```
┌──────────────────────────────────────────────────────────────────────┐
│ CLIENTE (React 19 + Vite + Tailwind CSS v4)                          │
│                                                                      │
│  App.tsx ──► Consola científica (Radar, Series, Composición,         │
│          │   Earthdata + Maps, PDS, Proyección Latitud, ML, Search)  │
│          └──► AnalogoGame.tsx (Canvas 2D + Web Audio gameAudio.ts)   │
│                                                                      │
│  src/lib/analogo.ts (Motor matemático + 41 catálogos calibrados)     │
│  src/lib/firebase.ts (Google Auth + Firestore en tiempo real)        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTP /api/* + Vite middlewares
┌───────────────────────────────▼──────────────────────────────────────┐
│ SERVIDOR (Express en server.ts · Puerto 3000)                        │
│                                                                      │
│  ├── Fuentes NASA / WUSTL: POWER, CMR, GIBS Worldview, ODE, PDS4,    │
│  │                         NASA Moon/Mars Trek WMTS                  │
│  ├── Grounding Gemini (gemini-4-hydrogen):                           │
│  │     ├── server/verifier.ts (Google Search Grounding)              │
│  │     └── server/maps.ts     (Google Maps Grounding + latLng)       │
│  └── Sistema Neuronal Local & Gobernanza:                            │
│        ├── server/db.ts        (SQLite conocimiento.db)              │
│        ├── server/whitelist.ts (Dominios oficiales auto-aprobados)   │
│        ├── server/ml.ts        (Ensambles MLP 2×3 con Adam + JSON)   │
│        └── server/ciclo.ts     (Semilla, conector NASA, ciclo)       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Copia de seguridad realizada

Se generó un respaldo completo del proyecto (excluyendo `node_modules/`, `dist/` y la propia carpeta `backups/` para evitar recursión) en `/backups/`:

- **Archivo comprimido portable:** `backups/analogo_planetario_backup_2026-11-15.tar.gz`
- **Instantánea extraída:** `backups/snapshot_2026-11-15/` (contiene código fuente, `conocimiento.db`, `modelos/clima.json`, `modelos/similitud.json`, `firestore.rules`, `firebase-blueprint.json`, recursos en `src/assets/` y `public/`)
- **Manifiesto de integridad:** `backups/SHA256SUMS.txt` con el hash SHA-256 de cada archivo respaldado.
- **Aislamiento de compilación:** Se excluyó `backups` en `tsconfig.json`, `eslint.config.mjs` y `.gitignore` para no duplicar símbolos durante la verificación de tipos ni contaminar el repositorio.

---

## 3. Mapa completo de archivos y responsabilidades

| Archivo / Carpeta | Rol en el sistema |
| :--- | :--- |
| `server.ts` | Punto de entrada Express (puerto `3000`). Expone los 15 endpoints `/api/*`, monta `vite.middlewares` en desarrollo o sirve `dist/` en producción, inicializa SQLite (`db.iniciar()`) y dispara el entrenamiento inicial si faltan `modelos/*.json`. |
| `server/db.ts` | Capa de persistencia sobre `node:sqlite` (`conocimiento.db`). Define esquemas `registros`, `entrenamientos` y `lista_blanca`, valida rangos físicos (`LIMITES`), aplica deduplicación SHA-1 determinística (`sortKeys`) y auto-aprueba fuentes oficiales (`OFICIALES`) o forzadas por lista blanca. |
| `server/ml.ts` | Implementación pura en TypeScript (sin librerías externas de tensor) de perceptrones multicapa (`MLP` con capa oculta `tanh` y optimizador Adam), agrupados en `Ensamble` de 3 miembros. Gestiona normalización z-score, tope autónomo del 40 %, cálculo de incertidumbre ($\sigma$ entre miembros) y serialización en `modelos/clima.json` y `modelos/similitud.json`. |
| `server/ciclo.ts` | Orquestador de ciclo de vida ML (`ejecutarCiclo`): siembra el dataset desde `analogo.ts` (`sembrar`), opcionalmente descarga observaciones horarias reales de NASA POWER (`conectorNasaPower`), detecta si se añadieron sitios nuevos (`faltanSitiosEnDb`) y entrena ambos ensambles. |
| `server/train-local.ts` | Script CLI (`npm run train:local`) para entrenar 100 % en CPU local sin llamadas externas y validar inferencia de pares representativos. |
| `server/whitelist.ts` | Gestión de dominios oficiales (`SEMILLA_OFICIAL`: `nasa.gov`, `pds.nasa.gov`, `pds-geosciences.wustl.edu`, `rsl.wustl.edu`, `jpl.nasa.gov`, `usgs.gov`, `esa.int`, `noaa.gov`) con coincidencia exacta y de subdominio para auto-aprobación y auto-entrenamiento. |
| `server/verifier.ts` | Auditoría científica con `@google/genai` (`gemini-4-hydrogen` + herramienta `googleSearch`). Extrae valores SI en JSON, clasifica fuentes citadas frente a la lista blanca y devuelve nivel de confianza. |
| `server/maps.ts` | Servicio de **Google Maps Grounding** usando `gemini-4-hydrogen` + `{ googleMaps: {} }` y `toolConfig.retrievalConfig.latLng`. Extrae texto Markdown, enlaces directos de `groundingChunks[].maps.uri` y reseñas (`reviewSnippets`). |
| `src/lib/analogo.ts` | Núcleo científico del frontend y catálogos compartidos: 15 análogos terrestres (`ANALOGOS_TERRESTRES_NASA`), 26 sitios de Luna/Marte (`ANALOGOS_LUNA_MARTE_PDS`), 3 sitios base (`SITIOS_INICIALES`), interpolación de series medidas NASA POWER, Wasserstein-1D, correlación de forma, variación total y penalización crítica. |
| `src/lib/firebase.ts` | Inicialización de Firebase Auth (Google Sign-In con popup) y Firestore (`db` con `firestoreDatabaseId`), wrapper `handleFirestoreError`, sanitización de IDs y suscripción en tiempo real (`onSnapshot`) por `ownerUid`. |
| `src/lib/gameAudio.ts` | Sintetizador procedural Web Audio (`GameAudioEngine`) sin archivos MP3/WAV externos: pulsos de escáner, recolección de muestras, baliza, impactos, advertencias, victoria y derrota, con control de silencio. |
| `src/App.tsx` | Estado maestro de la consola científica (sitios A/B, modos `reloj`/`ciclo`, ventana temporal, pesos, variables críticas, escalas, proyecciones latitudinales, datos NASA en vivo) y selector de vista `laboratorio` / `juego`. |
| `src/components/RadarChart.tsx` | Gráfico radial SVG interactivo de 9 ejes con escala 20–100 %, resaltado de variables críticas y lectura de precisión al pasar el cursor. |
| `src/components/TimeSeriesPanel.tsx` | Comparador SVG de series temporales (Temperatura, Presión con conmutador lineal/`log₁₀`, Viento, Irradiancia) con sonda interactiva `(t, y)` y correlación de forma `r`. |
| `src/components/CompositionPanel.tsx` | Comparación visual barra a barra de fracciones molares atmosféricas/exosféricas y óxidos del suelo/regolito con distancia de Variación Total (`TV`). |
| `src/components/EarthdataPanel.tsx` | Integración terrestre completa: selector de los 15 sitios + coordenadas manuales, series NASA POWER, mosaicos satelitales GIBS/Worldview, búsqueda CMR de Earthdata Search y subpanel de **Google Maps Grounding** con geolocalización del navegador. |
| `src/components/PdsPanel.tsx` | Integración lunar y marciana: conmutador Luna/Marte (26 sitios), teselas orbitales de NASA Moon/Mars Trek WMTS, consultas espaciales a WUSTL Geosciences ODE y búsqueda de bundles PDS4 (`pds.nasa.gov`). |
| `src/components/LatitudeProjectionPanel.tsx` | Simulador interactivo de traslado latitudinal (`-90°` a `+90°`) con modelos lineal y sinusoidal ($\cos\phi$), escalado de amplitud diaria y gráfica SVG clicable que actualiza el comparador en tiempo real. |
| `src/components/MlPanel.tsx` | Interfaz del sistema neuronal: botones de entrenamiento local offline o sincronizado con NASA POWER, selección de épocas (`800`/`1200`/`2000`), predicciones con incertidumbre `± σ`, cola de revisión manual, carga manual JSON e historial de entrenamientos. |
| `src/components/WhitelistVerifyPanel.tsx` | Ingesta guiada de observaciones, verificación con Google Search Grounding, administración CRUD de la lista blanca oficial y sincronización opcional con Google/Firestore. |
| `src/components/ConsoleOutput.tsx` | Salida textual equivalente al `__main__` original de `analogo.py`, con copiado al portapapeles y exportación a `informe_analogo.json`. |
| `src/components/AnalogoGame.tsx` | Juego 2D **Misión Rover** en `<canvas>` a pantalla completa: pantalla de título con portada ilustrada (`src/assets/images/rover_mission_backdrop_1794737830833.jpg`), física acoplada a los 41 análogos reales, amenazas telegrafiadas, escáner radial, 3 sectores y briefing Maps al terminar sectores terrestres. |
| `firestore.rules` / `firebase-blueprint.json` | Contrato de esquema y reglas de seguridad estrictas en Firestore (deny por defecto, verificación de email, validación de campos permitidos y aislamiento por usuario). |

---

## 4. Motor matemático de analogía (`src/lib/analogo.ts`)

1. **Generación de series temporales (`generarSerie`)**:
   - En modo sintético:
     - $T(t) = T_{\text{media}} - A_T \cos(\text{fase})$, donde $\text{fase} = \frac{2\pi t}{\text{periodo}}$.
     - $P(t) = P_{\text{media}} \cdot (1 - \alpha_P \cos(\text{fase}))$.
     - $v(t) = \max\big(0, v_{\text{media}} \cdot (1 + \alpha_v \sin(\text{fase}))\big)$.
     - $L(t) = L_{\text{pico}} \cdot \max(0, -\cos(\text{fase}))$.
   - Cuando `usarSerieMedida` está activo en Tierra, interpola linealmente la serie horaria real de NASA POWER (`interpolarSerieHoraria`) y aplica, si corresponde, el desplazamiento térmico latitudinal (`desplazamientoTemp`).
2. **Similitud cuantílica / Wasserstein-1D (`simSerie`)**:
   - Aplica transformación logarítmica a variables de amplio rango dinámico (`presion`: $\log_{10}(\max(P, 10^{-12}))$; `radiacion`: $\log_{10}(\max(R, 10^{-4}))$).
   - Ordena ambos vectores de muestras $q_A, q_B$ y calcula la distancia media entre cuantiles $d = \frac{1}{n}\sum_i |q_{A,i} - q_{B,i}|$.
   - Convierte a porcentaje acotado: $S = 100 \cdot \max(0, 1 - d / \text{escala})$.
3. **Correlación de forma temporal (`simForma`)**:
   - Calcula el coeficiente de correlación de Pearson $r \in [-1, 1]$ entre series temporales (o `null` si alguna serie es constante).
4. **Composición química (`distanciaTV` / `simComp`)**:
   - Normaliza cada diccionario de fracciones y obtiene $TV = \frac{1}{2}\sum_k |p_k - q_k|$, devolviendo $S_{\text{comp}} = 100(1 - TV)$.
5. **Terreno (`simTerreno`)**:
   - Promedia las diferencias normalizadas de pendiente ($/30^\circ$) y rugosidad ($/0.2\text{ m}$).
6. **Índice global y penalización crítica (`compararSitios`)**:
   - Calcula la media ponderada directa $\bar{S}_w = \frac{\sum w_k S_k}{\sum w_k}$.
   - Identifica la peor variable entre las marcadas como críticas (`criticas`, por defecto `presion`, `gravedad`, `aire`): $S_{\min} = \min_{k \in C} S_k$.
   - Aplica penalización no lineal:
     $$S_{\text{total}} = \min\Big(\bar{S}_w,\; 0.5\,\bar{S}_w + 0.5\,S_{\min}\Big)$$
7. **Proyección latitudinal de temperatura (`LatitudeProjectionPanel.tsx`)**:
   - **Lineal:** $T'(\phi_1) = \max\big(20,\; T_0 - \gamma \cdot (|\phi_1| - |\phi_0|)\big)$.
   - **Sinusoidal:** $T'(\phi_1) = \max\big(20,\; T_0 + \Delta_{\text{ep}} \cdot (\cos\phi_1 - \cos\phi_0)\big)$.
   - Opcionalmente escala la amplitud diaria $A_T$ de forma proporcional al coseno de la latitud o al desplazamiento polar.

---

## 5. Sistema neuronal local y gobernanza de conocimiento (`server/ml.ts`, `db.ts`, `ciclo.ts`)

### Arquitectura de los modelos
- **Ensamble Clima (`modelos/clima.json`)**:
  - **Entradas (`nIn = 46`)**: codificación *one-hot* de los 44 sitios registrados en `SITIOS_ML` (3 base + 15 terrestres + 26 Luna/Marte) más fase armónica cíclica $\big(\sin\frac{2\pi h}{\text{periodo}}, \cos\frac{2\pi h}{\text{periodo}}\big)$.
  - **Salidas (`nOut = 4`)**: `temperatura (K)`, $\log_{10}(\text{presion})$, `viento (m/s)`, `luz (W/m²)`.
- **Ensamble Similitud (`modelos/similitud.json`)**:
  - **Entradas (`nIn = 12`)**: vectores escalados `vec(a)` (4), `vec(b)` (4) y diferencia absoluta `|vec(a) - vec(b)|` (4).
  - **Salidas (`nOut = 5`)**: similitud en `temperatura`, `presion`, `viento`, `luz` y `total` (acotadas en `[0, 100]` durante inferencia).
- **Topología y entrenamiento**:
  - Cada ensamble entrena **3 redes MLP independientes** (semillas `0, 1, 2` con inicialización normal determinística Mulberry32 + Box-Muller).
  - Cada MLP tiene **1 capa oculta de 24 neuronas `tanh`** y capa de salida lineal, optimizada con **Adam** ($\beta_1=0.9$, $\beta_2=0.999$, `lr=0.02`) sobre salidas estandarizadas (`z-score`).
  - La predicción devuelve la media de los 3 miembros y su desviación estándar como **incertidumbre ($\pm \sigma$)**.

### Reglas de calidad y seguridad en SQLite (`conocimiento.db`)
- **Validación física (`LIMITES`)**: rechaza temperaturas fuera de `[0, 1000] K`, presiones fuera de `[0, 10⁷] Pa`, vientos fuera de `[0, 150] m/s` o irradiancias fuera de `[0, 1500] W/m²`.
- **Deduplicación**: calcula un hash `SHA-1` sobre `[tipo, sortKeys(x), sortKeys(y), fuente]` para ignorar duplicados (`duplicado`).
- **Tope autónomo (`TOPE_AUTONOMO = 0.4`)**: reescala los pesos de registros autónomos para que nunca superen el **40 %** del peso total respecto a los registros curados por `editor`.
- **Lista blanca oficial (`lista_blanca`)**: si la URL de entrada coincide con un dominio activo de la lista blanca (o subdominio, ej. `power.larc.nasa.gov` → `nasa.gov`), la observación entra directamente como `aprobado` y puede disparar reentrenamiento automático.

---

## 6. Referencia de endpoints API (`server.ts`)

| Método y Ruta | Función | Fuente / Motor |
| :--- | :--- | :--- |
| `GET /api/earthdata/power` | Descarga series horarias reales (`T2M`, `PS`, `WS10M`, `ALLSKY_SFC_SW_DWN`) | `power.larc.nasa.gov` |
| `GET /api/earthdata/cmr` | Busca colecciones y enlaces a gránulos por palabra clave y coordenada | `cmr.earthdata.nasa.gov` |
| `GET /api/earthdata/worldview` | Proxy WMS `EPSG:4326` de imágenes satelitales MODIS / VIIRS | `gibs.earthdata.nasa.gov` |
| `POST /api/earthdata/maps-grounding` | Contexto territorial y enlaces/reseñas de Google Maps anclados a `(lat, lon)` | `@google/genai` (`googleMaps`) |
| `GET /api/ml/status` | Estado de ensambles, conteos de `conocimiento.db`, pendientes e historial | SQLite + `modelos/*.json` |
| `POST /api/ml/train` | Ejecuta `ejecutarCiclo` (local offline o sincronizado con NASA POWER) | `server/ciclo.ts` |
| `POST /api/ml/predict` | Predice clima medio e índice de similitud con incertidumbre `± σ` | `server/ml.ts` |
| `POST /api/ml/records` | Valida e inserta un registro manual/autónomo en SQLite | `server/db.ts` |
| `POST /api/ml/records/:id/estado` | Aprueba o rechaza manualmente un registro `pendiente` | `server/db.ts` |
| `GET / POST / PATCH / DELETE /api/ml/whitelist` | CRUD completo de dominios oficiales en la lista blanca | `server/whitelist.ts` |
| `POST /api/ml/whitelist-ingest` | Ingiere observación verificando dominio; auto-aprueba y reentrena si está en lista blanca | `server/whitelist.ts` + `ml.ts` |
| `POST /api/ml/verify-search` | Verifica observación usando Google Search Grounding y opcionalmente guarda/entrena | `server/verifier.ts` |
| `GET /api/pds/ode` | Consulta productos espaciales orbitales (LRO, MGS, MRO) | `oderest.rsl.wustl.edu` |
| `GET /api/pds/search` | Busca bundles PDS4 para Luna o Marte | `pds.nasa.gov` |
| `GET /api/pds/trek` | Proxy de teselas WMTS cartográficas de Luna y Marte | `trek.nasa.gov` |

---

## 7. Integración y seguridad en Firebase (`firestore.rules` y `firebase-blueprint.json`)

- **Autenticación**: Google Sign-In vía popup (`iniciarSesionGoogle` en `src/lib/firebase.ts`), sincronizando perfil en `/users/{uid}` cuando `emailVerified === true`.
- **Reglas de Firestore (`firestore.rules`)**:
  - Denegación por defecto (`match /{document=**} { allow read, write: if false; }`).
  - Aislamiento por dueño (`ownerUid == request.auth.uid`) en `whitelistDomains` y `knowledgeEntries`, con acceso administrativo limitado a cuentas en `/admins/{uid}` o al correo administrador verificado.
  - Validación estricta de esquema (`keys().hasOnly(...)`), longitudes de cadena, enumeraciones (`categoria`, `tipo`, `status`), rangos físicos numéricos y marcas de tiempo de servidor (`request.time`), impidiendo mutar `ownerUid`, `id` o `createdAt` en actualizaciones.

---

## 8. Juego interactivo 2D — Misión Rover (`src/components/AnalogoGame.tsx`)

- **Aislamiento de shell**: Cuando `vista === 'juego'` en `src/App.tsx`, se oculta completamente la barra de navegación y el flujo del laboratorio, renderizando el juego en un contenedor `fixed inset-0 z-50`.
- **Máquina de estados**: `TITLE_MENU` → `PLAYING` → (`PAUSED` | `ROUND_SUMMARY` | `VICTORY` | `GAME_OVER`).
- **Acoplamiento con datos científicos reales**:
  - Lee los 41 sitios de `ANALOGOS_TERRESTRES_NASA` y `ANALOGOS_LUNA_MARTE_PDS`.
  - La gravedad (`gravity`) modula la aceleración y el agarre/amortiguamiento del rover; el viento (`windMs`) aplica deriva lateral y partículas de polvo; `slopeDeg` y `roughness` determinan la densidad de cráteres; `radiation` ajusta la frecuencia de amenazas; y `soil` define el óxido dominante y porcentaje mostrado en cada muestra (`SiO2`, `Fe2O3`, `Al2O3`, etc.).
- **Bucle de juego y game feel**:
  - Bucle `requestAnimationFrame` desacoplado de React (`engineRef`) con paso `dt` acotado a `0.05 s`, piscina preasignada de 160 partículas, *hitstop* de `45 ms`, sacudida de cámara decreciente, *squash-and-stretch*, invulnerabilidad temporal tras impacto, advertencias visuales de `1.25 s` antes de activar vórtices/meteoritos y audio Web Audio sintetizado (`src/lib/gameAudio.ts`).
  - Récord persistido en `localStorage` (`analogo_rover_best_score_v1`).

---

## 9. Comandos operativos y observaciones de auditoría

### Comandos útiles
- `npm run dev` — Inicia Express + Vite en el puerto `3000`.
- `npm run lint` — Ejecuta `tsc --noEmit` para validar todo el tipado estricto.
- `npm run build` — Compila el bundle de producción en `dist/`.
- `npm run train:local` — Ejecuta el entrenamiento neuronal 100 % local desde consola (`server/train-local.ts`).

### Hallazgos relevantes tras analizar el código completo
1. **Resiliencia ante cuotas externas (`429`)**: Tanto `/api/ml/verify-search` como `/api/earthdata/maps-grounding` capturan errores `RESOURCE_EXHAUSTED` / `429` de Gemini y responden con JSON HTTP `429` legible en español sin derribar el servidor ni bloquear el uso local de la aplicación.
2. **Consistencia de nombres en `SITIOS_ML`**: `server/ml.ts` valida al cargar `modelos/*.json` que la dimensión de entrada `nIn` coincida con `NOMBRES.length + 2` (actualmente `44 + 2 = 46`). Si en el futuro se añaden más sitios a `analogo.ts`, el servidor detectará la diferencia y reentrenará automáticamente los ensambles al arrancar.
3. **Limpieza automática de listeners e inputs en juego**: `AnalogoGame.tsx` limpia `heldKeysRef` en el evento `window.blur` y al cambiar de sector/pausar, evitando teclas bloqueadas al cambiar de pestaña.
4. **Mantenimiento de respaldos**: La carpeta `backups/` queda excluida de TypeScript, ESLint y Git; si deseas descargar o mover el respaldo fuera del entorno, utiliza directamente `backups/analogo_planetario_backup_2026-11-15.tar.gz`.
