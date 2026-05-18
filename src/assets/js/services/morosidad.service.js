/* =========================================================
   MOROSIDAD SERVICE - EDIFIKA
   Detecta cuotas vencidas, unidades morosas y métricas
========================================================= */

/* =========================
   HELPERS BASE
========================= */

function fechaHoyMorosidadService() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function fechaHoraMorosidadService() {
    return new Date().toISOString();
}

function obtenerSesionMorosidadService() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function convertirMontoMorosidad(valor) {
    const numero = Number(valor);

    return Number.isFinite(numero) ? numero : 0;
}

function diferenciaDiasMorosidad(fechaInicio, fechaFin) {
    const inicio = new Date(`${fechaInicio}T00:00:00`);
    const fin = new Date(`${fechaFin}T00:00:00`);

    const diferencia = fin.getTime() - inicio.getTime();

    return Math.round(diferencia / (1000 * 60 * 60 * 24));
}

/* =========================
   INICIALIZACIÓN
========================= */

function inicializarMorosidadService() {
    const db = obtenerTodo();

    db.cuotas = db.cuotas || [];
    db.pagos = db.pagos || [];

    if (typeof actualizarCuotasVencidas === "function") {
        actualizarCuotasVencidas(db);
    } else {
        actualizarCuotasVencidasMorosidad(db);
    }

    guardarTodo(db);

    return obtenerMorosidadGeneral();
}

/* =========================
   ACTUALIZAR VENCIDAS
========================= */

function actualizarCuotasVencidasMorosidad(db = obtenerTodo()) {
    const hoy = fechaHoyMorosidadService();

    let cambio = false;

    (db.cuotas || []).forEach(cuota => {
        const estado = normalizarEstadoCuotaMorosidad(cuota.estado);

        if (
            estado === "pendiente" &&
            String(cuota.fechaVencimiento || "") < String(hoy)
        ) {
            cuota.estado = "vencido";
            cuota.fechaActualizacion = fechaHoraMorosidadService();

            cuota.historial = cuota.historial || [];

            cuota.historial.push({
                id: generarIdMorosidadService(),
                estado: "vencido",
                observacion: "Cuota marcada como vencida por morosidad.",
                usuarioId: "sistema",
                usuarioNombre: "Sistema",
                fecha: fechaHoraMorosidadService()
            });

            cambio = true;
        }
    });

    if (cambio) {
        guardarTodo(db);
    }

    return cambio;
}

function generarIdMorosidadService() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 8);
}

/* =========================
   CONSULTAS BASE
========================= */

function obtenerCuotasMorosidadBase() {
    if (typeof obtenerCuotas === "function") {
        return obtenerCuotas();
    }

    const db = obtenerTodo();

    db.cuotas = db.cuotas || [];

    actualizarCuotasVencidasMorosidad(db);

    return db.cuotas;
}

function obtenerCuotasVencidasMorosidad() {
    return obtenerCuotasMorosidadBase().filter(cuota =>
        normalizarEstadoCuotaMorosidad(cuota.estado) === "vencido"
    );
}

function obtenerCuotasPendientesMorosidad() {
    return obtenerCuotasMorosidadBase().filter(cuota =>
        ["pendiente", "vencido", "observado"].includes(
            normalizarEstadoCuotaMorosidad(cuota.estado)
        )
    );
}

/* =========================
   MOROSIDAD GENERAL
========================= */

function obtenerMorosidadGeneral() {
    const cuotasVencidas = obtenerCuotasVencidasMorosidad();

    return calcularMorosidadDesdeCuotas(cuotasVencidas);
}

