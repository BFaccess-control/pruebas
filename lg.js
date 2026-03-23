/**
 * lg.js — Módulo de Autenticación y Gestión de Sesión
 * ─────────────────────────────────────────────────────
 * Responsabilidades:
 *   • Inicialización de Firebase (config ofuscada en variables)
 *   • Login / Logout con Firebase Auth
 *   • Persistencia de sesión y detección de estado
 *   • Resolución de rol (admin / jefatura / usuario)
 *   • Exposición de instancias `db` y `auth` al contexto global
 */

// ══════════════════════════════════════════════
// SECCIÓN 1 — CONFIGURACIÓN FIREBASE (ofuscada)
// ══════════════════════════════════════════════
// IMPORTANTE: En producción reemplazar estos valores por los reales
// y considerar el uso de variables de entorno o un proxy backend.
// No exponer API keys sensibles en repositorios públicos.

const _cfg = (() => {
  // Configuración Firebase — proyecto: registro-ingreso-5d3a1
  return {
    apiKey:            'AIzaSyBZxSJBPrOkDWRAqPG0tJM4AdwT5kgzjnk',
    authDomain:        'registro-ingreso-5d3a1.firebaseapp.com',
    projectId:         'registro-ingreso-5d3a1',
    storageBucket:     'registro-ingreso-5d3a1.firebasestorage.app',
    messagingSenderId: '737060993636',
    appId:             '1:737060993636:web:3a1d2783bcbdd534a6bd71',
  };
})();

// ══════════════════════════════════════════════
// SECCIÓN 2 — ROLES Y JERARQUÍA (RBAC)
// ══════════════════════════════════════════════

/**
 * Matriz de permisos por rol:
 *   admin     → acceso total (lectura, escritura, export, gestión guardias)
 *   jefatura  → lectura, escritura, exportación de reportes
 *   usuario   → solo carga de formularios de ingreso/salida
 */
const ROLES = {
  ADMIN:    'admin',
  JEFATURA: 'jefatura',
  USUARIO:  'usuario',
};

/** Email del administrador maestro */
const ADMIN_EMAIL = 'bfernandez@prosud.cl';

// ══════════════════════════════════════════════
// SECCIÓN 3 — INICIALIZACIÓN FIREBASE
// ══════════════════════════════════════════════

let _firebaseApp = null;
let _db          = null;
let _auth        = null;

/**
 * Inicializa Firebase si no ha sido inicializado previamente.
 * Retorna las instancias de auth y db.
 */
function lgInitFirebase() {
  try {
    if (!firebase.apps.length) {
      _firebaseApp = firebase.initializeApp(_cfg);
    } else {
      _firebaseApp = firebase.apps[0];
    }
    _auth = firebase.auth();
    _db   = firebase.firestore();

    // Habilitar persistencia offline (mejora UX con red intermitente)
    _db.enablePersistence({ synchronizeTabs: true })
       .catch(err => console.warn('[lg] Persistencia offline no disponible:', err.code));

    console.log('[lg] Firebase inicializado correctamente');
    return { auth: _auth, db: _db };
  } catch (err) {
    console.error('[lg] Error al inicializar Firebase:', err);
    throw err;
  }
}

// ══════════════════════════════════════════════
// SECCIÓN 4 — RESOLUCIÓN DE ROL
// ══════════════════════════════════════════════

/**
 * Determina el rol del usuario autenticado.
 * 1. Admin maestro por email
 * 2. Verifica colección `admins` en Firestore
 * 3. Por defecto: USUARIO estándar
 *
 * @param {object} user   - Objeto de usuario Firebase Auth
 * @param {object} db     - Instancia Firestore
 * @returns {Promise<string>} rol: 'admin' | 'jefatura' | 'usuario'
 */
async function lgResolveRole(user, db) {
  if (!user) return ROLES.USUARIO;

  // Admin maestro hardcoded por email
  if (user.email === ADMIN_EMAIL) return ROLES.ADMIN;

  try {
    const snap = await db.collection('admins').doc(user.uid).get();
    if (snap.exists) {
      const data = snap.data();
      // El documento puede tener campo `rol` = 'admin' | 'jefatura'
      return data.rol || ROLES.JEFATURA;
    }
  } catch (err) {
    console.warn('[lg] No se pudo resolver rol desde Firestore:', err);
  }

  return ROLES.USUARIO;
}

// ══════════════════════════════════════════════
// SECCIÓN 5 — LOGIN Y LOGOUT
// ══════════════════════════════════════════════

