document.addEventListener("DOMContentLoaded", () => {
    renderizarSidebar();
});

function renderizarSidebar() {
    const sidebar = document.getElementById("sidebar");

    if (!sidebar) return;

    const sesion = obtenerSesionSidebar();

    if (!sesion) {
        window.location.href = obtenerRutaIndexSidebar();
        return;
    }

    const rol = sesion.rol || "residente";
    const nombre = sesion.nombre || sesion.nombres || "Usuario";

    sidebar.className = "sidebar";

    sidebar.innerHTML = `
        <h2>EDIFIKA</h2>

        <div class="sidebar-user">
            <div class="sidebar-avatar">
                ${obtenerInicialesSidebar(nombre)}
            </div>

            <div class="sidebar-user-info">
                <strong>${nombre}</strong>
                <span>${formatearRolSidebar(rol)}</span>
            </div>
        </div>

        <div class="sidebar-menu">
            ${obtenerMenuPorRolSidebar(rol)}
        </div>
    `;

    marcarOpcionActivaSidebar();
}

function obtenerSesionSidebar() {
    try {
        return JSON.parse(localStorage.getItem("usuarioSesion"));
    } catch (error) {
        return null;
    }
}

function obtenerMenuPorRolSidebar(rol) {
    if (rol === "superadmin" || rol === "admin") {
        return obtenerMenuAdminSidebar();
    }

    return obtenerMenuResidenteSidebar();
}

function obtenerMenuAdminSidebar() {
    const items = [
        {
            texto: "Dashboard",
            icono: "🏠",
            href: "../admin/dashboard.html",
            paginas: ["dashboard.html"]
        },
        {
            texto: "Mi Perfil",
            icono: "👤",
            href: "../common/perfil.html",
            paginas: ["perfil.html"]
        },
        {
            texto: "Unidades",
            icono: "🏢",
            href: "../admin/departamentos.html",
            paginas: ["departamentos.html"]
        },
        {
            texto: "Invitaciones",
            icono: "📩",
            href: "../admin/vinculacion.html",
            paginas: ["vinculacion.html"]
        },
        {
            texto: "Anuncios",
            icono: "📢",
            href: "../admin/anuncios.html",
            paginas: ["anuncios.html"]
        },
        {
            texto: "Áreas Comunes",
            icono: "🌳",
            href: "../admin/areas.html",
            paginas: ["areas.html"]
        },
        {
            texto: "Incidencias",
            icono: "🛠️",
            href: "../admin/incidencias.html",
            paginas: ["incidencias.html"]
        },
        {
            texto: "Pagos",
            icono: "💳",
            href: "../admin/pagos.html",
            paginas: ["pagos.html"]
        },
        {
            texto: "Residentes",
            icono: "👥",
            href: "../admin/residentes.html",
            paginas: ["residentes.html"]
        },
        {
            texto: "Configuración",
            icono: "⚙️",
            href: "../admin/config.html",
            paginas: ["config.html"]
        },
        {
            texto: "Vista Usuario",
            icono: "🏠",
            href: "../residente/inicio.html",
            paginas: ["inicio.html"]
        },
        {
            texto: "Cerrar sesión",
            icono: "🚪",
            href: "#",
            accion: "cerrarSesionSidebar()",
            paginas: []
        }
    ];

    return items.map(crearItemSidebar).join("");
}

function obtenerMenuResidenteSidebar() {
    const items = [
        {
            texto: "Inicio",
            icono: "🏠",
            href: "../residente/inicio.html",
            paginas: ["inicio.html"]
        },
        {
            texto: "Mi Perfil",
            icono: "👤",
            href: "../common/perfil.html",
            paginas: ["perfil.html"]
        },
        {
            texto: "Anuncios",
            icono: "📢",
            href: "../residente/anuncios.html",
            paginas: ["anuncios.html"]
        },
        {
            texto: "Mis Reservas",
            icono: "📅",
            href: "../residente/mis-reservas.html",
            paginas: ["mis-reservas.html"]
        },
        {
            texto: "Cerrar sesión",
            icono: "🚪",
            href: "#",
            accion: "cerrarSesionSidebar()",
            paginas: []
        }
    ];

    return items.map(crearItemSidebar).join("");
}

function crearItemSidebar(item) {
    const paginaActual = obtenerPaginaActualSidebar();

    const activo = item.paginas.includes(paginaActual)
        ? "active"
        : "";

    const onclick = item.accion
        ? `onclick="${item.accion}"`
        : "";

    return `
        <a href="${item.href}" class="${activo}" ${onclick}>
            ${item.icono} ${item.texto}
        </a>
    `;
}

function marcarOpcionActivaSidebar() {
    const links = document.querySelectorAll("#sidebar .sidebar-menu a");
    const paginaActual = obtenerPaginaActualSidebar();

    links.forEach(link => {
        const href = link.getAttribute("href") || "";

        if (href.includes(paginaActual)) {
            link.classList.add("active");
        }
    });
}

function obtenerPaginaActualSidebar() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf("/") + 1);
}

function cerrarSesionSidebar() {
    localStorage.removeItem("usuarioSesion");
    localStorage.removeItem("edifika_edificio_activo");
    localStorage.removeItem("edifika_dashboard_filtro_edificio");

    window.location.href = obtenerRutaIndexSidebar();
}

function obtenerRutaIndexSidebar() {
    const path = window.location.pathname;

    if (path.includes("/pages/admin/")) {
        return "../../../index.html";
    }

    if (path.includes("/pages/residente/")) {
        return "../../../index.html";
    }

    if (path.includes("/pages/common/")) {
        return "../../../index.html";
    }

    return "index.html";
}

function obtenerInicialesSidebar(nombre) {
    if (!nombre) return "U";

    const partes = String(nombre).trim().split(" ");

    if (partes.length === 1) {
        return partes[0].charAt(0).toUpperCase();
    }

    return `${partes[0].charAt(0)}${partes[1].charAt(0)}`.toUpperCase();
}

function formatearRolSidebar(rol) {
    const roles = {
        superadmin: "Superadministrador",
        admin: "Administrador",
        residente: "Residente"
    };

    return roles[rol] || "Usuario";
}