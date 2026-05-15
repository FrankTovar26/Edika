document.addEventListener("DOMContentLoaded", () => {
    protegerPaginaAdmin();

    asegurarSelectorEdificioArea();

    configurarFormularioArea();
    configurarFormularioReserva();
    configurarCambioEdificioArea();

    cargarSelectsReserva();
    renderizarAreas();
    renderizarReservas();
});

function protegerPaginaAdmin() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));

    if (!sesion) {
        window.location.href = "../../../index.html";
        return;
    }

    if (sesion.rol !== "admin" && sesion.rol !== "superadmin") {
        alert("No tienes permisos para acceder a esta página.");
        window.location.href = "../residente/inicio.html";
    }
}

function asegurarSelectorEdificioArea() {
    if (document.getElementById("edificioArea")) return;

    const form = document.getElementById("formArea");

    if (!form) return;

    const contenedor = form.querySelector(".form-group-container") || form;

    const grupo = document.createElement("div");
    grupo.className = "group";
    grupo.innerHTML = `
        <label for="edificioArea">Edificio</label>
        <select id="edificioArea">
            <option value="">Seleccione edificio...</option>
        </select>
    `;

    contenedor.prepend(grupo);

    cargarSelectEdificiosArea();
}

function cargarSelectEdificiosArea() {
    const db = obtenerTodo();
    const select = document.getElementById("edificioArea");

    if (!select) return;

    const edificios = obtenerEdificiosPermitidosObjetos(db);

    select.innerHTML = `<option value="">Seleccione edificio...</option>`;

    edificios.forEach(edificio => {
        select.innerHTML += `
            <option value="${edificio.id}">
                ${edificio.nombre}
            </option>
        `;
    });

    if (edificios.length === 1) {
        select.value = edificios[0].id;
    }
}

function configurarCambioEdificioArea() {
    const select = document.getElementById("edificioArea");

    if (!select) return;

    select.addEventListener("change", () => {
        cargarSelectsReserva();
        renderizarAreas();
        renderizarReservas();
    });
}

function obtenerIdsEdificiosAsignadosSesion(sesion) {
    if (!sesion) return [];

    if (Array.isArray(sesion.edificioIds) && sesion.edificioIds.length > 0) {
        return sesion.edificioIds.filter(Boolean).map(String);
    }

    if (sesion.edificioId) {
        return [String(sesion.edificioId)];
    }

    return [];
}

function obtenerEdificiosPermitidosAreas() {
    const sesion = JSON.parse(localStorage.getItem("usuarioSesion"));
    const db = obtenerTodo();

    if (!sesion) return [];

    const edificios = db.edificios || [];

    if (sesion.rol === "superadmin") {
        return edificios
            .filter(edificio => edificio.activo !== false)
            .map(edificio => String(edificio.id));
    }

    if (sesion.rol === "admin") {
        const asignados = obtenerIdsEdificiosAsignadosSesion(sesion);

        return edificios
            .filter(edificio =>
                edificio.activo !== false &&
                asignados.includes(String(edificio.id))
            )
            .map(edificio => String(edificio.id));
    }

    return [];
}

function obtenerEdificiosPermitidosObjetos(db) {
    const permitidos = obtenerEdificiosPermitidosAreas();

    return (db.edificios || []).filter(edificio =>
        permitidos.includes(String(edificio.id))
    );
}

function obtenerEdificioSeleccionadoArea() {
    const select = document.getElementById("edificioArea");

    if (select && select.value) {
        return select.value;
    }

    const permitidos = obtenerEdificiosPermitidosAreas();

    return permitidos[0] || null;
}

function obtenerAreasPermitidas(db) {
    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let areas = db.areasComunes || [];

    areas = areas.filter(area =>
        permitidos.includes(String(area.edificioId || ""))
    );

    if (edificioSeleccionado) {
        areas = areas.filter(area =>
            String(area.edificioId) === String(edificioSeleccionado)
        );
    }

    return areas;
}

function obtenerDepartamentosPermitidosAreas(db) {
    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let unidades = db.departamentos || [];

    unidades = unidades.filter(dep =>
        permitidos.includes(String(dep.edificioId || ""))
    );

    unidades = unidades.filter(dep => {
        const tipo = normalizarTipoUnidad(dep.tipo);
        return tipo === "departamento" || tipo === "oficina";
    });

    if (edificioSeleccionado) {
        unidades = unidades.filter(dep =>
            String(dep.edificioId) === String(edificioSeleccionado)
        );
    }

    return unidades;
}

