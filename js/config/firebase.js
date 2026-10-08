import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Config pública del proyecto Firebase (fordoc-reino-del-padre).
// No es secreta: la seguridad real la dan las reglas de Firestore, no ocultar esta clave.
export var firebaseConfig = {
  apiKey: "AIzaSyAZC1TJ3XdvzTI-qBnbxr6rmgeCUo39Pj8",
  authDomain: "fordoc-reino-del-padre.firebaseapp.com",
  projectId: "fordoc-reino-del-padre",
  storageBucket: "fordoc-reino-del-padre.firebasestorage.app",
  messagingSenderId: "955338785447",
  appId: "1:955338785447:web:2063e38db815594bdd9182"
};
export var firebaseApp = initializeApp(firebaseConfig);
export var db = getFirestore(firebaseApp);
export var auth = getAuth(firebaseApp);
// Scope de Drive que se pide SOLO a quien entra por el camino "comando"
// (nunca a milicianos) — ver signIn() y "Subida de archivos al Drive
// del usuario" en CLAUDE.md, 22/09/2026.
export var DRIVE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/drive.file';
// Todo el contenido de los días vive en un único documento compartido.
export var stateDocRef = doc(db, 'fordoc', 'shared');
export var usersColRef = collection(db, 'users');
// Cuadro de mandos (nombres reales) — movido de config/constants.js a
// Firestore (08/10/2026, ver "Publicar en GitHub" en CLAUDE.md) para que el
// código fuente, que ahora también se publica en un repo público, no
// cargue ningún dato sensible. Legible por cualquiera logueado (mismo
// criterio que `fordoc/shared` — ver reglas de Firestore), escribible
// solo por admin.
export var mandosDocRef = doc(db, 'mandos', 'data');
// Comentarios de feedback sobre la página (botón flotante) — documentos sueltos,
// separados de `fordoc/shared` porque solo los lee un admin, nunca el resto del comando.
export var feedbackColRef = collection(db, 'feedback');
