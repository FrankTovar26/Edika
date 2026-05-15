document.addEventListener("DOMContentLoaded", () => {
    const loginView = document.getElementById("loginView");
    const registerView = document.getElementById("registerView");

    const showRegisterBtn = document.getElementById("showRegisterBtn");
    const showLoginBtn = document.getElementById("showLoginBtn");

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (showRegisterBtn) {
        showRegisterBtn.addEventListener("click", () => {
            loginView.classList.add("hidden");
            registerView.classList.remove("hidden");
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener("click", () => {
            registerView.classList.add("hidden");
            loginView.classList.remove("hidden");
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", iniciarSesion);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", activarCuenta);
    }
});

function iniciarSesion(event) {
    event.preventDefault();

    const correo = document.getElementById("emailLogin").value.trim().toLowerCase();
    const clave = document.getElementById("passwordLogin").value.trim();

    const usuarios = obtenerUsuarios();

    const usuario = usuarios.find(u =>
        String(u.correo).toLowerCase() === correo &&
        String(u.clave) === clave
    );

    if (!usuario) {
        alert("Correo o clave incorrectos.");
        return;
    }

    localStorage.setItem("usuarioSesion", JSON.stringify(usuario));

    if (usuario.rol === "admin") {
        window.location.href = "src/pages/admin/dashboard.html";
        return;
    }

    if (usuario.rol === "residente") {
        window.location.href = "src/pages/residente/inicio.html";
        return;
    }

    alert("El usuario no tiene un rol válido.");
}

function activarCuenta(event) {
    event.preventDefault();

    const correo = document.getElementById("registerEmail").value.trim().toLowerCase();
    const nombre = document.getElementById("registerName").value.trim();
    const dni = document.getElementById("registerDni").value.trim();
    const clave = document.getElementById("registerPassword").value.trim();

    if (!correo || !nombre || !dni || !clave) {
        alert("Completa todos los campos.");
        return;
    }

    const db = obtenerTodo();
    db.usuarios = db.usuarios || [];

    const usuarioExistente = db.usuarios.find(u =>
        String(u.correo).toLowerCase() === correo
    );

    if (usuarioExistente) {
        alert("Este correo ya tiene una cuenta activada. Inicia sesión con tu contraseña.");
        return;
    }

    const invitaciones = buscarInvitacionesPendientesPorCorreo(db, correo);

    if (invitaciones.length === 0) {
        alert("No existen invitaciones pendientes para este correo.");
        return;
    }

    const unidadesAutorizadas = invitaciones.map(invitacion => ({
        unidadId: invitacion.unidad.id,
        unidadNumero: invitacion.unidad.numero,
        tipoUnidad: normalizarTipoUnidadAuth(invitacion.unidad.tipo),
        tipoVinculacion: invitacion.tipoVinculacion
    }));

    const unidadPrincipal = obtenerUnidadPrincipal(unidadesAutorizadas);

    const nuevoUsuario = {
        id: Date.now().toString(),
        nombre,
        dni,
        correo,
        clave,
        rol: "residente",

        unidadPrincipalId: unidadPrincipal.unidadId,
        unidadPrincipalNumero: unidadPrincipal.unidadNumero,

        departamentoId: unidadPrincipal.unidadId,
        departamentoNumero: unidadPrincipal.unidadNumero,

        tipoUnidad: unidadPrincipal.tipoUnidad,
        tipoResidente: unidadPrincipal.tipoVinculacion,

        unidadesAutorizadas
    };

    db.usuarios.push(nuevoUsuario);

    invitaciones.forEach(invitacion => {
        marcarInvitacionAceptada(invitacion, nombre, dni, clave);
    });

    guardarTodo(db);

    alert(`Cuenta activada correctamente. Se vincularon ${unidadesAutorizadas.length} unidad(es) a tu usuario.`);

    document.getElementById("registerForm").reset();

    document.getElementById("registerView").classList.add("hidden");
    document.getElementById("loginView").classList.remove("hidden");
}

function buscarInvitacionesPendientesPorCorreo(db, correo) {
    const unidades = db.departamentos || [];
    const invitaciones = [];

    unidades.forEach(unidad => {
        if (
            unidad.emailPropietario &&
            String(unidad.emailPropietario).toLowerCase() === correo &&
            (unidad.estadoInvitacion || "pendiente") !== "aceptada"
        ) {
            invitaciones.push({
                unidad,
                tipoVinculacion: "propietario",
                estado: unidad.estadoInvitacion || "pendiente"
            });
        }

        if (
            unidad.emailInquilino &&
            String(unidad.emailInquilino).toLowerCase() === correo &&
            (unidad.estadoInquilino || "pendiente") !== "aceptada"
        ) {
            invitaciones.push({
                unidad,
                tipoVinculacion: "inquilino",
                estado: unidad.estadoInquilino || "pendiente"
            });
        }

        (unidad.autorizados || []).forEach(autorizado => {
            if (
                String(autorizado.correo).toLowerCase() === correo &&
                (autorizado.estado || "pendiente") !== "aceptada"
            ) {
                invitaciones.push({
                    unidad,
                    autorizado,
                    tipoVinculacion: "autorizado",
                    estado: autorizado.estado || "pendiente"
                });
            }
        });
    });

    return invitaciones;
}

function obtenerUnidadPrincipal(unidadesAutorizadas) {
    const propietarioDepartamento = unidadesAutorizadas.find(unidad =>
        unidad.tipoUnidad === "departamento" &&
        unidad.tipoVinculacion === "propietario"
    );

    if (propietarioDepartamento) return propietarioDepartamento;

    const inquilinoDepartamento = unidadesAutorizadas.find(unidad =>
        unidad.tipoUnidad === "departamento" &&
        unidad.tipoVinculacion === "inquilino"
    );

    if (inquilinoDepartamento) return inquilinoDepartamento;

    const departamento = unidadesAutorizadas.find(unidad =>
        unidad.tipoUnidad === "departamento"
    );

    if (departamento) return departamento;

    return unidadesAutorizadas[0];
}

function marcarInvitacionAceptada(invitacion, nombre, dni, clave) {
    const unidad = invitacion.unidad;

    if (invitacion.tipoVinculacion === "propietario") {
        unidad.estadoInvitacion = "aceptada";
        unidad.nombreReal = nombre;
        unidad.dniPropietario = dni;
        unidad.password = clave;
        unidad.residente = nombre;
        return;
    }

    if (invitacion.tipoVinculacion === "inquilino") {
        unidad.estadoInquilino = "aceptada";
        unidad.nombreInquilino = nombre;
        unidad.dniInquilino = dni;
        unidad.passwordInquilino = clave;
        unidad.residente = nombre;
        return;
    }

    if (invitacion.tipoVinculacion === "autorizado" && invitacion.autorizado) {
        invitacion.autorizado.estado = "aceptada";
        invitacion.autorizado.nombre = nombre;
        invitacion.autorizado.dni = dni;
        invitacion.autorizado.password = clave;
    }
}

function obtenerUsuarios() {
    const db = obtenerTodo();

    const usuariosSistema = db.usuarios || [];

    const usuariosDemo = [
        {
            id: "1",
            nombre: "Administrador",
            correo: "admin@edifika.com",
            clave: "123456",
            rol: "admin"
        }
    ];

    return [...usuariosDemo, ...usuariosSistema];
}

function normalizarTipoUnidadAuth(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}