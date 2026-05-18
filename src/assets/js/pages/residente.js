document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaResidente();
    cargarVistaResidente();
});

/* =========================================================
   SEGURIDAD
========================================================= */

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

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

function cargarVistaResidente() {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    document.getElementById("bienvenida").textContent =
        `Bienvenido, ${sesion?.nombre || "Residente"}`;

    cargarEstadisticasResidente(db, sesion);

    renderizarAreasResidente(db, sesion);
    renderizarUltimasReservasResidente(db, sesion);

    renderizarProximasReservas(db, sesion);
    renderizarAnunciosResidente(db, sesion);
}

/* =========================================================
   DATOS SESIÓN
========================================================= */

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

/* =========================================================
   ESTADÍSTICAS
========================================================= */

function cargarEstadisticasResidente(db, sesion) {

    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    const reservas = obtenerReservasDelResidente(db, sesion);

    const areasDisponibles = obtenerAreasDisponiblesResidente(db, edificiosPermitidos);

    const anuncios = obtenerAnunciosVisiblesResidente(db, sesion);

    const mantenimientos = obtenerMantenimientosActivos(db, edificiosPermitidos);

    actualizarElemento("totalAreas", areasDisponibles.length);
    actualizarElemento("totalReservas", reservas.length);
    actualizarElemento("totalAnuncios", anuncios.length);
    actualizarElemento("totalMantenimientos", mantenimientos.length);
}

/* =========================================================
   ÁREAS
========================================================= */

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
                <td colspan="5">
                    No hay áreas comunes registradas para tus edificios vinculados.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => {

        const estadoReal = obtenerEstadoRealArea(db, area);

        return `
            <tr>
                <td>
                    <strong>${escaparHTML(area.nombre)}</strong>
                </td>

                <td>${area.aforo || "-"}</td>

                <td>${escaparHTML(area.descripcion || "-")}</td>

                <td>
                    <span class="badge ${claseEstadoArea(estadoReal)}">
                        ${formatearEstadoArea(estadoReal)}
                    </span>
                </td>

                <td>
                    ${renderizarDetalleEstadoArea(db, area, estadoReal)}
                </td>
            </tr>
        `;
    }).join("");
}

/* =========================================================
   RESERVAS
========================================================= */

