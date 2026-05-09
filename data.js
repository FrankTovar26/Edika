const DB_KEY = 'sistema_edifika_db';

function obtenerTodo() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : { configEdificio: null, departamentos: [] };
}

function guardarTodo(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// --- GESTIÓN DE DEPARTAMENTOS ---
function agregarDepartamento(nuevo) {
    const db = obtenerTodo();
    if (db.departamentos.find(d => d.numero === nuevo.numero)) {
        return { ok: false, error: "El número de departamento ya existe." };
    }
    const depto = {
        id: Date.now(),
        numero: nuevo.numero,
        piso: nuevo.piso,
        propietario: "Sin asignar",
        emailPropietario: null,
        nombreReal: null,
        dni: null,
        estadoInvitacion: "No invitado",
        emailInquilino: null,
        nombreInquilino: null,
        estadoInquilino: "No invitado",
        saldo: Math.floor(Math.random() * 500)
    };
    db.departamentos.push(depto);
    guardarTodo(db);
    return { ok: true };
}

function eliminarDepartamento(id) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == id);
    if (!depto) return { ok: false, error: "No existe." };
    if (depto.emailPropietario || depto.emailInquilino) {
        return { ok: false, error: "No se puede eliminar: tiene residentes vinculados." };
    }
    db.departamentos = db.departamentos.filter(d => d.id != id);
    guardarTodo(db);
    return { ok: true };
}

// --- VINCULACIÓN ---
function vincularPropietario(id, email) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == id);
    depto.emailPropietario = email;
    depto.estadoInvitacion = "Pendiente de Activación";
    guardarTodo(db);
    return { ok: true };
}

function vincularInquilino(id, email) {
    const db = obtenerTodo();
    const depto = db.departamentos.find(d => d.id == id);
    if (!depto.emailPropietario) return { ok: false, error: "Debe asignar un Propietario primero." };
    depto.emailInquilino = email;
    depto.estadoInquilino = "Pendiente de Activación";
    guardarTodo(db);
    return { ok: true };
}

function activarCuenta(id, rol, datos) {
    const db = obtenerTodo();
    const d = db.departamentos.find(x => x.id == id);
    if (rol === "Propietario") {
        d.nombreReal = datos.nombre;
        d.dni = datos.dni;
        d.password = datos.password;
        d.estadoInvitacion = "Activo";
    } else {
        d.nombreInquilino = datos.nombre;
        d.dniInquilino = datos.dni;
        d.passwordInquilino = datos.password;
        d.estadoInquilino = "Activo";
    }
    guardarTodo(db);
    return { ok: true };
}

function guardarConfiguracionEdificio(info) {
    const db = obtenerTodo();
    db.configEdificio = info;
    guardarTodo(db);
}

function limpiarDB() {
    localStorage.removeItem(DB_KEY);
    location.reload();
}