function calcularMorosidadDesdeCuotas(cuotasVencidas) {
    const db = obtenerTodo();
    const hoy = fechaHoyMorosidadService();

    const mapa = new Map();

    cuotasVencidas.forEach(cuota => {
        const clave = String(cuota.unidadId || "");

        if (!clave) return;

        if (!mapa.has(clave)) {
            const unidad = obtenerUnidadMorosidad(db, cuota.unidadId);
            const edificio = obtenerEdificioMorosidad(db, cuota.edificioId);
            const usuario = obtenerUsuarioPorUnidadMorosidad(db, unidad);

            mapa.set(clave, {
                unidadId: cuota.unidadId,
                unidadNumero: unidad?.numero || "-",
                unidadTipo: unidad?.tipo || "Unidad",

                edificioId: cuota.edificioId,
                edificioNombre: edificio?.nombre || "-",

                residenteId: usuario?.id || "",
                residenteNombre: usuario?.nombre || usuario?.nombres || "Residente",
                residenteCorreo: usuario?.email || usuario?.correo || "",

                totalVencido: 0,
                cantidadCuotas: 0,
                diasMaximoVencido: 0,
                nivelMorosidad: "baja",

                cuotas: []
            });
        }

        const item = mapa.get(clave);

        const diasVencido = Math.max(
            0,
            diferenciaDiasMorosidad(cuota.fechaVencimiento, hoy)
        );

        item.totalVencido += convertirMontoMorosidad(cuota.monto);
        item.cantidadCuotas += 1;
        item.diasMaximoVencido = Math.max(item.diasMaximoVencido, diasVencido);
        item.cuotas.push(cuota);
        item.nivelMorosidad = calcularNivelMorosidad(item);
    });

    return Array.from(mapa.values())
        .sort((a, b) => b.totalVencido - a.totalVencido);
}

/* =========================
   MOROSIDAD POR FILTROS
========================= */

function obtenerMorosidadPorEdificio(edificioId) {
    let cuotas = obtenerCuotasVencidasMorosidad();

    if (edificioId) {
        cuotas = cuotas.filter(cuota =>
            String(cuota.edificioId || "") === String(edificioId)
        );
    }

    return calcularMorosidadDesdeCuotas(cuotas);
}

function obtenerMorosidadPorUnidad(unidadId) {
    const cuotas = obtenerCuotasVencidasMorosidad().filter(cuota =>
        String(cuota.unidadId || "") === String(unidadId || "")
    );

    return calcularMorosidadDesdeCuotas(cuotas)[0] || null;
}

function obtenerMorosidadPorResidente(usuarioId) {
    const db = obtenerTodo();
    const usuario = (db.usuarios || []).find(item =>
        String(item.id) === String(usuarioId)
    );

    if (!usuario) return [];

    const idsUnidades = obtenerIdsUnidadesMorosidad(usuario);

    const cuotas = obtenerCuotasVencidasMorosidad().filter(cuota =>
        idsUnidades.includes(String(cuota.unidadId || ""))
    );

    return calcularMorosidadDesdeCuotas(cuotas);
}

function obtenerMorosidadVisibleAdmin() {
    const sesion = obtenerSesionMorosidadService();

    if (!sesion) return [];

    if (sesion.rol === "superadmin") {
        return obtenerMorosidadGeneral();
    }

    if (sesion.rol === "admin") {
        const edificios = obtenerEdificiosPermitidosMorosidad(sesion);

        return obtenerMorosidadGeneral().filter(item =>
            edificios.includes(String(item.edificioId || ""))
        );
    }

    return [];
}

function obtenerMorosidadVisibleResidente() {
    const sesion = obtenerSesionMorosidadService();

    if (!sesion) return [];

    const idsUnidades = obtenerIdsUnidadesMorosidad(sesion);

    return obtenerMorosidadGeneral().filter(item =>
        idsUnidades.includes(String(item.unidadId || ""))
    );
}

/* =========================
   MÉTRICAS
========================= */

function calcularMetricasMorosidad(itemsMorosidad = obtenerMorosidadVisibleAdmin()) {
    const totalMoroso = itemsMorosidad.reduce(
        (total, item) => total + convertirMontoMorosidad(item.totalVencido),
        0
    );

    return {
        totalUnidadesMorosas: itemsMorosidad.length,
        totalMoroso,
        cuotasVencidas: itemsMorosidad.reduce(
            (total, item) => total + Number(item.cantidadCuotas || 0),
            0
        ),
        morosidadBaja: itemsMorosidad.filter(item => item.nivelMorosidad === "baja").length,
        morosidadMedia: itemsMorosidad.filter(item => item.nivelMorosidad === "media").length,
        morosidadAlta: itemsMorosidad.filter(item => item.nivelMorosidad === "alta").length,
        morosidadCritica: itemsMorosidad.filter(item => item.nivelMorosidad === "critica").length,
        mayorDeuda: itemsMorosidad.length > 0
            ? Math.max(...itemsMorosidad.map(item => convertirMontoMorosidad(item.totalVencido)))
            : 0
    };
}

