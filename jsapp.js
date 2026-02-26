import { db, observarSesion, iniciarSesion, cerrarSesion, configurarPermisosSeguros } from './jslg.js';
import { activarAutocompletadoRUT, activarAutocompletadoPatente, cargarGuardiasYListados, guardarRegistro, aprenderPatente, exportarExcel, formatearRUT } from './jsmtr.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

observarSesion(async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-body').style.display = 'block';
        await configurarPermisosSeguros(user.email);
        cargarGuardiasYListados();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-body').style.display = 'none';
    }
});

// Botones de Sesión
document.getElementById('btn-login').onclick = () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    iniciarSesion(e, p).catch(() => alert("Error de acceso"));
};
document.getElementById('btn-logout').onclick = () => cerrarSesion();

// Inicializar Autocompletados
activarAutocompletadoRUT('t-rut', 't-sugerencias');
activarAutocompletadoRUT('v-rut', 'v-sugerencias-rut');
activarAutocompletadoPatente('t-patente', 'p-sugerencias');
activarAutocompletadoPatente('v-patente', 'v-sugerencias-patente');

// Formularios
document.getElementById('form-transporte').onsubmit = async (e) => {
    e.preventDefault();
    const pat = document.getElementById('t-patente').value;
    await guardarRegistro({
        tipo: "TRANSPORTE",
        guardia: document.getElementById('t-guardia-id').value,
        rut: document.getElementById('t-rut').value,
        nombre: document.getElementById('t-nombre').value,
        empresa: document.getElementById('t-empresa').value,
        patente: pat
    });
    await aprenderPatente(pat);
    e.target.reset();
};

document.getElementById('form-visitas').onsubmit = async (e) => {
    e.preventDefault();
    const pat = document.getElementById('v-patente').value;
    await guardarRegistro({
        tipo: "VISITA",
        guardia: document.getElementById('v-guardia-id').value,
        rut: document.getElementById('v-rut').value,
        nombre: document.getElementById('v-nombre').value,
        empresa: document.getElementById('v-representa').value,
        motivo: document.getElementById('v-motivo').value,
        patente: pat || "PEATON"
    });
    await aprenderPatente(pat);
    e.target.reset();
    document.getElementById('v-patente').style.display = 'none';
};

document.getElementById('form-maestro').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "conductores"), { 
        rut: document.getElementById('m-rut').value, 
        nombre: document.getElementById('m-nombre').value, 
        empresa: document.getElementById('m-empresa').value 
    });
    alert("Maestro Actualizado"); e.target.reset(); document.getElementById('modal-conductor').style.display = 'none';
};

// Navegación y Modales
document.getElementById('btn-tab-transporte').onclick = () => {
    document.getElementById('sec-transporte').style.display='block';
    document.getElementById('sec-visitas').style.display='none';
    document.getElementById('btn-tab-transporte').classList.add('active');
    document.getElementById('btn-tab-visitas').classList.remove('active');
};
document.getElementById('btn-tab-visitas').onclick = () => {
    document.getElementById('sec-visitas').style.display='block';
    document.getElementById('sec-transporte').style.display='none';
    document.getElementById('btn-tab-visitas').classList.add('active');
    document.getElementById('btn-tab-transporte').classList.remove('active');
};

document.getElementById('btn-gestionar-guardias').onclick = () => document.getElementById('modal-gestion-guardias').style.display='flex';
document.getElementById('btn-cerrar-gestion').onclick = () => document.getElementById('modal-gestion-guardias').style.display='none';
document.getElementById('btn-abrir-reportes').onclick = () => document.getElementById('modal-reportes').style.display='flex';
document.getElementById('btn-cerrar-reportes').onclick = () => document.getElementById('modal-reportes').style.display='none';
document.getElementById('btn-abrir-modal').onclick = () => document.getElementById('modal-conductor').style.display='flex';
document.getElementById('btn-cerrar-modal').onclick = () => document.getElementById('modal-conductor').style.display='none';

// Otros Eventos
document.getElementById('btn-add-guardia').onclick = async () => {
    const n = document.getElementById('nuevo-guardia-nombre');
    if(n.value) { await addDoc(collection(db, "lista_guardias"), {nombre: n.value}); n.value = ""; }
};
document.getElementById('v-check-vehiculo').onchange = (e) => document.getElementById('v-patente').style.display = e.target.checked ? 'block' : 'none';
document.getElementById('m-rut').oninput = (e) => e.target.value = formatearRUT(e.target.value);

document.getElementById('btn-exportar').onclick = () => {
    const inicio = document.getElementById('fecha-inicio').value;
    const fin = document.getElementById('fecha-fin').value;
    const tipoF = document.getElementById('filtro-tipo').value;
    if(!inicio || !fin) return alert("Seleccione fechas");
    exportarExcel(inicio, fin, tipoF);
};
