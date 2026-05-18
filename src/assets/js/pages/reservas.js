document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaResidente();

    migrarEstadosReservasResidente();

    cargarPaginaReservas();
    configurarFormularioReserva();
    configurarFiltroPorArea();
    configurarFechaMinima();
    inicializarCalendarioReservasResidente();
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
        alert("Esta vista corresponde al portal del residente.");
        window.location.href = "../admin/dashboard.html";
    }
}

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

function cargarPaginaReservas() {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    actualizarEstadosReservasFinalizadas(db);

    cargarAreasDisponibles(db, sesion);
    cargarUnidadesResidente(db, sesion);
    cargarResumenReservas(db, sesion);

    renderizarDisponibilidadAreas(db, sesion);
    renderizarMisReservas(db, sesion);

    refrescarCalendarioReservasResidente();
}

/* =========================================================
   FORMULARIO
========================================================= */

function configurarFormularioReserva() {
    const form = document.getElementById("formReservaResidente");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const db = obtenerTodo();
        const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

        const reservaId = document.getElementById("reservaId")?.value || "";
        const areaId = document.getElementById("areaReservaResidente")?.value || "";
        const unidadId = document.getElementById("unidadReservaResidente")?.value || "";
        const fecha = document.getElementById("fechaReservaResidente")?.value || "";

        if (!areaId || !unidadId || !fecha) {
            alert("Selecciona un área, una unidad y una fecha.");
            return;
        }

        if (fecha < obtenerFechaHoy()) {
            alert("No puedes registrar reservas en fechas pasadas.");
            return;
        }

        const area = obtenerAreasPermitidasResidente(db, sesion).find(a =>
            String(a.id) === String(areaId)
        );

        if (!area) {
            alert("El área seleccionada no pertenece a tus edificios vinculados o no está disponible.");
            return;
        }

        const unidad = obtenerUnidadesPermitidasReserva(db, sesion).find(u =>
            String(u.id) === String(unidadId)
        );

        if (!unidad) {
            alert("La unidad seleccionada no está vinculada a tu usuario.");
            return;
        }

        if (String(unidad.edificioId) !== String(area.edificioId)) {
            alert("La unidad y el área común deben pertenecer al mismo edificio.");
            return;
        }

        if (existeFechaReservada(db, areaId, fecha, reservaId)) {
            alert("Esta área ya tiene una reserva aprobada para la fecha seleccionada.");
            return;
        }

        if (existeMantenimientoEnFecha(db, areaId, fecha)) {
            alert("Esta área tiene mantenimiento programado en la fecha seleccionada.");
            return;
        }

        const datosReserva = {
            areaId,
            departamentoId: unidad.id,
            edificioId: area.edificioId,
            fecha,
            estado: "aprobada",
            observacion: "",
            motivoRechazo: ""
        };

        const resultado = reservaId
            ? editarReservaResidente(reservaId, datosReserva)
            : registrarReservaResidente(datosReserva);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioReserva();
        cargarPaginaReservas();

        alert(
            reservaId
                ? "Reserva reprogramada correctamente."
                : "Reserva registrada correctamente."
        );
    });
}

/* =========================================================
   REGISTRO / EDICIÓN
========================================================= */

function registrarReservaResidente(datosReserva) {
    if (typeof agregarReservaArea === "function") {
        return agregarReservaArea(datosReserva);
    }

    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    db.reservas.push({
        id: generarIdReservaResidente(),
        ...datosReserva,
        estado: "aprobada",
        fechaRegistro: new Date().toISOString()
    });

    guardarTodo(db);

    return { ok: true };
}

function editarReservaResidente(id, datosReserva) {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    const reserva = obtenerReservasDelResidente(db, sesion).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    const estadoActual = obtenerEstadoReservaVisible(reserva);

    if (!["aprobada", "rechazada"].includes(estadoActual)) {
        return {
            ok: false,
            error: "Solo puedes reprogramar reservas aprobadas o rechazadas."
        };
    }

    reserva.areaId = datosReserva.areaId;
    reserva.departamentoId = datosReserva.departamentoId;
    reserva.edificioId = datosReserva.edificioId;
    reserva.fecha = datosReserva.fecha;
    reserva.estado = "aprobada";
    reserva.observacion = "";
    reserva.motivoRechazo = "";
    reserva.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    return { ok: true };
}

