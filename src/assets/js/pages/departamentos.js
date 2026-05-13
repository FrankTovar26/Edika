document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarPisosDisponibles();
    configurarFormularioDepartamento();
    renderizarDepartamentos();
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

function cargarPisosDisponibles() {
    const db = obtenerTodo();
    const selectPiso = document.getElementById("pisoDepartamento");

    if (!db.configEdificio || !db.configEdificio.pisos) {
        alert("Primero debes configurar la cantidad de pisos del edificio.");
        window.location.href = "config.html";
        return;
    }

    selectPiso.innerHTML = `<option value="">Seleccione piso...</option>`;

    for (let i = 1; i <= Number(db.configEdificio.pisos); i++) {
        selectPiso.innerHTML += `<option value="${i}">Piso ${i}</option>`;
    }
}

function configurarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("departamentoId").value;
        const numero = document.getElementById("numeroDepartamento").value.trim().toUpperCase();
        const piso = document.getElementById("pisoDepartamento").value;

        const resultado = id
            ? editarDepartamento(id, { numero, piso })
            : agregarDepartamento({ numero, piso });

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioDepartamento();
        renderizarDepartamentos();

        alert(id ? "Unidad actualizada correctamente." : "Unidad registrada correctamente.");
    });
}

function renderizarDepartamentos() {
    const tbody = document.getElementById("listaDepartamentos");
    const db = obtenerTodo();

    const departamentos = [...(db.departamentos || [])].sort((a, b) => {
        if (Number(a.piso) !== Number(b.piso)) {
            return Number(a.piso) - Number(b.piso);
        }

        return String(a.numero).localeCompare(String(b.numero));
    });

    if (departamentos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">No hay unidades registradas.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = departamentos.map(dep => `
        <tr>
            <td><strong>${dep.numero}</strong></td>
            <td>Piso ${dep.piso}</td>
            <td>${formatearFecha(dep.fechaRegistro)}</td>
            <td>
                <button class="btn btn-blue" onclick="cargarDepartamentoParaEditar('${dep.id}')">
                    Editar
                </button>

                <button class="btn btn-red" onclick="eliminarUnidad('${dep.id}')">
                    Eliminar
                </button>
            </td>
        </tr>
    `).join("");
}

function cargarDepartamentoParaEditar(id) {
    const db = obtenerTodo();

    const departamento = (db.departamentos || []).find(dep =>
        String(dep.id) === String(id)
    );

    if (!departamento) {
        alert("Unidad no encontrada.");
        return;
    }

    document.getElementById("departamentoId").value = departamento.id;
    document.getElementById("numeroDepartamento").value = departamento.numero;
    document.getElementById("pisoDepartamento").value = departamento.piso;
}

function eliminarUnidad(id) {
    const confirmar = confirm("¿Está seguro de eliminar esta unidad?");
    if (!confirmar) return;

    const resultado = eliminarDepartamento(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarDepartamentos();
    alert("Unidad eliminada correctamente.");
}

function limpiarFormularioDepartamento() {
    document.getElementById("formDepartamento").reset();
    document.getElementById("departamentoId").value = "";
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