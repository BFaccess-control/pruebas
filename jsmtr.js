import { db } from './jslg.js';
import { collection, addDoc, onSnapshot, getDocs, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let maestros = [];
let listaGuardias = [];
let maestroPatentes = [];

// --- 1. FORMATEADORES (No se toca nada) ---
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

// --- 2. SUSCRIPCIONES ---
onSnapshot(collection(db, "conductores"), (snap) => { maestros = snap.docs.map(d => d.data()); });
onSnapshot(collection(db, "vehiculos"), (snap) => { maestroPatentes = snap.docs.map(d => d.data()); });

// --- 3. AUTOCOMPLETADOS (Se mantiene lógica de bloqueo de campos) ---
export function activarAutocompletadoRUT(idInput, idBox) {
    const input = document.getElementById(idInput);
    if (!input) return;
    
    input.oninput = (e) => {
        const val = e.target.value = formatearRUT(e.target.value);
        const bLimpia = val.replace(/-/g, "");
        const box = document.getElementById(idBox);
        box.innerHTML = "";
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
                gestionarBloqueoCampos(idInput, true);
            };
            box.appendChild(d);
        });
    };
}

function gestionarBloqueoCampos(idInput, bloquear) {
    const sufijos = idInput.split('-')[0]; 
    const nombre = document.getElementById(`${sufijos}-nombre`);
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

// sección Gestión de Guardias (Actualizada para mostrar lista)
export const cargarGuardiasYListados = async () => {
    const colRef = collection(db, "lista_guardias");
    const contenedorAdmin = document.getElementById('lista-guardias-admin'); // El div del modal

    const renderizar = (docs) => {
        listaGuardias = docs.map(d => ({id: d.id, ...d.data()}));
        
        // 1. Llenar los SELECT de los formularios
        let opciones = '<option value="">-- Seleccione Guardia --</option>';
        listaGuardias.forEach(g => { opciones += `<option value="${g.nombre}">${g.nombre}</option>`; });
        ['t-guardia-id', 'v-guardia-id', 'a-guardia-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opciones;
        });

        // 2. Llenar la LISTA del modal administrativo (LO QUE TE FALTA)
        if (contenedorAdmin) {
            contenedorAdmin.innerHTML = ""; // Limpiar antes de llenar
            listaGuardias.forEach(g => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.padding = '5px';
                item.style.borderBottom = '1px solid #eee';
                
                item.innerHTML = `
                    <span>${g.nombre}</span>
                    <button class="btn-eliminar-guardia" data-id="${g.id}" style="color:red; cursor:pointer; border:none; background:none;">✕</button>
                `;
                contenedorAdmin.appendChild(item);
            });

            // Configurar botones para eliminar (opcional pero recomendado)
            document.querySelectorAll('.btn-eliminar-guardia').forEach(btn => {
                btn.onclick = async () => {
                    if(confirm("¿Eliminar guardia?")) {
                        await deleteDoc(doc(db, "lista_guardias", btn.dataset.id));
                    }
                };
            });
        }
    };

    const inicialSnap = await getDocs(colRef);
    renderizar(inicialSnap.docs);
    onSnapshot(colRef, (s) => { renderizar(s.docs); });
};

// --- 5. GUARDADO (Unificado a Formato Chile DD-MM-YYYY) ---
export const guardarRegistro = async (data) => {
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    data.fecha = `${dia}-${mes}-${ahora.getFullYear()}`;
    data.hora = ahora.toLocaleTimeString('es-CL', { hour12: false });
    try {
        await addDoc(collection(db, "ingresos"), data);
        alert("✅ Registro guardado");
    } catch (e) { alert("Error: " + e.message); }
};

// --- 6. APRENDER PATENTE (Vital para jstte.js y jsvst.js) ---
export const aprenderPatente = async (pat) => {
    if (!pat || pat === "PEATON") return;
    const existe = maestroPatentes.some(p => p.patente.replace(/-/g, "") === pat.replace(/-/g, ""));
    if (!existe) {
        try {
            await addDoc(collection(db, "vehiculos"), { patente: pat.toUpperCase() });
        } catch (e) { console.error("Error al aprender patente", e); }
    }
};

// --- 7. EXCEL (Solución definitiva para reportes) ---
export const exportarExcel = async (inicio, fin, tipoF) => {
    try {
        const snap = await getDocs(collection(db, "ingresos"));
        let filtrados = snap.docs.map(d => d.data()).filter(r => {
            if (!r.fecha) return false;
            let fComp = r.fecha;
            // Si la fecha está en formato chileno (DD-MM-YYYY), la invertimos para comparar con el calendario
            if (r.fecha.includes("-") && r.fecha.split("-")[0].length === 2) {
                const [d, m, a] = r.fecha.split("-");
                fComp = `${a}-${m}-${d}`;
            }
            return (fComp >= inicio && fComp <= fin) && (tipoF === "TODOS" || r.tipo === tipoF);
        });

        if(filtrados.length === 0) return alert(`Sin datos para el rango ${inicio} al ${fin}`);

        // Ordenar por fecha y hora
        filtrados.sort((a, b) => a.fecha.localeCompare(b.fecha));

        const ws = XLSX.utils.json_to_sheet(filtrados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, `Reporte_Prosud_${inicio}.xlsx`);
    } catch (e) { alert("Error al exportar: " + e.message); }
};
