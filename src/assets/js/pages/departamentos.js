document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();
    cargarPisosDisponibles();
    configurarFormularioDepartamento();
    configurarFiltros();
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
    const filtroPiso = document.getElementById("filtroPisoUnidad");

    if (!db.configEdificio || !db.configEdificio.pisos) {
        alert("Primero debes configurar la cantidad de pisos del edificio.");
        window.location.href = "config.html";
        return;
    }

    if (selectPiso) {
        selectPiso.innerHTML = `<option value="">Seleccione piso...</option>`;
    }

    if (filtroPiso) {
        filtroPiso.innerHTML = `<option value="">Todos</option>`;
    }

    for (let i = 1; i <= Number(db.configEdificio.pisos); i++) {
        if (selectPiso) {
            selectPiso.innerHTML += `<option value="${i}">Piso ${i}</option>`;
        }

        if (filtroPiso) {
            filtroPiso.innerHTML += `<option value="${i}">Piso ${i}</option>`;
        }
    }
}

function configurarFormularioDepartamento() {
    const form = document.getElementById("formDepartamento");
    const btnCancelar = document.getElementById("btnCancelarEdicion");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("departamentoId").value;

        const datos = {
            numero: document.getElementById("numeroDepartamento").value.trim().toUpperCase(),
            piso: document.getElementById("pisoDepartamento").value,
            tipo: document.getElementById("tipoUnidad")?.value || "departamento",
            estado: document.getElementById("estadoUnidad")?.value || "disponible",
            observaciones: document.getElementById("observacionesUnidad")?.value.trim() || ""
        };

        const resultado = id
            ? editarDepartamento(id, datos)
            : agregarDepartamento(datos);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioDepartamento();
        renderizarDepartamentos();

        alert(id ? "Unidad actualizada correctamente." : "Unidad registrada correctamente.");
    });

    if (btnCancelar) {
        btnCancelar.addEventListener("click", limpiarFormularioDepartamento);
    }
}

function configurarFiltros() {
    const filtros = [
        "buscarUnidad",
        "filtroPisoUnidad",
        "filtroTipoUnidad",
        "filtroEstadoUnidad"
    ];

    filtros.forEach(id => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.addEventListener("input", renderizarDepartamentos);
            elemento.addEventListener("change", renderizarDepartamentos);
        }
    });
}

function renderizarDepartamentos() {
    const tbody = document.getElementById("listaDepartamentos");
    const db = obtenerTodo();

    if (!tbody) return;

    let departamentos = [...(db.departamentos || [])];

    const busqueda = document.getElementById("buscarUnidad")?.value.trim().toUpperCase() || "";
    const piso = document.getElementById("filtroPisoUnidad")?.value || "";
    const tipo = document.getElementById("filtroTipoUnidad")?.value || "";
    const estado = document.getElementById("filtroEstadoUnidad")?.value || "";

    if (busqueda) {
        departamentos = departamentos.filter(dep =>
            String(dep.numero || "").toUpperCase().includes(busqueda)
        );
    }

    if (piso) {
        departamentos = departamentos.filter(dep =>
            String(dep.piso) === String(piso)
        );
    }

    if (tipo) {
        departamentos = departamentos.filter(dep =>
            normalizarTipoUnidad(dep.tipo) === tipo
        );
    }

    if (estado) {
        departamentos = departamentos.filter(dep =>
            normalizarEstadoUnidad(dep.estado) === estado
        );
    }

    departamentos.sort((a, b) => {
        if (Number(a.piso) !== Number(b.piso)) {
            return Number(a.piso) - Number(b.piso);
        }

        return String(a.numero).localeCompare(String(b.numero));
    });

    actualizarEstadisticas();

    if (departamentos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">No hay unidades registradas con esos criterios.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = departamentos.map(dep => {
        const estadoUnidad = normalizarEstadoUnidad(dep.estado);
        const tipoUnidad = normalizarTipoUnidad(dep.tipo);

        return `
            <tr>
                <td><strong>${dep.numero}</strong></td>
                <td>Piso ${dep.piso}</td>
                <td>${formatearTipoUnidad(tipoUnidad)}</td>
                <td>
                    <span class="badge ${claseEstado(estadoUnidad)}">
                        ${formatearEstadoUnidad(estadoUnidad)}
                    </span>
                </td>
                <td>${dep.observaciones || "-"}</td>
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
        `;
    }).join("");
}

function actualizarEstadisticas() {
    const db = obtenerTodo();
    const departamentos = db.departamentos || [];

    const disponibles = departamentos.filter(d =>
        normalizarEstadoUnidad(d.estado) === "disponible"
    ).length;

    const ocupadas = departamentos.filter(d =>
        normalizarEstadoUnidad(d.estado) === "ocupada"
    ).length;

    const mantenimiento = departamentos.filter(d =>
        normalizarEstadoUnidad(d.estado) === "mantenimiento"
    ).length;

    const total = document.getElementById("totalUnidades");
    const disp = document.getElementById("unidadesDisponibles");
    const ocup = document.getElementById("unidadesOcupadas");
    const mant = document.getElementById("unidadesMantenimiento");

    if (total) total.textContent = departamentos.length;
    if (disp) disp.textContent = disponibles;
    if (ocup) ocup.textContent = ocupadas;
    if (mant) mant.textContent = mantenimiento;
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

    if (document.getElementById("tipoUnidad")) {
        document.getElementById("tipoUnidad").value = normalizarTipoUnidad(departamento.tipo);
    }

    if (document.getElementById("estadoUnidad")) {
        document.getElementById("estadoUnidad").value = normalizarEstadoUnidad(departamento.estado);
    }

    if (document.getElementById("observacionesUnidad")) {
        document.getElementById("observacionesUnidad").value = departamento.observaciones || "";
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
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
    const form = document.getElementById("formDepartamento");
    const departamentoId = document.getElementById("departamentoId");

    if (form) form.reset();
    if (departamentoId) departamentoId.value = "";
}

function normalizarEstadoUnidad(estado) {
    if (!estado) return "disponible";

    const valor = String(estado).toLowerCase().trim();

    if (valor === "ocupado") return "ocupada";
    if (valor === "ocupada") return "ocupada";
    if (valor === "mantenimiento") return "mantenimiento";
    if (valor === "en mantenimiento") return "mantenimiento";
    if (valor === "inactiva") return "inactiva";
    if (valor === "inactivo") return "inactiva";

    return "disponible";
}

function normalizarTipoUnidad(tipo) {
    if (!tipo) return "departamento";

    const valor = String(tipo).toLowerCase().trim();

    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";
    if (valor === "oficina" || valor === "local") return "oficina";

    return "departamento";
}

function claseEstado(estado) {
    if (estado === "disponible") return "vacio";
    if (estado === "ocupada") return "ocupado";
    if (estado === "mantenimiento") return "ocupado";
    if (estado === "inactiva") return "ocupado";

    return "vacio";
}

function formatearEstadoUnidad(estado) {
    const estados = {
        disponible: "Disponible",
        ocupada: "Ocupada",
        mantenimiento: "En mantenimiento",
        inactiva: "Inactiva"
    };

    return estados[estado] || "Disponible";
}

function formatearTipoUnidad(tipo) {
    const tipos = {
        departamento: "Departamento",
        estacionamiento: "Estacionamiento",
        deposito: "Depósito",
        oficina: "Oficina / Local"
    };

    return tipos[tipo] || "Departamento";
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