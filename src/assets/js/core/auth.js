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
        u.correo.toLowerCase() === correo &&
        u.clave === clave
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
    const departamentos = db.departamentos || [];

    let departamentoEncontrado = null;
    let tipoResidente = null;

    departamentos.forEach(dep => {
        if (dep.emailPropietario && dep.emailPropietario.toLowerCase() === correo) {
            departamentoEncontrado = dep;
            tipoResidente = "propietario";
        }

        if (dep.emailInquilino && dep.emailInquilino.toLowerCase() === correo) {
            departamentoEncontrado = dep;
            tipoResidente = "inquilino";
        }
    });

    if (!departamentoEncontrado) {
        alert("No existe una invitación pendiente para este correo.");
        return;
    }

    db.usuarios = db.usuarios || [];

    const yaExiste = db.usuarios.some(u => u.correo.toLowerCase() === correo);

    if (yaExiste) {
        alert("Este correo ya tiene una cuenta activada.");
        return;
    }

    const nuevoUsuario = {
        id: Date.now(),
        nombre,
        dni,
        correo,
        clave,
        rol: "residente",
        departamentoId: departamentoEncontrado.id,
        departamentoNumero: departamentoEncontrado.numero,
        tipoResidente
    };

    db.usuarios.push(nuevoUsuario);

    if (tipoResidente === "propietario") {
        departamentoEncontrado.estadoInvitacion = "aceptada";
        departamentoEncontrado.residente = nombre;
    }

    if (tipoResidente === "inquilino") {
        departamentoEncontrado.estadoInquilino = "aceptada";
        departamentoEncontrado.residente = nombre;
    }

    guardarTodo(db);

    alert("Cuenta activada correctamente. Ahora puedes iniciar sesión.");

    document.getElementById("registerForm").reset();

    document.getElementById("registerView").classList.add("hidden");
    document.getElementById("loginView").classList.remove("hidden");
}

function obtenerUsuarios() {
    const db = obtenerTodo();

    const usuariosSistema = db.usuarios || [];

    const usuariosDemo = [
        {
            id: 1,
            nombre: "Administrador",
            correo: "admin@edifika.com",
            clave: "123456",
            rol: "admin"
        }
    ];

    return [...usuariosDemo, ...usuariosSistema];
}