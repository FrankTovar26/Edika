// ==========================================
// BASE DE DATOS LOCAL
// ==========================================

function obtenerTodo() {
    const data = localStorage.getItem("edifika_db");

    const db = data ? JSON.parse(data) : {
        configEdificio: null,
        edificios: [],
        departamentos: [],
        unidadesGeneradas: [],
        usuarios: [],
        gastosMensuales: [],
        areasComunes: [],
        reservas: [],
        anuncios: [],
        notificaciones: [],
        correosEnviados: [],
        lecturasAnuncios: []
    };

    if (!db.edificios) db.edificios = [];
    if (!db.departamentos) db.departamentos = [];
    if (!db.unidadesGeneradas) db.unidadesGeneradas = [];
    if (!db.usuarios) db.usuarios = [];
    if (!db.gastosMensuales) db.gastosMensuales = [];
    if (!db.areasComunes) db.areasComunes = [];
    if (!db.reservas) db.reservas = [];
    if (!db.anuncios) db.anuncios = [];
    if (!db.notificaciones) db.notificaciones = [];
    if (!db.correosEnviados) db.correosEnviados = [];
    if (!db.lecturasAnuncios) db.lecturasAnuncios = [];

    migrarRolesYEdificios(db);

    db.departamentos.forEach(unidad => {
        if (!unidad.autorizados) unidad.autorizados = [];
    });

    return db;
}

function guardarTodo(db) {
    localStorage.setItem("edifika_db", JSON.stringify(db));
}

function migrarRolesYEdificios(db) {
    db.usuarios = db.usuarios || [];
    db.edificios = db.edificios || [];

    db.usuarios.forEach(usuario => {
        if (usuario.correo === "admin@edifika.com") {
            usuario.rol = "superadmin";
            usuario.esSuperAdmin = true;
        }

        if (usuario.rol === "admin" && usuario.correo === "admin@edifika.com") {
            usuario.rol = "superadmin";
            usuario.esSuperAdmin = true;
        }

        if (!usuario.edificioIds) usuario.edificioIds = [];

        if (usuario.rol === "residente" && !usuario.unidadesAutorizadas) {
            usuario.unidadesAutorizadas = [];
        }
    });

    db.edificios.forEach(edificio => {
        if (!edificio.administradoresIds) edificio.administradoresIds = [];
        if (!edificio.creadoPor) edificio.creadoPor = "sistema";
    });

    const edificioActivo = db.edificios.find(e => e.activo);

    if (edificioActivo) {
        asignarEdificioIdSiFalta(db.departamentos, edificioActivo.id);
        asignarEdificioIdSiFalta(db.unidadesGeneradas, edificioActivo.id);
        asignarEdificioIdSiFalta(db.areasComunes, edificioActivo.id);
        asignarEdificioIdSiFalta(db.reservas, edificioActivo.id);
        asignarEdificioIdSiFalta(db.anuncios, edificioActivo.id);
        asignarEdificioIdSiFalta(db.gastosMensuales, edificioActivo.id);

        if (db.configEdificio && !db.configEdificio.edificioId) {
            db.configEdificio.edificioId = edificioActivo.id;
        }
    }
}

function asignarEdificioIdSiFalta(lista, edificioId) {
    (lista || []).forEach(item => {
        if (!item.edificioId) {
            item.edificioId = edificioId;
        }
    });
}

// ==========================================
// SESIÓN, ROLES Y PERMISOS
// ==========================================

function obtenerSesionActualData() {
    return JSON.parse(localStorage.getItem("usuarioSesion"));
}

function esSuperAdmin(usuario = null) {
    const sesion = usuario || obtenerSesionActualData();

    return sesion?.rol === "superadmin" || sesion?.esSuperAdmin === true;
}

function esAdminEdificio(usuario = null) {
    const sesion = usuario || obtenerSesionActualData();

    return sesion?.rol === "admin";
}

function esResidente(usuario = null) {
    const sesion = usuario || obtenerSesionActualData();

    return sesion?.rol === "residente";
}

function obtenerEdificioActivoId() {
    const sesion = obtenerSesionActualData();
    const db = obtenerTodo();

    if (esSuperAdmin(sesion)) {
        const edificioSeleccionado = localStorage.getItem("edifika_edificio_activo");

        if (edificioSeleccionado && edificioSeleccionado !== "todos") {
            return edificioSeleccionado;
        }

        const activo = db.edificios.find(e => e.activo);
        return activo?.id || null;
    }

    if (esAdminEdificio(sesion)) {
        return sesion.edificioId || sesion.edificioIds?.[0] || null;
    }

    if (esResidente(sesion)) {
        const unidad = (sesion.unidadesAutorizadas || [])[0];
        return unidad?.edificioId || sesion.edificioId || null;
    }

    const activo = db.edificios.find(e => e.activo);
    return activo?.id || null;
}

