// El documento único compartido /fordoc/shared (días + entradas): carga
// en vivo, guardado, y los datos default con los que arranca un
// documento vacío la primera vez.

import { onSnapshot, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { stateDocRef, db } from '../config/firebase.js';
import { AppState } from '../app-state.js';
import { uid } from '../utils/helpers.js';
import { decodeHash } from '../utils/hash-router.js';
import { canEditStructure, canEditConsigna } from './permissions.js';
import { ensureProgressSubs, ensureCompletionsSubs } from './progress.service.js';
import { render, renderPanel, showStatus } from '../main.js';

  // Flag pública (26/09/2026, pedido del usuario): permite a un admin ocultar
  // "Soy miliciano" del login y "Milicianos" de "Ver como" — ver comentario
  // de `AppState.publicConfig`. Vive en `config/public` (NO en
  // `fordoc/shared`, que exige estar logueado para leerlo) porque la
  // pantalla de login se muestra ANTES de cualquier sesión de Firebase —
  // hace falta un doc legible de forma anónima. Se lee una sola vez al
  // arrancar (no una suscripción en vivo).
  export function loadPublicConfig(){
    return getDoc(doc(db, 'config', 'public')).then(function(snap){
      if(snap.exists()){
        AppState.publicConfig.milicianosLoginEnabled = snap.data().milicianosLoginEnabled !== false;
      }
    }).catch(function(e){
      console.error('No se pudo leer la config pública:', e);
    });
  }

  export function defaultData(){
    var d = [];
    for(var i=0;i<8;i++){ d.push(uid()); }

    var days = [
      { id:d[0], label:'Día 1', date:'', ejeCorto:'Eje 1 · Ser hijos',
        citaTexto:'Pero cuando se cumplió el tiempo establecido, Dios envió a su Hijo, nacido de una mujer y sujeto a la Ley, para redimir a los que estaban sometidos a la Ley y hacernos hijos adoptivos. Y la prueba de que ustedes son hijos, es que Dios infundió en nuestros corazones el Espíritu de su Hijo, que clama a Dios llamándolo: «¡Abba!», es decir, «¡Padre!». Así, ya no eres más esclavo, sino hijo, y por lo tanto, heredero por la gracia de Dios.',
        citaRef:'Gálatas 4, 4-7' },
      { id:d[1], label:'Día 2', date:'', ejeCorto:'Eje 1 · Ser hijos',
        citaTexto:'En aquellos días, Jesús llegó desde Nazaret de Galilea y fue bautizado por Juan en el Jordán. Y al salir del agua, vio que los cielos se abrían y que el Espíritu Santo descendía sobre él como una paloma; y una voz desde el cielo dijo: «Tú eres mi Hijo muy querido, en ti tengo puesta toda mi predilección».',
        citaRef:'Marcos 1, 9-11' },
      { id:d[2], label:'Día 3', date:'', ejeCorto:'Eje 1 · Ser hijos',
        citaTexto:'¿No saben ustedes que todos los que fuimos bautizados en Cristo Jesús, nos hemos sumergido en su muerte? Por el bautismo fuimos sepultados con él en la muerte, para que así como Cristo resucitó por la gloria del Padre, también nosotros llevemos una vida nueva.',
        citaRef:'Romanos 6, 3-11' },
      { id:d[3], label:'Día 4', date:'', ejeCorto:'Eje 2 · Ser herederos',
        citaTexto:'Que él se digne fortificarlos por medio de su Espíritu, conforme a la riqueza de su gloria, para que crezca en ustedes el hombre interior. Que Cristo habite en sus corazones por la fe, y sean arraigados y edificados en el amor.',
        citaRef:'Efesios 3, 16-19' },
      { id:d[4], label:'Día 5', date:'', ejeCorto:'Eje 2 · Ser herederos',
        citaTexto:'Entonces partió y volvió a la casa de su padre. Cuando todavía estaba lejos, su padre lo vio y se conmovió profundamente, corrió a su encuentro, lo abrazó y lo besó. [...] Comamos y festejemos, porque mi hijo estaba muerto y ha vuelto a la vida, estaba perdido y fue encontrado. Y comenzó la fiesta.',
        citaRef:'Lucas 15, 20-24' },
      { id:d[5], label:'Día 6', date:'', ejeCorto:'Eje 2 · Ser herederos',
        citaTexto:'Yo soy el pan vivo bajado del cielo. El que coma de este pan vivirá eternamente, y el pan que yo daré es mi carne para la vida del mundo. [...] El que come mi carne y bebe mi sangre permanece en mí y yo en él.',
        citaRef:'Juan 6, 51-58' },
      { id:d[6], label:'Día 7', date:'', ejeCorto:'Eje 3 · Anuncio del Reino',
        citaTexto:'Todos los que son conducidos por el Espíritu de Dios son hijos de Dios. [...] El mismo Espíritu se une a nuestro espíritu para dar testimonio de que somos hijos de Dios. Y si somos hijos, también somos herederos: herederos de Dios y coherederos con Cristo.',
        citaRef:'Romanos 8, 14-17' },
      { id:d[7], label:'Día 8', date:'', ejeCorto:'Eje 3 · Anuncio del Reino',
        citaTexto:'Todos los que son conducidos por el Espíritu de Dios son hijos de Dios. [...] El mismo Espíritu se une a nuestro espíritu para dar testimonio de que somos hijos de Dios. Y si somos hijos, también somos herederos: herederos de Dios y coherederos con Cristo.',
        citaRef:'Romanos 8, 14-17' }
    ];

    var entries = [
      { id: uid(), dayId: d[0], type:'texto', title:'La originalidad de la dignidad de hijos', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'Para adentrarnos en el ser hijos, debemos mirar al Hijo. Lo central en este primer eje es la relación del Hijo con el Padre. Jesús es la imagen visible del Dios invisible. En Él podemos contemplar al Padre, porque el Hijo revela plenamente quién y cómo es.\n\n'+
        'Fuimos creados a imagen y semejanza de Dios. Durante la creación, la imagen que el Padre tiene de nosotros para crearnos es la de Jesús, el Hijo. Desde el génesis fuimos pensados como hijos, y por lo tanto tal es nuestra dignidad.\n\n'+
        'Al encarnarse, Jesús une en su persona lo divino y lo humano. De este modo, devuelve al hombre la dignidad perdida a causa del pecado original, dignidad que es elevada por la pasión, muerte y resurrección de Jesús.\n\n'+
        'No sólo hemos sido creados a semejanza del Hijo, sino hacia la semejanza. Dios nos ha pensado desde el origen para ser cada vez más parecidos al Hijo (Cristificación).\n\n'+
        'Por Cristo, somos llamados a vivir la filiación: el ser hijos en el Hijo.' },

      { id: uid(), dayId: d[1], type:'texto', title:'Lo que el Hijo revela del Padre', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'El Padre es motor y fuerza del Hijo. Todo lo que el Hijo hace, lo hace por y para el Padre. Jesús se hace hombre para salvarnos, pero también para revelarnos quién y cómo es el Padre.\n\n'+
        'Aunque no lo necesite, en varios pasajes del evangelio dialoga en voz alta con el Padre para que podamos entender cómo es su relación. No es mera obediencia. Toda la fuerza del Hijo proviene de saberse amado y elegido por el Padre.\n\n'+
        'El diálogo entre el Hijo y el Padre nos invita a poner el foco en la oración.\n\n'+
        'Otras citas para este día:\n\n'+
        '«Yo te alabo, Padre, Señor del cielo y de la tierra, porque has ocultado estas cosas a los sabios y a los prudentes y las has revelado a los pequeños. [...] Nadie conoce al Hijo sino el Padre, así como nadie conoce al Padre sino el Hijo y aquel a quien el Hijo se lo quiera revelar» (Mateo 11, 25-27).\n\n'+
        '«Padre, te doy gracias porque me has escuchado. Yo sé que siempre me escuchas, pero digo esto por la multitud que me rodea, para que crean que tú me has enviado» (Juan 11, 41-42).' },

      { id: uid(), dayId: d[2], type:'texto', title:'El Bautismo', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'Por el Bautismo somos sumergidos a una nueva vida. Cristo nos rescata del pecado, y a la vez eleva y perfecciona nuestra dignidad original. Por su muerte estamos llamados a vivir la filiación: el ser hijos en el Hijo.\n\n'+
        'El Bautismo tiene su fundamento en la Pascua. Esto puede verse claramente en la misa de Vigilia Pascual, donde toda la liturgia de la Palabra va anticipando la redención del hombre y preparando la liturgia del agua, en donde son renovadas las promesas bautismales. Así como la Pascua es el paso de la muerte a la vida, el bautismo es nuestro paso de creaturas a hijos.\n\n'+
        'Por el Bautismo recibimos la gracia de Dios, en donde prometemos renunciar al pecado para abrazar el amor del Padre, que quiere habitar en nosotros, a la manera en que el Hijo y el Padre son uno. Jesús, en quien somos hijos, nos enseña el Padrenuestro, la oración de los hijos.' },

      { id: uid(), dayId: d[3], type:'texto', title:'La construcción del Reino en el corazón', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'Ser heredero es asumir la condición de hijo y permanecer en el Padre. Comienza primero en el corazón. El Reino de Dios es una realidad existencial que atraviesa toda la vida del hombre. Es una realidad dinámica: crece a medida que se fortalece nuestra relación con el Padre y se debilita cuando nos alejamos de Dios.\n\n'+
        'El Reino de Dios es el Reino de los corazones. La espiritualidad, el modo de relacionarnos con Dios que Él quiere, es aquella en la que nuestro corazón está alineado con el suyo, y no una espiritualidad basada en corregir conductas.\n\n'+
        'Constituidos hijos por el bautismo, la espiritualidad filial se sostiene en tres pilares: la gratitud, el amor y la confianza.' },

      { id: uid(), dayId: d[4], type:'texto', title:'La misericordia del Padre', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'Aún redimidos por el Hijo, no estamos exentos de pecar, porque todos somos pecadores. Sin embargo, en las miserias es donde Dios se muestra más cercano, porque "donde abundó el pecado sobreabundó la gracia" (Romanos 5, 20).\n\n'+
        'El Padre conoce nuestras debilidades, pero no es ajeno a ellas. Sufre con nuestro sufrimiento, es cercano, escucha, abraza y consuela. Espera con los brazos abiertos a que nosotros nos dejemos abrazar por su amor que todo lo perdona, todo lo repara, todo lo puede.\n\n'+
        'El ruca es imagen de la casa del Padre, porque es refugio donde el miliciano puede encontrarse con Dios, ser abrazado y descansar. Encontrarse con el Padre funciona en dos sentidos: me encuentro siendo hijo o me encuentro ejerciendo un rol de paternidad.' },

      { id: uid(), dayId: d[5], type:'texto', title:'El Pan de Vida', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'En continuidad con lo anterior, este es el día en que, con el suficiente tacto y acorde a cada edad, podemos tratar las heridas espirituales, así como también el perdón.\n\n'+
        'Queremos acercar a los milicianos al médico de la Vida, a aquel que cargó todas las heridas a cuestas en su espalda, y quien nos dio su propio cuerpo y sangre como alimento de vida.\n\n'+
        'La Eucaristía es la plenitud de la unión íntima con Dios. Es la presencia sacramental del Reino de los Cielos en el hombre.' },

      { id: uid(), dayId: d[6], type:'texto', title:'El Espíritu anuncia el Reino', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'En este campamento no queremos transmitir la repetida idea de "volver a contar lo que hemos escuchado", sino que queremos ir más profundo: quien anuncia y hace presente el Reino es el Espíritu de Dios. El anuncio del Reino no nace principalmente de una iniciativa humana ni de un esfuerzo individual: nace de la acción del Espíritu Santo en aquellos que se saben hijos de Dios. El mismo Espíritu que nos hace clamar «¡Abba, Padre!» es quien nos impulsa y nos capacita para llevar el Reino a la realidad concreta en la que vivimos.\n\n'+
        'Lo que debemos hacer, una vez custodiada la presencia de Dios en el corazón, es ser dóciles a la acción del Espíritu Santo, que irá disponiendo lo necesario para el anuncio del Evangelio.\n\n'+
        'Es importante transmitir que el "ir y anunciar la Buena Noticia" no debe ser vivido como un deber de estado por ser hijos y herederos. Por el contrario, como consecuencia de saberse hijos amados por Dios, el miliciano encarnará el Reino de Dios: un Reino que se despliega ya en el presente, comenzando en el corazón de cada uno y proyectándose sobre la ciudad, ámbito de evangelización del joven.\n\n'+
        'Aquí pueden emplearse las parábolas del Reino, que revelan con más profundidad cómo es ese Reino que estamos llamados a encarnar.' },

      { id: uid(), dayId: d[7], type:'texto', title:'Implementación por ámbitos', author:'FORDOC', authorGrupo:'FORDOC', seccion:'', createdAt: Date.now(), body:
        'Segunda jornada del tercer eje: bajamos el anuncio del Reino por la acción del Espíritu Santo a la implementación concreta, por ámbitos de la persona:\n\n'+
        'Espiritual — motivar en el miliciano a iniciar un modo de vincularse con Dios filial, basado más en la presencia, cercanía y confianza con el Padre que en un conductismo.\n\n'+
        'Intelectual — enseñar al miliciano, a partir de la Revelación, cómo Dios se muestra como Padre.\n\n'+
        'Volitivo — aprovechar el campamento como escuela de virtud en los hábitos: cuidar el orden, las cosas, la belleza y limpieza del lugar, el cuidado del cuerpo (aseo, buen descanso, el alimento).\n\n'+
        'Emocional — propiciar los espacios para que el miliciano pueda, reflexionando y rezando, vincularse afectivamente a Dios como Padre e hijo.\n\n'+
        'Social-relacional — disponer espacios y dinámicas que fomenten la amistad miliciana.' }
    ];

    return { days: days, entries: entries, campStart: '' };
  }


  // Asegura que `AppState.state.days`/`.entries` sean siempre arrays, sea lo
  // que sea que haya en el documento de Firestore — docenas de funciones de
  // vista (renderWelcomeSection, renderMensajePanel, etc.) hacen
  // `.filter()`/`.find()` directo sobre estos dos campos sin un `|| []`
  // propio (confirmado el 08/10/2026, investigando un reporte del usuario de
  // que la página quedaba completamente en blanco después de loguearse: el
  // header estático se veía, pero el sidebar y el panel quedaban vacíos para
  // siempre — exactamente lo que pasa si el primer render después del login
  // explota con un TypeError en el primer `.filter()` que toca `entries`, ya
  // que `renderGate()` ya reveló el `.layout` ANTES de que `renderPanel()`
  // llegue a escribir nada adentro, y ningún snapshot nuevo vuelve a disparar
  // un reintento). Si el documento compartido alguna vez queda sin `entries`
  // (por ejemplo, editado a mano desde la consola de Firebase, o cualquier
  // otra causa), esto evita que CUALQUIERA de esos lugares explote.
  function normalizeState(s){
    if(!s || typeof s !== 'object') s = {};
    if(!Array.isArray(s.days)) s.days = [];
    if(!Array.isArray(s.entries)) s.entries = [];
    return s;
  }

  // Destino de la PRIMERA carga de la sesión (09/10/2026, pedido del
  // usuario: GitHub Pages siempre volvía a Inicio en cada F5) — en vez de
  // arrancar siempre en 'HOME', se intenta arrancar donde diga el hash de
  // la URL (ver utils/hash-router.js). No valida permisos acá — si el hash
  // apunta a una pestaña que esta persona no puede ver, los guards que ya
  // existen en renderPanelImpl() (USERS/FEEDBACK/PAPELERA/DEPARTAMENTOS)
  // la bouncean solos a Inicio en el primer render, igual que si hubiera
  // llegado ahí por cualquier otro camino.
  function applyInitialNavFromHash(){
    var target = decodeHash(window.location.hash);
    AppState.activeDayId = target.tab;
    if(target.tab === 'MENSAJE' && target.dayId && AppState.state.days.some(function(d){ return d.id === target.dayId; })){
      AppState.activeMensajeDayId = target.dayId;
    } else {
      AppState.activeMensajeDayId = AppState.state.days.length ? AppState.state.days[0].id : null;
    }
  }

  export function load(){
    AppState.unsubState = onSnapshot(stateDocRef, function(snap){
      if(snap.exists()){
        AppState.state = normalizeState(snap.data());
      } else if(AppState.firstSnapshot){
        AppState.state = defaultData();
        save(true);
      }
      ensureProgressSubs();
      ensureCompletionsSubs();
      if(AppState.firstSnapshot){
        AppState.firstSnapshot = false;
        applyInitialNavFromHash();
        render();
        return;
      }
      // Actualización remota (otro jefe cargó/editó algo). Si hay un
      // formulario abierto localmente, no lo pisamos hasta que se cierre.
      if(AppState.activeMensajeDayId && AppState.state.days && !AppState.state.days.some(function(d){ return d.id === AppState.activeMensajeDayId; })){
        AppState.activeMensajeDayId = AppState.state.days.length ? AppState.state.days[0].id : null;
      }
      if(!AppState.formOpen){ render(); }
    }, function(err){
      console.error('Firestore onSnapshot error:', err);
      if(AppState.firstSnapshot){
        AppState.firstSnapshot = false;
        AppState.state = defaultData();
        applyInitialNavFromHash();
        render();
      }
      showStatus('No se pudo conectar con la base de datos. Los cambios no se van a guardar.');
    });
  }


  export async function save(silent){
    try{
      await setDoc(stateDocRef, AppState.state);
    }catch(e){
      console.error('Firestore setDoc error:', e);
      if(!silent){ showStatus('No se pudo guardar. Probá de nuevo.'); }
    }
  }

  export function addDay(){
    if(!canEditStructure()) return;
    var n = AppState.state.days.length + 1;
    var id = uid();
    AppState.state.days.push({ id: id, label: 'Día ' + n, date: '' });
    AppState.activeDayId = 'MENSAJE';
    AppState.activeMensajeDayId = id;
    save();
    render();
  }


  export function renameDay(id, newLabel){
    if(!canEditStructure()) return;
    var day = AppState.state.days.find(function(d){ return d.id === id; });
    if(day){ day.label = newLabel; save(); renderPanel(); }
  }


  export function setDayDate(id, newDate){
    if(!canEditStructure()) return;
    var day = AppState.state.days.find(function(d){ return d.id === id; });
    if(day){ day.date = newDate; save(); }
  }


  // Cita bíblica del día (09/10/2026, pedido del usuario) — hasta ahora
  // `citaTexto`/`citaRef` solo se cargaban una vez, a mano, en los 8 días
  // precargados (defaultData() más abajo) — no había forma de editarlos
  // desde la interfaz. Mismo gate/patrón que renameDay()/setDayDate().
  export function setDayCita(id, citaTexto, citaRef){
    if(!canEditStructure()) return;
    var day = AppState.state.days.find(function(d){ return d.id === id; });
    if(day){ day.citaTexto = citaTexto; day.citaRef = citaRef; save(); renderPanel(); }
  }


  export function setConsigna(dayId, seccion, text){
    if(!canEditConsigna(seccion)) return;
    var day = AppState.state.days.find(function(d){ return d.id === dayId; });
    if(!day) return;
    if(!day.consignas) day.consignas = {};
    if(text){ day.consignas[seccion] = text; } else { delete day.consignas[seccion]; }
    save();
  }


  export function deleteDay(id){
    if(!canEditStructure()) return;
    if(AppState.state.days.length <= 1){ showStatus('Tiene que quedar al menos un día.'); return; }
    if(!confirm('¿Eliminar este día y todo su contenido?')) return;
    AppState.state.days = AppState.state.days.filter(function(d){ return d.id !== id; });
    AppState.state.entries = AppState.state.entries.filter(function(e){ return e.dayId !== id; });
    AppState.activeMensajeDayId = AppState.state.days.length ? AppState.state.days[0].id : null;
    save();
    render();
  }
