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

    if (sesion.rol !== "residente") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../admin/dashboard.html";
    }
}

function cargarVistaResidente() {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    document.getElementById("bienvenida").textContent =
        `Bienvenido, ${sesion?.nombre || "Residente"}`;

    cargarEstadisticasResidente(db, sesion);
    renderizarAreasResidente(db, sesion);
    renderizarUltimasReservasResidente(db, sesion);
}

function obtenerUnidadesVinculadasSesion(sesion) {
    return sesion?.unidadesAutorizadas || [];
}

function obtenerIdsUnidadesVinculadas(sesion) {
    const ids = obtenerUnidadesVinculadasSesion(sesion)
        .map(unidad => String(unidad.unidadId))
        .filter(Boolean);

    if (sesion?.departamentoId) {
        ids.push(String(sesion.departamentoId));
    }

    return [...new Set(ids)];
}

function obtenerEdificiosVinculadosSesion(sesion) {
    const ids = obtenerUnidadesVinculadasSesion(sesion)
        .map(unidad => unidad.edificioId)
        .filter(Boolean)
        .map(String);

    if (sesion?.edificioId) {
        ids.push(String(sesion.edificioId));
    }

    return [...new Set(ids)];
}

function cargarEstadisticasResidente(db, sesion) {
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);
    const reservas = obtenerReservasDelResidente(db, sesion);

    const areasDisponibles = (db.areasComunes || []).filter(area => {
        const perteneceEdificio =
            edificiosPermitidos.length === 0 ||
            edificiosPermitidos.includes(String(area.edificioId || ""));

        return perteneceEdificio &&
            normalizarEstadoArea(area.estado) === "disponible";
    });

    document.getElementById("totalAreas").textContent = areasDisponibles.length;
    document.getElementById("totalReservas").textContent = reservas.length;
}

function renderizarAreasResidente(db, sesion) {
    const tabla = document.getElementById("tablaAreasResidente");

    if (!tabla) return;

    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    const areas = (db.areasComunes || []).filter(area =>
        edificiosPermitidos.length === 0 ||
        edificiosPermitidos.includes(String(area.edificioId || ""))
    );

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">No hay áreas comunes registradas para tus edificios vinculados.</td>
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
    const idsUnidades = obtenerIdsUnidadesVinculadas(sesion);
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.reservas || []).filter(reserva => {
        const perteneceUnidad = idsUnidades.includes(String(reserva.departamentoId));
        const perteneceEdificio =
            !reserva.edificioId ||
            edificiosPermitidos.length === 0 ||
            edificiosPermitidos.includes(String(reserva.edificioId));

        return perteneceUnidad && perteneceEdificio;
    });
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