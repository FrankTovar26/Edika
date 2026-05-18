/* =========================================================
   INCIDENCIAS SERVICE - EDIFIKA
   Maneja incidencias, estados, historial y notificaciones
========================================================= */

/* =========================
   HELPERS BASE
========================= */

function generarIdIncidenciaService() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function obtenerSesionIncidenciaService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function fechaHoyIncidenciaService() {
    return new Date().toISOString().split("T")[0];
}

function fechaHoraIncidenciaService() {
    return new Date().toISOString();
}

/* =========================
   INICIALIZACIÓN
========================= */

function inicializarIncidenciasService() {
    const db = obtenerTodo();

    db.incidencias = db.incidencias || [];
    db.anuncios = db.anuncios || [];

    db.incidencias.forEach(incidencia => {
        incidencia.estado = normalizarEstadoIncidencia(incidencia.estado);
        incidencia.prioridad = normalizarPrioridadIncidencia(incidencia.prioridad);
        incidencia.historial = incidencia.historial || [];
        incidencia.foto = incidencia.foto || "";
        incidencia.observacionAdmin = incidencia.observacionAdmin || "";
    });

    guardarTodo(db);

    return db.incidencias;
}

/* =========================
   CREAR INCIDENCIA
========================= */

function crearIncidencia(datos) {
    const db = obtenerTodo();
    const sesion = obtenerSesionIncidenciaService();

    db.incidencias = db.incidencias || [];

    if (!sesion) {
        return {
            ok: false,
            error: "No hay sesión activa."
        };
    }

    if (!datos.edificioId) {
        return {
            ok: false,
            error: "Debe seleccionar un edificio."
        };
    }

    if (!datos.unidadId) {
        return {
            ok: false,
            error: "Debe seleccionar una unidad vinculada."
        };
    }

    if (!datos.categoria) {
        return {
            ok: false,
            error: "Debe seleccionar una categoría."
        };
    }

    if (!datos.titulo || !datos.titulo.trim()) {
        return {
            ok: false,
            error: "Debe ingresar un título para la incidencia."
        };
    }

    if (!datos.descripcion || !datos.descripcion.trim()) {
        return {
            ok: false,
            error: "Debe ingresar una descripción."
        };
    }

    if (!datos.ubicacion || !datos.ubicacion.trim()) {
        return {
            ok: false,
            error: "Debe ingresar la ubicación del problema."
        };
    }

    const incidencia = {
        id: generarIdIncidenciaService(),

        edificioId: datos.edificioId,
        unidadId: datos.unidadId,

        reportadoPor: sesion.id || "",
        reportadoPorNombre: sesion.nombre || sesion.nombres || "Residente",

        categoria: normalizarCategoriaIncidencia(datos.categoria),
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        ubicacion: datos.ubicacion.trim(),

        prioridad: normalizarPrioridadIncidencia(datos.prioridad || "media"),
        estado: "abierta",

        foto: datos.foto || "",

        observacionAdmin: "",

        fechaRegistro: fechaHoraIncidenciaService(),
        fechaActualizacion: fechaHoraIncidenciaService(),

        historial: [
            {
                id: generarIdIncidenciaService(),
                estado: "abierta",
                observacion: "Incidencia registrada por el residente.",
                usuarioId: sesion.id || "",
                usuarioNombre: sesion.nombre || sesion.nombres || "Residente",
                fecha: fechaHoraIncidenciaService()
            }
        ]
    };

    db.incidencias.push(incidencia);

    guardarTodo(db);

    return {
        ok: true,
        incidencia
    };
}

/* =========================
   ACTUALIZAR ESTADO
========================= */

function actualizarEstadoIncidencia(id, nuevoEstado, observacion = "") {
    const db = obtenerTodo();
    const sesion = obtenerSesionIncidenciaService();

    db.incidencias = db.incidencias || [];

    const incidencia = db.incidencias.find(item =>
        String(item.id) === String(id)
    );

    if (!incidencia) {
        return {
            ok: false,
            error: "Incidencia no encontrada."
        };
    }

    const estadoNormalizado = normalizarEstadoIncidencia(nuevoEstado);

    if (!estadoNormalizado) {
        return {
            ok: false,
            error: "Estado inválido."
        };
    }

    if (!observacion || !observacion.trim()) {
        return {
            ok: false,
            error: "Debe ingresar una observación para cambiar el estado."
        };
    }

    const estadoActual = normalizarEstadoIncidencia(incidencia.estado);

    if (estadoActual === "resuelta") {
        return {
            ok: false,
            error: "Una incidencia resuelta no puede modificarse."
        };
    }

    incidencia.estado = estadoNormalizado;
    incidencia.observacionAdmin = observacion.trim();
    incidencia.fechaActualizacion = fechaHoraIncidenciaService();

    incidencia.historial = incidencia.historial || [];

    incidencia.historial.push({
        id: generarIdIncidenciaService(),
        estado: estadoNormalizado,
        observacion: observacion.trim(),
        usuarioId: sesion?.id || "sistema",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Administración",
        fecha: fechaHoraIncidenciaService()
    });

    crearNotificacionCambioEstadoIncidencia(db, incidencia, observacion.trim());

    guardarTodo(db);

    return {
        ok: true,
        incidencia
    };
}

