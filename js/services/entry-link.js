// Link directo a una entrada (07/11/2026, pedido del usuario): `#entrada/<id>`
// lleva a la carpeta donde está la entrada (día de Mensaje, categoría/grupo de
// Recursos, Departamentos) y la abre en la Fordoquera. Si no existe o la
// persona no puede verla (sin permiso, borrada, todavía no publicada), avisa y
// queda en Inicio.

import { AppState } from '../app-state.js';
import { canSeeEntry } from './permissions.js';
import { recursoCategoriaDe, recursoGrupoDe } from '../utils/helpers.js';
import { render } from '../main.js';
import { openFordoqueraViewer } from '../components/fordoquera-embed.js';
import { showAlert } from '../components/dialog.js';
import { showToast } from '../components/toast.js';

export function linkDeEntrada(id){
  return window.location.origin + window.location.pathname + '#entrada/' + encodeURIComponent(id);
}

export function irAEntrada(id){
  var entry = (AppState.state.entries || []).find(function(e){ return e.id === id; });
  AppState.formOpen = false;
  if(!entry || entry.deletedAt || !canSeeEntry(entry)){
    AppState.activeDayId = 'HOME';
    render();
    showAlert(!entry || entry.deletedAt
      ? 'Esa entrada no existe o fue borrada.'
      : 'No tenés acceso a esa entrada, o todavía no se publicó.');
    return;
  }
  if(entry.dayId === 'RESOURCES'){
    AppState.activeDayId = 'RECURSOS';
    AppState.recursosCategoria = recursoCategoriaDe(entry);
    AppState.recursosGrupo = recursoGrupoDe(AppState.state, entry) || '';
  } else if(entry.dayId === 'INFO_GENERAL'){
    AppState.activeDayId = 'HOME';
  } else if(!entry.dayId){
    AppState.activeDayId = 'DEPARTAMENTOS';
    AppState.activeDeptoFiltro = '';
  } else {
    AppState.activeDayId = 'MENSAJE';
    AppState.activeMensajeDayId = entry.dayId;
  }
  render();
  openFordoqueraViewer(id);
}

export async function copiarLinkDeEntrada(id){
  var link = linkDeEntrada(id);
  try{
    await navigator.clipboard.writeText(link);
    var t = showToast({ message: 'Link de la entrada copiado.' });
    setTimeout(function(){ t.remove(); }, 2500);
  }catch(e){
    showAlert('Copiá este link:\n\n' + link);
  }
}
