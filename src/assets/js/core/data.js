// ==========================================
// BASE DE DATOS LOCAL
// ==========================================

function obtenerTodo() {
    const data = localStorage.getItem("edifika_db");

    const db = data ? JSON.parse(data) : {
        configEdificio: null,
        edificios: [],
        departamentos: [],
        usuarios: [],
        gastosMensuales: [],
        areasComunes: [],
        reservas: []
    };

    if (!db.edificios) db.edificios = [];
    if (!db.departamentos) db.departamentos = [];
    if (!db.usuarios) db.usuarios = [];
    if (!db.gastosMensuales) db.gastosMensuales = [];
    if (!db.areasComunes) db.areasComunes = [];
    if (!db.reservas) db.reservas = [];

    db.departamentos.forEach(unidad => {
        if (!unidad.autorizados) unidad.autorizados = [];
    });

    return db;
}

function guardarTodo(db) {
    localStorage.setItem("edifika_db", JSON.stringify(db));
}

// ==========================================
// CONFIGURACIÓN EDIFICIO
// ==========================================

function guardarConfiguracionEdificio(config) {
    const db = obtenerTodo();

    db.configEdificio = {
        nombre: config.nombre,
        direccion: config.direccion,
        pisos: config.pisos,
        sotanos: config.sotanos || 0,
        tieneOficinas: config.tieneOficinas || "no",
        tieneEstacionamientos: config.tieneEstacionamientos || "si",
        tieneDepositos: config.tieneDepositos || "si",
        fechaRegistro: new Date().toISOString()
    };

    guardarTodo(db);

    return { ok: true };
}

function validarCambioPisos(nuevoMaximo) {
    const db = obtenerTodo();

    const unidadInvalida = db.departamentos.find(unidad => {
        const piso = String(unidad.piso);

        if (piso.startsWith("S")) return false;

        return Number(piso) > Number(nuevoMaximo);
    });

    if (unidadInvalida) {
        return {
            ok: false,
            error: `No puedes reducir los pisos. Existe una unidad en el piso ${unidadInvalida.piso}.`
        };
    }

    return { ok: true };
}

// ==========================================
// UNIDADES
// ==========================================

function agregarDepartamento(unidad) {
    const db = obtenerTodo();

    if (!db.configEdificio) {
        return {
            ok: false,
            error: "Primero debes configurar un edificio activo."
        };
    }

    const datos = normalizarDatosUnidad(unidad);
    const validacion = validarUnidad(datos, db);

    if (!validacion.ok) return validacion;

    const existe = db.departamentos.some(item =>
        String(item.numero).toUpperCase() === datos.numero
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe una unidad con ese código."
        };
    }

    const nuevaUnidad = {
        id: Date.now().toString(),
        numero: datos.numero,
        piso: datos.piso,
        tipo: datos.tipo,
        estado: datos.estado,
        observaciones: datos.observaciones,
        saldo: 0,

        emailPropietario: null,
        emailInquilino: null,
        estadoInvitacion: null,
        estadoInquilino: null,
        codigoPropietario: null,
        codigoInquilino: null,

        nombreReal: null,
        nombreInquilino: null,
        dniPropietario: null,
        dniInquilino: null,
        password: null,
        passwordInquilino: null,

        autorizados: [],

        fechaRegistro: new Date().toISOString()
    };

    db.departamentos.push(nuevaUnidad);
    guardarTodo(db);

    return {
        ok: true,
        departamento: nuevaUnidad
    };
}

function editarDepartamento(id, unidad) {
    const db = obtenerTodo();

    const existente = db.departamentos.find(item =>
        String(item.id) === String(id)
    );

    if (!existente) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    const datos = normalizarDatosUnidad(unidad);
    const validacion = validarUnidad(datos, db);

    if (!validacion.ok) return validacion;

    const duplicado = db.departamentos.some(item =>
        String(item.id) !== String(id) &&
        String(item.numero).toUpperCase() === datos.numero
    );

    if (duplicado) {
        return {
            ok: false,
            error: "Ya existe otra unidad con ese código."
        };
    }

    existente.numero = datos.numero;
    existente.piso = datos.piso;
    existente.tipo = datos.tipo;
    existente.estado = datos.estado;
    existente.observaciones = datos.observaciones;

    if (!existente.autorizados) existente.autorizados = [];
    if (!existente.fechaRegistro) existente.fechaRegistro = new Date().toISOString();

    guardarTodo(db);

    return {
        ok: true,
        departamento: existente
    };
}

