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
            id: Date.now().toString(),
            nombre: db.configEdificio.nombre,
            direccion: db.configEdificio.direccion,
            pisos: db.configEdificio.pisos,
            sotanos: db.configEdificio.sotanos || 0,
            tieneOficinas: db.configEdificio.tieneOficinas || "no",
            tieneEstacionamientos: db.configEdificio.tieneEstacionamientos || "si",
            tieneDepositos: db.configEdificio.tieneDepositos || "si",
            activo: true,
            fechaCreacion: db.configEdificio.fechaRegistro || new Date().toISOString()
        });
    }

    guardarTodo(db);
}

function configurarFormulario() {
    const form = document.getElementById("formEdificio");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("edificioId").value;

        const datos = {
            nombre: document.getElementById("nombreEdificio").value.trim(),
            direccion: document.getElementById("direccionEdificio").value.trim(),
            pisos: document.getElementById("pisosEdificio").value,
            sotanos: document.getElementById("sotanosEdificio").value,
            tieneOficinas: document.getElementById("tieneOficinas").value,
            tieneEstacionamientos: document.getElementById("tieneEstacionamientos").value,
            tieneDepositos: document.getElementById("tieneDepositos").value
        };

        if (!datos.nombre || !datos.direccion || !datos.pisos) {
            alert("Completa los campos obligatorios.");
            return;
        }

        if (Number(datos.pisos) < 1) {
            alert("El edificio debe tener al menos 1 piso superior.");
            return;
        }

        if (Number(datos.sotanos) < 0) {
            alert("La cantidad de sótanos no puede ser negativa.");
            return;
        }

        if (id) {
            editarEdificio(id, datos);
        } else {
            registrarEdificio(datos);
        }

        limpiarFormulario();
        renderizarEdificios();
    });
}

function configurarBotones() {
    const btnCancelar = document.getElementById("btnCancelarEdicion");
    const btnLimpiar = document.getElementById("btnLimpiarDB");

    if (btnCancelar) {
        btnCancelar.addEventListener("click", limpiarFormulario);
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            const confirmar = confirm("¿Seguro que deseas borrar toda la base de datos?");

            if (!confirmar) return;

            limpiarDB();
            window.location.href = "../../../index.html";
        });
    }
}

function registrarEdificio(datos) {
    const db = obtenerTodo();

    db.edificios = db.edificios || [];

    const nuevoEdificio = {
        id: Date.now().toString(),
        nombre: datos.nombre,
        direccion: datos.direccion,
        pisos: datos.pisos,
        sotanos: datos.sotanos || 0,
        tieneOficinas: datos.tieneOficinas,
        tieneEstacionamientos: datos.tieneEstacionamientos,
        tieneDepositos: datos.tieneDepositos,
        activo: db.edificios.length === 0,
        fechaCreacion: new Date().toISOString()
    };

    db.edificios.push(nuevoEdificio);

    if (nuevoEdificio.activo) {
        db.configEdificio = crearConfigDesdeEdificio(nuevoEdificio);
    }

    guardarTodo(db);

    alert("Edificio registrado correctamente.");
}

function editarEdificio(id, datos) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) {
        alert("Edificio no encontrado.");
        return;
    }

    if (edificio.activo) {
        const validacion = validarCambioPisos(datos.pisos);

        if (!validacion.ok) {
            alert(validacion.error);
            return;
        }
    }

    edificio.nombre = datos.nombre;
    edificio.direccion = datos.direccion;
    edificio.pisos = datos.pisos;
    edificio.sotanos = datos.sotanos || 0;
    edificio.tieneOficinas = datos.tieneOficinas;
    edificio.tieneEstacionamientos = datos.tieneEstacionamientos;
    edificio.tieneDepositos = datos.tieneDepositos;

    if (edificio.activo) {
        db.configEdificio = crearConfigDesdeEdificio(edificio);
    }

    guardarTodo(db);

    alert("Edificio actualizado correctamente.");
}

function renderizarEdificios() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaEdificios");

    if (!tabla) return;

    const edificios = db.edificios || [];

    if (edificios.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="10">No hay edificios registrados.</td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = edificios.map(edificio => `
        <tr>
            <td>${edificio.nombre}</td>
            <td>${edificio.direccion}</td>
            <td>${edificio.pisos}</td>
            <td>${edificio.sotanos || 0}</td>
            <td>${formatearSiNo(edificio.tieneOficinas)}</td>
            <td>${formatearSiNo(edificio.tieneEstacionamientos)}</td>
            <td>${formatearSiNo(edificio.tieneDepositos)}</td>
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
    document.getElementById("sotanosEdificio").value = edificio.sotanos || 0;
    document.getElementById("tieneOficinas").value = edificio.tieneOficinas || "no";
    document.getElementById("tieneEstacionamientos").value = edificio.tieneEstacionamientos || "si";
    document.getElementById("tieneDepositos").value = edificio.tieneDepositos || "si";
}

function activarEdificio(id) {
    const db = obtenerTodo();

    const edificio = db.edificios.find(e => String(e.id) === String(id));

    if (!edificio) return;

    db.edificios.forEach(e => e.activo = false);

    edificio.activo = true;
    db.configEdificio = crearConfigDesdeEdificio(edificio);

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
        ? crearConfigDesdeEdificio(activo)
        : null;

    guardarTodo(db);
    renderizarEdificios();

    alert("Edificio desactivado correctamente.");
}

function crearConfigDesdeEdificio(edificio) {
    return {
        nombre: edificio.nombre,
        direccion: edificio.direccion,
        pisos: edificio.pisos,
        sotanos: edificio.sotanos || 0,
        tieneOficinas: edificio.tieneOficinas || "no",
        tieneEstacionamientos: edificio.tieneEstacionamientos || "si",
        tieneDepositos: edificio.tieneDepositos || "si"
    };
}

function limpiarFormulario() {
    const form = document.getElementById("formEdificio");

    if (form) form.reset();

    document.getElementById("edificioId").value = "";
    document.getElementById("sotanosEdificio").value = 0;
    document.getElementById("tieneOficinas").value = "no";
    document.getElementById("tieneEstacionamientos").value = "si";
    document.getElementById("tieneDepositos").value = "si";
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

function formatearSiNo(valor) {
    return valor === "si" ? "Sí" : "No";
}