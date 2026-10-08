// localStorage helpers — "visto hasta cuándo" por uid, para los badges de
// Novedades y de usuarios nuevos en la pestaña "Usuarios". Envueltos en
// try/catch porque localStorage puede fallar (contexto no seguro, cuota,
// modo privado) y no debería tirar abajo el resto de la app por eso.

  export function novedadesSeenKey(uid){ return 'fordoc_novedadesSeenAt_' + uid; }

  export function loadNovedadesSeenAt(uid){
    try{
      var v = localStorage.getItem(novedadesSeenKey(uid));
      return v ? (parseInt(v, 10) || 0) : 0;
    }catch(e){ return 0; }
  }

  export function saveNovedadesSeenAt(uid, ts){
    try{ localStorage.setItem(novedadesSeenKey(uid), String(ts)); }catch(e){}
  }


  export function usersSeenKey(uid){ return 'fordoc_usersSeenAt_' + uid; }

  export function loadUsersSeenAt(uid){
    try{
      var v = localStorage.getItem(usersSeenKey(uid));
      if(v) return parseInt(v, 10) || 0;
      // Nunca se guardó un "visto" para este admin — es la primera vez que
      // corre este código en su navegador. Arrancar en 0 haría que TODA la
      // gente ya registrada (no solo la que se loguee de acá en más) cuente
      // como "nueva" la primera vez que se vea el badge, sea o no que haya
      // entrado a la pestaña "Usuarios" — bug reportado por el usuario
      // (25/09/2026): "me aparece +12... no fueron doce personas nuevas
      // sino que se logueó la persona número 12" (12 = el total de gente ya
      // registrada, no la cantidad de logins genuinamente nuevos). Se sella
      // "ahora" como línea de corte de una: de acá en más el badge solo
      // cuenta a quien se loguee DESPUÉS de este momento.
      var now = Date.now();
      saveUsersSeenAt(uid, now);
      return now;
    }catch(e){ return Date.now(); }
  }

  export function saveUsersSeenAt(uid, ts){
    try{ localStorage.setItem(usersSeenKey(uid), String(ts)); }catch(e){}
  }

