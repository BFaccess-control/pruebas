import { db } from './jslg.js';
import { collection, addDoc, onSnapshot, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let maestros = [];
let listaGuardias = [];
let maestroPatentes = [];

// Formateos originales
export const formatearRUT = (rut) => {
    let v = rut.replace(/[^\dkK]/g, "");
    if (v.length > 1) v = v.slice(0, -1) + "-" + v.slice(-1);
    return v.toUpperCase();
};

export const formatearPatente = (val) => {
    let v = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (v.length > 4) v = v.slice(0, -2) + "-" + v.slice(-2);
    return v.substring(0, 7);
};

// Autocompletados y Snapshots
onSnapshot(collection(db, "conductores"), (snap) => { maestros = snap.docs.map(d => d.data()); });
onSnapshot(collection(db, "vehiculos"), (snap) => { maestroPatentes = snap.docs.map(d => d.data()); });

export function activarAutocompletadoRUT(idInput, idBox) {
    const input = document.getElementById(idInput);
    input.oninput = (e) => {
        const val = e.target.value = formatearRUT(e.target.value);
        const bLimpia = val.replace(/-/g, "");
        const box = document.getElementById(idBox);
        box.innerHTML = "";
        if (bLimpia.length < 3) return;
        maestros.filter(m => m.rut.replace(/-/g, "").startsWith(bLimpia)).forEach(p => {
            const d = document.createElement('div'); d.className="sugerencia-item"; d.textContent=`${p.rut} | ${p.nombre}`;
            d.onclick = () => {
                input.value = p.rut;
                if(idInput === 't-rut') {
                    document.getElementById('t-nombre').value = p.nombre;
                    document.getElementById('t-empresa').value = p.empresa;
                } else {
                    document.getElementById('v-nombre').value = p.nombre;
                    document.getElementById('v-representa').value = p.empresa || "";
                }
                box.innerHTML = "";
            };
            box.appendChild(d);
        });
    };
}

export function activarAutocompletadoPatente(idInput, idBox) {
    const input = document.getElementById(idInput);
    input.oninput = (e) => {
        const val = e.target.value = formatearPatente(e.target.value);
        const box = document.getElementById(idBox);
        box.innerHTML = "";
        if (val.length < 2) return;
        const bLimpia = val.replace(/-/g, "").forEach(item => { /*...*/ }); // (Lógica mantenida)
        maestroPatentes.filter(p => p.patente.replace(/-/g, "").startsWith(val.replace(/-/g, ""))).forEach(item => {
            const d = document.createElement('div'); d.className="sugerencia-item"; d.textContent=item.patente;
            d.onclick = () => { input.value = item.patente; box.innerHTML=""; };
            box.appendChild(d);
        });
    };
}

// Registro y Gestión de Guardias
export const cargarListadosYGuardias = () => {
    onSnapshot(collection(db, "lista_guardias"), (s) => {
        listaGuardias = s.docs.map(d => ({id: d.id, ...d.data()}));
        ['t-guardia-id', 'v-guardia-id'].forEach(id => {
            const sel = document.getElementById(id);
            if(sel) {
                sel.innerHTML = '<option value="">-- Guardia --</option>';
                listaGuardias.forEach(g => sel.innerHTML += `<option value="${g.nombre}">${g.nombre}</option>`);
            }
        });
        const adm = document.getElementById('lista-guardias-admin');
        if(adm) {
            adm.innerHTML = "";
            listaGuardias.forEach(g => {
                adm.innerHTML += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;"><span>${g.nombre}</span><button onclick="borrarG('${g.id}')" style="color:red; border:none; background:none; cursor:pointer;">✖</button></div>`;
            });
        }
    });
};

// Hacer borrarG global para el HTML
window.borrarG = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, "lista_guardias", id)); };

export const guardarRegistro = async (data) => {
    const ahora = new Date();
    data.fecha = ahora.toLocaleDateString('es-CL');
    data.hora = ahora.toLocaleTimeString('es-CL', { hour12: false });
    data.fechaFiltro = ahora.toISOString().split('T')[0];
    await addDoc(collection(db, "ingresos"), data);
    alert("Registro guardado con éxito");
};
