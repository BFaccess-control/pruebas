import { auth } from './jsfb.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export function iniciarSesion(email, pass) {
    return signInWithEmailAndPassword(auth, email, pass);
}

export function cerrarSesion() {
    return signOut(auth);
}

export function observarSesion(callback) {
    onAuthStateChanged(auth, callback);
}