function renderizarUltimasReservasResidente(db, sesion) {

    const tabla = document.getElementById("tablaReservasResidente");

    if (!tabla) return;

    const reservas = obtenerReservasDelResidente(db, sesion)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 5);

    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="4">
                    No tienes reservas registradas.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = reservas.map(reserva => {

        const area = areas.find(a =>
            String(a.id) === String(reserva.areaId)
        );

        const departamento = departamentos.find(d =>
            String(d.id) === String(reserva.departamentoId)
        );

        const estado = normalizarEstadoReserva(reserva.estado);

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>

                <td>${departamento?.numero || "-"}</td>

                <td>${formatearFecha(reserva.fecha)}</td>

                <td>
                    <span class="badge ${claseEstadoReserva(estado)}">
                        ${formatearEstadoReserva(estado)}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

/* =========================================================
   PRÓXIMAS RESERVAS
========================================================= */

function renderizarProximasReservas(db, sesion) {

    const contenedor = document.getElementById("proximasReservas");

    if (!contenedor) return;

    const hoy = obtenerFechaHoy();

    const reservas = obtenerReservasDelResidente(db, sesion)
        .filter(r =>
            r.fecha >= hoy &&
            normalizarEstadoReserva(r.estado) === "aprobada"
        )
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .slice(0, 3);

    const areas = db.areasComunes || [];

    if (reservas.length === 0) {
        contenedor.innerHTML = `
            <p class="empty-state">
                No tienes próximas reservas.
            </p>
        `;
        return;
    }

    contenedor.innerHTML = reservas.map(reserva => {

        const area = areas.find(a =>
            String(a.id) === String(reserva.areaId)
        );

        return `
            <div class="mini-card">
                <strong>${area?.nombre || "Área común"}</strong>

                <p>${formatearFecha(reserva.fecha)}</p>
            </div>
        `;
    }).join("");
}

/* =========================================================
   ANUNCIOS
========================================================= */

function renderizarAnunciosResidente(db, sesion) {

    const contenedor = document.getElementById("anunciosResidente");

    if (!contenedor) return;

    const anuncios = obtenerAnunciosVisiblesResidente(db, sesion)
        .slice(0, 5);

    if (anuncios.length === 0) {
        contenedor.innerHTML = `
            <p class="empty-state">
                No hay anuncios disponibles.
            </p>
        `;
        return;
    }

    contenedor.innerHTML = anuncios.map(anuncio => `
        <div class="card-anuncio-residente">

            <div class="anuncio-header">
                <h4>${escaparHTML(anuncio.titulo)}</h4>

                <span class="badge ${clasePrioridadAnuncio(anuncio.prioridad)}">
                    ${formatearPrioridadAnuncio(anuncio.prioridad)}
                </span>
            </div>

            <p>
                ${escaparHTML(anuncio.mensaje || anuncio.descripcion || "")}
            </p>

            <small>
                ${formatearFecha(anuncio.fechaPublicacion || anuncio.fecha)}
            </small>
        </div>
    `).join("");
}

/* =========================================================
   HELPERS RESERVAS
========================================================= */

function obtenerReservasDelResidente(db, sesion) {

    const idsUnidades = obtenerIdsUnidadesVinculadas(sesion);

    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.reservas || []).filter(reserva => {

        const perteneceUnidad =
            idsUnidades.includes(String(reserva.departamentoId));

        const perteneceEdificio =
            !reserva.edificioId ||
            edificiosPermitidos.length === 0 ||
            edificiosPermitidos.includes(String(reserva.edificioId));

        return perteneceUnidad && perteneceEdificio;
    });
}

/* =========================================================
   HELPERS ÁREAS
========================================================= */

function obtenerAreasDisponiblesResidente(db, edificiosPermitidos) {

    return (db.areasComunes || []).filter(area => {

        const perteneceEdificio =
            edificiosPermitidos.length === 0 ||
            edificiosPermitidos.includes(String(area.edificioId || ""));

        return perteneceEdificio &&
            obtenerEstadoRealArea(db, area) === "disponible";
    });
}

function obtenerEstadoRealArea(db, area) {

    const hoy = obtenerFechaHoy();

    const mantenimiento = (db.mantenimientosAreas || []).some(m =>
        String(m.areaId) === String(area.id) &&
        normalizarEstadoMantenimiento(m.estado) === "programado" &&
        hoy >= m.fechaInicio &&
        hoy <= m.fechaFin
    );

    if (mantenimiento) {
        return "mantenimiento";
    }

    const reservaHoy = (db.reservas || []).some(r =>
        String(r.areaId) === String(area.id) &&
        String(r.fecha) === String(hoy) &&
        normalizarEstadoReserva(r.estado) === "aprobada"
    );

    if (reservaHoy) {
        return "reservada";
    }

    return normalizarEstadoArea(area.estado);
}

function renderizarDetalleEstadoArea(db, area, estado) {

    if (estado === "mantenimiento") {

        const mantenimiento = (db.mantenimientosAreas || []).find(m =>
            String(m.areaId) === String(area.id) &&
            normalizarEstadoMantenimiento(m.estado) === "programado"
        );

        return `
            <small>
                En mantenimiento hasta
                ${formatearFecha(mantenimiento?.fechaFin)}
            </small>
        `;
    }

    if (estado === "reservada") {
        return `
            <small>
                Área reservada para hoy
            </small>
        `;
    }

    return `
        <small>
            Disponible para reserva
        </small>
    `;
}

/* =========================================================
   MANTENIMIENTOS
========================================================= */

function obtenerMantenimientosActivos(db, edificiosPermitidos) {

    const hoy = obtenerFechaHoy();

    return (db.mantenimientosAreas || []).filter(m => {

        const perteneceEdificio =
            edificiosPermitidos.includes(String(m.edificioId || ""));

        return perteneceEdificio &&
            normalizarEstadoMantenimiento(m.estado) === "programado" &&
            hoy >= m.fechaInicio &&
            hoy <= m.fechaFin;
    });
}

/* =========================================================
   ANUNCIOS
========================================================= */

function obtenerAnunciosVisiblesResidente(db, sesion) {

    if (typeof obtenerAnunciosVisiblesUsuario === "function") {
        return obtenerAnunciosVisiblesUsuario(sesion)
            .sort((a, b) =>
                new Date(b.fechaRegistro || 0) -
                new Date(a.fechaRegistro || 0)
            );
    }

    return [];
}

/* =========================================================
   FORMATEADORES
========================================================= */

function normalizarEstadoArea(estado) {

    if (!estado) return "disponible";

    const valor = String(estado).toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "bloqueada") return "bloqueada";
    if (valor === "no_disponible") return "bloqueada";
    if (valor === "mantenimiento") return "mantenimiento";

    return "disponible";
}

function normalizarEstadoReserva(estado) {

    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "aprobada") return "aprobada";
    if (valor === "rechazada") return "rechazada";
    if (valor === "cancelada") return "cancelada";

    return "aprobada";
}

function normalizarEstadoMantenimiento(estado) {

    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "programado") return "programado";
    if (valor === "finalizado") return "finalizado";
    if (valor === "cancelado") return "cancelado";

    return "programado";
}

function formatearEstadoArea(estado) {

    const estados = {
        disponible: "Disponible",
        reservada: "Reservada",
        mantenimiento: "Mantenimiento",
        bloqueada: "No disponible"
    };

    return estados[estado] || "Disponible";
}

function claseEstadoArea(estado) {

    if (estado === "disponible") return "vacio";
    if (estado === "mantenimiento") return "pendiente";
    if (estado === "reservada") return "inactivo";

    return "ocupado";
}

function formatearEstadoReserva(estado) {

    const estados = {
        aprobada: "Aprobada",
        rechazada: "Rechazada",
        cancelada: "Cancelada"
    };

    return estados[estado] || "Aprobada";
}

function claseEstadoReserva(estado) {

    if (estado === "aprobada") return "vacio";
    if (estado === "rechazada") return "ocupado";

    return "inactivo";
}

/* =========================================================
   HELPERS UI
========================================================= */

function actualizarElemento(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function obtenerFechaHoy() {

    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatearFecha(fecha) {

    if (!fecha) return "-";

    const date = new Date(fecha + "T00:00:00");

    return date.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}

function escaparHTML(texto) {

    return String(texto || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}