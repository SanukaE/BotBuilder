"use strict";

const apiRoutesElem = document.getElementById("apiRoutes");
const endpointSearch = document.getElementById("endpointSearch");
const searchBtn = document.getElementById("searchBtn");

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// API routes logic
let sortedRoutes = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const apiKey = getCookie("apiKey");
    const response = await fetch("/api/endpoints", {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) throw new Error("Response was not ok.");

    const { routes } = await response.json();
    sortedRoutes = routes.sort(
      ([path]) =>
        path.split("/").length - path.split("/").filter(Boolean).length * 0.01
    );

    renderRoutes(sortedRoutes);
    endpointSearch.disabled = false;
    searchBtn.disabled = false;
  } catch (error) {
    console.error("Failed to fetch endpoints:", error);
    apiRoutesElem.innerHTML = `
            <div class="api-error">
                <i class="fas fa-exclamation-circle"></i>
                Unable to load API endpoints. Please try again later.
            </div>
        `;
  }
});

function renderRoutes(routes) {
  if (apiRoutesElem.innerHTML.includes("Loading Endpoints...")) {
    apiRoutesElem.innerHTML = "";
  }

  for (const [routePath, route, importData] of routes) {
    const routeContainer = document.createElement("div");
    routeContainer.className = "api-route";

    // Path
    const pathElem = document.createElement("h3");
    pathElem.textContent = routePath;
    routeContainer.appendChild(pathElem);

    // Badges
    const badges = document.createElement("div");
    badges.className = "badges";

    const methodBadge = document.createElement("span");
    methodBadge.className = "badge badge-method";
    methodBadge.textContent = route.method;
    badges.appendChild(methodBadge);

    if (route.isGuildOnly) {
      const guildBadge = document.createElement("span");
      guildBadge.className = "badge badge-guild";
      guildBadge.textContent = "Guild Only";
      badges.appendChild(guildBadge);
    }

    routeContainer.appendChild(badges);

    // Description
    const descElem = document.createElement("p");
    descElem.textContent = route.description;
    routeContainer.appendChild(descElem);

    // Types
    if (importData && (importData.ReqDataType || importData.ResDataType)) {
      const codeBlock = document.createElement("pre");
      codeBlock.className = "api-types";
      let codeContent = "";

      if (importData.ReqDataType) {
        codeContent += `// Request Data\n${JSON.stringify(
          importData.ReqDataType,
          null,
          2
        )}\n\n`;
      }
      if (importData.ResDataType) {
        codeContent += `// Response Data\n${JSON.stringify(
          importData.ResDataType,
          null,
          2
        )}`;
      }

      codeBlock.textContent = codeContent.trim();
      routeContainer.appendChild(codeBlock);
    }

    apiRoutesElem.appendChild(routeContainer);
  }
}

function handleSearch() {
  const searchValue = endpointSearch.value.trim().toLowerCase();

  if (!sortedRoutes || sortedRoutes.length === 0) {
    alert("There are no routes to search for.");
    return;
  }

  apiRoutesElem.innerHTML = '<i class="fa-solid fa-clock"></i> Searching...';

  let filteredRoutes = sortedRoutes;
  if (searchValue !== "") {
    filteredRoutes = sortedRoutes.filter(
      ([routePath, route]) =>
        routePath.toLowerCase().includes(searchValue) ||
        (route.description &&
          route.description.toLowerCase().includes(searchValue)) ||
        (route.method && route.method.toLowerCase().includes(searchValue))
    );
  }

  if (filteredRoutes.length === 0) {
    apiRoutesElem.innerHTML = `
            <div class="api-error">
                <i class="fas fa-exclamation-circle"></i>
                No matching API endpoints found.
            </div>
        `;
    return;
  }

  apiRoutesElem.innerHTML = "";
  renderRoutes(filteredRoutes);
}

document.addEventListener("keypress", (ev) => {
  if (ev.key.toLowerCase() === "enter") {
    handleSearch();
  }
});