/**
 * Intenta autenticar al usuario con email y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} - Objeto usuario Firebase
 */
async function lgLogin(email, password) {
  if (!_auth) throw new Error('Firebase Auth no inicializado');
  const credential = await _auth.signInWithEmailAndPassword(email, password);
  return credential.user;
}

/**
 * Cierra la sesión del usuario actual.
 * @returns {Promise<void>}
 */
async function lgLogout() {
  if (!_auth) return;
  await _auth.signOut();
  console.log('[lg] Sesión cerrada');
}

// ══════════════════════════════════════════════
// SECCIÓN 6 — OBSERVER DE ESTADO DE SESIÓN
// ══════════════════════════════════════════════

/**
 * Registra un observer que se ejecuta cada vez que cambia
 * el estado de autenticación (login / logout).
 *
 * @param {Function} onLogin   - Callback({ user, rol })
 * @param {Function} onLogout  - Callback()
 */
function lgOnAuthChange(onLogin, onLogout) {
  if (!_auth) return;

  _auth.onAuthStateChanged(async user => {
    if (user) {
      const rol = await lgResolveRole(user, _db);
      onLogin({ user, rol });
    } else {
      onLogout();
    }
  });
}

// ══════════════════════════════════════════════
// SECCIÓN 7 — MENSAJES DE ERROR LEGIBLES
// ══════════════════════════════════════════════

/**
 * Traduce códigos de error de Firebase Auth a mensajes en español.
 * @param {string} code - Código de error Firebase
 * @returns {string}
 */
function lgAuthErrorMsg(code) {
  const msgs = {
    'auth/user-not-found':      'No existe una cuenta con ese correo.',
    'auth/wrong-password':      'Contraseña incorrecta.',
    'auth/invalid-email':       'Correo electrónico inválido.',
    'auth/too-many-requests':   'Demasiados intentos. Intente más tarde.',
    'auth/network-request-failed': 'Error de red. Verifique su conexión.',
    'auth/user-disabled':       'Esta cuenta ha sido deshabilitada.',
  };
  return msgs[code] || 'Error de autenticación. Intente nuevamente.';
}

// ══════════════════════════════════════════════
// SECCIÓN 8 — INICIALIZACIÓN DEL MÓDULO DE LOGIN
// ══════════════════════════════════════════════

/**
 * Inicializa el formulario de login: binding de eventos y submit.
 * Llamado desde app.js al cargar la aplicación.
 */
function lgInitLoginForm() {
  const btnLogin   = document.getElementById('btn-login');
  const inputEmail = document.getElementById('login-email');
  const inputPass  = document.getElementById('login-pass');
  const errorDiv   = document.getElementById('login-error');
  const btnText    = btnLogin.querySelector('.btn-text');
  const btnLoader  = btnLogin.querySelector('.btn-loader');

  // Año dinámico en el footer
  const yearEl = document.getElementById('login-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function setLoading(state) {
    btnLogin.disabled = state;
    btnText.classList.toggle('hidden', state);
    btnLoader.classList.toggle('hidden', !state);
  }

  function showError(msg) {
    errorDiv.textContent = '⚠️ ' + msg;
    errorDiv.classList.remove('hidden');
  }

  function clearError() {
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
  }

  // Submit al hacer click
  btnLogin.addEventListener('click', async () => {
    clearError();
    const email = inputEmail.value.trim();
    const pass  = inputPass.value;

    if (!email || !pass) {
      showError('Complete todos los campos.');
      return;
    }

    setLoading(true);
    try {
      await lgLogin(email, pass);
      // El observer onAuthStateChanged en app.js tomará el control
    } catch (err) {
      showError(lgAuthErrorMsg(err.code));
      setLoading(false);
    }
  });

  // Enter en el campo de contraseña dispara el login
  inputPass.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnLogin.click();
  });
  inputEmail.addEventListener('keydown', e => {
    if (e.key === 'Enter') inputPass.focus();
  });

  // Limpiar error al escribir
  [inputEmail, inputPass].forEach(el => {
    el.addEventListener('input', clearError);
  });
}

// ══════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ══════════════════════════════════════════════

window.LG = {
  initFirebase:   lgInitFirebase,
  initLoginForm:  lgInitLoginForm,
  login:          lgLogin,
  logout:         lgLogout,
  onAuthChange:   lgOnAuthChange,
  resolveRole:    lgResolveRole,
  ROLES,

  // Getters de instancias Firebase
  get db()   { return _db; },
  get auth() { return _auth; },
};
