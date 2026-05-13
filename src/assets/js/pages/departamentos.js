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

    if (!selectPiso) return;

    if (!db.configEdificio || !db.configEdificio.pisos) {
        alert("Primero debes configurar la cantidad de pisos del edificio.");
        window.location.href = "config.html";
        return;
    }

    const maxPisos = parseInt(db.configEdificio.pisos);

    selectPiso.innerHTML = `<option value="">Seleccione piso...</option>`;

    for (let i = 1; i <= maxPisos; i++) {
        selectPiso.innerHTML += `<option value="${i}">Piso ${i}</option>`;
    }
}

function configurarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const numero = document
            .getElementById("numeroDepartamento")
            .value
            .trim()
            .toUpperCase();

        const piso = document.getElementById("pisoDepartamento").value;

        const resultado = agregarDepartamento({
            numero,
            piso
        });

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        form.reset();
        document.getElementById("numeroDepartamento").focus();

        renderizarDepartamentos();
    });
}

function renderizarDepartamentos() {
    const tbody = document.getElementById("listaDepartamentos");

    if (!tbody) return;

    const db = obtenerTodo();
    const departamentos = db.departamentos || [];

    const departamentosOrdenados = [...departamentos].sort((a, b) => {
        if (parseInt(a.piso) !== parseInt(b.piso)) {
            return parseInt(a.piso) - parseInt(b.piso);
        }

        return String(a.numero).localeCompare(String(b.numero));
    });

    if (departamentosOrdenados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3">No hay unidades registradas.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = departamentosOrdenados.map(departamento => `
        <tr>
            <td><strong>${departamento.numero}</strong></td>
            <td>Piso ${departamento.piso}</td>
            <td>
                <button 
                    class="btn btn-red" 
                    onclick="eliminarUnidad('${departamento.id}')"
                >
                    Eliminar
                </button>
            </td>
        </tr>
    `).join("");
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
}