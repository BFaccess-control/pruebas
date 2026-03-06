import { db } from './jslg.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { activarAutocompletadoRUT, activarAutocompletadoPatente, aprenderPatente, guardarRegistro } from './jsmtr.js';

export const inicializarAbastecimiento = () => {
    const form = document.getElementById('form-abastecimiento');
    if(!form) return;

    // 1. ACTIVAR BUSCADORES (Lo que agregamos nuevo)
    activarAutocompletadoRUT('a-rut', 'a-sugerencias-rut');
    activarAutocompletadoPatente('a-patente', 'a-sugerencias-patente');
    activarAutocompletadoPatente('a-rampla', 'a-sugerencias-rampla');

    // 2. CARGA INICIAL DE LA TABLA
    cargarCamionesEnRecinto();

    // 3. LOGICA DE GUARDADO
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const patenteCamion = document.getElementById('a-patente').value.toUpperCase();
        const patenteRampla = document.getElementById('a-rampla').value.toUpperCase();

        // Verificar si ya está en recinto (Tu lógica original)
        const qCheck = query(collection(db, "registros"), 
            where("tipo", "==", "ABASTECIMIENTO"),
            where("estado", "==", "En Recinto"),
            where("patente", "==", patenteCamion));
        
        const checkSnap = await getDocs(qCheck);
        if (!checkSnap.empty) return alert("⚠️ Este camión ya figura 'En Recinto'.");

        const data = {
            tipo: "ABASTECIMIENTO",
            guardia: document.getElementById('a-guardia-id').value,
            rut: document.getElementById('a-rut').value,
            nombre: document.getElementById('a-nombre').value,
            patente: patenteCamion,
            rampla: patenteRampla,
            estado: "En Recinto"
        };

        // Guardar en ambas colecciones (Historial y Control actual)
        await guardarRegistro(data); // Para el Excel
        await addDoc(collection(db, "registros"), data); // Para la tabla visual
        
        await aprenderPatente(patenteCamion);
        if(patenteRampla) await aprenderPatente(patenteRampla);
        
        e.target.reset();
        cargarCamionesEnRecinto();
    };
};

// --- FUNCIÓN QUE DIBUJA LA TABLA (La que faltaba) ---
export const cargarCamionesEnRecinto = async () => {
    const contenedor = document.getElementById('lista-camiones-recinto');
    if (!contenedor) return;

    const q = query(collection(db, "registros"), 
        where("tipo", "==", "ABASTECIMIENTO"), 
        where("estado", "==", "En Recinto"));

    // Usamos onSnapshot para que la tabla se actualice sola si otro guardia marca una salida
    onSnapshot(q, (snapshot) => {
        contenedor.innerHTML = "";
        if (snapshot.empty) {
            contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>No hay camiones en recinto.</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const res = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement('div');
            card.className = 'camion-card';
            card.innerHTML = `
                <div class="camion-info">
                    <strong>${res.patente}</strong> <span>(R: ${res.rampla || '---'})</span><br>
                    <small>${res.nombre} | ${res.rut}</small>
                </div>
                <button class="btn-salida" data-id="${id}" data-patente="${res.patente}" data-hora="${res.hora}">
                    Marcar Salida
                </button>
            `;
            contenedor.appendChild(card);
        });

        // Asignar eventos a los botones de salida
        document.querySelectorAll('.btn-salida').forEach(btn => {
            btn.onclick = () => marcarSalida(btn.dataset.id, btn.dataset.patente, btn.dataset.hora);
        });
    });
};

async function marcarSalida(id, patente, horaI) {
    const horaS = new Date().toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // Calcular permanencia (Tu lógica original)
    const [h1, m1] = horaI.split(':').map(Number);
    const [h2, m2] = horaS.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    const perm = `${Math.floor(diff/60)}h ${diff%60}m`;

    try {
        // 1. Actualizar tabla de control
        await updateDoc(doc(db, "registros", id), {
            estado: "Finalizado",
            horaSalida: horaS,
            permanencia: perm
        });

        // 2. Actualizar para el Excel
        const qIng = query(collection(db, "ingresos"), 
            where("tipo", "==", "ABASTECIMIENTO"),
            where("patente", "==", patente),
            where("estado", "==", "En Recinto")
        );
        const snapIng = await getDocs(qIng);
        snapIng.forEach(async (d) => {
            await updateDoc(doc(db, "ingresos", d.id), {
                estado: "Finalizado",
                horaSalida: horaS,
                permanencia: perm
            });
        });

        alert("✅ Salida registrada: " + horaS);
    } catch (error) {
        alert("Error al marcar salida");
    }
}
