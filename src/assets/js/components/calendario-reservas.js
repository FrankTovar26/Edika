/* =========================================================
   CALENDARIO RESERVAS - EDIFIKA
   Requiere Flatpickr
========================================================= */

let calendarioReservaInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    inicializarCalendarioReservas();
    escucharCambiosCalendarioReservas();
});

function inicializarCalendarioReservas() {
    const inputFecha = document.getElementById("fechaReserva");

    if (!inputFecha) return;

    if (typeof flatpickr === "undefined") {
        console.warn("Flatpickr no está cargado. Se usará input date normal.");
        return;
    }

    calendarioReservaInstance = flatpickr(inputFecha, {
        dateFormat: "Y-m-d",
        minDate: "today",
        locale: "es",
        disable: obtenerFechasBloqueadasCalendario(),
        onDayCreate: pintarDiasCalendario,
        onChange: validarFechaSeleccionadaCalendario
    });
}

function escucharCambiosCalendarioReservas() {
    const areaReserva = document.getElementById("areaReserva");
    const edificioArea = document.getElementById("edificioArea");

    if (areaReserva) {
        areaReserva.addEventListener("change", refrescarCalendarioReservas);
    }

    if (edificioArea) {
        edificioArea.addEventListener("change", refrescarCalendarioReservas);
    }
}

function refrescarCalendarioReservas() {
    if (!calendarioReservaInstance) return;

    calendarioReservaInstance.set("disable", obtenerFechasBloqueadasCalendario());
    calendarioReservaInstance.redraw();

    const fechaActual = document.getElementById("fechaReserva")?.value;

    if (fechaActual && fechaBloqueadaCalendario(fechaActual)) {
        calendarioReservaInstance.clear();
        alert("La fecha seleccionada ya no está disponible para esta área.");
    }
}

/* =========================================================
   FECHAS BLOQUEADAS
========================================================= */

function obtenerFechasBloqueadasCalendario() {
    const areaId = document.getElementById("areaReserva")?.value;

    if (!areaId) return [];

    const db = obtenerTodo();

    const fechasReservadas = obtenerFechasReservadasCalendario(db, areaId);
    const rangosMantenimiento = obtenerRangosMantenimientoCalendario(db, areaId);

    return [
        ...fechasReservadas,
        ...rangosMantenimiento
    ];
}

function obtenerFechasReservadasCalendario(db, areaId) {
    return (db.reservas || [])
        .filter(reserva =>
            String(reserva.areaId) === String(areaId) &&
            normalizarEstadoReservaCalendario(reserva.estado) === "aprobada"
        )
        .map(reserva => reserva.fecha)
        .filter(Boolean);
}

function obtenerRangosMantenimientoCalendario(db, areaId) {
    return (db.mantenimientosAreas || [])
        .filter(mantenimiento =>
            String(mantenimiento.areaId) === String(areaId) &&
            normalizarEstadoMantenimientoCalendario(mantenimiento.estado) === "programado"
        )
        .map(mantenimiento => ({
            from: mantenimiento.fechaInicio,
            to: mantenimiento.fechaFin
        }));
}

function fechaBloqueadaCalendario(fecha) {
    const areaId = document.getElementById("areaReserva")?.value;

    if (!areaId || !fecha) return false;

    const db = obtenerTodo();

    const reservada = (db.reservas || []).some(reserva =>
        String(reserva.areaId) === String(areaId) &&
        String(reserva.fecha) === String(fecha) &&
        normalizarEstadoReservaCalendario(reserva.estado) === "aprobada"
    );

    if (reservada) return true;

    const mantenimiento = (db.mantenimientosAreas || []).some(item =>
        String(item.areaId) === String(areaId) &&
        normalizarEstadoMantenimientoCalendario(item.estado) === "programado" &&
        String(fecha) >= String(item.fechaInicio) &&
        String(fecha) <= String(item.fechaFin)
    );

    return mantenimiento;
}

/* =========================================================
   COLORES EN CALENDARIO
========================================================= */

function pintarDiasCalendario(_, __, ___, dayElem) {
    const areaId = document.getElementById("areaReserva")?.value;

    if (!areaId) return;

    const fecha = convertirDateAISOCalendario(dayElem.dateObj);
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(item =>
        String(item.areaId) === String(areaId) &&
        String(item.fecha) === String(fecha) &&
        normalizarEstadoReservaCalendario(item.estado) === "aprobada"
    );

    if (reserva) {
        dayElem.classList.add("calendar-day-reservada");
        dayElem.title = "Fecha reservada";
        return;
    }

    const mantenimiento = (db.mantenimientosAreas || []).find(item =>
        String(item.areaId) === String(areaId) &&
        normalizarEstadoMantenimientoCalendario(item.estado) === "programado" &&
        String(fecha) >= String(item.fechaInicio) &&
        String(fecha) <= String(item.fechaFin)
    );

    if (mantenimiento) {
        dayElem.classList.add("calendar-day-mantenimiento");
        dayElem.title = `Mantenimiento: ${formatearMotivoCalendario(mantenimiento.motivo)}`;
    }
}

/* =========================================================
   VALIDACIÓN
========================================================= */

function validarFechaSeleccionadaCalendario(selectedDates, dateStr) {
    if (!dateStr) return;

    if (fechaBloqueadaCalendario(dateStr)) {
        alert("Esta fecha no está disponible. Selecciona otra fecha.");
        calendarioReservaInstance.clear();
    }
}

/* =========================================================
   HELPERS
========================================================= */

function convertirDateAISOCalendario(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function normalizarEstadoReservaCalendario(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "registrada" || valor === "activa") return "aprobada";
    if (valor === "aprobada") return "aprobada";
    if (valor === "rechazada") return "rechazada";
    if (valor === "cancelada") return "cancelada";
    if (valor === "finalizada") return "finalizada";

    return "aprobada";
}

function normalizarEstadoMantenimientoCalendario(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "programado") return "programado";
    if (valor === "finalizado") return "finalizado";
    if (valor === "cancelado") return "cancelado";

    return "programado";
}

function formatearMotivoCalendario(motivo) {
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