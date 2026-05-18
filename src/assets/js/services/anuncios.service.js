/* =========================================================
   ANUNCIOS SERVICE - EDIFIKA
========================================================= */

/* =========================
   HELPERS
========================= */

function generarIdAnuncioService() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

function obtenerSesionAnuncioService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function fechaHoyAnuncioService() {
    return new Date().toISOString().split("T")[0];
}

function fechaHoraActualAnuncioService() {
    return new Date().toISOString();
}

/* =========================
   CREAR ANUNCIO GENERAL
========================= */

function crearAnuncioGeneral(datos) {
    const db = obtenerTodo();

    db.anuncios = db.anuncios || [];

    if (!datos.titulo || !datos.mensaje) {
        return {
            ok: false,
            error: "El anuncio debe tener título y mensaje."
        };
    }

    const anuncio = {
        id: generarIdAnuncioService(),

        tipo: datos.tipo || "general",

        titulo: datos.titulo.trim(),
        mensaje: datos.mensaje.trim(),

        edificioId: datos.edificioId || "",

        alcance: datos.alcance || "residentes_edificio",

        destinatarioUsuarioId: datos.destinatarioUsuarioId || "",
        unidadId: datos.unidadId || "",

        prioridad: datos.prioridad || "normal",

        estado: "publicado",

        fechaPublicacion: datos.fechaPublicacion || fechaHoyAnuncioService(),

        fechaExpiracion: datos.fechaExpiracion || "",

        creadoPor: obtenerSesionAnuncioService()?.id || "sistema",

        fechaRegistro: fechaHoraActualAnuncioService()
    };

    db.anuncios.push(anuncio);

    guardarTodo(db);

    return {
        ok: true,
        anuncio
    };
}

/* =========================
   ANUNCIO PRIVADO
========================= */

function crearAnuncioPrivado(datos) {
    return crearAnuncioGeneral({
        ...datos,
        alcance: "usuario"
    });
}

/* =========================
   ANUNCIO PARA EDIFICIO
========================= */

function crearAnuncioEdificio(datos) {
    return crearAnuncioGeneral({
        ...datos,
        alcance: "residentes_edificio"
    });
}

/* =========================
   ANUNCIO RECHAZO RESERVA
========================= */

function crearAnuncioReservaRechazada(datos) {
    const mensaje =
        datos.mensaje ||
        `Tu reserva para ${datos.areaNombre || "el área común"} fue rechazada.`;

    return crearAnuncioPrivado({
        tipo: "reserva_rechazada",

        titulo: "Reserva rechazada",

        mensaje,

        edificioId: datos.edificioId,

        unidadId: datos.unidadId || "",

        destinatarioUsuarioId: datos.destinatarioUsuarioId || "",

        prioridad: "alta"
    });
}

/* =========================
   ANUNCIO MANTENIMIENTO
========================= */

function crearAnuncioMantenimiento(datos) {
    return crearAnuncioEdificio({
        tipo: "mantenimiento_area",

        titulo: datos.titulo || "Mantenimiento programado",

        mensaje: datos.mensaje,

        edificioId: datos.edificioId,

        prioridad: "alta"
    });
}

/* =========================
   OBTENER ANUNCIOS
========================= */

function obtenerAnuncios() {
    const db = obtenerTodo();

    db.anuncios = db.anuncios || [];

    return db.anuncios;
}

function obtenerAnunciosActivos() {
    return obtenerAnuncios().filter(anuncio =>
        anuncio.estado === "publicado"
    );
}

function obtenerAnunciosPorEdificio(edificioId) {
    return obtenerAnunciosActivos().filter(anuncio =>
        String(anuncio.edificioId || "") === String(edificioId || "")
    );
}

function obtenerAnunciosPorUsuario(usuarioId) {
    return obtenerAnunciosActivos().filter(anuncio =>
        anuncio.alcance === "usuario" &&
        String(anuncio.destinatarioUsuarioId || "") === String(usuarioId || "")
    );
}

function obtenerAnunciosGeneralesPorEdificio(edificioId) {
    return obtenerAnunciosActivos().filter(anuncio =>
        anuncio.alcance === "residentes_edificio" &&
        String(anuncio.edificioId || "") === String(edificioId || "")
    );
}

/* =========================
   ANUNCIOS VISIBLES
========================= */

function obtenerAnunciosVisiblesUsuario(usuario) {
    const anuncios = obtenerAnunciosActivos();

    if (!usuario) return [];

    if (usuario.rol === "superadmin") {
        return anuncios;
    }

    const edificiosUsuario = obtenerEdificiosUsuarioAnuncioService(usuario);

    return anuncios.filter(anuncio => {

        if (anuncio.alcance === "usuario") {
            return String(anuncio.destinatarioUsuarioId || "") === String(usuario.id || "");
        }

        if (anuncio.alcance === "residentes_edificio") {
            return edificiosUsuario.includes(String(anuncio.edificioId || ""));
        }

        return false;
    });
}

/* =========================
   ELIMINAR / ARCHIVAR
========================= */

function eliminarAnuncio(id) {
    const db = obtenerTodo();

    db.anuncios = (db.anuncios || []).filter(anuncio =>
        String(anuncio.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

function archivarAnuncio(id) {
    const db = obtenerTodo();

    const anuncio = (db.anuncios || []).find(item =>
        String(item.id) === String(id)
    );

    if (!anuncio) {
        return {
            ok: false,
            error: "Anuncio no encontrado."
        };
    }

    anuncio.estado = "archivado";
    anuncio.fechaArchivado = fechaHoraActualAnuncioService();

    guardarTodo(db);

    return { ok: true };
}

/* =========================
   PRIORIDAD
========================= */

function formatearPrioridadAnuncio(prioridad) {
    const prioridades = {
        baja: "Baja",
        normal: "Normal",
        alta: "Alta",
        urgente: "Urgente"
    };

    return prioridades[prioridad] || "Normal";
}

function clasePrioridadAnuncio(prioridad) {
    if (prioridad === "urgente") return "ocupado";
    if (prioridad === "alta") return "pendiente";
    if (prioridad === "baja") return "vacio";

    return "badge-blue";
}

/* =========================
   TIPOS
========================= */

function formatearTipoAnuncio(tipo) {
    const tipos = {
        general: "General",
        mantenimiento_area: "Mantenimiento",
        reserva_rechazada: "Reserva rechazada",
        reserva_aprobada: "Reserva aprobada",
        sistema: "Sistema"
    };

    return tipos[tipo] || "General";
}

/* =========================
   FECHAS
========================= */

function anuncioExpirado(anuncio) {
    if (!anuncio.fechaExpiracion) return false;

    return String(anuncio.fechaExpiracion) < String(fechaHoyAnuncioService());
}

/* =========================
   HELPERS USUARIO
========================= */

function obtenerEdificiosUsuarioAnuncioService(usuario) {
    if (!usuario) return [];

    if (Array.isArray(usuario.edificioIds) && usuario.edificioIds.length > 0) {
        return usuario.edificioIds.map(String);
    }

    if (usuario.edificioId) {
        return [String(usuario.edificioId)];
    }

    const unidades = usuario.unidadesAutorizadas || [];

    return [...new Set(
        unidades
            .map(unidad => String(unidad.edificioId || ""))
            .filter(Boolean)
    )];
}

/* =========================
   FORMATEO FECHAS
========================= */

function formatearFechaAnuncio(fecha) {
    if (!fecha) return "-";

    const partes = String(fecha).split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}