function obtenerRankingMorosidad(limite = 10, edificioId = "") {
    let items = edificioId
        ? obtenerMorosidadPorEdificio(edificioId)
        : obtenerMorosidadVisibleAdmin();

    return items
        .sort((a, b) => {
            if (b.totalVencido !== a.totalVencido) {
                return b.totalVencido - a.totalVencido;
            }

            return b.diasMaximoVencido - a.diasMaximoVencido;
        })
        .slice(0, limite);
}

function obtenerResumenMorosidadPorEdificio() {
    const db = obtenerTodo();
    const sesion = obtenerSesionMorosidadService();

    let edificios = db.edificios || [];

    if (sesion?.rol === "admin") {
        const permitidos = obtenerEdificiosPermitidosMorosidad(sesion);

        edificios = edificios.filter(edificio =>
            permitidos.includes(String(edificio.id))
        );
    }

    return edificios.map(edificio => {
        const items = obtenerMorosidadPorEdificio(edificio.id);
        const metricas = calcularMetricasMorosidad(items);

        return {
            edificioId: edificio.id,
            edificioNombre: edificio.nombre,
            ...metricas
        };
    });
}

/* =========================
   ESTADO FINANCIERO RESIDENTE
========================= */

function obtenerEstadoFinancieroResidente() {
    const sesion = obtenerSesionMorosidadService();

    if (!sesion) {
        return {
            estado: "sin_sesion",
            mensaje: "No hay sesión activa.",
            totalVencido: 0,
            totalPendiente: 0,
            cuotasVencidas: 0,
            cuotasPendientes: 0
        };
    }

    const idsUnidades = obtenerIdsUnidadesMorosidad(sesion);

    const cuotas = obtenerCuotasMorosidadBase().filter(cuota =>
        idsUnidades.includes(String(cuota.unidadId || ""))
    );

    const vencidas = cuotas.filter(cuota =>
        normalizarEstadoCuotaMorosidad(cuota.estado) === "vencido"
    );

    const pendientes = cuotas.filter(cuota =>
        normalizarEstadoCuotaMorosidad(cuota.estado) === "pendiente"
    );

    const observadas = cuotas.filter(cuota =>
        normalizarEstadoCuotaMorosidad(cuota.estado) === "observado"
    );

    const totalVencido = vencidas.reduce(
        (total, cuota) => total + convertirMontoMorosidad(cuota.monto),
        0
    );

    const totalPendiente = [...vencidas, ...pendientes, ...observadas].reduce(
        (total, cuota) => total + convertirMontoMorosidad(cuota.monto),
        0
    );

    if (vencidas.length > 0) {
        return {
            estado: "moroso",
            nivel: calcularNivelMorosidad({
                totalVencido,
                cantidadCuotas: vencidas.length,
                diasMaximoVencido: calcularDiasMaximoVencido(vencidas)
            }),
            mensaje: `Tienes ${vencidas.length} cuota(s) vencida(s).`,
            totalVencido,
            totalPendiente,
            cuotasVencidas: vencidas.length,
            cuotasPendientes: pendientes.length,
            cuotasObservadas: observadas.length
        };
    }

    if (pendientes.length > 0 || observadas.length > 0) {
        return {
            estado: "pendiente",
            nivel: "baja",
            mensaje: `Tienes ${pendientes.length + observadas.length} cuota(s) pendiente(s) de atención.`,
            totalVencido: 0,
            totalPendiente,
            cuotasVencidas: 0,
            cuotasPendientes: pendientes.length,
            cuotasObservadas: observadas.length
        };
    }

    return {
        estado: "al_dia",
        nivel: "sin_deuda",
        mensaje: "No tienes deudas pendientes.",
        totalVencido: 0,
        totalPendiente: 0,
        cuotasVencidas: 0,
        cuotasPendientes: 0,
        cuotasObservadas: 0
    };
}