function obtenerEdificiosPermitidosSesion() {
    const sesion = obtenerSesionActualData();
    const db = obtenerTodo();

    if (esSuperAdmin(sesion)) {
        const edificioSeleccionado = localStorage.getItem("edifika_edificio_activo");

        if (edificioSeleccionado && edificioSeleccionado !== "todos") {
            return [edificioSeleccionado];
        }

        return db.edificios.map(e => String(e.id));
    }

    if (esAdminEdificio(sesion)) {
        return (sesion.edificioIds || [sesion.edificioId])
            .filter(Boolean)
            .map(String);
    }

    if (esResidente(sesion)) {
        const ids = (sesion.unidadesAutorizadas || [])
            .map(u => u.edificioId)
            .filter(Boolean)
            .map(String);

        if (sesion.edificioId) ids.push(String(sesion.edificioId));

        return [...new Set(ids)];
    }

    return [];
}

function usuarioPuedeVerEdificio(edificioId) {
    const permitidos = obtenerEdificiosPermitidosSesion();

    if (permitidos.length === 0) return true;

    return permitidos.includes(String(edificioId));
}

function filtrarPorEdificioPermitido(lista) {
    const permitidos = obtenerEdificiosPermitidosSesion();

    if (permitidos.length === 0) return lista || [];

    return (lista || []).filter(item =>
        !item.edificioId || permitidos.includes(String(item.edificioId))
    );
}

function protegerPaginaAdminData() {
    const sesion = obtenerSesionActualData();

    if (!sesion) {
        window.location.href = "../../../index.html";
        return false;
    }

    if (sesion.rol !== "admin" && sesion.rol !== "superadmin") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../residente/inicio.html";
        return false;
    }

    return true;
}

function obtenerEdificioPorId(db, edificioId) {
    return (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    ) || null;
}

// ==========================================
// CONFIGURACIÓN EDIFICIO
// ==========================================

function guardarConfiguracionEdificio(config) {
    const db = obtenerTodo();

    const edificioId = config.edificioId || obtenerEdificioActivoId();

    db.configEdificio = {
        edificioId,
        nombre: config.nombre,
        direccion: config.direccion,
        pisos: config.pisos,
        sotanos: config.sotanos || 0,
        tieneOficinas: config.tieneOficinas || "no",
        tieneEstacionamientos: config.tieneEstacionamientos || "si",
        tieneDepositos: config.tieneDepositos || "si",
        modoConfiguracion: config.modoConfiguracion || "simple",
        departamentosPorPiso: config.departamentosPorPiso || 0,
        oficinasPorPiso: config.oficinasPorPiso || 0,
        estacionamientosPorSotano: config.estacionamientosPorSotano || 0,
        depositosPorSotano: config.depositosPorSotano || 0,
        configuracionAvanzada: config.configuracionAvanzada || [],
        fechaRegistro: new Date().toISOString()
    };

    guardarTodo(db);

    return { ok: true };
}

function validarCambioPisos(nuevoMaximo, edificioId = null) {
    const db = obtenerTodo();
    const edificioFiltro = edificioId || obtenerEdificioActivoId();

    const unidadInvalida = db.departamentos.find(unidad => {
        if (edificioFiltro && String(unidad.edificioId) !== String(edificioFiltro)) return false;

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
        String(item.numero).toUpperCase() === datos.numero &&
        String(item.edificioId || "") === String(datos.edificioId || "")
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe una unidad con ese código en este edificio."
        };
    }

    const nuevaUnidad = {
        id: Date.now().toString(),
        edificioId: datos.edificioId,
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

    const datos = normalizarDatosUnidad({
        ...unidad,
        edificioId: unidad.edificioId || existente.edificioId
    });

    const validacion = validarUnidad(datos, db);

    if (!validacion.ok) return validacion;

    const duplicado = db.departamentos.some(item =>
        String(item.id) !== String(id) &&
        String(item.numero).toUpperCase() === datos.numero &&
        String(item.edificioId || "") === String(datos.edificioId || "")
    );

    if (duplicado) {
        return {
            ok: false,
            error: "Ya existe otra unidad con ese código en este edificio."
        };
    }

    existente.edificioId = datos.edificioId;
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
        edificioId: String(unidad.edificioId || obtenerEdificioActivoId() || "").trim(),
        numero: String(unidad.numero || "").trim().toUpperCase(),
        piso: String(unidad.piso || "").trim(),
        tipo: normalizarTipoUnidadData(unidad.tipo),
        estado: normalizarEstadoUnidadData(unidad.estado),
        observaciones: String(unidad.observaciones || "").trim()
    };
}

