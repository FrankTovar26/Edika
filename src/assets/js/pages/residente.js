document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaResidente();
    cargarVistaResidente();
});

function protegerPaginaResidente() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }
}

function cargarVistaResidente() {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    document.getElementById("bienvenida").textContent =
        `Bienvenido, ${sesion?.nombre || "Residente"}`;

    cargarEstadisticasResidente(db, sesion);
    renderizarAreasResidente(db);
    renderizarUltimasReservasResidente(db, sesion);
}

function cargarEstadisticasResidente(db, sesion) {
    const areasDisponibles = (db.areasComunes || []).filter(area =>
        normalizarEstadoArea(area.estado) === "disponible"
    );

    const reservas = obtenerReservasDelResidente(db, sesion);

    document.getElementById("totalAreas").textContent = areasDisponibles.length;
    document.getElementById("totalReservas").textContent = reservas.length;
}

function renderizarAreasResidente(db) {
    const tabla = document.getElementById("tablaAreasResidente");
    const areas = db.areasComunes || [];

    if (!tabla) return;

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">No hay áreas comunes registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => {
        const disponible = normalizarEstadoArea(area.estado) === "disponible";

        return `
            <tr>
                <td>${area.nombre}</td>
                <td>${area.aforo}</td>
                <td>${area.descripcion || "-"}</td>
                <td>
                    <span class="badge ${disponible ? "vacio" : "ocupado"}">
                        ${disponible ? "Disponible" : "No disponible"}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarUltimasReservasResidente(db, sesion) {
    const tabla = document.getElementById("tablaReservasResidente");

    if (!tabla) return;

    const reservas = obtenerReservasDelResidente(db, sesion).slice(-5);
    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="3">No tienes reservas registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = reservas.map(reserva => {
        const area = areas.find(a => String(a.id) === String(reserva.areaId));
        const departamento = departamentos.find(d => String(d.id) === String(reserva.departamentoId));

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>
                <td>${departamento?.numero || "-"}</td>
                <td>${reserva.fecha || "-"}</td>
            </tr>
        `;
    }).join("");
}

function obtenerReservasDelResidente(db, sesion) {
    return (db.reservas || []).filter(reserva =>
        String(reserva.departamentoId) === String(sesion?.departamentoId)
    );
}

function normalizarEstadoArea(estado) {
    if (!estado) return "disponible";

    const valor = String(estado).toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "no disponible") return "no_disponible";
    if (valor === "no_disponible") return "no_disponible";
    if (valor === "mantenimiento") return "no_disponible";

    return "disponible";
}