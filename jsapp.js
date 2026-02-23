import { observarSesion, iniciarSesion, cerrarSesion } from './jslg.js';
import { validarYGuardarMaestro, limpiarRUT } from './jsmtr.js';

// Control visual de pantallas
observarSesion((user) => {
    document.getElementById('login-screen').style.display = user ? 'none' : 'flex';
    document.getElementById('app-body').style.display = user ? 'block' : 'none';
});

// Botón Login
document.getElementById('btn-login').onclick = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    iniciarSesion(e, p).catch(() => alert("Acceso denegado"));
};

// Botón Logout
document.getElementById('btn-logout').onclick = () => cerrarSesion();

// Formulario Maestro (Misión 1)
document.getElementById('form-maestro').onsubmit = async (e) => {
    e.preventDefault();
    const rut = document.getElementById('m-rut').value;
    const nom = document.getElementById('m-nombre').value;
    const emp = document.getElementById('m-empresa').value;

    const exito = await validarYGuardarMaestro(rut, nom, emp);
    if (exito) {
        alert("✅ Guardado con éxito");
        e.target.reset();
        document.getElementById('modal-conductor').style.display = 'none';
    }
};

// Navegación Básica
document.getElementById('btn-tab-transporte').onclick = () => {
    document.getElementById('sec-transporte').style.display='block';
    document.getElementById('sec-visitas').style.display='none';
};
document.getElementById('btn-tab-visitas').onclick = () => {
    document.getElementById('sec-visitas').style.display='block';
    document.getElementById('sec-transporte').style.display='none';
};