// ==========================================
// BASE DE DATOS LOCAL
// ==========================================

function obtenerTodo() {
    const data = localStorage.getItem("edifika_db");

    const db = data
        ? JSON.parse(data)
        : {
              configEdificio: null,
              departamentos: [],
              gastosMensuales: [],
              areasComunes: [],
              reservas: []
          };

    if (!db.departamentos) db.departamentos = [];
    if (!db.areasComunes) db.areasComunes = [];
    if (!db.reservas) db.reservas = [];

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
        ...config,
        fechaRegistro: new Date().toISOString()
    };

    guardarTodo(db);

    return { ok: true };
}

function validarCambioPisos(nuevoMaximo) {
    const db = obtenerTodo();

    const deptoInvalido = db.departamentos.find(
        d => Number(d.piso) > Number(nuevoMaximo)
    );

    if (deptoInvalido) {
        return {
            ok: false,
            error: `No puedes reducir los pisos. Existe una unidad en el piso ${deptoInvalido.piso}.`
        };
    }

    return { ok: true };
}

// ==========================================
// DEPARTAMENTOS / UNIDADES
// ==========================================

function agregarDepartamento(depto) {
    const db = obtenerTodo();

    if (!db.configEdificio || !db.configEdificio.pisos) {
        return {
            ok: false,
            error: "Primero debes configurar el edificio."
        };
    }

    const numero = depto.numero.trim().toUpperCase();

    const formatoValido = /^[0-9]+-[A-Z0-9]+$/;

    if (!formatoValido.test(numero)) {
        return {
            ok: false,
            error: "Formato inválido. Ejemplo válido: 1-A"
        };
    }

    const existe = db.departamentos.find(
        d => d.numero.toUpperCase() === numero
    );

    if (existe) {
        return {
            ok: false,
            error: "La unidad ya existe."
        };
    }

    const pisoExtraido = Number(numero.split("-")[0]);

    if (pisoExtraido !== Number(depto.piso)) {
        return {
            ok: false,
            error: "El piso del número no coincide con el piso seleccionado."
        };
    }

    const nuevoDepartamento = {
        id: Date.now().toString(),
        numero,
        piso: depto.piso,
        tipo: depto.tipo || "departamento",
        estado: depto.estado || "disponible",
        observaciones: depto.observaciones || "",
        saldo: 0,

        emailPropietario: null,
        emailInquilino: null,

        estadoInvitacion: null,
        estadoInquilino: null,

        fechaRegistro: new Date().toISOString()
    };

    db.departamentos.push(nuevoDepartamento);

    guardarTodo(db);

    return { ok: true };
}

function editarDepartamento(id, datos) {
    const db = obtenerTodo();

    const departamento = db.departamentos.find(
        d => String(d.id) === String(id)
    );

    if (!departamento) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    const numero = datos.numero.trim().toUpperCase();

    const existeDuplicado = db.departamentos.find(
        d =>
            String(d.id) !== String(id) &&
            d.numero.toUpperCase() === numero
    );

    if (existeDuplicado) {
        return {
            ok: false,
            error: "Ya existe otra unidad con ese número."
        };
    }

    departamento.numero = numero;
    departamento.piso = datos.piso;
    departamento.tipo = datos.tipo || "departamento";
    departamento.estado = datos.estado || "disponible";
    departamento.observaciones = datos.observaciones || "";

    guardarTodo(db);

    return { ok: true };
}

