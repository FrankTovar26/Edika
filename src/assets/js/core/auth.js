document.addEventListener("DOMContentLoaded", () => {
    const loginView = document.getElementById("loginView");
    const registerView = document.getElementById("registerView");

    const showRegisterBtn = document.getElementById("showRegisterBtn");
    const showLoginBtn = document.getElementById("showLoginBtn");

    const loginForm = document.getElementById("loginForm");

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
});

function iniciarSesion(event) {
    event.preventDefault();

    const correo = document.getElementById("emailLogin").value.trim();
    const clave = document.getElementById("passwordLogin").value.trim();

    const usuarios = obtenerUsuariosDemo();

    const usuario = usuarios.find(u =>
        u.correo === correo &&
        u.clave === clave
    );

    if (!usuario) {
        alert("Correo o clave incorrectos");
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

function obtenerUsuariosDemo() {
    return [
        {
            id: 1,
            nombre: "Administrador",
            correo: "admin@edifika.com",
            clave: "123456",
            rol: "admin"
        },
        {
            id: 2,
            nombre: "Residente Demo",
            correo: "residente@edifika.com",
            clave: "123456",
            rol: "residente"
        }
    ];
}