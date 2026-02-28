import { db } from './jslg.js';
import { collection, addDoc, onSnapshot, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let maestros = [];
let listaGuardias = [];
let maestroPatentes = [];

export const formatearRUT = (rut) => {
    let v = rut.replace(/[^\dkK]/g, "");
    if (v.length > 1) v = v.slice(0, -1) + "-" + v.slice(-1);
    return v.toUpperCase();
};

export const formatearPatente = (val) => {
    let v = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (v.length > 4) v = v.slice(0, -1) + "-" + v.slice(-1); 
    return v.substring(0, 7);
};

onSnapshot(collection(db, "conductores"), (snap) => { maestros = snap.docs.map(d => d.data()); });
onSnapshot(collection(db, "vehiculos"), (snap) => { maestroPatentes = snap.docs.map(d => d.data()); });

export function activarAutocompletadoRUT(idInput, idBox) {
    const input = document.getElementById(idInput);
    if (!input) return;
    
    input.oninput = (e) => {
        const val = e.target.value = formatearRUT(e.target.value);
        const bLimpia = val.replace(/-/g, "");
        const box = document.getElementById(idBox);
        box.innerHTML = "";
        if (bLimpia.length < 3) return;
        
        maestros.filter(m => m.rut.replace(/-/g, "").startsWith(bLimpia)).forEach(p => {
            const d = document.createElement('div'); 
            d.className="sugerencia-item"; 
            d.textContent=`${p.rut} | ${p.nombre}`;
            d.onclick = () => {
                input.value = p.rut;
                if(idInput === 't-rut') {
                    document.getElementById('t-nombre').value = p.nombre;
                    document.getElementById('t-empresa').value = p.empresa;
                } else if(idInput === 'v-rut') {
                    document.getElementById('v-nombre').value = p.nombre;
                    document.getElementById('v-representa').value = p.empresa || "";
                } else if(idInput === 'a-rut') {
                    document.getElementById('a-nombre').value = p.nombre;
                }
                box.innerHTML = "";
            };
            box.appendChild(d);
        });
    };
}

export function activarAutocompletadoPatente(idInput, idBox) {
    const input = document.getElementById(idInput);
    if (!input) return;

    input.oninput = (e) => {
        const val = e.target.value = formatearPatente(e.target.value);
        const box = document.getElementById(idBox);
        box.innerHTML = "";
        if (val.length < 2) return;
        const bLimpia = val.replace(/-/g, "");
        maestroPatentes.filter(p => p.patente.replace(/-/g, "").startsWith(bLimpia)).forEach(item => {
            const d = document.createElement('div'); d.className="sugerencia-item"; d.textContent=item.patente;
            d.onclick = () => { input.value = item.patente; box.innerHTML=""; };
            box.appendChild(d);
        });
    };
}

// CORRECCIÓN AQUÍ: Aseguramos que el llenado ocurra dentro del Snapshot
export const cargarGuardiasYListados = () => {
    onSnapshot(collection(db, "lista_guardias"), (s) => {
        listaGuardias = s.docs.map(d => ({id: d.id, ...d.data()}));
        
        let opciones = '<option value="">-- Seleccione Guardia --</option>';
        listaGuardias.forEach(g => {
            opciones += `<option value="${g.nombre}">${g.nombre}</option>`;
        });

        // Llenamos los tres selects con la lista real de Firebase
        const selects = ['t-guardia-id', 'v-guardia-id', 'a-guardia-id'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opciones;
        });

        const adm = document.getElementById('lista-guardias-admin');
        if(adm) {
            adm.innerHTML = "";
            listaGuardias.forEach(g => {
                adm.innerHTML += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;">
                    <span>${g.nombre}</span>
                    <button onclick="borrarG('${g.id}')" style="color:red; border:none; background:none; cursor:pointer;">✖</button>
                </div>`;
            });
        }
    });
};

window.borrarG = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, "lista_guardias", id)); };

export const guardarRegistro = async (data) => {
    const ahora = new Date();
    data.fecha = ahora.toLocaleDateString('es-CL');
    data.hora = ahora.toLocaleTimeString('es-CL', { hour12: false });
    const anio = ahora.getFullYear(), mes = String(ahora.getMonth() + 1).padStart(2, '0'), dia = String(ahora.getDate()).padStart(2, '0');
    data.fechaFiltro = `${anio}-${mes}-${dia}`;
    await addDoc(collection(db, "ingresos"), data);
    alert("Registro guardado con éxito");
};

export const aprenderPatente = async (pat) => {
    if (pat && pat.length >= 6 && !maestroPatentes.some(p => p.patente === pat)) {
        await addDoc(collection(db, "vehiculos"), { patente: pat });
    }
};

export const exportarExcel = async (inicio, fin, tipoF) => {
    const snap = await getDocs(collection(db, "ingresos"));
    let filtrados = snap.docs.map(d => d.data()).filter(r => {
        const cF = r.fechaFiltro >= inicio && r.fechaFiltro <= fin;
        const cT = (tipoF === "TODOS") || (r.tipo === tipoF);
        return cF && cT;
    });

    if(filtrados.length === 0) return alert("Sin datos para este rango.");
    
    filtrados.sort((a, b) => (a.fechaFiltro + a.hora).localeCompare(b.fechaFiltro + b.hora));
    
    const datosOrdenados = filtrados.map(r => {
        const fila = { 
            "Fecha": r.fecha, 
            "Hora": r.hora || r.horaIngreso, 
            "Tipo": r.tipo, 
            "Guardia": r.guardia || "No especificado", 
            "Rut": r.rut, 
            "Nombre": r.nombre, 
            "Patente": r.patente 
        };
        if (r.empresa) fila["Empresa"] = r.empresa;
        if (r.guia) fila["Guía"] = r.guia;
        if (r.rampla) fila["Rampla"] = r.rampla;
        if (r.permanencia) fila["Permanencia"] = r.permanencia;
        return fila;
    });

    const ws = XLSX.utils.json_to_sheet(datosOrdenados), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Prosud_${tipoF}.xlsx`);
};
