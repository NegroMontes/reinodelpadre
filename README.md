# FORDOC — Reino del Padre MDZ 2027

Página web del Campamento Nacional "Reino del Padre" (AMJM, FASTA, Mendoza 2027) — la herramienta del comando de Formación Doctrinal (FORDOC) para cargar y compartir el plan formativo por día de campamento, y el link que usa el comando para entrar.

Sin datos sensibles en el código: el cuadro de mandos (nombres del comando) vive en Firestore, nunca acá — y el mail de admin bootstrap se sacó de este espejo a propósito (iniciar sesión acá no otorga ningún rol de admin de una, igual que en el sitio operativo).

## Stack

Vanilla JS (ES modules, sin build step) + Firebase (Auth + Firestore) para la persistencia y el login con Google. Estructura:

- `index.html` — shell de la página (carga los módulos de `css/`/`js/`).
- `css/` — estilos, separados por capa (`base`, `layout`, `components`) y por pantalla (`views/`).
- `js/config/` — configuración de Firebase y constantes del proyecto (secciones, departamentos, etc.).
- `js/services/` — acceso a Firestore/Auth (perfiles, entradas, comentarios, progreso).
- `js/components/` / `js/views/` — la interfaz: formulario de contenido, lector de entradas paso a paso, paneles de admin.
- `data/` — bibliotecas de citas precargadas (YouCat, DOCAT, Compendio de la DSI, etc.).

## Desarrollo local

```
python serve.py
```

Sirve el sitio en `http://localhost:8000` sin caché (útil mientras se edita).