function configurarFormularioArea() {
    const form = document.getElementById("formArea");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const nombre = document.getElementById("nombreArea").value.trim();
        const aforo = Number(document.getElementById("aforoArea").value);
        const descripcion = document.getElementById("descripcionArea").value.trim();
        const estado = document.getElementById("estadoArea").value;
        const edificioId = obtenerEdificioSeleccionadoArea();

        if (!edificioId) {
            alert("Selecciona el edificio al que pertenece el área.");
            return;
        }

        if (!nombre) {
            alert("Ingresa el nombre del área común.");
            return;
        }

        if (!aforo || aforo < 1) {
            alert("Ingresa un aforo válido.");
            return;
        }

        const resultado = agregarAreaComunSeguro({
            edificioId,
            nombre,
            aforo,
            descripcion,
            estado
        });

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        form.reset();

        cargarSelectEdificiosArea();
        renderizarAreas();
        cargarSelectsReserva();

        alert("Área común registrada correctamente.");
    });
}

function agregarAreaComunSeguro(area) {
    if (typeof agregarAreaComun === "function") {
        return agregarAreaComun(area);
    }

    const db = obtenerTodo();

    db.areasComunes = db.areasComunes || [];

    const existe = db.areasComunes.some(item =>
        String(item.edificioId) === String(area.edificioId) &&
        item.nombre.trim().toLowerCase() === area.nombre.trim().toLowerCase()
    );

    if (existe) {
        return {
            ok: false,
            error: "Ya existe un área común con ese nombre en este edificio."
        };
    }

    db.areasComunes.push({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
        edificioId: area.edificioId,
        nombre: area.nombre,
        aforo: Number(area.aforo),
        descripcion: area.descripcion || "",
        estado: normalizarEstadoArea(area.estado),
        fechaRegistro: new Date().toISOString()
    });

    guardarTodo(db);

    return { ok: true };
}

function configurarFormularioReserva() {
    const form = document.getElementById("formReserva");

    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const reservaId = document.getElementById("reservaAdminId").value;
        const areaId = document.getElementById("areaReserva").value;
        const departamentoId = document.getElementById("departamentoReserva").value;
        const fecha = document.getElementById("fechaReserva").value;

        if (!areaId || !departamentoId || !fecha) {
            alert("Completa todos los campos de la reserva.");
            return;
        }

        const db = obtenerTodo();

        const area = obtenerAreasPermitidas(db).find(a =>
            String(a.id) === String(areaId)
        );

        if (!area || normalizarEstadoArea(area.estado) !== "disponible") {
            alert("Esta área no está disponible para reservas.");
            return;
        }

        const unidad = obtenerDepartamentosPermitidosAreas(db).find(dep =>
            String(dep.id) === String(departamentoId)
        );

        if (!unidad) {
            alert("Selecciona un departamento u oficina válida.");
            return;
        }

        const tipoUnidad = normalizarTipoUnidad(unidad.tipo);

        if (tipoUnidad !== "departamento" && tipoUnidad !== "oficina") {
            alert("Solo departamentos u oficinas pueden solicitar reservas de áreas comunes.");
            return;
        }

        if (String(unidad.edificioId) !== String(area.edificioId)) {
            alert("El área y la unidad deben pertenecer al mismo edificio.");
            return;
        }

        const reservaData = {
            areaId,
            departamentoId,
            fecha,
            edificioId: area.edificioId
        };

        const resultado = reservaId
            ? editarReservaAreaSeguro(reservaId, reservaData)
            : agregarReservaAreaSeguro(reservaData);

        if (!resultado.ok) {
            alert(resultado.error);
            return;
        }

        limpiarFormularioReservaAdmin();
        renderizarReservas();

        alert(
            reservaId
                ? "Reserva actualizada correctamente."
                : "Reserva registrada correctamente."
        );
    });
}

function agregarReservaAreaSeguro(reservaData) {
    if (typeof agregarReservaArea === "function") {
        return agregarReservaArea(reservaData);
    }

    const db = obtenerTodo();

    db.reservas = db.reservas || [];

    const duplicada = db.reservas.some(reserva =>
        String(reserva.areaId) === String(reservaData.areaId) &&
        String(reserva.fecha) === String(reservaData.fecha)
    );

    if (duplicada) {
        return {
            ok: false,
            error: "Ya existe una reserva para esta área en la fecha seleccionada."
        };
    }

    db.reservas.push({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
        ...reservaData,
        estado: "registrada",
        fechaRegistro: new Date().toISOString()
    });

    guardarTodo(db);

    return { ok: true };
}

