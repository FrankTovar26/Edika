/* =========================================================
   DASHBOARD FINANCIERO SERVICE - EDIFIKA
   Métricas financieras, cobranza, morosidad y resumen
========================================================= */

/* =========================
   HELPERS BASE
========================= */

function obtenerSesionDashboardFinanciero() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function fechaHoyDashboardFinanciero() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function obtenerPeriodoActualDashboardFinanciero() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
}

function convertirMontoDashboardFinanciero(valor) {
    const numero = Number(valor);

    return Number.isFinite(numero) ? numero : 0;
}

/* =========================
   INICIALIZACIÓN
========================= */

function inicializarDashboardFinancieroService() {
    if (typeof inicializarPagosService === "function") {
        inicializarPagosService();
    }

    if (typeof inicializarMorosidadService === "function") {
        inicializarMorosidadService();
    }

    if (typeof ejecutarRecordatoriosAutomaticos === "function") {
        ejecutarRecordatoriosAutomaticos();
    }

    return obtenerResumenDashboardFinanciero();
}

/* =========================
   RESUMEN GENERAL
========================= */

function obtenerResumenDashboardFinanciero(filtros = {}) {
    const cuotas = obtenerCuotasDashboardFinanciero(filtros);
    const pagos = obtenerPagosDashboardFinanciero(filtros);
    const morosidad = obtenerMorosidadDashboardFinanciero(filtros);

    return {
        filtros,

        cuotas,
        pagos,
        morosidad,

        metricas: calcularMetricasDashboardFinanciero(cuotas, pagos, morosidad),

        resumenEdificios: obtenerResumenFinancieroPorEdificio(filtros),

        rankingMorosidad: obtenerRankingMorosidadDashboard(filtros),

        tendencias: obtenerTendenciasFinancieras(filtros),

        alertas: obtenerAlertasFinancierasDashboard(filtros)
    };
}

/* =========================
   CUOTAS / PAGOS / MOROSIDAD
========================= */

function obtenerCuotasDashboardFinanciero(filtros = {}) {
    let cuotas = [];

    if (typeof obtenerCuotasVisiblesAdmin === "function") {
        cuotas = obtenerCuotasVisiblesAdmin();
    } else {
        const db = obtenerTodo();
        cuotas = db.cuotas || [];
    }

    return aplicarFiltrosDashboardFinanciero(cuotas, filtros);
}

function obtenerPagosDashboardFinanciero(filtros = {}) {
    let pagos = [];

    if (typeof obtenerPagosVisiblesAdmin === "function") {
        pagos = obtenerPagosVisiblesAdmin();
    } else {
        const db = obtenerTodo();
        pagos = db.pagos || [];
    }

    if (filtros.edificioId) {
        pagos = pagos.filter(pago =>
            String(pago.edificioId || "") === String(filtros.edificioId)
        );
    }

    if (filtros.unidadId) {
        pagos = pagos.filter(pago =>
            String(pago.unidadId || "") === String(filtros.unidadId)
        );
    }

    if (filtros.periodo) {
        const cuotasPeriodo = obtenerCuotasDashboardFinanciero(filtros)
            .map(cuota => String(cuota.id));

        pagos = pagos.filter(pago =>
            cuotasPeriodo.includes(String(pago.cuotaId))
        );
    }

    return pagos;
}

function obtenerMorosidadDashboardFinanciero(filtros = {}) {
    let items = [];

    if (typeof obtenerMorosidadVisibleAdmin === "function") {
        items = obtenerMorosidadVisibleAdmin();
    } else {
        items = [];
    }

    if (filtros.edificioId) {
        items = items.filter(item =>
            String(item.edificioId || "") === String(filtros.edificioId)
        );
    }

    if (filtros.unidadId) {
        items = items.filter(item =>
            String(item.unidadId || "") === String(filtros.unidadId)
        );
    }

    return items;
}

