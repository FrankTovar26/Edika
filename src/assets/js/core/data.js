// CONFIGURACIÓN INICIAL DE LA "BASE DE DATOS" LOCAL
function obtenerTodo() {
    const data = localStorage.getItem('edifika_db');

    const db = data ? JSON.parse(data) : {
        configEdificio: null,
        departamentos: [],
        gastosMensuales: [],
        areasComunes: [],
        reservas: [],
        invitaciones: []
    };

    if (!db.configEdificio) db.configEdificio = null;
    if (!db.departamentos) db.departamentos = [];
    if (!db.gastosMensuales) db.gastosMensuales = [];
    if (!db.areasComunes) db.areasComunes = [];
    if (!db.reservas) db.reservas = [];
    if (!db.invitaciones) db.invitaciones = [];

    return db;
}

function guardarTodo(db) {
    localStorage.setItem('edifika_db', JSON.stringify(db));
}

// --- FUNCIONES DE ADMINISTRACIÓN ---
function guardarConfiguracionEdificio(config) {
    const db = obtenerTodo();
    db.configEdificio = config;
    guardarTodo(db);
}

function agregarDepartamento(depto) {
    const db = obtenerTodo();

    if (!db.configEdificio || !db.configEdificio.pisos) {
        return {
            ok: false,
            error: "Primero debe configurar el edificio."
        };
    }

    db.departamentos = db.departamentos || [];

    const numero = depto.numero.trim().toUpperCase();
    const piso = String(depto.piso);

    const formatoValido = /^[0-9]+-[A-Z]$/;

    if (!formatoValido.test(numero)) {
        return {
            ok: false,
            error: "Formato inválido. Use: Piso-Letra. Ejemplo: 1-A."
        };
    }

    const pisoExtraido = Number(numero.split("-")[0]);
    const pisoIngresado = Number(piso);
    const maxPisos = Number(db.configEdificio.pisos);

    if (pisoExtraido !== pisoIngresado) {
        return {
            ok: false,
            error: `Inconsistencia: el código indica piso ${pisoExtraido}, pero seleccionaste piso ${pisoIngresado}.`
        };
    }

    if (pisoIngresado > maxPisos) {
        return {
            ok: false,
            error: `El edificio solo tiene ${maxPisos} pisos.`
        };
    }

    const existe = db.departamentos.some(d =>
        String(d.numero).toUpperCase() === numero
    );

    if (existe) {
        return {
            ok: false,
            error: "Esta unidad ya existe."
        };
    }

    const nuevoDepartamento = {
        id: Date.now(),
        numero,
        piso,
        saldo: 0,
        residente: "",
        emailPropietario: "",
        estadoInvitacion: "",
        emailInquilino: "",
        estadoInquilino: "",
        fechaRegistro: new Date().toISOString()
    };

    db.departamentos.push(nuevoDepartamento);
    guardarTodo(db);

    return {
        ok: true,
        departamento: nuevoDepartamento
    };
}

function editarDepartamento(id, datos) {
    const db = obtenerTodo();

    const departamento = (db.departamentos || []).find(dep =>
        String(dep.id) === String(id)
    );

    if (!departamento) {
        return {
            ok: false,
            error: "La unidad no existe."
        };
    }

    const numero = datos.numero.trim().toUpperCase();
    const piso = String(datos.piso);

    const formatoValido = /^[0-9]+-[A-Z]$/;

    if (!formatoValido.test(numero)) {
        return {
            ok: false,
            error: "Formato inválido. Use: Piso-Letra. Ejemplo: 1-A."
        };
    }

    const pisoExtraido = Number(numero.split("-")[0]);
    const pisoIngresado = Number(piso);
    const maxPisos = Number(db.configEdificio.pisos);

    if (pisoExtraido !== pisoIngresado) {
        return {
            ok: false,
            error: `Inconsistencia: el código indica piso ${pisoExtraido}, pero seleccionaste piso ${pisoIngresado}.`
        };
    }

    if (pisoIngresado > maxPisos) {
        return {
            ok: false,
            error: `El edificio solo tiene ${maxPisos} pisos.`
        };
    }

    const duplicado = db.departamentos.some(dep =>
        String(dep.id) !== String(id) &&
        String(dep.numero).toUpperCase() === numero
    );

    if (duplicado) {
        return {
            ok: false,
            error: "Ya existe otra unidad con ese número."
        };
    }

    departamento.numero = numero;
    departamento.piso = piso;

    if (!departamento.fechaRegistro) {
        departamento.fechaRegistro = new Date().toISOString();
    }

    guardarTodo(db);

    return {
        ok: true,
        departamento
    };
}

function eliminarDepartamento(id) {
    const db = obtenerTodo();

    const departamento = (db.departamentos || []).find(dep =>
        String(dep.id) === String(id)
    );

    if (!departamento) {
        return {
            ok: false,
            error: "La unidad no existe."
        };
    }

    if (departamento.emailPropietario || departamento.emailInquilino) {
        return {
            ok: false,
            error: "No se puede eliminar una unidad vinculada a un residente."
        };
    }

    const tieneReservas = (db.reservas || []).some(reserva =>
        String(reserva.departamentoId) === String(id)
    );

    if (tieneReservas) {
        return {
            ok: false,
            error: "No se puede eliminar una unidad con reservas registradas."
        };
    }

    db.departamentos = db.departamentos.filter(dep =>
        String(dep.id) !== String(id)
    );

    guardarTodo(db);

    return {
        ok: true
    };
}

function validarCambioPisos(nuevoMaximo) {
    const db = obtenerTodo();
    const deptosHuerfanos = db.departamentos.find(d => parseInt(d.piso) > parseInt(nuevoMaximo));
    if (deptosHuerfanos) {
        return { ok: false, error: `No puedes reducir a ${nuevoMaximo} pisos. Hay unidades en pisos superiores.` };
    }
    return { ok: true };
}