function editarReservaAreaSeguro(id, reservaData) {
    if (typeof editarReservaArea === "function") {
        return editarReservaArea(id, reservaData);
    }

    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        return {
            ok: false,
            error: "Reserva no encontrada."
        };
    }

    reserva.areaId = reservaData.areaId;
    reserva.departamentoId = reservaData.departamentoId;
    reserva.fecha = reservaData.fecha;
    reserva.edificioId = reservaData.edificioId;

    guardarTodo(db);

    return { ok: true };
}

function cargarSelectsReserva() {
    const db = obtenerTodo();

    const selectArea = document.getElementById("areaReserva");
    const selectDepartamento = document.getElementById("departamentoReserva");

    const areasDisponibles = obtenerAreasPermitidas(db).filter(area =>
        normalizarEstadoArea(area.estado) === "disponible"
    );

    if (selectArea) {
        selectArea.innerHTML = `
            <option value="">Seleccione un área</option>
        `;

        areasDisponibles.forEach(area => {
            const edificio = obtenerNombreEdificio(db, area.edificioId);

            selectArea.innerHTML += `
                <option value="${area.id}">
                    ${area.nombre} - ${edificio}
                </option>
            `;
        });
    }

    if (selectDepartamento) {
        const unidades = obtenerDepartamentosPermitidosAreas(db);

        selectDepartamento.innerHTML = `
            <option value="">Seleccione departamento u oficina</option>
        `;

        unidades.forEach(dep => {
            const edificio = obtenerNombreEdificio(db, dep.edificioId);
            const tipo = formatearTipoUnidad(normalizarTipoUnidad(dep.tipo));

            selectDepartamento.innerHTML += `
                <option value="${dep.id}">
                    ${dep.numero} - ${tipo} - ${edificio}
                </option>
            `;
        });
    }
}

