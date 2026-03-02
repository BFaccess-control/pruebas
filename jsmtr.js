import { db } from './jslg.js';
import { collection, addDoc, onSnapshot, getDocs, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let maestros = [];
let listaGuardias = [];
let maestroPatentes = [];

// --- FORMATEADORES ---
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

// --- SUSCRIPCIONES A MAESTROS ---
onSnapshot(collection(db, "conductores"), (snap) => { maestros = snap.docs.map(d => d.data()); });
onSnapshot(collection(db, "vehiculos"), (snap) => { maestroPatentes = snap.docs.map(d => d.data()); });

// --- AUTOCOMPLETADOS ---
export function activarAutocompletadoRUT(idInput, idBox) {
    const input = document.getElementById(idInput);
    if (!input) return;
    
    input.oninput = (e) => {
        const val = e.target.value = formatearRUT(e.target.value);
        const bLimpia = val.replace(/-/g, "");
        const box = document.getElementById(idBox);
        box.innerHTML = "";

        // Si el usuario borra o cambia el RUT, por seguridad desbloqueamos campos 
        // para que no se queden bloqueados con datos viejos
        gestionarBloqueoCampos(idInput, false);

        if (bLimpia.length < 3) return;
        
        const sugerencias = maestros.filter(m => m.rut.replace(/-/g, "").startsWith(bLimpia));
        
        sugerencias.forEach(p => {
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
                // Como el conductor existe, bloqueamos para evitar errores de tipeo
                gestionarBloqueoCampos(idInput, true);
            };
            box.appendChild(d);
        });
    };
}

// Función auxiliar para bloquear/desbloquear según si el conductor existe
function gestionarBloqueoCampos(idInput, bloquear) {
    const sufijos = idInput.split('-')[0]; // 't', 'v' o 'a'
    const nombre = document.getElementById(`${sufijos}-nombre`);
    const empresa = document.getElementById(sufijos === 't' ? 't-empresa' : (sufijos === 'v' ? 'v-representa' : 'a-nombre'));

    if (nombre) {
        nombre.readOnly = bloquear;
        bloquear ? nombre.classList.add('readonly') : nombre.classList.remove('readonly');
    }
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

// --- GESTIÓN DE GUARDIAS ---
export const cargarGuardiasYListados = async () => {
    const colRef = collection(db, "lista_guardias");

    const renderizar = (docs) => {
        listaGuardias = docs.map(d => ({id: d.id, ...d.data()}));
        let opciones = '<option value="">-- Seleccione Guardia --</option>';
        listaGuardias.forEach(g => {
            opciones += `<option value="${g.nombre}">${g.nombre}</option>`;
        });

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
    };

    const inicialSnap = await getDocs(colRef);
    renderizar(inicialSnap.docs);
    onSnapshot(colRef, (s) => { renderizar(s.docs); });
};

window.borrarG = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, "lista_guardias", id)); };

// --- GUARDADO DE REGISTROS CON VALIDACIÓN ---
export const guardarRegistro = async (data) => {
    // Misión Secundaria: Evitar campos vacíos
    const camposObligatorios = ['rut', 'nombre', 'guardia', 'patente'];
    const faltantes = camposObligatorios.filter(campo => !data[campo] || data[campo].trim() === "");

    if (faltantes.length > 0) {
        alert("❌ Error: Faltan datos obligatorios (RUT, Nombre, Guardia o Patente). El registro no se guardará.");
        return; 
    }

    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    
    data.fecha = `${anio}-${mes}-${dia}`;
    data.hora = ahora.toLocaleTimeString('es-CL', { hour12: false });
    
    try {
        await addDoc(collection(db, "ingresos"), data);
        alert("✅ Registro guardado con éxito");
    } catch (e) {
        alert("Error al guardar: " + e.message);
    }
};

export const aprenderPatente = async (pat) => {
    if (pat && pat.length >= 6 && !maestroPatentes.some(p => p.patente === pat)) {
        await addDoc(collection(db, "vehiculos"), { patente: pat });
    }
};

// --- EXPORTACIÓN A EXCEL CORREGIDA ---
export const exportarExcel = async (inicio, fin, tipoF) => {
    const snap = await getDocs(collection(db, "ingresos"));
    
    let filtrados = snap.docs.map(d => d.data()).filter(r => {
        const cF = r.fecha >= inicio && r.fecha <= fin;
        const cT = (tipoF === "TODOS") || (r.tipo === tipoF);
        return cF && cT;
    });

    if(filtrados.length === 0) {
        return alert(`Sin datos para el rango ${inicio} al ${fin} en ${tipoF}`);
    }
    
    filtrados.sort((a, b) => (a.fecha + (a.hora || a.horaIngreso)).localeCompare(b.fecha + (b.hora || b.horaIngreso)));
    
    const datosOrdenados = filtrados.map(r => {
        const fila = { 
            "Fecha": r.fecha, 
            "H. Ingreso": r.hora || r.horaIngreso, 
            "H. Salida": r.horaSalida || "Pendiente",
            "Permanencia": r.permanencia || "---",
            "Estado": r.estado || "Finalizado",
            "Tipo": r.tipo, 
            "Guardia": r.guardia || "No especificado", 
            "Rut": r.rut, 
            "Nombre": r.nombre, 
            "Patente": r.patente 
        };
        if (r.empresa) fila["Empresa"] = r.empresa;
        if (r.guia) fila["Guía"] = r.guia;
        if (r.rampla) fila["Rampla"] = r.rampla;
        return fila;
    });

    const ws = XLSX.utils.json_to_sheet(datosOrdenados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Prosud");
    XLSX.writeFile(wb, `Reporte_${tipoF}_${inicio}.xlsx`);
};
