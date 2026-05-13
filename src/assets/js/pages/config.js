document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarConfiguracion();
    configurarFormulario();
    configurarBotonLimpiar();
});

function protegerPaginaAdmin() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "admin") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../residente/inicio.html";
    }
}

function cargarConfiguracion() {
    const db = obtenerTodo();

    if (!db.configEdificio) return;

    document.getElementById("nombreEdificio").value = db.configEdificio.nombre || "";
    document.getElementById("direccionEdificio").value = db.configEdificio.direccion || "";
    document.getElementById("pisosEdificio").value = db.configEdificio.pisos || "";
}

function configurarFormulario() {
    const form = document.getElementById("formConfig");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const nuevoPiso = document.getElementById("pisosEdificio").value;

        const validacion = validarCambioPisos(nuevoPiso);

        if (!validacion.ok) {
            alert(validacion.error);
            return;
        }

        guardarConfiguracionEdificio({
            nombre: document.getElementById("nombreEdificio").value.trim(),
            direccion: document.getElementById("direccionEdificio").value.trim(),
            pisos: nuevoPiso
        });

        alert("Configuración guardada correctamente.");
        window.location.href = "dashboard.html";
    });
}

function configurarBotonLimpiar() {
    const btn = document.getElementById("btnLimpiarDB");

    btn.addEventListener("click", () => {
        const confirmar = confirm("¿Seguro que deseas borrar toda la base de datos? Esta acción no se puede deshacer.");

        if (!confirmar) return;

        limpiarDB();
        alert("Base de datos eliminada correctamente.");
        window.location.href = "../../../index.html";
    });
}