function validarUnidad(datos, db) {
    if (!datos.edificioId) {
        return {
            ok: false,
            error: "La unidad debe estar asociada a un edificio."
        };
    }

    if (!datos.numero || !datos.piso || !datos.tipo) {
        return {
            ok: false,
            error: "Completa todos los datos de la unidad."
        };
    }

    const config = obtenerConfigEdificioParaUnidad(db, datos.edificioId);

    if (!config) {
        return {
            ok: false,
            error: "No existe una configuración para el edificio seleccionado."
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

    return validarFormatoUnidad(datos.numero, datos.tipo, datos.piso, datos.edificioId);
}

function obtenerConfigEdificioParaUnidad(db, edificioId) {
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    );

    if (edificio) {
        return {
            edificioId: edificio.id,
            pisos: edificio.pisos,
            sotanos: edificio.sotanos,
            tieneOficinas: edificio.tieneOficinas,
            tieneEstacionamientos: edificio.tieneEstacionamientos,
            tieneDepositos: edificio.tieneDepositos,
            modoConfiguracion: edificio.modoConfiguracion,
            departamentosPorPiso: edificio.departamentosPorPiso,
            oficinasPorPiso: edificio.oficinasPorPiso,
            estacionamientosPorSotano: edificio.estacionamientosPorSotano,
            depositosPorSotano: edificio.depositosPorSotano,
            configuracionAvanzada: edificio.configuracionAvanzada || []
        };
    }

    if (db.configEdificio && String(db.configEdificio.edificioId || "") === String(edificioId)) {
        return db.configEdificio;
    }

    return db.configEdificio || null;
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

function validarFormatoUnidad(numero, tipo, piso, edificioId = null) {
    const unidadGenerada = validarFormatoUnidadGenerada(numero, tipo, piso, edificioId);

    if (unidadGenerada.ok) {
        return { ok: true };
    }

    if (tipo === "departamento") {
        if (!/^DPTO\s+[0-9]+$/i.test(numero)) {
            return {
                ok: false,
                error: "Formato inválido para departamento. Ejemplo: Dpto 101."
            };
        }

        const numeroDepartamento = numero.replace(/DPTO\s+/i, "");
        const pisoCodigo = numeroDepartamento.charAt(0);

        if (String(pisoCodigo) !== String(piso)) {
            return {
                ok: false,
                error: "El código del departamento debe iniciar con el piso seleccionado. Ejemplo: Piso 2 → Dpto 201."
            };
        }
    }

    if (tipo === "oficina") {
        if (!/^OF\s+[0-9]+$/i.test(numero)) {
            return {
                ok: false,
                error: "Formato inválido para oficina/local. Ejemplo: Of 201."
            };
        }

        const numeroOficina = numero.replace(/OF\s+/i, "");
        const pisoCodigo = numeroOficina.charAt(0);

        if (String(pisoCodigo) !== String(piso)) {
            return {
                ok: false,
                error: "El código de oficina debe iniciar con el piso seleccionado. Ejemplo: Piso 2 → Of 201."
            };
        }
    }

    if (tipo === "estacionamiento") {
        if (!/^E-S[0-9]+-[0-9]+$/i.test(numero)) {
            return {
                ok: false,
                error: "Formato inválido para estacionamiento. Ejemplo: E-S1-01."
            };
        }

        const sotanoCodigo = numero.match(/^E-(S[0-9]+)-[0-9]+$/i)?.[1];

        if (String(sotanoCodigo).toUpperCase() !== String(piso).toUpperCase()) {
            return {
                ok: false,
                error: "El sótano del código no coincide con la ubicación seleccionada."
            };
        }
    }

    if (tipo === "deposito") {
        if (!/^D-S[0-9]+-[0-9]+$/i.test(numero)) {
            return {
                ok: false,
                error: "Formato inválido para depósito. Ejemplo: D-S1-01."
            };
        }

        const sotanoCodigo = numero.match(/^D-(S[0-9]+)-[0-9]+$/i)?.[1];

        if (String(sotanoCodigo).toUpperCase() !== String(piso).toUpperCase()) {
            return {
                ok: false,
                error: "El sótano del código no coincide con la ubicación seleccionada."
            };
        }
    }

    return { ok: true };
}

function validarFormatoUnidadGenerada(numero, tipo, piso, edificioId = null) {
    const db = obtenerTodo();

    const unidad = (db.unidadesGeneradas || []).find(item => {
        const mismoCodigo = String(item.codigo).toUpperCase() === String(numero).toUpperCase();
        const mismoEdificio = edificioId ? String(item.edificioId || "") === String(edificioId) : true;

        return mismoCodigo && mismoEdificio;
    });

    if (!unidad) {
        return { ok: false };
    }

    if (normalizarTipoUnidadData(unidad.tipo) !== tipo) {
        return {
            ok: false,
            error: "El tipo de unidad no coincide con la nomenclatura generada."
        };
    }

    if (String(unidad.piso).toUpperCase() !== String(piso).toUpperCase()) {
        return {
            ok: false,
            error: "La ubicación no coincide con la nomenclatura generada."
        };
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
// USUARIOS ADMINISTRADORES
// ==========================================

function crearAdministradorEdificio(datosAdmin) {
    const db = obtenerTodo();

    const nombre = String(datosAdmin.nombre || "").trim();
    const correo = String(datosAdmin.correo || "").trim().toLowerCase();
    const clave = String(datosAdmin.clave || "").trim();
    const edificioIds = (datosAdmin.edificioIds || [datosAdmin.edificioId])
        .filter(Boolean)
        .map(String);

    if (!nombre || !correo || !clave || edificioIds.length === 0) {
        return {
            ok: false,
            error: "Completa los datos del administrador y selecciona al menos un edificio."
        };
    }

    const existe = db.usuarios.some(usuario =>
        String(usuario.correo || "").toLowerCase() === correo
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe un usuario registrado con ese correo."
        };
    }

    const nuevoAdmin = {
        id: Date.now().toString(),
        nombre,
        correo,
        clave,
        rol: "admin",
        edificioIds,
        edificioId: edificioIds[0],
        fechaRegistro: new Date().toISOString()
    };

    db.usuarios.push(nuevoAdmin);

    db.edificios.forEach(edificio => {
        if (edificioIds.includes(String(edificio.id))) {
            edificio.administradoresIds = edificio.administradoresIds || [];

            if (!edificio.administradoresIds.includes(nuevoAdmin.id)) {
                edificio.administradoresIds.push(nuevoAdmin.id);
            }
        }
    });

    guardarTodo(db);

    return {
        ok: true,
        usuario: nuevoAdmin
    };
}

function actualizarAdministradorEdificio(usuarioId, datosAdmin) {
    const db = obtenerTodo();

    const usuario = db.usuarios.find(u =>
        String(u.id) === String(usuarioId)
    );

    if (!usuario) {
        return {
            ok: false,
            error: "Administrador no encontrado."
        };
    }

    const edificioIds = (datosAdmin.edificioIds || [datosAdmin.edificioId])
        .filter(Boolean)
        .map(String);

    usuario.nombre = String(datosAdmin.nombre || usuario.nombre || "").trim();
    usuario.correo = String(datosAdmin.correo || usuario.correo || "").trim().toLowerCase();

    if (datosAdmin.clave) {
        usuario.clave = String(datosAdmin.clave).trim();
    }

    usuario.rol = "admin";
    usuario.edificioIds = edificioIds;
    usuario.edificioId = edificioIds[0] || null;

    db.edificios.forEach(edificio => {
        edificio.administradoresIds = (edificio.administradoresIds || []).filter(id =>
            String(id) !== String(usuario.id)
        );

        if (edificioIds.includes(String(edificio.id))) {
            edificio.administradoresIds.push(usuario.id);
        }
    });

    guardarTodo(db);

    return {
        ok: true,
        usuario
    };
}

function eliminarAdministradorEdificio(usuarioId) {
    const db = obtenerTodo();

    const usuario = db.usuarios.find(u =>
        String(u.id) === String(usuarioId)
    );

    if (!usuario) {
        return {
            ok: false,
            error: "Administrador no encontrado."
        };
    }

    if (usuario.rol !== "admin") {
        return {
            ok: false,
            error: "Solo puedes eliminar administradores secundarios desde esta función."
        };
    }

    db.usuarios = db.usuarios.filter(u =>
        String(u.id) !== String(usuarioId)
    );

    db.edificios.forEach(edificio => {
        edificio.administradoresIds = (edificio.administradoresIds || []).filter(id =>
            String(id) !== String(usuarioId)
        );
    });

    guardarTodo(db);

    return { ok: true };
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
    const edificioId = area.edificioId || obtenerEdificioActivoId();

    if (!nombre) {
        return {
            ok: false,
            error: "Ingresa el nombre del área común."
        };
    }

    if (!edificioId) {
        return {
            ok: false,
            error: "Selecciona un edificio para registrar el área común."
        };
    }

    const duplicado = db.areasComunes.some(item =>
        String(item.nombre).toLowerCase() === nombre.toLowerCase() &&
        String(item.edificioId || "") === String(edificioId)
    );

    if (duplicado) {
        return {
            ok: false,
            error: "Ya existe un área común con ese nombre en este edificio."
        };
    }

    const nuevaArea = {
        id: Date.now().toString(),
        edificioId,
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
        edificioId: reserva.edificioId || area.edificioId || obtenerEdificioActivoId(),
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
    localStorage.removeItem("usuarioSesion");
    localStorage.removeItem("edifika_edificio_activo");
}