/* =========================================================
   SELECTS
========================================================= */

function cargarAreasDisponibles(db, sesion) {
    const select = document.getElementById("areaReservaResidente");

    if (!select) return;

    const valorActual = select.value;
    const areas = obtenerAreasPermitidasResidente(db, sesion);

    select.innerHTML = `<option value="">Seleccione un área</option>`;

    areas.forEach(area => {
        const edificio = obtenerNombreEdificio(db, area.edificioId);

        select.innerHTML += `
            <option value="${area.id}">
                ${area.nombre} - ${edificio}
            </option>
        `;
    });

    if (areas.some(a => String(a.id) === String(valorActual))) {
        select.value = valorActual;
    }
}

function cargarUnidadesResidente(db, sesion) {
    const select = document.getElementById("unidadReservaResidente");

    if (!select) return;

    const valorActual = select.value;
    const unidades = obtenerUnidadesPermitidasReserva(db, sesion);

    select.innerHTML = `<option value="">Seleccione una unidad</option>`;

    unidades.forEach(unidad => {
        const edificio = obtenerNombreEdificio(db, unidad.edificioId);
        const tipo = formatearTipoUnidad(normalizarTipoUnidad(unidad.tipo));

        select.innerHTML += `
            <option value="${unidad.id}">
                ${unidad.numero} - ${tipo} - ${edificio}
            </option>
        `;
    });

    if (unidades.some(u => String(u.id) === String(valorActual))) {
        select.value = valorActual;
    }
}

/* =========================================================
   DISPONIBILIDAD
========================================================= */

function renderizarDisponibilidadAreas(db, sesion) {
    const tabla = document.getElementById("tablaReservasExistentes");

    if (!tabla) return;

    const areaSeleccionada = document.getElementById("areaReservaResidente")?.value || "";

    let areas = obtenerAreasPermitidasResidente(db, sesion);

    if (areaSeleccionada) {
        areas = areas.filter(area =>
            String(area.id) === String(areaSeleccionada)
        );
    }

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">No hay áreas disponibles para tus edificios vinculados.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => {
        const estado = obtenerEstadoActualArea(db, area);
        const edificio = obtenerNombreEdificio(db, area.edificioId);

        return `
            <tr>
                <td><strong>${area.nombre}</strong></td>
                <td>${edificio}</td>
                <td>${area.aforo || "-"}</td>
                <td>
                    <span class="badge ${claseEstadoAreaResidente(estado)}">
                        ${formatearEstadoAreaResidente(estado)}
                    </span>
                </td>
                <td>${obtenerDetalleEstadoArea(db, area, estado)}</td>
            </tr>
        `;
    }).join("");
}

/* =========================================================
   MIS RESERVAS
========================================================= */

