// Autenticación (Google Sign-In) y ciclo de vida de la sesión: login,
// logout, y el listener de perfil que resuelve el rol una vez logueado
// (incluye el onboarding — crear el perfil la primera vez).

import { GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { auth, db, DRIVE_UPLOAD_SCOPE } from '../config/firebase.js';
import { BOOTSTRAP_ADMIN_EMAIL } from '../config/constants.js';
import { AppState } from '../app-state.js';
import { posGrupoLabel } from '../utils/helpers.js';
import { declaredBucketFromForm, buildMandosIndex, findMandoByName, bucketsMatch } from '../utils/mandos-matcher.js';
import { loadNovedadesSeenAt, loadUsersSeenAt } from '../utils/storage.js';
import { watchUsers } from './users.service.js';
import { watchFeedback } from './feedback.service.js';
import { load } from './state.service.js';
import { render } from '../main.js';

  export function signIn(){
    // Proveedor nuevo en cada intento (en vez de uno compartido a nivel
    // módulo) — así el scope de Drive nunca se "pega" a una sesión que
    // eligió "Soy miliciano" ni se acumula entre reintentos.
    var provider = new GoogleAuthProvider();
    if(AppState.authPath === 'comando'){
      // Pedido del usuario (22/09/2026): el permiso de Drive se pide
      // únicamente a quien entra por el camino "comando" — un miliciano
      // nunca ve esta pantalla de consentimiento extra, porque nunca
      // necesita subir archivos.
      provider.addScope(DRIVE_UPLOAD_SCOPE);
    }
    signInWithPopup(auth, provider).then(function(result){
      var cred = GoogleAuthProvider.credentialFromResult(result);
      AppState.driveAccessToken = (cred && cred.accessToken) ? cred.accessToken : null;
      // Por si el listener de auth ya renderizó el formulario (u otra parte
      // de la UI que depende de `driveAccessToken`) antes de que este token
      // quedara disponible.
      if(AppState.authResolved){ render(); }
    }).catch(function(e){
      console.error('Error de login:', e);
      alert('No se pudo iniciar sesión: ' + e.message);
    });
  }


  export function signOutUser(){
    signOut(auth);
  }


  export function watchProfile(fbUser){
    if(AppState.unsubProfile){ AppState.unsubProfile(); AppState.unsubProfile = null; }
    var profileRef = doc(db, 'users', fbUser.uid);
    AppState.unsubProfile = onSnapshot(profileRef, async function(snap){
      if(snap.exists()){
        var data = snap.data();
        AppState.pendingFbUser = null;
        AppState.currentUser = { uid: fbUser.uid, email: fbUser.email, displayName: data.displayName || fbUser.displayName || fbUser.email, role: data.role, seccion: data.seccion || null, depto: data.depto || null, readDepartamentos: !!data.readDepartamentos, esFormacion: !!data.esFormacion, tipo: data.tipo || null, actividadFavorita: data.actividadFavorita || '' };
      } else if(fbUser.email === BOOTSTRAP_ADMIN_EMAIL){
        // El admin bootstrap no pasa por el formulario: se auto-crea directo.
        var bootstrapProfile = {
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email,
          role: 'admin',
          seccion: null,
          tipo: 'comando',
          verificado: true,
          createdAt: Date.now()
        };
        try{ await setDoc(profileRef, bootstrapProfile); }catch(e){ console.error('No se pudo crear el perfil admin:', e); }
        AppState.pendingFbUser = null;
        AppState.currentUser = { uid: fbUser.uid, email: fbUser.email, displayName: bootstrapProfile.displayName, role: bootstrapProfile.role, seccion: null };
      } else {
        // Primera vez que este usuario inicia sesión: todavía no tiene perfil.
        // Le mostramos el formulario de "¿quién sos?" en vez de crear un perfil pendiente ciego.
        AppState.currentUser = null;
        AppState.pendingFbUser = fbUser;
      }
      if(AppState.currentUser && AppState.novedadesSeenAtLoadedForUid !== AppState.currentUser.uid){
        AppState.novedadesSeenAt = loadNovedadesSeenAt(AppState.currentUser.uid);
        AppState.novedadesSeenAtLoadedForUid = AppState.currentUser.uid;
      }
      if(AppState.currentUser && AppState.usersSeenAtLoadedForUid !== AppState.currentUser.uid){
        AppState.usersSeenAt = loadUsersSeenAt(AppState.currentUser.uid);
        AppState.usersSeenAtLoadedForUid = AppState.currentUser.uid;
      }
      AppState.authResolved = true;
      if(AppState.currentUser && AppState.currentUser.role === 'admin'){ watchUsers(); watchFeedback(); }
      if(AppState.currentUser && AppState.currentUser.role !== 'pendiente' && !AppState.stateSubscribed){ AppState.stateSubscribed = true; load(); }
      render();
    }, function(e){
      console.error('Error leyendo perfil de usuario:', e);
      AppState.authResolved = true;
      render();
    });
  }


  // Se llama al enviar el formulario de onboarding (tanto comando como acampante).
  export async function submitOnboarding(fbUser, tipo, formValues){
    var profile = {
      email: fbUser.email,
      displayName: formValues.nombreCompleto || fbUser.displayName || fbUser.email,
      tipo: tipo,
      rucaFundacion: formValues.rucaFundacion || '',
      actividadFavorita: formValues.actividadFavorita || '',
      createdAt: Date.now()
    };

    if(tipo === 'acampante'){
      profile.role = 'lector';
      profile.seccion = formValues.seccion || null;
      profile.depto = null;
      profile.verificado = false; // no hay padrón de acampantes contra qué verificar
      profile.declaradoComo = 'Acampante — ' + (formValues.seccion || 'sin sección');
    } else if(formValues.posGrupo === 'cocina'){
      // Comando de cocina: no hay padrón de quiénes son (puede variar durante el
      // campamento), así que no lo comparamos contra la resolución — se aprueba
      // directo con acceso de lectura general, sin sección propia. Rol
      // 'subjefe' (mismos permisos que un subjefe de sección — pedido del
      // usuario, 23/09/2026: "a comando de cocina le corresponde subjefe de
      // sección/depto").
      profile.role = 'subjefe';
      profile.seccion = null;
      profile.depto = null;
      profile.verificado = false;
      profile.declaradoComo = 'Comando de cocina';
    } else {
      var declared = declaredBucketFromForm(formValues.posGrupo, formValues.seccionOrDepto);
      // El cuadro de mandos se lee de Firestore en vivo (AppState.mandosData,
      // ver services/mandos.service.js) — se reconstruye el índice de
      // matching en cada envío en vez de una vez al cargar el módulo, para
      // reflejar siempre el dato más reciente. Si todavía no cargó (o nadie
      // lo importó a Firestore todavía), `buildMandosIndex(null)` devuelve
      // un índice vacío y `found` queda `null` — la persona cae a
      // "pendiente", como cualquier nombre que no matchea.
      var found = findMandoByName(formValues.nombreCompleto, buildMandosIndex(AppState.mandosData));
      var matched = bucketsMatch(declared, found);
      var seccionOrDeptoLabel = (formValues.posGrupo === 'capellan' && formValues.seccionOrDepto === 'general')
        ? 'acompaña en general' : formValues.seccionOrDepto;
      profile.declaradoComo = posGrupoLabel(formValues.posGrupo) + (seccionOrDeptoLabel ? ' — ' + seccionOrDeptoLabel : '');

      // `found` (el match por NOMBRE contra la resolución) es la fuente de
      // verdad de qué posición tiene esta persona — ya no hace falta que el
      // "Tu mando" que declaró coincida exacto para auto-aprobar (pedido del
      // usuario, 23/09/2026: "a veces los jefes de sección se declaran como
      // comando central" — antes, ese desliz los dejaba atascados en
      // "pendiente" aunque su nombre matcheara perfecto como jefe de
      // sección). Única excepción: `formacion_member` necesita un dato que
      // NO sale de la resolución (qué sección acompaña ese subjefe de
      // Formación en particular) — ese dato solo se junta si el formulario
      // pasó por el camino correcto (Subjefe de depto → Formación), así que
      // ahí sí hace falta que lo declarado haya coincidido.
      var canAutoApprove = !!found && (found.bucket.type !== 'formacion_member' || matched);

      if(canAutoApprove){
        profile.verificado = true;
        if(found.bucket.type === 'admin'){
          // El rol admin es el de mayor riesgo: cualquiera podría escribir "Agustín Montes"
          // o el nombre del jefe de Formación y matchear. No lo auto-otorgamos: el nombre y
          // mando quedan verificados (✓) pero el rol real queda en manos de un admin humano,
          // que lo confirma con un clic desde la pestaña Usuarios.
          profile.role = 'pendiente';
          profile.seccion = null;
          profile.depto = null;
          profile.rolSugerido = 'admin';
        }
        else if(found.bucket.type === 'jefe_seccion'){ profile.role = 'jefe_seccion'; profile.seccion = found.bucket.seccion; profile.depto = null; }
        else if(found.bucket.type === 'formacion_member'){ profile.role = 'jefe_seccion'; profile.seccion = formValues.seccionFormacion || null; profile.depto = null; profile.esFormacion = true; }
        else if(found.bucket.type === 'jefe_depto'){ profile.role = 'jefe_seccion'; profile.depto = found.bucket.depto; profile.seccion = null; }
        // Rediseño de roles (23/09/2026): "secretario o subjefe de sección" y
        // "subjefe de departamento" pasan de `role:'lector'` a su propio rol
        // `subjefe` — mismos permisos de siempre (`isLectorLike`), pero ya no
        // comparten el valor de rol con un miliciano.
        else if(found.bucket.type === 'lector_depto'){ profile.role = 'subjefe'; profile.depto = found.bucket.depto; profile.seccion = null; }
        else if(found.bucket.type === 'capellan'){
          // "Consagrado" (antes "Capellán") — mismos permisos que un subjefe
          // de sección, con su propia etiqueta (pedido del usuario,
          // 23/09/2026), más la lectura de "Departamentos" que ya tenía.
          profile.role = 'consagrado'; profile.seccion = found.bucket.seccion; profile.depto = null;
          profile.readDepartamentos = true;
        }
        else { profile.role = 'subjefe'; profile.seccion = found.bucket.seccion || null; profile.depto = null; }
      } else {
        profile.verificado = false;
        profile.role = 'pendiente';
        profile.seccion = null;
        profile.depto = null;
      }
    }

    try{
      await setDoc(doc(db, 'users', fbUser.uid), profile);
    }catch(e){
      console.error('No se pudo guardar tu perfil:', e);
      alert('No se pudo guardar: ' + e.message);
    }
  }
