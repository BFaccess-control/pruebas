import { db, observarSesion, iniciarSesion, cerrarSesion, configurarPermisosSeguros } from './jslg.js';
import { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarGuardiasYListados, exportarExcel, formatearRUT } from './jsmtr.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// IMPORTANTE: Importamos los inicializadores de las otras ventanas
import { inicializarTransporte } from './jstte.js';
import { inicializarVisitas } from './jsvst.js';

// --- CONTROL DE SESIÓN ---
observarSesion(async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-body').style.display = 'block';
        
        // Cargar permisos y datos maestros
        await configurarPermisosSeguros(user.email);
        cargarGuardiasYListados();
        
        // Activamos la lógica de los formularios (Transporte y Visitas)
        inicializarTransporte();
        inicializarVisitas();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-body').style.display = 'none';
    }
});

// --- LOGIN Y LOGOUT ---
document.getElementById('btn-login').onclick = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    iniciarSesion(email, pass).catch(() => alert("Error de acceso"));
};

document.getElementById('btn-logout').onclick = () => {
    cerrarSesion();
};

// --- AUTOCOMPLETADOS (Transversales) ---
activarAutocompletadoRUT('t-rut', 't-sugerencias');
activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
activarAutocompletadoPatente('t-patente', 'p-sugerencias');
activarAutocompletadoPatente('v-patente', 'v-sugerencias-patente');

// --- NAVEGACIÓN ENTRE PESTAÑAS (UI) ---
document.getElementById('btn-tab-transporte').onclick = () => {
    document.getElementById('sec-transporte').style.display = 'block';
    document.getElementById('sec-visitas').style.display = 'none';
    document.getElementById('btn-tab-transporte').classList.add('active');
    document.getElementById('btn-tab-visitas').classList.remove('active');
};

document.getElementById('btn-tab-visitas').onclick = () => {
    document.getElementById('sec-visitas').style.display = 'block';
    document.getElementById('sec-transporte').style.display = 'none';
    document.getElementById('btn-tab-visitas').classList.add('active');
    document.getElementById('btn-tab-transporte').classList.remove('active');
};

// --- MODALES DE ADMINISTRACIÓN ---
// Gestionar Guardias
document.getElementById('btn-gestionar-guardias').onclick = () => {
    document.getElementById('modal-gestion-guardias').style.display = 'flex';
};
document.getElementById('btn-cerrar-gestion').onclick = () => {
    document.getElementById('modal-gestion-guardias').style.display = 'none';
};

// Reportes
document.getElementById('btn-abrir-reportes').onclick = () => {
    document.getElementById('modal-reportes').style.display = 'flex';
};
document.getElementById('btn-cerrar-reportes').onclick = () => {
    document.getElementById('modal-reportes').style.display = 'none';
};

// Maestro Conductor
document.getElementById('btn-abrir-modal').onclick = () => {
    document.getElementById('modal-conductor').style.display = 'flex';
};
document.getElementById('btn-cerrar-modal').onclick = () => {
    document.getElementById('modal-conductor').style.display = 'none';
};

// --- LÓGICA
