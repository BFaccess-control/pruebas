import { db } from './jsfb.js';
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function validarYGuardarMaestro(rut, nombre, empresa) {
    // Buscamos si el RUT ya existe
    const q = query(collection(db, "conductores"), where("rut", "==", rut));
    const snap = await getDocs(q);

    if (!snap.empty) {
        alert(`⚠️ Error: El RUT ${rut} ya está registrado.`);
        return false;
    }

    // Si no existe, lo guardamos
    await addDoc(collection(db, "conductores"), { rut, nombre, empresa });
    return true;
}

export function limpiarRUT(rut) {
    let v = rut.replace(/[^\dkK]/g, "");
    if (v.length > 1) v = v.slice(0, -1) + "-" + v.slice(-1);
    return v.toUpperCase();
}