function eliminarDepartamento(id) {
    const db = obtenerTodo();

    const departamento = db.departamentos.find(
        d => String(d.id) === String(id)
    );

    if (!departamento) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (
        departamento.emailPropietario ||
        departamento.emailInquilino
    ) {
        return {
            ok: false,
            error: "No puedes eliminar una unidad vinculada."
        };
    }

    db.departamentos = db.departamentos.filter(
        d => String(d.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// VINCULACIONES
// ==========================================

function vincularPropietario(idDepto, email) {
    const db = obtenerTodo();

    const depto = db.departamentos.find(
        d => String(d.id) === String(idDepto)
    );

    if (!depto) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    depto.emailPropietario = email;
    depto.estadoInvitacion = "pendiente";

    guardarTodo(db);

    return { ok: true };
}

function vincularInquilino(idDepto, email) {
    const db = obtenerTodo();

    const depto = db.departamentos.find(
        d => String(d.id) === String(idDepto)
    );

    if (!depto) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    depto.emailInquilino = email;
    depto.estadoInquilino = "pendiente";

    guardarTodo(db);

    return { ok: true };
}

function eliminarVinculacion(idDepto, tipo) {
    const db = obtenerTodo();

    const depto = db.departamentos.find(
        d => String(d.id) === String(idDepto)
    );

    if (!depto) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (tipo === "propietario") {
        depto.emailPropietario = null;
        depto.estadoInvitacion = null;

        depto.nombreReal = null;
        depto.dniPropietario = null;
        depto.password = null;
    }

    if (tipo === "inquilino") {
        depto.emailInquilino = null;
        depto.estadoInquilino = null;

        depto.nombreInquilino = null;
        depto.dniInquilino = null;
        depto.passwordInquilino = null;
    }

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// ÁREAS COMUNES
// ==========================================

function agregarAreaComun(area) {
    const db = obtenerTodo();

    const nuevaArea = {
        id: Date.now().toString(),
        nombre: area.nombre,
        aforo: area.aforo,
        descripcion: area.descripcion || "",
        estado: area.estado || "disponible",
        fechaRegistro: new Date().toISOString()
    };

    db.areasComunes.push(nuevaArea);

    guardarTodo(db);

    return { ok: true };
}

function cambiarEstadoArea(id, nuevoEstado) {
    const db = obtenerTodo();

    const area = db.areasComunes.find(
        a => String(a.id) === String(id)
    );

    if (!area) {
        return {
            ok: false,
            error: "Área no encontrada."
        };
    }

    area.estado = nuevoEstado;

    guardarTodo(db);

    return { ok: true };
}

function eliminarAreaComun(id) {
    const db = obtenerTodo();

    db.areasComunes = db.areasComunes.filter(
        a => String(a.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// RESERVAS
// ==========================================

function agregarReservaArea(reserva) {
    const db = obtenerTodo();

    const fechaHoy = new Date().toISOString().split("T")[0];

    if (reserva.fecha < fechaHoy) {
        return {
            ok: false,
            error: "No puedes reservar fechas anteriores."
        };
    }

    const existe = db.reservas.find(r =>
        String(r.areaId) === String(reserva.areaId) &&
        r.fecha === reserva.fecha &&
        String(r.id) !== String(reserva.id || "")
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

    return { ok: true };
}

function editarReservaArea(id, datos) {
    const db = obtenerTodo();

    const reserva = db.reservas.find(
        r => String(r.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    const existe = db.reservas.find(r =>
        String(r.id) !== String(id) &&
        String(r.areaId) === String(datos.areaId) &&
        r.fecha === datos.fecha
    );

    if (existe) {
        return {
            ok: false,
            error: "El área ya se encuentra reservada en esa fecha."
        };
    }

    reserva.areaId = datos.areaId;
    reserva.fecha = datos.fecha;

    guardarTodo(db);

    return { ok: true };
}

function eliminarReservaArea(id) {
    const db = obtenerTodo();

    db.reservas = db.reservas.filter(
        r => String(r.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// ACTIVACIÓN DE CUENTAS
// ==========================================

function activarCuenta(idDepto, rol, datos) {
    const db = obtenerTodo();

    const depto = db.departamentos.find(
        d => String(d.id) === String(idDepto)
    );

    if (!depto) {
        return {
            ok: false,
            error: "Unidad no encontrada."
        };
    }

    if (rol === "Propietario") {
        depto.nombreReal = datos.nombre;
        depto.dniPropietario = datos.dni;
        depto.password = datos.password;
        depto.estadoInvitacion = "aceptada";
    } else {
        depto.nombreInquilino = datos.nombre;
        depto.dniInquilino = datos.dni;
        depto.passwordInquilino = datos.password;
        depto.estadoInquilino = "aceptada";
    }

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// RECUPERAR ACCESO
// ==========================================

function recuperarAcceso(email, nombre, dni, nuevaPassword) {
    const db = obtenerTodo();

    const depto = db.departamentos.find(
        d =>
            d.emailPropietario === email ||
            d.emailInquilino === email
    );

    if (!depto) {
        return {
            ok: false,
            error: "Correo no encontrado."
        };
    }

    const esPropietario =
        depto.emailPropietario === email;

    const nombreDB = esPropietario
        ? depto.nombreReal
        : depto.nombreInquilino;

    const dniDB = esPropietario
        ? depto.dniPropietario
        : depto.dniInquilino;

    if (nombreDB !== nombre || dniDB !== dni) {
        return {
            ok: false,
            error: "Datos incorrectos."
        };
    }

    if (esPropietario) {
        depto.password = nuevaPassword;
    } else {
        depto.passwordInquilino = nuevaPassword;
    }

    guardarTodo(db);

    return { ok: true };
}

// ==========================================
// LIMPIAR DB
// ==========================================

function limpiarDB() {
    const confirmar = confirm(
        "¿Deseas borrar toda la base de datos?"
    );

    if (!confirmar) return;

    localStorage.removeItem("edifika_db");

    location.reload();
}