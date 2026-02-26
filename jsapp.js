import { observarSesion, iniciarSesion, cerrarSesion, configurarPermisosSeguros } from './jslg.js';
import { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarListadosYGuardias, guardarRegistro, formatearRUT } from './jsmtr.js';

observarSesion(async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-body').style.display = 'block';
        await configurarPermisosSeguros(user.email);
        cargarListadosYGuardias(); // Activa la lista de guardias
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-body').style.display = 'none';
    }
});

// Inicializar Autocompletados
activarAutocompletadoRUT('t-rut', 't-sugerencias');
activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
activarAutocompletadoPatente('t-patente', 'p-sugerencias');
activarAutocompletadoPatente('v-patente', 'v-sugerencias-patente');

// Eventos de Botones (Login, Logout, Tabs, Modales...)
// [Aquí incluyes todos los document.getElementById(...).onclick que tenías]
// Ejemplo:
document.getElementById('btn-login').onclick = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    iniciarSesion(e, p).catch(() => alert("Error de acceso"));
};
