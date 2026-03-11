import { db } from './jslg.js';
import { collection, addDoc, onSnapshot, getDocs, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let maestros = [];
let listaGuardias = [];
let maestroPatentes = [];

// --- 1. FORMATEADORES (Mantenidos intactos) ---
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

// --- 3. AUTOCOMPLETADOS ---
export function activarAutocompletadoRUT(idInput, idSugerencias) {
    const input = document.getElementById(idInput);
    const box = document.getElementById(idSugerencias);
    if (!input || !box) return;

    input.oninput = (e) => {
        const val = formatearRUT(e.target.value);
        e.target.value = val;
        box.innerHTML = "";
        if (val.length < 3) return;

        const coinciden = maestros.filter(m => m.rut.includes(val));
        coinciden.forEach(m => {
            const div = document.createElement("div");
            div.className = "sugerencia-item";
            div.innerText = `${m.rut} - ${m.nombre}`;
            div.onclick = () => {
                input.value = m.rut;
                box.innerHTML = "";
                // Rellenar campos hermanos según el prefijo del ID (t-, v-, a-)
                const prefijo = idInput.split('-')[0];
                const nombreField = document.getElementById(`${prefijo}-nombre`);
                const empresaField = document.getElementById(`${prefijo}-empresa`) || document.getElementById(`${prefijo}-representa`);
                
                if (nombreField) nombreField.value = m.nombre;
                if (empresaField) empresaField.value = m.empresa;
            };
            box.appendChild(div);
        });
    };
    document.addEventListener("click", () => box.innerHTML = "");
}

export function activarAutocompletadoPatente(idInput, idSugerencias) {
    const input = document.getElementById(idInput);
    const box = document.getElementById(idSugerencias);
    if (!input || !box) return;

    input.oninput = (e) => {
        const val = e.target.value.toUpperCase();
        box.innerHTML = "";
        if (val.length < 2) return;

        const coinciden = maestroPatentes.filter(p => p.patente.includes(val));
        coinciden.forEach(p => {
            const div = document.createElement("div");
            div.className = "sugerencia-item";
            div.innerText = p.patente;
            div.onclick = () => {
                input.value = p.patente;
                box.innerHTML = "";
            };
            box.appendChild(div);
        });
    };
}

// --- 4. CARGA DE GUARDIAS ---
export const cargarGuardiasYListados = () => {
    const combos = ['t-guardia-id', 'v-guardia-id', 'a-guardia-id', 'g-guardia-id'];
    onSnapshot(collection(db, "guardias"), (snap) => {
        listaGuardias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        combos.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<option value="">Seleccione Guardia</option>';
                listaGuardias.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.nombre;
                    opt.innerText = g.nombre;
                    el.appendChild(opt);
                });
            }
        });
    });
};

// --- 5. REGISTROS ---
export const guardarRegistro = async (data) => {
    try {
        const hoy = new Date();
        const fechaChile = hoy.toLocaleDateString('es-CL').replace(/\//g, "-");
        await addDoc(collection(db, "ingresos"), { ...data, fecha: fechaChile });
    } catch (e) { console.error("Error al guardar registro", e); }
};

export const aprenderPatente = async (patente) => {
    if (!patente) return;
    const pat = patente.toUpperCase();
    const existe = maestroPatentes.some(p => p.patente.replace(/-/g, "") === pat.replace(/-/g, ""));
    if (!existe) {
        try {
            await addDoc(collection(db, "vehiculos"), { patente: pat });
        } catch (e) { console.error("Error al aprender patente", e); }
    }
};

// --- 6. NUEVAS FUNCIONES DE CONDUCTORES (Integradas) ---
export async function buscarConductorPorRut(rut) {
    const q = query(collection(db, "conductores"), where("rut", "==", rut));
    const snap = await getDocs(q);
    if (!snap.empty) {
        return snap.docs[0].data();
    }
    return null;
}

export async function aprenderConductor(rut, nombre, empresa) {
    const q = query(collection(db, "conductores"), where("rut", "==", rut));
    const snap = await getDocs(q);
    if (snap.empty) {
        try {
            await addDoc(collection(db, "conductores"), { 
                rut, 
                nombre, 
                empresa,
                fechaCreacion: new Date().toISOString() 
            });
        } catch (e) { console.error("Error al guardar maestro conductor", e); }
    }
}

// --- 7. EXCEL ---
export const exportarExcel = async (inicio, fin, tipoF) => {
    try {
        const snap = await getDocs(collection(db, "ingresos"));
        let filtrados = snap.docs.map(d => d.data()).filter(r => {
            if (!r.fecha) return false;
            let fComp = r.fecha;
            if (r.fecha.includes("-") && r.fecha.split("-")[0].length === 2) {
                const [d, m, a] = r.fecha.split("-");
                fComp = `${a}-${m}-${d}`;
            }
            return (fComp >= inicio && fComp <= fin) && (tipoF === "TODOS" || r.tipo === tipoF);
        });

        if(filtrados.length === 0) return alert(`Sin datos para el rango ${inicio} al ${fin}`);

        filtrados.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

        const ws = XLSX.utils.json_to_sheet(filtrados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registros");
        XLSX.writeFile(wb, `Reporte_Prosud_${inicio}_${fin}.xlsx`);
    } catch (e) { alert("Error al generar Excel"); }
};
