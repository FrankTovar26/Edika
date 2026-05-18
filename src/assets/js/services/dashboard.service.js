/* =========================================================
   DASHBOARD SERVICE - EDIFIKA
========================================================= */

function obtenerMetricasDashboard() {
    const db = obtenerTodo();
    const sesion = obtenerSesionDashboardService();

    const edificios = obtenerEdificiosVisiblesDashboardService(db, sesion);
    const edificiosIds = edificios.map(e => String(e.id));

    const unidades = obtenerUnidadesDashboardService(db)
        .filter(unidad => edificiosIds.includes(String(unidad.edificioId)));

    const reservas = (db.reservas || [])
        .filter(reserva => edificiosIds.includes(String(reserva.edificioId || "")));

    const mantenimientos = (db.mantenimientosAreas || [])
        .filter(mantenimiento => edificiosIds.includes(String(mantenimiento.edificioId || "")));

    const anuncios = (db.anuncios || [])
        .filter(anuncio => edificiosIds.includes(String(anuncio.edificioId || "")));

    return {
        edificios,
        unidades,
        reservas,
        mantenimientos,
        anuncios,

        totalEdificios: edificios.length,
        totalUnidades: unidades.length,

        totalDepartamentos: contarPorTipoUnidadDashboard(unidades, "departamento"),
        totalEstacionamientos: contarPorTipoUnidadDashboard(unidades, "estacionamiento"),
        totalDepositos: contarPorTipoUnidadDashboard(unidades, "deposito"),
        totalOficinas: contarPorTipoUnidadDashboard(unidades, "oficina"),

        unidadesOcupadas: unidades.filter(u => obtenerEstadoRealUnidadDashboardService(u) === "ocupada").length,
        unidadesDisponibles: unidades.filter(u => obtenerEstadoRealUnidadDashboardService(u) === "disponible").length,
        unidadesMantenimiento: unidades.filter(u => obtenerEstadoRealUnidadDashboardService(u) === "mantenimiento").length,

        reservasAprobadas: reservas.filter(r => normalizarEstadoReservaDashboard(r.estado) === "aprobada").length,
        reservasRechazadas: reservas.filter(r => normalizarEstadoReservaDashboard(r.estado) === "rechazada").length,
        reservasCanceladas: reservas.filter(r => normalizarEstadoReservaDashboard(r.estado) === "cancelada").length,

        mantenimientosProgramados: mantenimientos.filter(m => normalizarEstadoMantenimientoDashboard(m.estado) === "programado").length,

        anunciosPublicados: anuncios.filter(a => a.estado === "publicado").length
    };
}

function obtenerResumenEdificiosDashboard() {
    const metricas = obtenerMetricasDashboard();

    return metricas.edificios.map(edificio => {
        const unidades = metricas.unidades.filter(unidad =>
            String(unidad.edificioId) === String(edificio.id)
        );

        const reservas = metricas.reservas.filter(reserva =>
            String(reserva.edificioId || "") === String(edificio.id)
        );

        const mantenimientos = metricas.mantenimientos.filter(mantenimiento =>
            String(mantenimiento.edificioId || "") === String(edificio.id)
        );

        const ocupadas = unidades.filter(u =>
            obtenerEstadoRealUnidadDashboardService(u) === "ocupada"
        ).length;

        const disponibles = unidades.filter(u =>
            obtenerEstadoRealUnidadDashboardService(u) === "disponible"
        ).length;

        const mantenimiento = unidades.filter(u =>
            obtenerEstadoRealUnidadDashboardService(u) === "mantenimiento"
        ).length;

        const porcentajeOcupacion = unidades.length > 0
            ? Math.round((ocupadas / unidades.length) * 100)
            : 0;

        return {
            edificioId: edificio.id,
            nombre: edificio.nombre,
            activo: edificio.activo !== false,

            totalUnidades: unidades.length,
            departamentos: contarPorTipoUnidadDashboard(unidades, "departamento"),
            estacionamientos: contarPorTipoUnidadDashboard(unidades, "estacionamiento"),
            depositos: contarPorTipoUnidadDashboard(unidades, "deposito"),
            oficinas: contarPorTipoUnidadDashboard(unidades, "oficina"),

            ocupadas,
            disponibles,
            mantenimiento,
            porcentajeOcupacion,

            reservasAprobadas: reservas.filter(r => normalizarEstadoReservaDashboard(r.estado) === "aprobada").length,
            mantenimientosProgramados: mantenimientos.filter(m => normalizarEstadoMantenimientoDashboard(m.estado) === "programado").length
        };
    });
}