function calcularDiasMaximoVencido(cuotas) {
    const hoy = fechaHoyMorosidadService();

    if (!cuotas || cuotas.length === 0) return 0;

    return Math.max(
        ...cuotas.map(cuota =>
            Math.max(0, diferenciaDiasMorosidad(cuota.fechaVencimiento, hoy))
        )
    );
}

/* =========================
   NIVELES DE MOROSIDAD
========================= */

function calcularNivelMorosidad(item) {
    const total = convertirMontoMorosidad(item.totalVencido);
    const cuotas = Number(item.cantidadCuotas || 0);
    const dias = Number(item.diasMaximoVencido || 0);

    if (dias >= 30 || total >= 1000 || cuotas >= 4) {
        return "critica";
    }

    if (dias >= 15 || total >= 500 || cuotas >= 3) {
        return "alta";
    }

    if (dias >= 7 || total >= 200 || cuotas >= 2) {
        return "media";
    }

    return "baja";
}

function formatearNivelMorosidad(nivel) {
    const niveles = {
        baja: "Baja",
        media: "Media",
        alta: "Alta",
        critica: "Crítica",
        sin_deuda: "Sin deuda"
    };

    return niveles[nivel] || "Baja";
}

function claseNivelMorosidad(nivel) {
    if (nivel === "critica") return "ocupado";
    if (nivel === "alta") return "ocupado";
    if (nivel === "media") return "pendiente";
    if (nivel === "baja") return "badge-blue";
    if (nivel === "sin_deuda") return "vacio";

    return "badge-blue";
}

/* =========================
   UTILIDADES DE DATOS
========================= */

function obtenerUnidadMorosidad(db, unidadId) {
    return (db.departamentos || []).find(unidad =>
        String(unidad.id) === String(unidadId)
    );
}

function obtenerEdificioMorosidad(db, edificioId) {
    return (db.edificios || []).find(edificio =>
        String(edificio.id) === String(edificioId)
    );
}

function obtenerUsuarioPorUnidadMorosidad(db, unidad) {
    if (!unidad) return null;

    return (db.usuarios || []).find(usuario => {
        const unidades = usuario.unidadesAutorizadas || [];

        const vinculado = unidades.some(vinculo =>
            String(vinculo.edificioId || "") === String(unidad.edificioId || "") &&
            (
                String(vinculo.unidadId || "") === String(unidad.id || "") ||
                String(vinculo.unidadNumero || vinculo.numero || "") === String(unidad.numero || "")
            )
        );

        if (vinculado) return true;

        return String(usuario.departamentoId || "") === String(unidad.id || "");
    });
}

function obtenerIdsUnidadesMorosidad(usuario) {
    const ids = [];

    if (usuario?.departamentoId) {
        ids.push(String(usuario.departamentoId));
    }

    const unidades = usuario?.unidadesAutorizadas || [];

    unidades.forEach(unidad => {
        if (unidad.unidadId) {
            ids.push(String(unidad.unidadId));
        }
    });

    return [...new Set(ids)];
}

function obtenerEdificiosPermitidosMorosidad(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

/* =========================
   NORMALIZADORES
========================= */

function normalizarEstadoCuotaMorosidad(estado) {
    if (typeof normalizarEstadoCuota === "function") {
        return normalizarEstadoCuota(estado);
    }

    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "pendiente") return "pendiente";
    if (valor === "pagado" || valor === "pagada") return "pagado";
    if (valor === "vencido" || valor === "vencida") return "vencido";
    if (valor === "observado" || valor === "observada") return "observado";
    if (valor === "anulado" || valor === "anulada") return "anulado";

    return "pendiente";
}

/* =========================
   FORMATEADORES
========================= */

function formatearMontoMorosidad(monto) {
    return convertirMontoMorosidad(monto).toFixed(2);
}

function formatearFechaMorosidad(fecha) {
    if (!fecha) return "-";

    const base = String(fecha).split("T")[0];
    const partes = base.split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}