function aplicarFiltrosDashboardFinanciero(cuotas, filtros = {}) {
    let resultado = [...cuotas];

    if (filtros.edificioId) {
        resultado = resultado.filter(cuota =>
            String(cuota.edificioId || "") === String(filtros.edificioId)
        );
    }

    if (filtros.unidadId) {
        resultado = resultado.filter(cuota =>
            String(cuota.unidadId || "") === String(filtros.unidadId)
        );
    }

    if (filtros.periodo) {
        resultado = resultado.filter(cuota =>
            String(cuota.periodo || "") === String(filtros.periodo)
        );
    }

    if (filtros.tipo) {
        resultado = resultado.filter(cuota =>
            normalizarTipoCuotaDashboardFinanciero(cuota.tipo) === filtros.tipo
        );
    }

    if (filtros.estado) {
        resultado = resultado.filter(cuota =>
            normalizarEstadoCuotaDashboardFinanciero(cuota.estado) === filtros.estado
        );
    }

    return resultado;
}

/* =========================
   MÉTRICAS
========================= */

function calcularMetricasDashboardFinanciero(cuotas, pagos, morosidad) {
    const cuotasValidas = cuotas.filter(cuota =>
        normalizarEstadoCuotaDashboardFinanciero(cuota.estado) !== "anulado"
    );

    const totalFacturado = cuotasValidas.reduce(
        (total, cuota) => total + convertirMontoDashboardFinanciero(cuota.monto),
        0
    );

    const totalCobrado = cuotasValidas
        .filter(cuota =>
            normalizarEstadoCuotaDashboardFinanciero(cuota.estado) === "pagado"
        )
        .reduce(
            (total, cuota) => total + convertirMontoDashboardFinanciero(cuota.monto),
            0
        );

    const totalPendiente = cuotasValidas
        .filter(cuota =>
            ["pendiente", "vencido", "observado"].includes(
                normalizarEstadoCuotaDashboardFinanciero(cuota.estado)
            )
        )
        .reduce(
            (total, cuota) => total + convertirMontoDashboardFinanciero(cuota.monto),
            0
        );

    const totalVencido = cuotasValidas
        .filter(cuota =>
            normalizarEstadoCuotaDashboardFinanciero(cuota.estado) === "vencido"
        )
        .reduce(
            (total, cuota) => total + convertirMontoDashboardFinanciero(cuota.monto),
            0
        );

    const pagosPendientesValidacion = pagos.filter(pago =>
        normalizarEstadoPagoDashboardFinanciero(pago.estadoValidacion) === "pendiente"
    ).length;

    return {
        totalCuotas: cuotas.length,

        totalFacturado,
        totalCobrado,
        totalPendiente,
        totalVencido,

        cuotasPendientes: cuotas.filter(c =>
            normalizarEstadoCuotaDashboardFinanciero(c.estado) === "pendiente"
        ).length,

        cuotasVencidas: cuotas.filter(c =>
            normalizarEstadoCuotaDashboardFinanciero(c.estado) === "vencido"
        ).length,

        cuotasObservadas: cuotas.filter(c =>
            normalizarEstadoCuotaDashboardFinanciero(c.estado) === "observado"
        ).length,

        cuotasPagadas: cuotas.filter(c =>
            normalizarEstadoCuotaDashboardFinanciero(c.estado) === "pagado"
        ).length,

        cuotasAnuladas: cuotas.filter(c =>
            normalizarEstadoCuotaDashboardFinanciero(c.estado) === "anulado"
        ).length,

        pagosPendientesValidacion,

        unidadesMorosas: morosidad.length,

        totalMoroso: morosidad.reduce(
            (total, item) => total + convertirMontoDashboardFinanciero(item.totalVencido),
            0
        ),

        porcentajeCobranza: totalFacturado > 0
            ? Math.round((totalCobrado / totalFacturado) * 100)
            : 0,

        porcentajeMorosidad: totalFacturado > 0
            ? Math.round((totalVencido / totalFacturado) * 100)
            : 0
    };
}