function obtenerAlertasDashboard() {
    const db = obtenerTodo();
    const metricas = obtenerMetricasDashboard();
    const hoy = obtenerFechaHoyDashboardService();

    const alertas = [];

    const mantenimientosHoy = metricas.mantenimientos.filter(m =>
        normalizarEstadoMantenimientoDashboard(m.estado) === "programado" &&
        String(hoy) >= String(m.fechaInicio) &&
        String(hoy) <= String(m.fechaFin)
    );

    mantenimientosHoy.forEach(m => {
        const area = (db.areasComunes || []).find(a =>
            String(a.id) === String(m.areaId)
        );

        alertas.push({
            tipo: "mantenimiento",
            prioridad: "alta",
            titulo: "Mantenimiento activo",
            mensaje: `${area?.nombre || "Un área común"} está en mantenimiento hoy.`
        });
    });

    const reservasHoy = metricas.reservas.filter(r =>
        normalizarEstadoReservaDashboard(r.estado) === "aprobada" &&
        String(r.fecha) === String(hoy)
    );

    if (reservasHoy.length > 0) {
        alertas.push({
            tipo: "reservas",
            prioridad: "normal",
            titulo: "Reservas para hoy",
            mensaje: `Hay ${reservasHoy.length} reserva(s) aprobada(s) para hoy.`
        });
    }

    return alertas;
}

function obtenerUnidadesDashboardService(db) {
    const unidadesBase = [];

    (db.departamentos || []).forEach(unidad => {
        unidadesBase.push(normalizarUnidadDashboardService(unidad));
    });

    (db.unidadesGeneradas || []).forEach(unidad => {
        unidadesBase.push(normalizarUnidadDashboardService(unidad));
    });

    const mapa = new Map();

    unidadesBase.forEach(unidad => {
        if (!unidad.edificioId) return;

        const clave = `${unidad.edificioId}_${unidad.numero}_${unidad.tipo}`;

        if (!mapa.has(clave)) {
            mapa.set(clave, unidad);
            return;
        }

        const existente = mapa.get(clave);

        mapa.set(clave, {
            ...unidad,
            ...existente,
            id: existente.id || unidad.id,
            numero: existente.numero || unidad.numero,
            codigo: existente.codigo || unidad.codigo,
            edificioId: existente.edificioId || unidad.edificioId
        });
    });

    return Array.from(mapa.values());
}

function normalizarUnidadDashboardService(unidad) {
    const numero = unidad.numero || unidad.codigo || unidad.nombre || "-";
    const tipo = normalizarTipoUnidadDashboard(unidad.tipo);

    return {
        ...unidad,
        id: unidad.id || `${unidad.edificioId || "sin-edificio"}_${numero}_${tipo}`,
        edificioId: unidad.edificioId || "",
        numero,
        codigo: unidad.codigo || numero,
        piso: unidad.piso || unidad.ubicacion || "",
        tipo,
        estado: unidad.estado || "disponible",
        autorizados: unidad.autorizados || []
    };
}

function obtenerEstadoRealUnidadDashboardService(unidad) {
    const estadoManual = normalizarEstadoUnidadDashboard(unidad.estado);

    if (estadoManual === "mantenimiento" || estadoManual === "inactiva") {
        return estadoManual;
    }

    const propietarioAceptado =
        unidad.emailPropietario && unidad.estadoInvitacion === "aceptada";

    const inquilinoAceptado =
        unidad.emailInquilino && unidad.estadoInquilino === "aceptada";

    const autorizadoAceptado = (unidad.autorizados || []).some(a =>
        a.estado === "aceptada"
    );

    if (propietarioAceptado || inquilinoAceptado || autorizadoAceptado) {
        return "ocupada";
    }

    return "disponible";
}

function obtenerEdificiosVisiblesDashboardService(db, sesion) {
    if (!sesion) return [];

    const edificios = db.edificios || [];

    if (sesion.rol === "superadmin") {
        return edificios.filter(edificio => edificio.activo !== false);
    }

    if (sesion.rol === "admin") {
        const asignados = obtenerIdsEdificiosAsignadosDashboardService(sesion);

        return edificios.filter(edificio =>
            edificio.activo !== false &&
            asignados.includes(String(edificio.id))
        );
    }

    return [];
}

function obtenerIdsEdificiosAsignadosDashboardService(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function contarPorTipoUnidadDashboard(unidades, tipo) {
    return unidades.filter(unidad =>
        normalizarTipoUnidadDashboard(unidad.tipo) === tipo
    ).length;
}

function normalizarTipoUnidadDashboard(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}

function normalizarEstadoUnidadDashboard(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "ocupada" || valor === "ocupado") return "ocupada";
    if (valor === "mantenimiento" || valor === "en mantenimiento") return "mantenimiento";
    if (valor === "inactiva" || valor === "inactivo") return "inactiva";

    return "disponible";
}

function normalizarEstadoReservaDashboard(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "registrada" || valor === "activa") return "aprobada";
    if (valor === "aprobada") return "aprobada";
    if (valor === "rechazada") return "rechazada";
    if (valor === "cancelada") return "cancelada";

    return "aprobada";
}

function normalizarEstadoMantenimientoDashboard(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "programado") return "programado";
    if (valor === "finalizado") return "finalizado";
    if (valor === "cancelado") return "cancelado";

    return "programado";
}

function obtenerSesionDashboardService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function obtenerFechaHoyDashboardService() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}