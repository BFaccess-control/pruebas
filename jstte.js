import { db } from './jslg.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { guardarRegistro, aprenderPatente } from './jsmtr.js';

export const inicializarTransporte = () => {
    const form = document.getElementById('form-transporte');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const pat = document.getElementById('t-patente').value;
        
        const data = {
            tipo: "TRANSPORTE",
            guardia: document.getElementById('t-guardia-id').value,
            rut: document.getElementById('t-rut').value,
            nombre: document.getElementById('t-nombre').value,
            empresa: document.getElementById('t-empresa').value,
            patente: pat
        };

        await guardarRegistro(data);
        await aprenderPatente(pat);
        e.target.reset();
    };
};