// --- VINCULACIÓN E INVITACIONES ---
function vincularPropietario(idDepto, email) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == idDepto);
    depto.emailPropietario = email;
    depto.estadoInvitacion = 'Pendiente';
    guardarTodo(db);
    return { ok: true };
}

function vincularInquilino(idDepto, email) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == idDepto);
    if (!depto.emailPropietario) {
        return { ok: false, error: "No se puede registrar un inquilino sin un propietario." };
    }
    depto.emailInquilino = email;
    depto.estadoInquilino = 'Pendiente';
    guardarTodo(db);
    return { ok: true };
}

function eliminarVinculacion(idDepto, rol) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == idDepto);
    if (rol === 'prop') {
        depto.emailPropietario = depto.nombreReal = depto.dniPropietario = depto.password = depto.estadoInvitacion = null;
        depto.emailInquilino = depto.nombreInquilino = depto.dniInquilino = depto.passwordInquilino = depto.estadoInquilino = null;
    } else {
        depto.emailInquilino = depto.nombreInquilino = depto.dniInquilino = depto.passwordInquilino = depto.estadoInquilino = null;
    }
    guardarTodo(db);
    return { ok: true };
}

function actualizarCorreoInvitacion(idDepto, rol, nuevoEmail) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == idDepto);
    if (rol === 'prop') depto.emailPropietario = nuevoEmail;
    else depto.emailInquilino = nuevoEmail;
    guardarTodo(db);
    return { ok: true };
}

// --- ÁREAS COMUNES Y RESERVAS ---
function agregarAreaComun(area) {
    const db = obtenerTodo();
    area.id = Date.now();
    area.estado = 'Disponible';
    db.areasComunes.push(area);
    guardarTodo(db);
    return { ok: true };
}

function cambiarEstadoArea(id, nuevoEstado) {
    const db = obtenerTodo();
    const area = db.areasComunes.find(a => a.id == id);
    if (area) {
        area.estado = nuevoEstado;
        guardarTodo(db);
    }
    return { ok: true };
}

function registrarReserva(reserva) {
    const db = obtenerTodo();
    reserva.id = Date.now();
    db.reservas.push(reserva);
    guardarTodo(db);
    return { ok: true };
}

// --- USUARIO / RESIDENTE ---
function activarCuenta(idDepto, rol, datos) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == idDepto);
    if (rol === 'Propietario') {
        depto.nombreReal = datos.nombre;
        depto.dniPropietario = datos.dni;
        depto.password = datos.password;
        depto.estadoInvitacion = 'Activo';
    } else {
        depto.nombreInquilino = datos.nombre;
        depto.dniInquilino = datos.dni;
        depto.passwordInquilino = datos.password;
        depto.estadoInquilino = 'Activo';
    }
    guardarTodo(db);
    return { ok: true };
}

function recuperarAcceso(email, nombre, dni, nuevaPassword) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => (d.emailPropietario === email || d.emailInquilino === email));
    if (!depto) return { ok: false, error: "Correo no encontrado." };

    const esProp = depto.emailPropietario === email;
    const nombreDB = esProp ? depto.nombreReal : depto.nombreInquilino;
    const dniDB = esProp ? depto.dniPropietario : depto.dniInquilino;

    if (nombreDB === nombre && dniDB === dni) {
        if (esProp) depto.password = nuevaPassword;
        else depto.passwordInquilino = nuevaPassword;
        guardarTodo(db);
        return { ok: true };
    }
    return { ok: false, error: "Datos de identidad incorrectos." };
}

function limpiarDB() {
    localStorage.removeItem('edifika_db');
    location.reload();
}

function agregarReservaArea(reserva) {
    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    const yaExiste = db.reservas.some(r =>
        String(r.areaId) === String(reserva.areaId) &&
        String(r.fecha) === String(reserva.fecha)
    );

    if (yaExiste) {
        return {
            ok: false,
            error: "Esta área ya tiene una reserva registrada para esa fecha."
        };
    }

    const nuevaReserva = {
        id: Date.now(),
        areaId: reserva.areaId,
        departamentoId: reserva.departamentoId,
        fecha: reserva.fecha,
        estado: "activa"
    };

    db.reservas.push(nuevaReserva);

    guardarTodo(db);

    return {
        ok: true,
        reserva: nuevaReserva
    };
}

function eliminarReservaArea(id) {
    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    db.reservas = db.reservas.filter(r => String(r.id) !== String(id));

    guardarTodo(db);

    return {
        ok: true
    };
}

function agregarAreaComun(area) {
    const db = obtenerTodo();

    db.areasComunes = db.areasComunes || [];

    const nuevaArea = {
        id: Date.now(),
        nombre: area.nombre,
        aforo: area.aforo,
        descripcion: area.descripcion,
        estado: area.estado || "disponible"
    };

    db.areasComunes.push(nuevaArea);
    guardarTodo(db);

    return { ok: true, area: nuevaArea };
}

function editarReservaArea(id, datos) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r => String(r.id) === String(id));

    if (!reserva) {
        return { ok: false, error: "La reserva no existe." };
    }

    const yaExiste = (db.reservas || []).some(r =>
        String(r.id) !== String(id) &&
        String(r.areaId) === String(datos.areaId) &&
        String(r.fecha) === String(datos.fecha)
    );

    if (yaExiste) {
        return {
            ok: false,
            error: "Esta área ya está reservada para esa fecha."
        };
    }

    reserva.areaId = datos.areaId;
    reserva.fecha = datos.fecha;

    guardarTodo(db);

    return { ok: true, reserva };
}