function renderizarMisReservas(db, sesion) {
    const tabla = document.getElementById("tablaMisReservas");

    if (!tabla) return;

    const reservas = obtenerReservasDelResidente(db, sesion)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7">No tienes reservas registradas.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = reservas.map(reserva => {
        const area = areas.find(a => String(a.id) === String(reserva.areaId));
        const unidad = departamentos.find(d => String(d.id) === String(reserva.departamentoId));
        const edificio = obtenerNombreEdificio(db, reserva.edificioId);
        const estado = obtenerEstadoReservaVisible(reserva);

        return `
            <tr>
                <td>${area?.nombre || "-"}</td>
                <td>${edificio}</td>
                <td>
                    ${unidad?.numero || "-"}<br>
                    <small>${formatearTipoUnidad(normalizarTipoUnidad(unidad?.tipo))}</small>
                </td>
                <td>${formatearFecha(reserva.fecha)}</td>
                <td>
                    <span class="badge ${claseEstadoReservaResidente(estado)}">
                        ${formatearEstadoReservaResidente(estado)}
                    </span>
                </td>
                <td>${reserva.observacion || "-"}</td>
                <td>
                    ${renderizarAccionesReserva(reserva, estado)}
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarAccionesReserva(reserva, estado) {
    if (estado === "finalizada") {
        return `<span class="empty-text">Sin acciones</span>`;
    }

    if (estado === "cancelada") {
        return `<span class="empty-text">Cancelada</span>`;
    }

    if (estado === "rechazada") {
        return `
            <button class="btn btn-blue" onclick="cargarReservaParaEditar('${reserva.id}')">
                Reprogramar
            </button>
        `;
    }

    return `
        <button class="btn btn-blue" onclick="cargarReservaParaEditar('${reserva.id}')">
            Editar
        </button>

        <button class="btn btn-red" onclick="cancelarMiReserva('${reserva.id}')">
            Cancelar
        </button>
    `;
}

/* =========================================================
   EDITAR / CANCELAR
========================================================= */

function cargarReservaParaEditar(id) {
    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    const reserva = obtenerReservasDelResidente(db, sesion).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    const estado = obtenerEstadoReservaVisible(reserva);

    if (!["aprobada", "rechazada"].includes(estado)) {
        alert("Esta reserva ya no puede modificarse.");
        return;
    }

    document.getElementById("reservaId").value = reserva.id;
    document.getElementById("areaReservaResidente").value = reserva.areaId;
    document.getElementById("unidadReservaResidente").value = reserva.departamentoId;
    document.getElementById("fechaReservaResidente").value = reserva.fecha;

    const boton = document.getElementById("btnGuardarReservaResidente");
    if (boton) {
        boton.textContent = estado === "rechazada"
            ? "Reprogramar reserva"
            : "Actualizar reserva";
    }

    renderizarDisponibilidadAreas(db, sesion);
    refrescarCalendarioReservasResidente();

    window.scrollTo({
        top: document.getElementById("formReservaResidente").offsetTop - 80,
        behavior: "smooth"
    });
}

function cancelarMiReserva(id) {
    const confirmar = confirm("¿Deseas cancelar esta reserva? La fecha quedará liberada.");

    if (!confirmar) return;

    const db = obtenerTodo();
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    const reserva = obtenerReservasDelResidente(db, sesion).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada o no pertenece a tus unidades vinculadas.");
        return;
    }

    if (obtenerEstadoReservaVisible(reserva) === "finalizada") {
        alert("No puedes cancelar una reserva finalizada.");
        return;
    }

    reserva.estado = "cancelada";
    reserva.observacion = "Reserva cancelada por el residente.";
    reserva.fechaActualizacion = new Date().toISOString();

    guardarTodo(db);

    limpiarFormularioReserva();
    cargarPaginaReservas();

    alert("Reserva cancelada correctamente.");
}

function limpiarFormularioReserva() {
    const form = document.getElementById("formReservaResidente");
    const reservaId = document.getElementById("reservaId");
    const boton = document.getElementById("btnGuardarReservaResidente");

    if (form) form.reset();
    if (reservaId) reservaId.value = "";

    if (boton) {
        boton.textContent = "Guardar reserva";
    }

    if (calendarioReservaResidenteInstance) {
        calendarioReservaResidenteInstance.clear();
    }
}

/* =========================================================
   CALENDARIO RESIDENTE
========================================================= */

let calendarioReservaResidenteInstance = null;

function inicializarCalendarioReservasResidente() {
    const inputFecha = document.getElementById("fechaReservaResidente");

    if (!inputFecha) return;

    if (typeof flatpickr === "undefined") {
        inputFecha.type = "date";
        inputFecha.min = obtenerFechaHoy();
        return;
    }

    calendarioReservaResidenteInstance = flatpickr(inputFecha, {
        dateFormat: "Y-m-d",
        minDate: "today",
        locale: "es",
        disable: obtenerFechasBloqueadasResidente(),
        onDayCreate: pintarDiasCalendarioResidente,
        onChange: validarFechaSeleccionadaResidente
    });
}

function refrescarCalendarioReservasResidente() {
    if (!calendarioReservaResidenteInstance) return;

    calendarioReservaResidenteInstance.set("disable", obtenerFechasBloqueadasResidente());
    calendarioReservaResidenteInstance.redraw();

    const fechaActual = document.getElementById("fechaReservaResidente")?.value;

    if (fechaActual && fechaBloqueadaResidente(fechaActual)) {
        calendarioReservaResidenteInstance.clear();
        alert("La fecha seleccionada ya no está disponible para esta área.");
    }
}

function obtenerFechasBloqueadasResidente() {
    const areaId = document.getElementById("areaReservaResidente")?.value;

    if (!areaId) return [];

    const db = obtenerTodo();
    const reservaIdEditando = document.getElementById("reservaId")?.value || "";

    const fechasReservadas = (db.reservas || [])
        .filter(reserva =>
            String(reserva.areaId) === String(areaId) &&
            String(reserva.id) !== String(reservaIdEditando) &&
            obtenerEstadoReservaVisible(reserva) === "aprobada"
        )
        .map(reserva => reserva.fecha)
        .filter(Boolean);

    const mantenimientos = (db.mantenimientosAreas || [])
        .filter(m =>
            String(m.areaId) === String(areaId) &&
            normalizarEstadoMantenimiento(m.estado) === "programado"
        )
        .map(m => ({
            from: m.fechaInicio,
            to: m.fechaFin
        }));

    return [
        ...fechasReservadas,
        ...mantenimientos
    ];
}

function pintarDiasCalendarioResidente(_, __, ___, dayElem) {
    const areaId = document.getElementById("areaReservaResidente")?.value;

    if (!areaId) return;

    const fecha = convertirDateAISO(dayElem.dateObj);
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.areaId) === String(areaId) &&
        String(r.fecha) === String(fecha) &&
        obtenerEstadoReservaVisible(r) === "aprobada"
    );

    if (reserva) {
        dayElem.classList.add("calendar-day-reservada");
        dayElem.title = "Fecha reservada";
        return;
    }

    const mantenimiento = (db.mantenimientosAreas || []).find(m =>
        String(m.areaId) === String(areaId) &&
        normalizarEstadoMantenimiento(m.estado) === "programado" &&
        String(fecha) >= String(m.fechaInicio) &&
        String(fecha) <= String(m.fechaFin)
    );

    if (mantenimiento) {
        dayElem.classList.add("calendar-day-mantenimiento");
        dayElem.title = `Mantenimiento: ${formatearMotivoMantenimiento(mantenimiento.motivo)}`;
    }
}

function validarFechaSeleccionadaResidente(_, dateStr) {
    if (!dateStr) return;

    if (fechaBloqueadaResidente(dateStr)) {
        alert("Esta fecha no está disponible. Selecciona otra fecha.");
        calendarioReservaResidenteInstance.clear();
    }
}

function fechaBloqueadaResidente(fecha) {
    const areaId = document.getElementById("areaReservaResidente")?.value;
    const reservaIdEditando = document.getElementById("reservaId")?.value || "";

    if (!areaId || !fecha) return false;

    const db = obtenerTodo();

    const reservada = (db.reservas || []).some(r =>
        String(r.areaId) === String(areaId) &&
        String(r.fecha) === String(fecha) &&
        String(r.id) !== String(reservaIdEditando) &&
        obtenerEstadoReservaVisible(r) === "aprobada"
    );

    if (reservada) return true;

    return existeMantenimientoEnFecha(db, areaId, fecha);
}

/* =========================================================
   EVENTOS
========================================================= */

function configurarFiltroPorArea() {
    const selectArea = document.getElementById("areaReservaResidente");
    const selectUnidad = document.getElementById("unidadReservaResidente");

    if (selectArea) {
        selectArea.addEventListener("change", () => {
            const db = obtenerTodo();
            const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

            renderizarDisponibilidadAreas(db, sesion);
            refrescarCalendarioReservasResidente();
        });
    }

    if (selectUnidad) {
        selectUnidad.addEventListener("change", refrescarCalendarioReservasResidente);
    }
}

/* =========================================================
   RESUMEN
========================================================= */

function cargarResumenReservas(db, sesion) {
    const reservas = obtenerReservasDelResidente(db, sesion);
    const areas = obtenerAreasPermitidasResidente(db, sesion);

    setText("totalAreasDisponiblesResidente", areas.length);
    setText("totalReservasAprobadasResidente", reservas.filter(r => obtenerEstadoReservaVisible(r) === "aprobada").length);
    setText("totalReservasRechazadasResidente", reservas.filter(r => obtenerEstadoReservaVisible(r) === "rechazada").length);
    setText("totalReservasFinalizadasResidente", reservas.filter(r => obtenerEstadoReservaVisible(r) === "finalizada").length);
}

/* =========================================================
   DATOS
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

function obtenerUnidadesPermitidasReserva(db, sesion) {
    const idsUnidades = obtenerIdsUnidadesVinculadas(sesion);

    return (db.departamentos || []).filter(unidad => {
        const vinculada = idsUnidades.includes(String(unidad.id));
        const tipo = normalizarTipoUnidad(unidad.tipo);

        return vinculada && (tipo === "departamento" || tipo === "oficina");
    });
}

function obtenerAreasPermitidasResidente(db, sesion) {
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.areasComunes || []).filter(area => {
        const perteneceEdificio =
            edificiosPermitidos.length === 0 ||
            edificiosPermitidos.includes(String(area.edificioId || ""));

        return perteneceEdificio &&
            normalizarEstadoArea(area.estado) === "disponible";
    });
}

function obtenerReservasDelResidente(db, sesion) {
    const idsUnidades = obtenerIdsUnidadesVinculadas(sesion);
    const edificiosPermitidos = obtenerEdificiosVinculadosSesion(sesion);

    return (db.reservas || []).filter(reserva => {
        const perteneceUnidad = idsUnidades.includes(String(reserva.departamentoId));

        const perteneceEdificio =
            !reserva.edificioId ||
            edificiosPermitidos.includes(String(reserva.edificioId));

        return perteneceUnidad && perteneceEdificio;
    });
}

/* =========================================================
   VALIDACIONES
========================================================= */

function existeFechaReservada(db, areaId, fecha, reservaIdIgnorar = "") {
    return (db.reservas || []).some(reserva =>
        String(reserva.areaId) === String(areaId) &&
        String(reserva.fecha) === String(fecha) &&
        String(reserva.id) !== String(reservaIdIgnorar) &&
        obtenerEstadoReservaVisible(reserva) === "aprobada"
    );
}

function existeMantenimientoEnFecha(db, areaId, fecha) {
    return (db.mantenimientosAreas || []).some(m =>
        String(m.areaId) === String(areaId) &&
        normalizarEstadoMantenimiento(m.estado) === "programado" &&
        String(fecha) >= String(m.fechaInicio) &&
        String(fecha) <= String(m.fechaFin)
    );
}

/* =========================================================
   ESTADOS
========================================================= */

function migrarEstadosReservasResidente() {
    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    db.reservas.forEach(reserva => {
        reserva.estado = normalizarEstadoReserva(reserva.estado || "aprobada");
        reserva.observacion = reserva.observacion || "";
        reserva.motivoRechazo = reserva.motivoRechazo || "";
    });

    guardarTodo(db);
}

function actualizarEstadosReservasFinalizadas(db) {
    const hoy = obtenerFechaHoy();

    let cambio = false;

    (db.reservas || []).forEach(reserva => {
        if (
            normalizarEstadoReserva(reserva.estado) === "aprobada" &&
            String(reserva.fecha) < String(hoy)
        ) {
            reserva.estado = "finalizada";
            reserva.fechaActualizacion = new Date().toISOString();
            cambio = true;
        }
    });

    if (cambio) {
        guardarTodo(db);
    }
}

function obtenerEstadoReservaVisible(reserva) {
    const estado = normalizarEstadoReserva(reserva.estado);

    if (estado === "aprobada" && String(reserva.fecha) < String(obtenerFechaHoy())) {
        return "finalizada";
    }

    return estado;
}

function normalizarEstadoReserva(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "registrada" || valor === "activa") return "aprobada";
    if (valor === "aprobada") return "aprobada";
    if (valor === "rechazada") return "rechazada";
    if (valor === "cancelada") return "cancelada";
    if (valor === "finalizada") return "finalizada";

    return "aprobada";
}

function normalizarEstadoArea(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "bloqueada") return "bloqueada";
    if (valor === "no_disponible") return "bloqueada";
    if (valor === "no disponible") return "bloqueada";

    return "disponible";
}

function normalizarEstadoMantenimiento(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "programado") return "programado";
    if (valor === "finalizado") return "finalizado";
    if (valor === "cancelado") return "cancelado";

    return "programado";
}

function obtenerEstadoActualArea(db, area) {
    const hoy = obtenerFechaHoy();

    const mantenimiento = existeMantenimientoEnFecha(db, area.id, hoy);

    if (mantenimiento) {
        return "mantenimiento";
    }

    const reservaHoy = (db.reservas || []).some(r =>
        String(r.areaId) === String(area.id) &&
        String(r.fecha) === String(hoy) &&
        obtenerEstadoReservaVisible(r) === "aprobada"
    );

    if (reservaHoy) {
        return "reservada";
    }

    return normalizarEstadoArea(area.estado);
}

/* =========================================================
   FORMATEADORES
========================================================= */

function formatearEstadoReservaResidente(estado) {
    const estados = {
        aprobada: "Aprobada",
        rechazada: "Rechazada",
        cancelada: "Cancelada",
        finalizada: "Finalizada"
    };

    return estados[estado] || "Aprobada";
}

function claseEstadoReservaResidente(estado) {
    if (estado === "aprobada") return "vacio";
    if (estado === "rechazada") return "ocupado";
    if (estado === "cancelada") return "inactivo";
    if (estado === "finalizada") return "badge-blue";

    return "vacio";
}

function formatearEstadoAreaResidente(estado) {
    const estados = {
        disponible: "Disponible",
        reservada: "Reservada hoy",
        mantenimiento: "Mantenimiento",
        bloqueada: "Bloqueada"
    };

    return estados[estado] || "Disponible";
}

function claseEstadoAreaResidente(estado) {
    if (estado === "disponible") return "vacio";
    if (estado === "mantenimiento") return "pendiente";
    if (estado === "reservada") return "inactivo";
    if (estado === "bloqueada") return "ocupado";

    return "vacio";
}

function obtenerDetalleEstadoArea(db, area, estado) {
    if (estado === "mantenimiento") {
        const mantenimiento = (db.mantenimientosAreas || []).find(m =>
            String(m.areaId) === String(area.id) &&
            normalizarEstadoMantenimiento(m.estado) === "programado"
        );

        return `
            En mantenimiento hasta ${formatearFecha(mantenimiento?.fechaFin)}.
        `;
    }

    if (estado === "reservada") {
        return "Reservada para el día de hoy.";
    }

    if (estado === "bloqueada") {
        return "Área no disponible temporalmente.";
    }

    return "Disponible para nueva reserva.";
}

function normalizarTipoUnidad(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "oficina" || valor === "local") return "oficina";
    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";

    return "departamento";
}

function formatearTipoUnidad(tipo) {
    const tipos = {
        departamento: "Departamento",
        oficina: "Oficina / Local",
        estacionamiento: "Estacionamiento",
        deposito: "Depósito"
    };

    return tipos[tipo] || "Departamento";
}

function formatearMotivoMantenimiento(motivo) {
    const motivos = {
        limpieza_profunda: "Limpieza profunda",
        reparacion: "Reparación",
        fumigacion: "Fumigación",
        inspeccion: "Inspección técnica",
        mejora: "Mejora del ambiente",
        otro: "Otro"
    };

    return motivos[motivo] || "Mantenimiento";
}

function formatearFecha(fecha) {
    if (!fecha) return "-";

    const partes = String(fecha).split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}

/* =========================================================
   HELPERS
========================================================= */

function configurarFechaMinima() {
    const inputFecha = document.getElementById("fechaReservaResidente");

    if (!inputFecha) return;

    inputFecha.min = obtenerFechaHoy();
}

function obtenerFechaHoy() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function convertirDateAISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function obtenerNombreEdificio(db, edificioId) {
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    );

    return edificio ? edificio.nombre : "-";
}

function setText(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function generarIdReservaResidente() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}