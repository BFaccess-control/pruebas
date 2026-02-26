import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBZxSJBPrOkDWRAqPG0tJM4AdwT5kgzjnk",
    authDomain: "registro-ingreso-5d3a1.firebaseapp.com",
    projectId: "registro-ingreso-5d3a1",
    storageBucket: "registro-ingreso-5d3a1.firebasestorage.app",
    messagingSenderId: "737060993636",
    appId: "1:737060993636:web:3a1d2783bcbdd534a6bd71"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence);

export const iniciarSesion = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const cerrarSesion = () => signOut(auth);
export const observarSesion = (callback) => onAuthStateChanged(auth, callback);

// Función de permisos que estaba en tu código original
export async function configurarPermisosSeguros(email) {
    const adminPanel = document.getElementById('admin-panel');
    const btnGestionar = document.getElementById('btn-gestionar-guardias');
    const btnMaestro = document.getElementById('btn-abrir-modal');
    
    try {
        const adminRef = doc(db, "admins", email);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            const datosAdmin = adminSnap.data();
            adminPanel.style.display = 'flex';
            btnGestionar.style.display = (datosAdmin.rol === "administrador") ? 'block' : 'none';
            btnMaestro.style.display = 'block'; 
        } else {
            adminPanel.style.display = 'none';
            btnMaestro.style.display = 'block';
        }
    } catch (error) {
        console.error("Error verificando permisos:", error);
    }
}