/* =========================
   CANCELAR / RECHAZAR
========================= */

function rechazarIncidencia(id, observacion) {
    return actualizarEstadoIncidencia(id, "rechazada", observacion);
}

function cancelarIncidencia(id, observacion = "Incidencia cancelada por el residente.") {
    const db = obtenerTodo();
    const sesion = obtenerSesionIncidenciaService();

    const incidencia = (db.incidencias || []).find(item =>
        String(item.id) === String(id)
    );

    if (!incidencia) {
        return {
            ok: false,
            error: "Incidencia no encontrada."
        };
    }

    const estadoActual = normalizarEstadoIncidencia(incidencia.estado);

    if (estadoActual === "resuelta") {
        return {
            ok: false,
            error: "No puedes cancelar una incidencia ya resuelta."
        };
    }

    incidencia.estado = "cancelada";
    incidencia.observacionAdmin = observacion;
    incidencia.fechaActualizacion = fechaHoraIncidenciaService();

    incidencia.historial = incidencia.historial || [];

    incidencia.historial.push({
        id: generarIdIncidenciaService(),
        estado: "cancelada",
        observacion,
        usuarioId: sesion?.id || "",
        usuarioNombre: sesion?.nombre || sesion?.nombres || "Residente",
        fecha: fechaHoraIncidenciaService()
    });

    guardarTodo(db);

    return {
        ok: true,
        incidencia
    };
}

/* =========================
   CONSULTAS
========================= */

function obtenerIncidencias() {
    const db = obtenerTodo();

    db.incidencias = db.incidencias || [];

    return db.incidencias;
}

function obtenerIncidenciaPorId(id) {
    return obtenerIncidencias().find(item =>
        String(item.id) === String(id)
    );
}

function obtenerIncidenciasPorEdificio(edificioId) {
    return obtenerIncidencias().filter(item =>
        String(item.edificioId || "") === String(edificioId || "")
    );
}

function obtenerIncidenciasPorUsuario(usuarioId) {
    return obtenerIncidencias().filter(item =>
        String(item.reportadoPor || "") === String(usuarioId || "")
    );
}

function obtenerIncidenciasPorUnidad(unidadId) {
    return obtenerIncidencias().filter(item =>
        String(item.unidadId || "") === String(unidadId || "")
    );
}

/* =========================
   PERMISOS / VISIBILIDAD
========================= */

function obtenerIncidenciasVisiblesAdmin() {
    const db = obtenerTodo();
    const sesion = obtenerSesionIncidenciaService();

    if (!sesion) return [];

    const incidencias = db.incidencias || [];

    if (sesion.rol === "superadmin") {
        return incidencias;
    }

    if (sesion.rol === "admin") {
        const edificiosPermitidos = obtenerEdificiosPermitidosIncidencias(sesion);

        return incidencias.filter(item =>
            edificiosPermitidos.includes(String(item.edificioId || ""))
        );
    }

    return [];
}

function obtenerIncidenciasVisiblesResidente() {
    const db = obtenerTodo();
    const sesion = obtenerSesionIncidenciaService();

    if (!sesion) return [];

    const idsUnidades = obtenerIdsUnidadesIncidencias(sesion);

    return (db.incidencias || []).filter(item =>
        String(item.reportadoPor || "") === String(sesion.id || "") ||
        idsUnidades.includes(String(item.unidadId || ""))
    );
}

