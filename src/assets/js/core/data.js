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
        return { ok: false, error: "Primero debe configurar el edificio (Cantidad de pisos)." };
    }
    const maxPisos = parseInt(db.configEdificio.pisos);
    const formatoValido = /^[0-9]+-[A-Z]$/;

    if (!formatoValido.test(depto.numero)) {
        return { ok: false, error: "Formato inválido. Use: Piso-Letra (Ej: 1-A)." };
    }
    const pisoExtraido = parseInt(depto.numero.split('-')[0]);
    const pisoIngresado = parseInt(depto.piso);

    if (pisoExtraido !== pisoIngresado) {
        return { ok: false, error: `Inconsistencia: El departamento indica piso ${pisoExtraido} pero seleccionó piso ${pisoIngresado}.` };
    }
    if (pisoIngresado > maxPisos) {
        return { ok: false, error: `Error: El edificio solo tiene ${maxPisos} pisos.` };
    }
    if (db.departamentos.find(d => d.numero === depto.numero)) {
        return { ok: false, error: "Esta unidad ya existe." };
    }

    depto.id = Date.now();
    depto.saldo = 0;
    db.departamentos.push(depto);
    guardarTodo(db);
    return { ok: true };
}

function eliminarDepartamento(id) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id === id);
    if (depto.emailPropietario || depto.emailInquilino) {
        return { ok: false, error: "No se puede eliminar una unidad vinculada." };
    }
    db.departamentos = db.departamentos.filter(d => d.id !== id);
    guardarTodo(db);
    return { ok: true };
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