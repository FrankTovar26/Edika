document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    inicializarEdificios();
    renderizarEdificios();
    configurarFormulario();
    configurarBotones();
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

function inicializarEdificios() {
    const db = obtenerTodo();

    db.edificios = db.edificios || [];

    if (db.configEdificio && db.edificios.length === 0) {
        db.edificios.push({
            id: Date.now(),
            nombre: db.configEdificio.nombre,
            direccion: db.configEdificio.direccion,
            pisos: db.configEdificio.pisos,
            activo: true,
            fechaCreacion: new Date().toISOString()
        });
    }

    guardarTodo(db);
}

function configurarFormulario() {
    const form = document.getElementById("formEdificio");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("edificioId").value;
        const nombre = document.getElementById("nombreEdificio").value.trim();
        const direccion = document.getElementById("direccionEdificio").value.trim();
        const pisos = document.getElementById("pisosEdificio").value;

        if (!nombre || !direccion || !pisos) {
            alert("Completa todos los campos.");
            return;
        }

        if (id) {
            editarEdificio(id, nombre, direccion, pisos);
        } else {
            registrarEdificio(nombre, direccion, pisos);
        }

        limpiarFormulario();
        renderizarEdificios();
    });
}

function configurarBotones() {
    document.getElementById("btnCancelarEdicion").addEventListener("click", limpiarFormulario);

    document.getElementById("btnLimpiarDB").addEventListener("click", () => {
        const confirmar = confirm("¿Seguro que deseas borrar toda la base de datos?");

        if (!confirmar) return;

        limpiarDB();
        window.location.href = "../../../index.html";
    });
}

function registrarEdificio(nombre, direccion, pisos) {
    const db = obtenerTodo();

    db.edificios = db.edificios || [];

    const nuevoEdificio = {
        id: Date.now(),
        nombre,
        direccion,
        pisos,
        activo: db.edificios.length === 0,
        fechaCreacion: new Date().toISOString()
    };

    db.edificios.push(nuevoEdificio);

    if (nuevoEdificio.activo) {
        db.configEdificio = {
            nombre,
            direccion,
            pisos
        };
    }

    guardarTodo(db);

    alert("Edificio registrado correctamente.");
}

function editarEdificio(id, nombre, direccion, pisos) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) {
        alert("Edificio no encontrado.");
        return;
    }

    if (edificio.activo) {
        const validacion = validarCambioPisos(pisos);

        if (!validacion.ok) {
            alert(validacion.error);
            return;
        }
    }

    edificio.nombre = nombre;
    edificio.direccion = direccion;
    edificio.pisos = pisos;

    if (edificio.activo) {
        db.configEdificio = {
            nombre,
            direccion,
            pisos
        };
    }

    guardarTodo(db);

    alert("Edificio actualizado correctamente.");
}

function renderizarEdificios() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaEdificios");

    const edificios = db.edificios || [];

    if (edificios.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6">No hay edificios registrados.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = edificios.map(edificio => `
        <tr>
            <td>${edificio.nombre}</td>
            <td>${edificio.direccion}</td>
            <td>${edificio.pisos}</td>
            <td>
                <span class="badge ${edificio.activo ? "vacio" : "ocupado"}">
                    ${edificio.activo ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td>${formatearFecha(edificio.fechaCreacion)}</td>
            <td>
                <button class="btn btn-blue" onclick="cargarEdificioParaEditar('${edificio.id}')">
                    Editar
                </button>

                <button class="btn btn-green" onclick="activarEdificio('${edificio.id}')">
                    Activar
                </button>

                <button class="btn btn-red" onclick="desactivarEdificio('${edificio.id}')">
                    Desactivar
                </button>
            </td>
        </tr>
    `).join("");
}

function cargarEdificioParaEditar(id) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    document.getElementById("edificioId").value = edificio.id;
    document.getElementById("nombreEdificio").value = edificio.nombre;
    document.getElementById("direccionEdificio").value = edificio.direccion;
    document.getElementById("pisosEdificio").value = edificio.pisos;
}

function activarEdificio(id) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    db.edificios.forEach(e => e.activo = false);

    edificio.activo = true;

    db.configEdificio = {
        nombre: edificio.nombre,
        direccion: edificio.direccion,
        pisos: edificio.pisos
    };

    guardarTodo(db);
    renderizarEdificios();

    alert("Edificio activado correctamente.");
}

function desactivarEdificio(id) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    edificio.activo = false;

    const activo = db.edificios.find(e => e.activo);

    db.configEdificio = activo
        ? {
            nombre: activo.nombre,
            direccion: activo.direccion,
            pisos: activo.pisos
        }
        : null;

    guardarTodo(db);
    renderizarEdificios();

    alert("Edificio desactivado correctamente.");
}

function limpiarFormulario() {
    document.getElementById("formEdificio").reset();
    document.getElementById("edificioId").value = "";
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return "-";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}