function obtenerEdificiosPermitidosIncidencias(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function obtenerIdsUnidadesIncidencias(sesion) {
    const ids = [];

    if (sesion?.departamentoId) {
        ids.push(String(sesion.departamentoId));
    }

    const unidades = sesion?.unidadesAutorizadas || [];

    unidades.forEach(unidad => {
        if (unidad.unidadId) {
            ids.push(String(unidad.unidadId));
        }
    });

    return [...new Set(ids)];
}

/* =========================
   NOTIFICACIONES / ANUNCIOS
========================= */

function crearNotificacionCambioEstadoIncidencia(db, incidencia, observacion) {
    db.anuncios = db.anuncios || [];

    db.anuncios.push({
        id: generarIdIncidenciaService(),

        tipo: "incidencia_estado",

        titulo: "Actualización de incidencia",

        mensaje:
            `Tu incidencia "${incidencia.titulo}" cambió a ` +
            `"${formatearEstadoIncidencia(incidencia.estado)}". ` +
            `Observación: ${observacion}`,

        edificioId: incidencia.edificioId,
        unidadId: incidencia.unidadId,

        destinatarioUsuarioId: incidencia.reportadoPor || "",

        alcance: "usuario",

        prioridad: incidencia.estado === "resuelta" ? "normal" : "alta",

        fechaPublicacion: fechaHoyIncidenciaService(),
        fechaRegistro: fechaHoraIncidenciaService(),

        creadoPor: obtenerSesionIncidenciaService()?.id || "sistema",

        estado: "publicado"
    });
}

/* =========================
   ESTADÍSTICAS
========================= */

function obtenerMetricasIncidenciasAdmin() {
    const incidencias = obtenerIncidenciasVisiblesAdmin();

    return calcularMetricasIncidencias(incidencias);
}

function obtenerMetricasIncidenciasResidente() {
    const incidencias = obtenerIncidenciasVisiblesResidente();

    return calcularMetricasIncidencias(incidencias);
}

function calcularMetricasIncidencias(incidencias) {
    return {
        total: incidencias.length,
        abiertas: incidencias.filter(i => normalizarEstadoIncidencia(i.estado) === "abierta").length,
        enRevision: incidencias.filter(i => normalizarEstadoIncidencia(i.estado) === "en_revision").length,
        enProceso: incidencias.filter(i => normalizarEstadoIncidencia(i.estado) === "en_proceso").length,
        resueltas: incidencias.filter(i => normalizarEstadoIncidencia(i.estado) === "resuelta").length,
        rechazadas: incidencias.filter(i => normalizarEstadoIncidencia(i.estado) === "rechazada").length,
        canceladas: incidencias.filter(i => normalizarEstadoIncidencia(i.estado) === "cancelada").length,
        urgentes: incidencias.filter(i => normalizarPrioridadIncidencia(i.prioridad) === "urgente").length
    };
}

/* =========================
   NORMALIZADORES
========================= */

function normalizarCategoriaIncidencia(categoria) {
    const valor = String(categoria || "").toLowerCase().trim();

    if (valor === "plomeria" || valor === "plomería") return "plomeria";
    if (valor === "electrico" || valor === "eléctrico") return "electrico";
    if (valor === "estructural") return "estructural";
    if (valor === "limpieza") return "limpieza";
    if (valor === "seguridad") return "seguridad";
    if (valor === "ascensores" || valor === "ascensor") return "ascensores";
    if (valor === "areas_comunes" || valor === "áreas comunes" || valor === "areas comunes") return "areas_comunes";
    if (valor === "ruido" || valor === "convivencia" || valor === "ruido_convivencia") return "ruido_convivencia";

    return "otro";
}

function normalizarPrioridadIncidencia(prioridad) {
    const valor = String(prioridad || "").toLowerCase().trim();

    if (valor === "baja") return "baja";
    if (valor === "media") return "media";
    if (valor === "alta") return "alta";
    if (valor === "urgente") return "urgente";

    return "media";
}

function normalizarEstadoIncidencia(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "abierta" || valor === "abierto") return "abierta";
    if (valor === "revision" || valor === "revisión" || valor === "en_revision" || valor === "en revisión") return "en_revision";
    if (valor === "proceso" || valor === "en_proceso" || valor === "en proceso") return "en_proceso";
    if (valor === "resuelta" || valor === "resuelto") return "resuelta";
    if (valor === "rechazada" || valor === "rechazado") return "rechazada";
    if (valor === "cancelada" || valor === "cancelado") return "cancelada";

    return "abierta";
}

/* =========================
   FORMATEADORES
========================= */

function formatearCategoriaIncidencia(categoria) {
    const categorias = {
        plomeria: "Plomería",
        electrico: "Eléctrico",
        estructural: "Estructural",
        limpieza: "Limpieza",
        seguridad: "Seguridad",
        ascensores: "Ascensores",
        areas_comunes: "Áreas comunes",
        ruido_convivencia: "Ruido / convivencia",
        otro: "Otro"
    };

    return categorias[normalizarCategoriaIncidencia(categoria)] || "Otro";
}

function formatearPrioridadIncidencia(prioridad) {
    const prioridades = {
        baja: "Baja",
        media: "Media",
        alta: "Alta",
        urgente: "Urgente"
    };

    return prioridades[normalizarPrioridadIncidencia(prioridad)] || "Media";
}

function formatearEstadoIncidencia(estado) {
    const estados = {
        abierta: "Abierta",
        en_revision: "En revisión",
        en_proceso: "En proceso",
        resuelta: "Resuelta",
        rechazada: "Rechazada",
        cancelada: "Cancelada"
    };

    return estados[normalizarEstadoIncidencia(estado)] || "Abierta";
}

function formatearFechaIncidencia(fecha) {
    if (!fecha) return "-";

    const fechaBase = String(fecha).split("T")[0];
    const partes = fechaBase.split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}

/* =========================
   CLASES CSS
========================= */

function claseEstadoIncidencia(estado) {
    const valor = normalizarEstadoIncidencia(estado);

    if (valor === "abierta") return "pendiente";
    if (valor === "en_revision") return "badge-blue";
    if (valor === "en_proceso") return "badge-purple";
    if (valor === "resuelta") return "vacio";
    if (valor === "rechazada") return "ocupado";
    if (valor === "cancelada") return "inactivo";

    return "pendiente";
}

function clasePrioridadIncidencia(prioridad) {
    const valor = normalizarPrioridadIncidencia(prioridad);

    if (valor === "baja") return "vacio";
    if (valor === "media") return "badge-blue";
    if (valor === "alta") return "pendiente";
    if (valor === "urgente") return "ocupado";

    return "badge-blue";
}