// Pantalla de login: landing ("Soy miliciano"/"Soy del comando"),
// login con Google, el formulario de onboarding ("Contanos quién sos"),
// el minijuego de "Pendiente de aprobación", y renderGate() — el
// dispatcher que decide cuál de esas pantallas mostrar (o ninguna, si ya
// se pasó el gate) cada vez que la app se redibuja.

import { AppState } from '../app-state.js';
import { SECCIONES, DEPARTAMENTOS } from '../config/constants.js';
import { escapeHtml } from '../utils/helpers.js';
import { effectiveRole } from '../services/permissions.js';
import { signIn, signOutUser, submitOnboarding } from '../services/auth.service.js';
import { render } from '../main.js';

  export function renderLandingHtml(){
    var html = '<div class="gate-box landing-box">';
    html += '  <p class="landing-tag">El campamento, en un solo lugar.</p>';
    html += '  <div class="landing-cards">';
    // "Soy miliciano" se puede ocultar desde Usuarios → Milicianos (pedido
    // del usuario, 26/09/2026) — mientras el campamento arma su propia
    // página para milicianos, esta queda exclusiva del comando.
    if(AppState.publicConfig.milicianosLoginEnabled !== false){
      html += '    <button type="button" class="landing-card" id="pathAcampanteBtn"><span class="landing-card-icon">⛺</span><span class="landing-card-text"><span class="landing-card-title">Soy miliciano</span><span class="landing-card-sub">Entrá a tu campamento</span></span></button>';
    }
    html += '    <button type="button" class="landing-card" id="pathComandoBtn"><span class="landing-card-icon">🧭</span><span class="landing-card-text"><span class="landing-card-title">Soy del comando</span><span class="landing-card-sub">Conducí la marcha</span></span></button>';
    html += '  </div>';
    html += '</div>';
    return html;
  }


  export function renderPathSigninHtml(path){
    var isComando = path === 'comando';
    var html = '<div class="gate-box">';
    html += '  <div class="eje-badge">' + (isComando ? 'COMANDO' : 'MILICIANO') + '</div>';
    // Textos del camino "comando" (pedido del usuario, 22/09/2026): el aviso
    // puntual sobre el permiso de Drive quedó absorbido en esta frase más
    // genérica ("otorgá los permisos necesarios"), en vez de un párrafo aparte.
    html += '  <h2>' + (isComando ? 'Gracias por tu a tus órdenes' : 'Bienvenido, miliciano') + '</h2>';
    html += '  <p>' + (isComando ? 'Entrá con tu cuenta de Google y otorgá los permisos necesarios.' : 'Entrá con tu cuenta de Google para ver el contenido de tu sección.') + '</p>';
    html += '  <button class="btn" id="gateSignInBtn" type="button">Entrar con Google</button>';
    html += '  <p style="margin-top:14px"><a href="#" id="gateBackBtn">Volver</a></p>';
    html += '</div>';
    return html;
  }


  export function renderOnboardFormHtml(fbUser, path){
    var isComando = path === 'comando';
    var html = '<div class="gate-box onboard-box">';
    html += '  <div class="eje-badge">' + (isComando ? 'COMANDO' : 'MILICIANO') + '</div>';
    html += '  <h2>Contanos quién sos</h2>';
    if(isComando){ html += '  <p class="mandos-sub">La comparamos con el cuadro de mandos para darte acceso automático.</p>'; }
    html += '  <div class="form-row"><label>Nombre completo</label><input type="text" id="obNombre" value="' + escapeHtml(AppState.obNombreDraft !== null ? AppState.obNombreDraft : (fbUser.displayName || '')) + '"></div>';
    html += '  <div class="form-row"><label>Ruca / Fundación de origen</label><input type="text" id="obRuca" placeholder="Ej: Ruca Chapelco" value="' + escapeHtml(AppState.obRucaDraft !== null ? AppState.obRucaDraft : '') + '"></div>';

    if(!isComando){
      html += '  <div class="form-row"><label>Sección</label><select id="obSeccion">';
      SECCIONES.forEach(function(s){ html += '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'; });
      html += '  </select></div>';
    } else {
      html += '  <div class="form-row"><label>Tu mando</label><select id="obPosGrupo">';
      html += '    <option value="cupula"' + (AppState.obPosGrupo==='cupula'?' selected':'') + '>Comando central</option>';
      html += '    <option value="jefe_seccion"' + (AppState.obPosGrupo==='jefe_seccion'?' selected':'') + '>Jefe de sección</option>';
      html += '    <option value="staff_seccion"' + (AppState.obPosGrupo==='staff_seccion'?' selected':'') + '>Secretario o subjefe de sección</option>';
      html += '    <option value="jefe_depto"' + (AppState.obPosGrupo==='jefe_depto'?' selected':'') + '>Jefe de departamento</option>';
      html += '    <option value="staff_depto"' + (AppState.obPosGrupo==='staff_depto'?' selected':'') + '>Subjefe de departamento</option>';
      html += '    <option value="cocina"' + (AppState.obPosGrupo==='cocina'?' selected':'') + '>Comando de cocina</option>';
      html += '    <option value="capellan"' + (AppState.obPosGrupo==='capellan'?' selected':'') + '>Consagrado</option>';
      html += '  </select></div>';

      if(AppState.obPosGrupo === 'jefe_seccion' || AppState.obPosGrupo === 'staff_seccion'){
        html += '  <div class="form-row"><label>Sección</label><select id="obSeccionOrDepto">';
        SECCIONES.forEach(function(s){ html += '<option value="' + escapeHtml(s) + '"' + (AppState.obSeccionOrDepto===s?' selected':'') + '>' + escapeHtml(s) + '</option>'; });
        html += '  </select></div>';
      } else if(AppState.obPosGrupo === 'jefe_depto' || AppState.obPosGrupo === 'staff_depto'){
        html += '  <div class="form-row"><label>Departamento</label><select id="obSeccionOrDepto">';
        DEPARTAMENTOS.forEach(function(d){ html += '<option value="' + escapeHtml(d) + '"' + (AppState.obSeccionOrDepto===d?' selected':'') + '>' + escapeHtml(d) + '</option>'; });
        html += '  </select></div>';
        if(AppState.obPosGrupo === 'staff_depto' && AppState.obSeccionOrDepto === 'Formación'){
          html += '  <div class="form-row"><label>Sección que acompañás</label><select id="obSeccionFormacion">';
          SECCIONES.forEach(function(s){ html += '<option value="' + escapeHtml(s) + '"' + (AppState.obSeccionFormacion===s?' selected':'') + '>' + escapeHtml(s) + '</option>'; });
          html += '  </select></div>';
        }
      } else if(AppState.obPosGrupo === 'capellan'){
        html += '  <div class="form-row"><label>¿Qué sección acompañás?</label><select id="obSeccionOrDepto">';
        SECCIONES.forEach(function(s){ html += '<option value="' + escapeHtml(s) + '"' + (AppState.obSeccionOrDepto===s?' selected':'') + '>' + escapeHtml(s) + '</option>'; });
        html += '<option value="general"' + (AppState.obSeccionOrDepto==='general'?' selected':'') + '>Acompaño en general (no una sección puntual)</option>';
        html += '  </select></div>';
      }
      // "Comando de cocina" no muestra ningún cartel aparte (pedido del
      // usuario, 23/09/2026, sacó el aviso que había acá antes) — entra
      // directo con el resto del formulario, sin ningún sub-campo adicional.
    }

    html += '  <div class="form-row"><label>Actividad favorita (opcional)</label><input type="text" id="obActividad" placeholder="Ej: marcha, campamento, fogón..." value="' + escapeHtml(AppState.obActividadDraft !== null ? AppState.obActividadDraft : '') + '"></div>';

    html += '  <button class="btn" id="obSubmitBtn" type="button">Entrar</button>';
    html += '  <p style="margin-top:14px;text-align:center"><a href="#" id="obCancelBtn">Cancelar</a></p>';
    html += '  <div class="status-msg" id="obStatusMsg" style="text-align:center"></div>';
    html += '</div>';
    return html;
  }


  export function attachOnboardEvents(fbUser, path){
    var isComando = path === 'comando';

    document.getElementById('obNombre').oninput = function(e){ AppState.obNombreDraft = e.target.value; };
    document.getElementById('obRuca').oninput = function(e){ AppState.obRucaDraft = e.target.value; };
    document.getElementById('obActividad').oninput = function(e){ AppState.obActividadDraft = e.target.value; };

    if(isComando){
      var posGrupoSel = document.getElementById('obPosGrupo');
      posGrupoSel.onchange = function(){
        AppState.obPosGrupo = posGrupoSel.value;
        if(AppState.obPosGrupo === 'jefe_seccion' || AppState.obPosGrupo === 'staff_seccion' || AppState.obPosGrupo === 'capellan'){ AppState.obSeccionOrDepto = SECCIONES[0]; }
        else if(AppState.obPosGrupo === 'jefe_depto' || AppState.obPosGrupo === 'staff_depto'){ AppState.obSeccionOrDepto = DEPARTAMENTOS[0]; }
        else { AppState.obSeccionOrDepto = ''; }
        AppState.obSeccionFormacion = (AppState.obPosGrupo === 'staff_depto' && AppState.obSeccionOrDepto === 'Formación') ? SECCIONES[0] : '';
        renderGate();
      };
      var subSel = document.getElementById('obSeccionOrDepto');
      if(subSel){
        subSel.onchange = function(){
          AppState.obSeccionOrDepto = subSel.value;
          AppState.obSeccionFormacion = (AppState.obPosGrupo === 'staff_depto' && AppState.obSeccionOrDepto === 'Formación') ? SECCIONES[0] : '';
          renderGate();
        };
      }
      var formSel = document.getElementById('obSeccionFormacion');
      if(formSel){ formSel.onchange = function(){ AppState.obSeccionFormacion = formSel.value; }; }
    }

    document.getElementById('obCancelBtn').onclick = function(e){
      e.preventDefault();
      AppState.authPath = null; AppState.obPosGrupo = 'cupula'; AppState.obSeccionOrDepto = ''; AppState.obSeccionFormacion = '';
      AppState.obNombreDraft = null; AppState.obRucaDraft = null; AppState.obActividadDraft = null;
      signOutUser();
    };

    document.getElementById('obSubmitBtn').onclick = function(){
      var nombreCompleto = document.getElementById('obNombre').value.trim();
      var rucaFundacion = document.getElementById('obRuca').value.trim();
      var actividadFavorita = document.getElementById('obActividad').value.trim();
      if(!nombreCompleto){ document.getElementById('obStatusMsg').textContent = 'Poné tu nombre completo.'; return; }

      var formValues = { nombreCompleto: nombreCompleto, rucaFundacion: rucaFundacion, actividadFavorita: actividadFavorita };
      if(!isComando){
        formValues.seccion = document.getElementById('obSeccion').value;
      } else {
        formValues.posGrupo = AppState.obPosGrupo;
        formValues.seccionOrDepto = AppState.obSeccionOrDepto;
        formValues.seccionFormacion = AppState.obSeccionFormacion;
        if(AppState.obPosGrupo === 'staff_depto' && AppState.obSeccionOrDepto === 'Formación' && !AppState.obSeccionFormacion){
          document.getElementById('obStatusMsg').textContent = 'Elegí qué sección acompañás.';
          return;
        }
      }

      submitOnboarding(fbUser, path, formValues);
      AppState.obPosGrupo = 'cupula'; AppState.obSeccionOrDepto = ''; AppState.obSeccionFormacion = '';
      AppState.obNombreDraft = null; AppState.obRucaDraft = null; AppState.obActividadDraft = null;
    };
  }


  export function renderPendienteGameHtml(){
    return '' +
      '<div class="pendiente-game">' +
      '  <p class="pendiente-game-intro">Mientras esperás, ¿un jueguito? Atrapá el escudo las veces que puedas en 20 segundos.</p>' +
      '  <div class="pendiente-game-stage" id="pendienteGameStage">' +
      '    <div class="pendiente-game-hud">' +
      '      <span id="pendienteGameScore">Puntos: 0</span>' +
      '      <span id="pendienteGameTime">20s</span>' +
      '    </div>' +
      '    <button class="btn primary" id="pendienteGamePlayBtn" type="button">Jugar</button>' +
      '  </div>' +
      '</div>';
  }


  export function attachPendienteGameEvents(){
    var playBtn = document.getElementById('pendienteGamePlayBtn');
    var stage = document.getElementById('pendienteGameStage');
    if(!playBtn || !stage) return;
    playBtn.onclick = function(){ startPendienteGame(stage); };
  }


  export function startPendienteGame(stage){
    if(AppState.pendienteGameTimer){ clearInterval(AppState.pendienteGameTimer); AppState.pendienteGameTimer = null; }
    AppState.pendienteGameScore = 0;
    var timeLeft = 20;
    var scoreEl = document.getElementById('pendienteGameScore');
    var timeEl = document.getElementById('pendienteGameTime');
    var playBtn = document.getElementById('pendienteGamePlayBtn');
    var oldResult = stage.querySelector('.pendiente-game-result');
    if(oldResult) oldResult.remove();
    if(playBtn) playBtn.style.display = 'none';
    if(scoreEl) scoreEl.textContent = 'Puntos: 0';
    if(timeEl) timeEl.textContent = timeLeft + 's';

    var target = document.createElement('img');
    target.src = 'assets/logo-icon.png';
    target.alt = '';
    target.className = 'pendiente-game-target';
    // Sin esto, mantener apretado el click sobre la imagen dispara el
    // "levantarla" nativo del navegador (drag de imagen) — pedido del
    // usuario (23/09/2026): interrumpe la experiencia de juego.
    target.draggable = false;
    target.ondragstart = function(){ return false; };
    stage.appendChild(target);

    function moveTarget(){
      var w = Math.max(0, stage.clientWidth - target.offsetWidth - 8);
      var h = Math.max(0, stage.clientHeight - target.offsetHeight - 34);
      target.style.left = (8 + Math.random() * w) + 'px';
      target.style.top = (30 + Math.random() * h) + 'px';
    }
    moveTarget();

    target.onclick = function(e){
      e.stopPropagation();
      AppState.pendienteGameScore++;
      if(scoreEl) scoreEl.textContent = 'Puntos: ' + AppState.pendienteGameScore;
      moveTarget();
    };

    AppState.pendienteGameTimer = setInterval(function(){
      // Si el gate ya se redibujó por otro motivo (ej. dejó de estar
      // "pendiente"), este cuadro ya no está en el documento — cortar el
      // intervalo en vez de seguir tickeando sobre un DOM fantasma.
      if(!document.body.contains(stage)){
        clearInterval(AppState.pendienteGameTimer);
        AppState.pendienteGameTimer = null;
        return;
      }
      timeLeft--;
      if(timeEl) timeEl.textContent = timeLeft + 's';
      if(timeLeft <= 0){
        clearInterval(AppState.pendienteGameTimer);
        AppState.pendienteGameTimer = null;
        if(target.parentNode) target.parentNode.removeChild(target);
        var result = document.createElement('div');
        result.className = 'pendiente-game-result';
        var resultTitle = document.createElement('p');
        resultTitle.className = 'secuencial-closing-title';
        resultTitle.textContent = '¡Se acabó el tiempo!';
        var resultSub = document.createElement('p');
        resultSub.className = 'secuencial-closing-sub';
        resultSub.textContent = 'Puntos: ' + AppState.pendienteGameScore;
        result.appendChild(resultTitle);
        result.appendChild(resultSub);
        stage.appendChild(result);
        if(playBtn){
          playBtn.textContent = 'Jugar de nuevo';
          playBtn.style.display = '';
          // El "Jugar" inicial queda centrado (CSS por default); una vez
          // que se juega al menos una partida, "Jugar de nuevo" pasa a
          // vivir en la esquina inferior derecha, pedido explícito del
          // usuario — y se queda ahí en las repeticiones siguientes.
          playBtn.classList.add('pendiente-game-playbtn-corner');
        }
      }
    }, 1000);
  }


  export function renderGate(){
    var gate = document.getElementById('gate');
    var layout = document.querySelector('.layout');
    function hideApp(){ layout.style.display = 'none'; }

    if(!AppState.authResolved){
      gate.innerHTML = '<div class="gate-box"><p class="loading-inline"><span class="loading-spinner"></span>Cargando…</p></div>';
      hideApp();
      return true;
    }

    // Logueado con Google pero todavía sin perfil en Firestore.
    if(AppState.pendingFbUser){
      if(!AppState.authPath){
        gate.innerHTML = renderLandingHtml();
        var pathAcampanteBtnEl = document.getElementById('pathAcampanteBtn');
        if(pathAcampanteBtnEl){ pathAcampanteBtnEl.onclick = function(){ AppState.authPath = 'acampante'; render(); }; }
        document.getElementById('pathComandoBtn').onclick = function(){ AppState.authPath = 'comando'; render(); };
        hideApp();
        return true;
      }
      gate.innerHTML = renderOnboardFormHtml(AppState.pendingFbUser, AppState.authPath);
      attachOnboardEvents(AppState.pendingFbUser, AppState.authPath);
      hideApp();
      return true;
    }

    if(!AppState.currentUser){
      if(!AppState.authPath){
        gate.innerHTML = renderLandingHtml();
        var pathAcampanteBtnEl = document.getElementById('pathAcampanteBtn');
        if(pathAcampanteBtnEl){ pathAcampanteBtnEl.onclick = function(){ AppState.authPath = 'acampante'; render(); }; }
        document.getElementById('pathComandoBtn').onclick = function(){ AppState.authPath = 'comando'; render(); };
        hideApp();
        return true;
      }
      gate.innerHTML = renderPathSigninHtml(AppState.authPath);
      document.getElementById('gateSignInBtn').onclick = signIn;
      document.getElementById('gateBackBtn').onclick = function(e){ e.preventDefault(); AppState.authPath = null; render(); };
      hideApp();
      return true;
    }

    if(effectiveRole() === 'pendiente'){
      hideApp();
      // No reescribir el gate si ya está mostrando esta misma pantalla —
      // un render() de paso (ej. un onSnapshot que no cambió nada real)
      // no debe pisar la partida del minijuego que la persona ya empezó.
      if(!gate.querySelector('.gate-pendiente')){
        gate.innerHTML = '<div class="gate-box gate-pendiente"><h2>Cuenta registrada</h2><p>Hola ' + escapeHtml(AppState.currentUser.displayName) + ', tu cuenta ya quedó guardada. Pedile a alguien de For.Doc. que te habilite el ingreso.</p>' + renderPendienteGameHtml() + '</div>';
        attachPendienteGameEvents();
      }
      return true;
    }

    gate.innerHTML = '';
    layout.style.display = '';
    return false;
  }