function eliminarDepartamento(id) {
    const db = obtenerTodo();

    const unidad = db.departamentos.find(item =>
        String(item.id) === String(id)
    );

    if (!unidad) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (unidad.emailPropietario || unidad.emailInquilino || (unidad.autorizados || []).length > 0) {
        return {
            ok: false,
            error: "No puedes eliminar una unidad con vinculaciones activas."
        };
    }

    const tieneReservas = db.reservas.some(reserva =>
        String(reserva.departamentoId) === String(id)
    );

    if (tieneReservas) {
        return {
            ok: false,
            error: "No puedes eliminar una unidad con reservas registradas."
        };
    }

    db.departamentos = db.departamentos.filter(item =>
        String(item.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

function normalizarDatosUnidad(unidad) {
    return {
        numero: String(unidad.numero || "").trim().toUpperCase(),
        piso: String(unidad.piso || "").trim(),
        tipo: normalizarTipoUnidadData(unidad.tipo),
        estado: normalizarEstadoUnidadData(unidad.estado),
        observaciones: String(unidad.observaciones || "").trim()
    };
}

function validarUnidad(datos, db) {
    if (!datos.numero || !datos.piso || !datos.tipo) {
        return {
            ok: false,
            error: "Completa todos los datos de la unidad."
        };
    }

    const config = db.configEdificio;

    if (!config) {
        return {
            ok: false,
            error: "No existe un edificio activo configurado."
        };
    }

    if (!tipoPermitido(datos.tipo, config)) {
        return {
            ok: false,
            error: "Este tipo de unidad no está habilitado en la configuración del edificio."
        };
    }

    if (!ubicacionPermitida(datos.tipo, datos.piso, config)) {
        return {
            ok: false,
            error: "La ubicación seleccionada no corresponde al tipo de unidad."
        };
    }

    return validarFormatoUnidad(datos.numero, datos.tipo, datos.piso);
}

function tipoPermitido(tipo, config) {
    if (tipo === "departamento") return true;
    if (tipo === "estacionamiento") return config.tieneEstacionamientos === "si";
    if (tipo === "deposito") return config.tieneDepositos === "si";
    if (tipo === "oficina") return config.tieneOficinas === "si";

    return false;
}

function ubicacionPermitida(tipo, piso, config) {
    const valor = String(piso);
    const esSotano = valor.startsWith("S");

    const sotanos = Number(config.sotanos || 0);
    const pisos = Number(config.pisos || 0);

    if (esSotano) {
        const numeroSotano = Number(valor.replace("S", ""));
        if (numeroSotano < 1 || numeroSotano > sotanos) return false;
    } else {
        const numeroPiso = Number(valor);
        if (numeroPiso < 1 || numeroPiso > pisos) return false;
    }

    if (tipo === "departamento") return !esSotano;
    if (tipo === "oficina") return !esSotano;
    if (tipo === "estacionamiento") return sotanos > 0 ? esSotano : !esSotano;
    if (tipo === "deposito") return sotanos > 0 ? esSotano : !esSotano;

    return false;
}

function validarFormatoUnidad(numero, tipo, piso) {
    if (tipo === "departamento") {
        if (!/^[0-9]+-[A-Z0-9]+$/.test(numero)) {
            return {
                ok: false,
                error: "Formato inválido para departamento. Ejemplo: 1-A."
            };
        }

        const pisoCodigo = numero.split("-")[0];

        if (String(pisoCodigo) !== String(piso)) {
            return {
                ok: false,
                error: "El piso del código no coincide con el piso seleccionado."
            };
        }
    }

    if (tipo === "estacionamiento" && !/^E-[0-9]+$/.test(numero)) {
        return {
            ok: false,
            error: "Formato inválido para estacionamiento. Ejemplo: E-01."
        };
    }

    if (tipo === "deposito" && !/^D-[0-9]+$/.test(numero)) {
        return {
            ok: false,
            error: "Formato inválido para depósito. Ejemplo: D-01."
        };
    }

    if (tipo === "oficina") {
        if (!/^OF-[0-9]+$/.test(numero)) {
            return {
                ok: false,
                error: "Formato inválido para oficina/local. Ejemplo: OF-101."
            };
        }

        const numeroOficina = numero.replace("OF-", "");
        const pisoCodigo = numeroOficina.charAt(0);

        if (String(pisoCodigo) !== String(piso)) {
            return {
                ok: false,
                error: "El código de oficina debe iniciar con el piso seleccionado. Ejemplo: Piso 2 → OF-201."
            };
        }
    }

    return { ok: true };
}

function normalizarTipoUnidadData(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}

function normalizarEstadoUnidadData(estado) {
    const valor = String(estado || "").toLowerCase().trim();

    if (valor === "ocupado" || valor === "ocupada") return "ocupada";
    if (valor === "mantenimiento" || valor === "en mantenimiento") return "mantenimiento";
    if (valor === "inactiva" || valor === "inactivo") return "inactiva";

    return "disponible";
}

// ==========================================
// VINCULACIONES
// ==========================================

function vincularPropietario(idUnidad, email) {
    const db = obtenerTodo();
    const unidad = buscarUnidadPorId(db, idUnidad);

    if (!unidad) return { ok: false, error: "Unidad no encontrada." };

    if (normalizarTipoUnidadData(unidad.tipo) !== "departamento") {
        return {
            ok: false,
            error: "Solo se puede asignar propietario principal a unidades de tipo departamento."
        };
    }

    if (unidad.estado === "mantenimiento" || unidad.estado === "inactiva") {
        return {
            ok: false,
            error: "No puedes vincular residentes a una unidad en mantenimiento o inactiva."
        };
    }

    if (unidad.emailPropietario) {
        return {
            ok: false,
            error: "La unidad ya tiene propietario vinculado o invitado."
        };
    }

    unidad.emailPropietario = String(email).trim().toLowerCase();
    unidad.estadoInvitacion = "pendiente";
    unidad.codigoPropietario = generarCodigoInvitacionData();

    guardarTodo(db);

    return { ok: true };
}

function vincularInquilino(idUnidad, email) {
    const db = obtenerTodo();
    const unidad = buscarUnidadPorId(db, idUnidad);

    if (!unidad) return { ok: false, error: "Unidad no encontrada." };

    if (normalizarTipoUnidadData(unidad.tipo) !== "departamento") {
        return {
            ok: false,
            error: "Solo se puede asignar inquilino principal a unidades de tipo departamento."
        };
    }

    if (unidad.estado === "mantenimiento" || unidad.estado === "inactiva") {
        return {
            ok: false,
            error: "No puedes vincular residentes a una unidad en mantenimiento o inactiva."
        };
    }

    if (unidad.emailInquilino) {
        return {
            ok: false,
            error: "La unidad ya tiene inquilino vinculado o invitado."
        };
    }

    unidad.emailInquilino = String(email).trim().toLowerCase();
    unidad.estadoInquilino = "pendiente";
    unidad.codigoInquilino = generarCodigoInvitacionData();

    guardarTodo(db);

    return { ok: true };
}

function vincularAutorizado(idUnidad, email) {
    const db = obtenerTodo();
    const unidad = buscarUnidadPorId(db, idUnidad);

    if (!unidad) return { ok: false, error: "Unidad no encontrada." };

    if (unidad.estado === "mantenimiento" || unidad.estado === "inactiva") {
        return {
            ok: false,
            error: "No puedes vincular usuarios a una unidad en mantenimiento o inactiva."
        };
    }

    unidad.autorizados = unidad.autorizados || [];

    const correo = String(email).trim().toLowerCase();

    const yaExisteEnUnidad =
        String(unidad.emailPropietario || "").toLowerCase() === correo ||
        String(unidad.emailInquilino || "").toLowerCase() === correo ||
        unidad.autorizados.some(item => String(item.correo).toLowerCase() === correo);

    if (yaExisteEnUnidad) {
        return {
            ok: false,
            error: "Este correo ya está vinculado o invitado en esta unidad."
        };
    }

    unidad.autorizados.push({
        id: Date.now().toString(),
        correo,
        estado: "pendiente",
        codigo: generarCodigoInvitacionData(),
        fechaRegistro: new Date().toISOString()
    });

    guardarTodo(db);

    return { ok: true };
}

function eliminarVinculacion(idUnidad, tipo, autorizadoId = "") {
    const db = obtenerTodo();
    const unidad = buscarUnidadPorId(db, idUnidad);

    if (!unidad) return { ok: false, error: "Unidad no encontrada." };

    if (tipo === "propietario") {
        unidad.emailPropietario = null;
        unidad.estadoInvitacion = null;
        unidad.codigoPropietario = null;
        unidad.nombreReal = null;
        unidad.dniPropietario = null;
        unidad.password = null;
    }

    if (tipo === "inquilino") {
        unidad.emailInquilino = null;
        unidad.estadoInquilino = null;
        unidad.codigoInquilino = null;
        unidad.nombreInquilino = null;
        unidad.dniInquilino = null;
        unidad.passwordInquilino = null;
    }

    if (tipo === "autorizado") {
        unidad.autorizados = (unidad.autorizados || []).filter(item =>
            String(item.id) !== String(autorizadoId)
        );
    }

    guardarTodo(db);

    return { ok: true };
}

function buscarUnidadPorId(db, idUnidad) {
    return (db.departamentos || []).find(unidad =>
        String(unidad.id) === String(idUnidad)
    );
}

function generarCodigoInvitacionData() {
    return "ED-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==========================================
// ÁREAS COMUNES
// ==========================================

function agregarAreaComun(area) {
    const db = obtenerTodo();

    const nombre = String(area.nombre || "").trim();

    if (!nombre) {
        return {
            ok: false,
            error: "Ingresa el nombre del área común."
        };
    }

    const duplicado = db.areasComunes.some(item =>
        String(item.nombre).toLowerCase() === nombre.toLowerCase()
    );

    if (duplicado) {
        return {
            ok: false,
            error: "Ya existe un área común con ese nombre."
        };
    }

    const nuevaArea = {
        id: Date.now().toString(),
        nombre,
        aforo: area.aforo,
        descripcion: String(area.descripcion || "").trim(),
        estado: area.estado || "disponible",
        fechaRegistro: new Date().toISOString()
    };

    db.areasComunes.push(nuevaArea);
    guardarTodo(db);

    return {
        ok: true,
        area: nuevaArea
    };
}

function eliminarAreaComun(id) {
    const db = obtenerTodo();

    const tieneReservas = db.reservas.some(reserva =>
        String(reserva.areaId) === String(id)
    );

    if (tieneReservas) {
        return {
            ok: false,
            error: "No puedes eliminar un área con reservas registradas."
        };
    }

    db.areasComunes = db.areasComunes.filter(area =>
        String(area.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// RESERVAS
// ==========================================

function agregarReservaArea(reserva) {
    const db = obtenerTodo();
    const fechaHoy = obtenerFechaHoyData();

    if (reserva.fecha < fechaHoy) {
        return {
            ok: false,
            error: "No puedes reservar fechas anteriores a la actual."
        };
    }

    const area = db.areasComunes.find(item =>
        String(item.id) === String(reserva.areaId)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área común no encontrada."
        };
    }

    if (String(area.estado).toLowerCase() !== "disponible") {
        return {
            ok: false,
            error: "El área no está disponible para reservas."
        };
    }

    const existe = db.reservas.some(item =>
        String(item.areaId) === String(reserva.areaId) &&
        item.fecha === reserva.fecha
    );

    if (existe) {
        return {
            ok: false,
            error: "El área ya se encuentra reservada en esa fecha."
        };
    }

    const nuevaReserva = {
        id: Date.now().toString(),
        areaId: reserva.areaId,
        departamentoId: reserva.departamentoId,
        fecha: reserva.fecha,
        estado: "activa",
        fechaRegistro: new Date().toISOString()
    };

    db.reservas.push(nuevaReserva);
    guardarTodo(db);

    return {
        ok: true,
        reserva: nuevaReserva
    };
}

function editarReservaArea(id, datos) {
    const db = obtenerTodo();

    const reserva = db.reservas.find(item =>
        String(item.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    const fechaHoy = obtenerFechaHoyData();

    if (datos.fecha < fechaHoy) {
        return {
            ok: false,
            error: "No puedes cambiar la reserva a una fecha pasada."
        };
    }

    const existe = db.reservas.some(item =>
        String(item.id) !== String(id) &&
        String(item.areaId) === String(datos.areaId) &&
        item.fecha === datos.fecha
    );

    if (existe) {
        return {
            ok: false,
            error: "El área ya se encuentra reservada en esa fecha."
        };
    }

    reserva.areaId = datos.areaId;
    reserva.fecha = datos.fecha;

    if (datos.departamentoId) {
        reserva.departamentoId = datos.departamentoId;
    }

    guardarTodo(db);

    return {
        ok: true,
        reserva
    };
}

function eliminarReservaArea(id) {
    const db = obtenerTodo();

    db.reservas = db.reservas.filter(item =>
        String(item.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

function obtenerFechaHoyData() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, "0");
    const day = String(hoy.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ==========================================
// LIMPIAR DB
// ==========================================

function limpiarDB() {
    localStorage.removeItem("edifika_db");
}