/* =========================
   RESUMEN POR EDIFICIO
========================= */

function obtenerResumenFinancieroPorEdificio(filtros = {}) {
    const db = obtenerTodo();
    const edificiosPermitidos = obtenerEdificiosPermitidosDashboardFinanciero();

    let edificios = (db.edificios || []).filter(edificio =>
        edificiosPermitidos.includes(String(edificio.id))
    );

    if (filtros.edificioId) {
        edificios = edificios.filter(edificio =>
            String(edificio.id) === String(filtros.edificioId)
        );
    }

    return edificios.map(edificio => {
        const cuotas = obtenerCuotasDashboardFinanciero({
            ...filtros,
            edificioId: edificio.id
        });

        const pagos = obtenerPagosDashboardFinanciero({
            ...filtros,
            edificioId: edificio.id
        });

        const morosidad = obtenerMorosidadDashboardFinanciero({
            ...filtros,
            edificioId: edificio.id
        });

        const metricas = calcularMetricasDashboardFinanciero(
            cuotas,
            pagos,
            morosidad
        );

        return {
            edificioId: edificio.id,
            edificioNombre: edificio.nombre,
            ...metricas
        };
    });
}

/* =========================
   RANKING MOROSIDAD
========================= */

function obtenerRankingMorosidadDashboard(filtros = {}, limite = 10) {
    let ranking = [];

    if (typeof obtenerRankingMorosidad === "function") {
        ranking = obtenerRankingMorosidad(limite, filtros.edificioId || "");
    } else {
        ranking = obtenerMorosidadDashboardFinanciero(filtros)
            .sort((a, b) => b.totalVencido - a.totalVencido)
            .slice(0, limite);
    }

    if (filtros.unidadId) {
        ranking = ranking.filter(item =>
            String(item.unidadId || "") === String(filtros.unidadId)
        );
    }

    return ranking;
}

/* =========================
   TENDENCIAS
========================= */

function obtenerTendenciasFinancieras(filtros = {}) {
    const cuotas = obtenerCuotasDashboardFinanciero(filtros);

    const mapa = new Map();

    cuotas.forEach(cuota => {
        const periodo = cuota.periodo || "Sin periodo";

        if (!mapa.has(periodo)) {
            mapa.set(periodo, {
                periodo,
                facturado: 0,
                cobrado: 0,
                pendiente: 0,
                vencido: 0
            });
        }

        const item = mapa.get(periodo);
        const monto = convertirMontoDashboardFinanciero(cuota.monto);
        const estado = normalizarEstadoCuotaDashboardFinanciero(cuota.estado);

        if (estado !== "anulado") {
            item.facturado += monto;
        }

        if (estado === "pagado") {
            item.cobrado += monto;
        }

        if (["pendiente", "observado"].includes(estado)) {
            item.pendiente += monto;
        }

        if (estado === "vencido") {
            item.vencido += monto;
        }
    });

    return Array.from(mapa.values())
        .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
}

/* =========================
   ALERTAS FINANCIERAS
========================= */

