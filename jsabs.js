import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { activarAutocompletadoRUT, activarAutocompletadoPatente, aprenderPatente, guardarRegistro } from './jsmtr.js';

export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-abastecimiento');
    if(!form) return;

    // ACTIVAR BUSCADORES EN TIEMPO REAL
    activarAutocompletadoRUT('a-rut', 'a-sugerencias-rut');
    activarAutocompletadoPatente('a-patente', 'a-sugerencias-patente');
    activarAutocompletadoPatente('a-rampla', 'a-sugerencias-rampla');

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const patCamion = document.getElementById('a-patente').value.toUpperCase();
        
        const data = {
            tipo: "ABASTECIMIENTO",
            guardia: document.getElementById('a-guardia-id').value,
            rut: document.getElementById('a-rut').value,
            nombre: document.getElementById('a-nombre').value,
            patente: patCamion,
            rampla: document.getElementById('a-rampla').value.toUpperCase(),
            estado: "En Recinto"
        };

        await guardarRegistro(data);
        await aprenderPatente(patCamion);
        
        e.target.reset();
        // Si tienes una función para cargar la tabla de "En Recinto", llámala aquí
        if (typeof cargarCamionesEnRecinto === "function") cargarCamionesEnRecinto();
    };
};
