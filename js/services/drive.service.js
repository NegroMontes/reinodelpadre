// Subida de archivos al Drive del propio usuario logueado — ver
// "Subida de archivos..." en CLAUDE.md (22/09/2026) para el porqué
// (evita depender de Firebase Storage / plan Blaze).

import { AppState } from '../app-state.js';
import { UPLOAD_MAX_BYTES } from '../config/constants.js';

  // Subida de archivos AL DRIVE DEL USUARIO (pedido del usuario, 22/09/2026,
  // reemplaza el intento anterior con Firebase Storage — descartado porque
  // exigía activar el plan de pago Blaze en Firebase). Usa el access token de
  // Google que devuelve el login (`driveAccessToken`, solo existe si entró
  // por el camino "comando" — ver signIn()) para llamar directo a la API de
  // Drive con `fetch`, sin SDK adicional. El resultado es un link normal de
  // "compartir" de Drive (`drive.google.com/file/d/<id>/view`) — se reusa
  // tal cual toda la lógica de embeds de Drive que ya existía (driveFileId /
  // embeddableImageSrc / embedBlockHtml), no hizo falta escribir nada nuevo
  // para mostrar lo subido.
  export async function uploadEntryFile(file){
    if(!AppState.driveAccessToken){
      throw new Error('No hay permiso de Drive activo — cerrá sesión y volvé a entrar por "Soy del comando" para poder subir archivos.');
    }
    if(file.size > UPLOAD_MAX_BYTES){
      throw new Error('El archivo pesa más de 25MB — subilo a Drive a mano y pegá el link en su lugar.');
    }
    var metadata = { name: file.name };
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    var uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AppState.driveAccessToken },
      body: form
    });
    if(!uploadRes.ok){
      if(uploadRes.status === 401) throw new Error('Tu permiso de Drive venció — cerrá sesión y volvé a entrar para renovarlo.');
      throw new Error('Drive rechazó la subida (código ' + uploadRes.status + ').');
    }
    var uploaded = await uploadRes.json();
    var fileId = uploaded.id;
    // Sin este paso el archivo queda privado — solo quien lo subió podría
    // verlo, y el resto del comando se toparía con la misma pantalla de
    // "solicitar acceso" ya documentada para links de Drive pegados a mano.
    await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AppState.driveAccessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
    return 'https://drive.google.com/file/d/' + fileId + '/view';
  }