function renderizarAreas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaAreas");

    if (!tabla) return;

    const areas = obtenerAreasPermitidas(db);

    if (areas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">
                    No hay áreas comunes registradas para tus edificios.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = areas.map(area => {
        const estado = normalizarEstadoArea(area.estado);
        const disponible = estado === "disponible";
        const edificio = obtenerNombreEdificio(db, area.edificioId);

        return `
            <tr>
                <td>
                    <strong>${area.nombre}</strong><br>
                    <small>${edificio}</small>
                </td>

                <td>${area.aforo}</td>

                <td>${area.descripcion || "-"}</td>

                <td>
                    <span class="badge ${disponible ? "vacio" : "ocupado"}">
                        ${disponible ? "Disponible" : "No disponible"}
                    </span>
                </td>

                <td>
                    <button 
                        class="btn btn-blue"
                        onclick="cambiarEstadoArea('${area.id}')"
                    >
                        ${disponible ? "Bloquear" : "Habilitar"}
                    </button>

                    <button 
                        class="btn btn-red"
                        onclick="eliminarArea('${area.id}')"
                    >
                        Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarReservas() {
    const db = obtenerTodo();
    const tabla = document.getElementById("tablaReservas");

    if (!tabla) return;

    const permitidos = obtenerEdificiosPermitidosAreas();
    const edificioSeleccionado = document.getElementById("edificioArea")?.value || "";

    let reservas = db.reservas || [];

    reservas = reservas.filter(reserva =>
        permitidos.includes(String(reserva.edificioId || ""))
    );

    if (edificioSeleccionado) {
        reservas = reservas.filter(reserva =>
            String(reserva.edificioId) === String(edificioSeleccionado)
        );
    }

    const areas = db.areasComunes || [];
    const departamentos = db.departamentos || [];

    if (reservas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5">
                    No hay reservas registradas.
                </td>
            </tr>
        `;
        return;
    }

    reservas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    tabla.innerHTML = reservas.map(reserva => {
        const area = areas.find(a =>
            String(a.id) === String(reserva.areaId)
        );

        const departamento = departamentos.find(d =>
            String(d.id) === String(reserva.departamentoId)
        );

        const edificio = obtenerNombreEdificio(db, reserva.edificioId);

        return `
            <tr>
                <td>
                    ${area?.nombre || "-"}<br>
                    <small>${edificio}</small>
                </td>

                <td>
                    ${departamento?.numero || "-"}<br>
                    <small>${formatearTipoUnidad(normalizarTipoUnidad(departamento?.tipo))}</small>
                </td>

                <td>${formatearFechaReserva(reserva.fecha)}</td>

                <td>
                    <button 
                        class="btn btn-blue"
                        onclick="cargarReservaAdminParaEditar('${reserva.id}')"
                    >
                        Editar
                    </button>

                    <button 
                        class="btn btn-red"
                        onclick="eliminarReserva('${reserva.id}')"
                    >
                        Cancelar
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function cambiarEstadoArea(id) {
    const db = obtenerTodo();

    const area = obtenerAreasPermitidas(db).find(a =>
        String(a.id) === String(id)
    );

    if (!area) {
        alert("Área no encontrada.");
        return;
    }

    const estadoActual = normalizarEstadoArea(area.estado);

    area.estado = estadoActual === "disponible"
        ? "no_disponible"
        : "disponible";

    guardarTodo(db);

    renderizarAreas();
    cargarSelectsReserva();

    alert("Estado del área actualizado.");
}

function eliminarArea(id) {
    const confirmar = confirm("¿Deseas eliminar esta área común?");

    if (!confirmar) return;

    const resultado = eliminarAreaComunSeguro(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarAreas();
    cargarSelectsReserva();

    alert("Área común eliminada correctamente.");
}

function eliminarAreaComunSeguro(id) {
    if (typeof eliminarAreaComun === "function") {
        return eliminarAreaComun(id);
    }

    const db = obtenerTodo();

    const tieneReservas = (db.reservas || []).some(reserva =>
        String(reserva.areaId) === String(id)
    );

    if (tieneReservas) {
        return {
            ok: false,
            error: "No puedes eliminar esta área porque tiene reservas registradas."
        };
    }

    db.areasComunes = (db.areasComunes || []).filter(area =>
        String(area.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

function eliminarReserva(id) {
    const confirmar = confirm("¿Deseas eliminar esta reserva?");

    if (!confirmar) return;

    const resultado = eliminarReservaAreaSeguro(id);

    if (!resultado.ok) {
        alert(resultado.error);
        return;
    }

    renderizarReservas();

    alert("Reserva eliminada correctamente.");
}

function eliminarReservaAreaSeguro(id) {
    if (typeof eliminarReservaArea === "function") {
        return eliminarReservaArea(id);
    }

    const db = obtenerTodo();

    db.reservas = (db.reservas || []).filter(reserva =>
        String(reserva.id) !== String(id)
    );

    guardarTodo(db);

    return { ok: true };
}

function cargarReservaAdminParaEditar(id) {
    const db = obtenerTodo();

    const reserva = (db.reservas || []).find(r =>
        String(r.id) === String(id)
    );

    if (!reserva) {
        alert("Reserva no encontrada.");
        return;
    }

    const selectEdificio = document.getElementById("edificioArea");

    if (selectEdificio) {
        selectEdificio.value = reserva.edificioId;
    }

    cargarSelectsReserva();

    document.getElementById("reservaAdminId").value = reserva.id;
    document.getElementById("areaReserva").value = reserva.areaId;
    document.getElementById("departamentoReserva").value = reserva.departamentoId;
    document.getElementById("fechaReserva").value = reserva.fecha;

    window.scrollTo({
        top: document.getElementById("formReserva").offsetTop - 80,
        behavior: "smooth"
    });
}

function limpiarFormularioReservaAdmin() {
    const form = document.getElementById("formReserva");
    const reservaId = document.getElementById("reservaAdminId");

    if (form) form.reset();
    if (reservaId) reservaId.value = "";
}

function obtenerNombreEdificio(db, edificioId) {
    const edificio = (db.edificios || []).find(e =>
        String(e.id) === String(edificioId)
    );

    return edificio ? edificio.nombre : "-";
}

function normalizarTipoUnidad(tipo) {
    const valor = String(tipo || "").toLowerCase().trim();

    if (valor === "departamento") return "departamento";
    if (valor === "oficina" || valor === "local") return "oficina";
    if (valor === "estacionamiento") return "estacionamiento";
    if (valor === "deposito" || valor === "depósito") return "deposito";

    return "departamento";
}

function formatearTipoUnidad(tipo) {
    const tipos = {
        departamento: "Departamento",
        oficina: "Oficina / Local",
        estacionamiento: "Estacionamiento",
        deposito: "Depósito"
    };

    return tipos[tipo] || "Departamento";
}

function normalizarEstadoArea(estado) {
    if (!estado) return "disponible";

    const valor = String(estado).toLowerCase().trim();

    if (valor === "disponible") return "disponible";
    if (valor === "no disponible") return "no_disponible";
    if (valor === "no_disponible") return "no_disponible";
    if (valor === "mantenimiento") return "no_disponible";

    return "disponible";
}

function formatearFechaReserva(fecha) {
    if (!fecha) return "-";

    const partes = String(fecha).split("-");

    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
}