function obtenerAlertasFinancierasDashboard(filtros = {}) {
    const resumen = {
        cuotas: obtenerCuotasDashboardFinanciero(filtros),
        pagos: obtenerPagosDashboardFinanciero(filtros),
        morosidad: obtenerMorosidadDashboardFinanciero(filtros)
    };

    const metricas = calcularMetricasDashboardFinanciero(
        resumen.cuotas,
        resumen.pagos,
        resumen.morosidad
    );

    const alertas = [];

    if (metricas.cuotasVencidas > 0) {
        alertas.push({
            tipo: "morosidad",
            prioridad: "alta",
            titulo: "Cuotas vencidas",
            mensaje: `Existen ${metricas.cuotasVencidas} cuota(s) vencida(s) por S/ ${formatearMontoDashboardFinanciero(metricas.totalVencido)}.`
        });
    }

    if (metricas.pagosPendientesValidacion > 0) {
        alertas.push({
            tipo: "validacion",
            prioridad: "media",
            titulo: "Comprobantes por validar",
            mensaje: `Hay ${metricas.pagosPendientesValidacion} comprobante(s) pendiente(s) de validación.`
        });
    }

    if (metricas.porcentajeCobranza < 60 && metricas.totalFacturado > 0) {
        alertas.push({
            tipo: "cobranza_baja",
            prioridad: "alta",
            titulo: "Cobranza baja",
            mensaje: `El porcentaje de cobranza actual es ${metricas.porcentajeCobranza}%.`
        });
    }

    if (metricas.unidadesMorosas > 0) {
        alertas.push({
            tipo: "unidades_morosas",
            prioridad: "media",
            titulo: "Unidades morosas",
            mensaje: `${metricas.unidadesMorosas} unidad(es) presentan morosidad.`
        });
    }

    return alertas;
}

/* =========================
   ESTADO FINANCIERO RESIDENTE
========================= */

function obtenerResumenFinancieroResidente() {
    const cuotas = typeof obtenerCuotasVisiblesResidente === "function"
        ? obtenerCuotasVisiblesResidente()
        : [];

    const pagos = typeof obtenerPagosVisiblesResidente === "function"
        ? obtenerPagosVisiblesResidente()
        : [];

    const estadoFinanciero = typeof obtenerEstadoFinancieroResidente === "function"
        ? obtenerEstadoFinancieroResidente()
        : null;

    const metricas = calcularMetricasDashboardFinanciero(cuotas, pagos, []);

    return {
        cuotas,
        pagos,
        estadoFinanciero,
        metricas
    };
}

/* =========================
   PERMISOS / EDIFICIOS
========================= */

function obtenerEdificiosPermitidosDashboardFinanciero() {
    const db = obtenerTodo();
    const sesion = obtenerSesionDashboardFinanciero();

    if (!sesion) return [];

    if (sesion.rol === "superadmin") {
        return (db.edificios || [])
            .filter(edificio => edificio.activo !== false)
            .map(edificio => String(edificio.id));
    }

    if (sesion.rol === "admin") {
        if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
            return sesion.edificioIds.filter(Boolean).map(String);
        }

        if (sesion.edificioId) {
            return [String(sesion.edificioId)];
        }
    }

    return [];
}

/* =========================
   NORMALIZADORES
========================= */

function normalizarEstadoCuotaDashboardFinanciero(estado) {
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

function normalizarEstadoPagoDashboardFinanciero(estado) {
    if (typeof normalizarEstadoPago === "function") {
        return normalizarEstadoPago(estado);
    }

    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "pendiente") return "pendiente";
    if (valor === "aprobado" || valor === "aprobada") return "aprobado";
    if (valor === "rechazado" || valor === "rechazada") return "rechazado";

    return "pendiente";
}

function normalizarTipoCuotaDashboardFinanciero(tipo) {
    if (typeof normalizarTipoCuota === "function") {
        return normalizarTipoCuota(tipo);
    }

    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "mantenimiento") return "mantenimiento";
    if (valor === "agua") return "agua";
    if (valor === "luz_comun" || valor === "luz común" || valor === "luz comun") return "luz_comun";
    if (valor === "seguridad") return "seguridad";
    if (valor === "limpieza") return "limpieza";
    if (valor === "multa") return "multa";
    if (valor === "extraordinaria") return "extraordinaria";
    if (valor === "reserva") return "reserva";
    if (valor === "otro") return "otro";

    return "mantenimiento";
}

/* =========================
   FORMATEADORES
========================= */

function formatearMontoDashboardFinanciero(monto) {
    return convertirMontoDashboardFinanciero(monto).toFixed(2);
}

function formatearPorcentajeDashboardFinanciero(valor) {
    return `${Number(valor || 0).toFixed(0)}%`;
}