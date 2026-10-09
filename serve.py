#!/usr/bin/env python3
"""Servidor local para FORDOC. Es igual a `python -m http.server 8000`, pero
le agrega a cada respuesta encabezados que le dicen al navegador que nunca
guarde nada en cache. Sin esto, a veces el navegador seguia mostrando una
version vieja de la pagina aunque el archivo en disco ya estuviera actualizado
por el `git pull` del acceso directo, y habia que forzar un refresco a mano
(Ctrl+Shift+R) para verlo.

Escucha en todas las interfaces de red (no solo localhost), asi que tambien
se puede abrir desde el celular -- por Tailscale, o por la misma red Wi-Fi --
usando alguna de las direcciones que este script imprime al arrancar.

Ademas, mientras esta corriendo, hace un `git pull` solo cada un rato en
segundo plano (ver `auto_pull_loop`) -- asi, con esta ventana ya abierta,
alcanza con recargar la pagina (F5) para ver cambios nuevos, sin tener que
volver a correr `abrir-fordoc.bat` entero cada vez."""
import http.server
import os
import socket
import subprocess
import threading
import time

PORT = 8000
AUTO_PULL_INTERVAL_SEG = 60
REPO_DIR = os.path.dirname(os.path.abspath(__file__))


def direcciones_red():
    """Direcciones IP de esta computadora en la red local (Wi-Fi/LAN)."""
    ips = []
    try:  # la direccion que se usa para salir a la red (no envia nada)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    privadas = [ip for ip in ips if ip.startswith(("192.168.", "10.")) or
                (ip.startswith("172.") and 16 <= int(ip.split(".")[1]) <= 31)]
    return ["http://%s:%d" % (ip, PORT) for ip in privadas]


def direcciones_tailscale():
    """Direcciones de Tailscale (100.64.0.0 - 100.127.255.255)."""
    ips = []
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            partes = ip.split(".")
            if partes[0] == "100" and 64 <= int(partes[1]) <= 127 and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ["http://%s:%d" % (ip, PORT) for ip in ips]


# Tipos de contenido fijos para las extensiones que usa este sitio, en vez de
# dejar que SimpleHTTPRequestHandler los adivine con el modulo `mimetypes`
# (que en Windows lee el registro -- `HKEY_CLASSES_ROOT\.css`/`.js` -- y en
# algunas instalaciones esa asociacion falta o quedo mal, asi que el archivo
# se sirve igual pero con un Content-Type incorrecto). Los navegadores son
# estrictos con el MIME type de un <link rel="stylesheet">: si no llega como
# "text/css", lo descartan en silencio -- el HTML/JS cargan bien (por eso la
# pagina funciona y tiene datos reales) pero queda sin ningun estilo.
TIPOS_FIJOS = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
}


def auto_pull_loop():
    """Corre `git pull` cada AUTO_PULL_INTERVAL_SEG segundos mientras el
    servidor esta vivo. Pensado para no tener que volver a correr
    `abrir-fordoc.bat` (que arranca este mismo script) cada vez que hay
    cambios nuevos -- con la ventana del servidor ya abierta, alcanza con
    esperar un toque y apretar F5 en el navegador. Si `git pull` falla (sin
    internet, conflicto, carpeta sin `.git`, etc.) lo imprime y sigue
    reintentando en el proximo ciclo -- un fallo puntual no tiene que tirar
    abajo el servidor."""
    while True:
        time.sleep(AUTO_PULL_INTERVAL_SEG)
        try:
            resultado = subprocess.run(
                ['git', 'pull'], cwd=REPO_DIR, capture_output=True, text=True, timeout=30
            )
            salida = (resultado.stdout or '').strip()
            if resultado.returncode != 0:
                print('[auto-pull] git pull fallo: ' + (resultado.stderr or '').strip())
            elif salida and 'Already up to date' not in salida and 'Ya está actualizado' not in salida:
                print('[auto-pull] Hay cambios nuevos -- recarga la pagina (F5) para verlos.')
        except Exception as e:
            print('[auto-pull] No se pudo actualizar: ' + str(e))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        for ext, tipo in TIPOS_FIJOS.items():
            if path.lower().endswith(ext):
                return tipo
        return super().guess_type(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    # ThreadingHTTPServer (no HTTPServer a secas) -- el sitio ahora carga
    # ~30 archivos por pagina (CSS + cada modulo JS + assets); HTTPServer
    # atiende un pedido a la vez, asi que el navegador termina encolando
    # todo eso en fila en vez de pedirlo en paralelo como haria normalmente
    # -- la causa mas probable de que "tarda mucho en cargar" (reportado
    # 09/10/2026) y de los ConnectionAbortedError en la consola (pedidos
    # que seguian en cola y el navegador cancelaba al recargar de nuevo).
    server = http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler)
    print('Sirviendo FORDOC (sin cache):')
    print('  En esta compu:  http://localhost:%d' % PORT)
    tailscale = direcciones_tailscale()
    if tailscale:
        print('  Desde el celu (Tailscale):  ' + '  o  '.join(tailscale))
    red = direcciones_red()
    if red:
        print('  Desde el celu (misma Wi-Fi):  ' + '  o  '.join(red))
    if not tailscale and not red:
        print('  (no se detecto ninguna IP de red -- revisa que Tailscale/Wi-Fi esten conectados)')
    print('  Buscando cambios nuevos solo cada %d segundos -- con esta ventana abierta, '
          'alcanza con recargar la pagina (F5) para verlos, sin tener que volver a abrir el acceso directo.' % AUTO_PULL_INTERVAL_SEG)
    threading.Thread(target=auto_pull_loop, daemon=True).start()
    server.serve_forever()
