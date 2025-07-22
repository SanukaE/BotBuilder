"use strict";

let configs = [];

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const configContainer = document.getElementById("config-container");
  try {
    const apiKey = getCookie("apiKey");
    const response = await fetch("/api/configurations", {
      headers: { Authorization: apiKey },
    });
    if (!response.ok) throw new Error("Response was not ok.");
    configs = (await response.json()).configs || [];

    for (const config of configs) {
      const { name: filename, data: moduleData } = config;
      if (!Array.isArray(moduleData) || moduleData.length < 3) continue;
      const [values, meta, fields] = moduleData;

      const moduleDiv = document.createElement("div");
      moduleDiv.className = "config-module";

      const title = document.createElement("h2");
      title.className = "config-module-title";
      title.textContent = meta.name || filename.replace(/\.json$/, "");
      moduleDiv.appendChild(title);

      if (meta.description) {
        const desc = document.createElement("p");
        desc.className = "config-module-description";
        desc.textContent = meta.description;
        moduleDiv.appendChild(desc);
      }

      const form = document.createElement("form");
      form.className = "config-form";
      form.dataset.filename = filename;

      for (const [key, field] of Object.entries(fields)) {
        const value = values[key];
        const fieldDiv = document.createElement("div");
        fieldDiv.className = "config-field";

        const label = document.createElement("label");
        label.className = "config-label";
        label.htmlFor = `${filename}-${key}`;
        label.textContent = field.name || key;
        fieldDiv.appendChild(label);

        let input;
        switch (field.type) {
          case "boolean":
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!value;
            input.className = "config-input config-checkbox";
            break;
          case "string[]":
          case "number[]":
            input = document.createElement("textarea");
            input.value = Array.isArray(value) ? value.join("\n") : "";
            input.className = "config-input config-textarea";
            input.rows = 3;
            break;
          case "number":
          case "integer":
          case "float":
            input = document.createElement("input");
            input.type = "number";
            input.value = value ?? "";
            input.className = "config-input config-number";
            if (field.type === "integer") input.step = "1";
            if (field.type === "float") input.step = "any";
            break;
          case "string":
            input = document.createElement("input");
            input.type = "text";
            input.value = value ?? "";
            input.className = "config-input config-text";
            break;
          case "select":
            input = document.createElement("select");
            input.className = "config-input config-select";
            for (const option of field.options || []) {
              const opt = document.createElement("option");
              opt.value = option.value ?? option;
              opt.textContent = option.label ?? option.value ?? option;
              if (value === opt.value) opt.selected = true;
              input.appendChild(opt);
            }
            break;
          case "object":
            input = document.createElement("textarea");
            input.value = value ? JSON.stringify(value, null, 2) : "";
            input.className = "config-input config-textarea";
            input.rows = 5;
            break;
          case "date":
            input = document.createElement("input");
            input.type = "date";
            if (value) input.value = value;
            input.className = "config-input config-date";
            break;
          case "time":
            input = document.createElement("input");
            input.type = "time";
            if (value) input.value = value;
            input.className = "config-input config-time";
            break;
          case "datetime":
            input = document.createElement("input");
            input.type = "datetime-local";
            if (value) input.value = value;
            input.className = "config-input config-datetime";
            break;
          case "password":
            input = document.createElement("input");
            input.type = "password";
            input.value = value ?? "";
            input.className = "config-input config-password";
            break;
          default:
            input = document.createElement("input");
            input.type = "text";
            input.value = value ?? "";
            input.className = "config-input config-text";
        }
        input.id = `${filename}-${key}`;
        input.name = key;
        fieldDiv.appendChild(input);

        if (field.description) {
          const fieldDesc = document.createElement("small");
          fieldDesc.className = "config-field-description";
          fieldDesc.textContent = field.description;
          fieldDiv.appendChild(fieldDesc);
        }

        if (configContainer.innerHTML.includes("Loading"))
          configContainer.innerHTML = "";

        form.appendChild(fieldDiv);
      }

      const saveBtn = document.createElement("button");
      saveBtn.type = "submit";
      saveBtn.className = "config-save-btn";
      saveBtn.textContent = "Save";
      form.appendChild(saveBtn);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = {};
        for (const [key, field] of Object.entries(fields)) {
          const input = form.elements[key];
          if (!input) continue;
          let value;
          switch (field.type) {
            case "boolean":
              value = input.checked;
              break;
            case "number":
            case "float":
              value = input.value === "" ? null : parseFloat(input.value);
              break;
            case "integer":
              value = input.value === "" ? null : parseInt(input.value, 10);
              break;
            case "string[]":
              value = input.value
                .split("\n")
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
              break;
            case "number[]":
              value = input.value
                .split("\n")
                .map((v) => v.trim())
                .filter((v) => v.length > 0)
                .map(Number);
              break;
            case "object":
              try {
                value = input.value ? JSON.parse(input.value) : {};
              } catch {
                value = {};
              }
              break;
            case "select":
              value = input.value;
              break;
            default:
              value = input.value;
          }
          formData[key] = value;
        }
        await saveModule(filename, formData);
      });

      moduleDiv.appendChild(form);
      configContainer.appendChild(moduleDiv);

      document.getElementById("moduleSearch").disabled = false;
      document.getElementById("searchBtn").disabled = false;
    }
  } catch (error) {
    console.error("Failed to fetch modules:", error);
    configContainer.innerHTML = `
      <div class="config-error">
        <i class="fas fa-exclamation-circle"></i> Unable to load config modules. Please try again later.
      </div>
    `;
  }
});

function handleSearch() {
  const searchValue = document
    .getElementById("moduleSearch")
    .value.trim()
    .toLowerCase();
  const configContainer = document.getElementById("config-container");
  if (!configs.length) {
    alert("There are no modules to search for.");
    return;
  }
  configContainer.innerHTML = '<i class="fa-solid fa-clock"></i> Searching...';

  let filteredConfigs = configs;
  if (searchValue) {
    filteredConfigs = configs.filter((config) => {
      const { name: filename, data: moduleData } = config;
      if (!Array.isArray(moduleData) || moduleData.length < 3) return false;
      const [values, meta, fields] = moduleData;
      return (
        (meta.name && meta.name.toLowerCase().includes(searchValue)) ||
        (meta.description &&
          meta.description.toLowerCase().includes(searchValue)) ||
        filename.toLowerCase().includes(searchValue) ||
        Object.entries(fields).some(
          ([key, field]) =>
            (field.name && field.name.toLowerCase().includes(searchValue)) ||
            (field.description &&
              field.description.toLowerCase().includes(searchValue)) ||
            key.toLowerCase().includes(searchValue)
        )
      );
    });
  }

  if (!filteredConfigs.length) {
    configContainer.innerHTML = `
      <div class="config-error">
        <i class="fas fa-exclamation-circle"></i> No matching modules found.
      </div>
    `;
    return;
  }

  configContainer.innerHTML = "";
  for (const config of filteredConfigs) {
    const { name: filename, data: moduleData } = config;
    if (!Array.isArray(moduleData) || moduleData.length < 3) continue;
    const [values, meta, fields] = moduleData;

    const moduleDiv = document.createElement("div");
    moduleDiv.className = "config-module";

    const title = document.createElement("h2");
    title.className = "config-module-title";
    title.textContent = meta.name || filename.replace(/\.json$/, "");
    moduleDiv.appendChild(title);

    if (meta.description) {
      const desc = document.createElement("p");
      desc.className = "config-module-description";
      desc.textContent = meta.description;
      moduleDiv.appendChild(desc);
    }

    const form = document.createElement("form");
    form.className = "config-form";
    form.dataset.filename = filename;

    for (const [key, field] of Object.entries(fields)) {
      const value = values[key];
      const fieldDiv = document.createElement("div");
      fieldDiv.className = "config-field";

      const label = document.createElement("label");
      label.className = "config-label";
      label.htmlFor = `${filename}-${key}`;
      label.textContent = field.name || key;
      fieldDiv.appendChild(label);

      let input;
      switch (field.type) {
        case "boolean":
          input = document.createElement("input");
          input.type = "checkbox";
          input.checked = !!value;
          input.className = "config-input config-checkbox";
          break;
        case "string[]":
        case "number[]":
          input = document.createElement("textarea");
          input.value = Array.isArray(value) ? value.join("\n") : "";
          input.className = "config-input config-textarea";
          input.rows = 3;
          break;
        case "number":
        case "integer":
        case "float":
          input = document.createElement("input");
          input.type = "number";
          input.value = value ?? "";
          input.className = "config-input config-number";
          if (field.type === "integer") input.step = "1";
          if (field.type === "float") input.step = "any";
          break;
        case "string":
          input = document.createElement("input");
          input.type = "text";
          input.value = value ?? "";
          input.className = "config-input config-text";
          break;
        case "select":
          input = document.createElement("select");
          input.className = "config-input config-select";
          for (const option of field.options || []) {
            const opt = document.createElement("option");
            opt.value = option.value ?? option;
            opt.textContent = option.label ?? option.value ?? option;
            if (value === opt.value) opt.selected = true;
            input.appendChild(opt);
          }
          break;
        case "object":
          input = document.createElement("textarea");
          input.value = value ? JSON.stringify(value, null, 2) : "";
          input.className = "config-input config-textarea";
          input.rows = 5;
          break;
        case "date":
          input = document.createElement("input");
          input.type = "date";
          if (value) input.value = value;
          input.className = "config-input config-date";
          break;
        case "time":
          input = document.createElement("input");
          input.type = "time";
          if (value) input.value = value;
          input.className = "config-input config-time";
          break;
        case "datetime":
          input = document.createElement("input");
          input.type = "datetime-local";
          if (value) input.value = value;
          input.className = "config-input config-datetime";
          break;
        case "password":
          input = document.createElement("input");
          input.type = "password";
          input.value = value ?? "";
          input.className = "config-input config-password";
          break;
        default:
          input = document.createElement("input");
          input.type = "text";
          input.value = value ?? "";
          input.className = "config-input config-text";
      }
      input.id = `${filename}-${key}`;
      input.name = key;
      fieldDiv.appendChild(input);

      if (field.description) {
        const fieldDesc = document.createElement("small");
        fieldDesc.className = "config-field-description";
        fieldDesc.textContent = field.description;
        fieldDiv.appendChild(fieldDesc);
      }

      form.appendChild(fieldDiv);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "config-save-btn";
    saveBtn.textContent = "Save";
    form.appendChild(saveBtn);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = {};
      for (const [key, field] of Object.entries(fields)) {
        const input = form.elements[key];
        if (!input) continue;
        let value;
        switch (field.type) {
          case "boolean":
            value = input.checked;
            break;
          case "number":
          case "float":
            value = input.value === "" ? null : parseFloat(input.value);
            break;
          case "integer":
            value = input.value === "" ? null : parseInt(input.value, 10);
            break;
          case "string[]":
            value = input.value
              .split("\n")
              .map((v) => v.trim())
              .filter((v) => v.length > 0);
            break;
          case "number[]":
            value = input.value
              .split("\n")
              .map((v) => v.trim())
              .filter((v) => v.length > 0)
              .map(Number);
            break;
          case "object":
            try {
              value = input.value ? JSON.parse(input.value) : {};
            } catch {
              value = {};
            }
            break;
          case "select":
            value = input.value;
            break;
          default:
            value = input.value;
        }
        formData[key] = value;
      }
      await saveModule(filename, formData);
    });

    moduleDiv.appendChild(form);
    configContainer.appendChild(moduleDiv);
  }
}

document.addEventListener("keypress", (ev) => {
  if (ev.key.toLowerCase() === "enter") {
    const searchInput = document.getElementById("moduleSearch");
    if (document.activeElement === searchInput) {
      handleSearch();
    }
  }
});

async function saveModule(moduleName, formData) {
  if (!moduleName || !formData) throw new Error("Missing module data.");
  const config = configs.find((c) => c.name === moduleName);
  if (!config) throw new Error("Config module couldn't be found.");
  const { name: fileName, data: moduleData } = config;
  const [values, meta, fields] = moduleData;

  for (const [key, field] of Object.entries(fields)) {
    const value = formData[key];
    const type = field.type;
    if (type === "boolean" && typeof value !== "boolean") {
      alert(`Field "${field.name || key}" must be a boolean.`);
      return;
    }
    if (
      (type === "number" || type === "float") &&
      (typeof value !== "number" || isNaN(value))
    ) {
      alert(`Field "${field.name || key}" must be a number.`);
      return;
    }
    if (
      type === "integer" &&
      (typeof value !== "number" || !Number.isInteger(value))
    ) {
      alert(`Field "${field.name || key}" must be an integer.`);
      return;
    }
    if (
      (type === "string" || type === "password") &&
      typeof value !== "string"
    ) {
      alert(`Field "${field.name || key}" must be a string.`);
      return;
    }
    if (
      type === "string[]" &&
      (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    ) {
      alert(`Field "${field.name || key}" must be an array of strings.`);
      return;
    }
    if (
      type === "number[]" &&
      (!Array.isArray(value) || !value.every((v) => typeof v === "number"))
    ) {
      alert(`Field "${field.name || key}" must be an array of numbers.`);
      return;
    }
    if (
      type === "object" &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      alert(`Field "${field.name || key}" must be an object.`);
      return;
    }
    if (type === "select" && Array.isArray(field.options)) {
      const validOptions = field.options.map((opt) => opt.value ?? opt);
      if (!validOptions.includes(value)) {
        alert(
          `Field "${field.name || key}" must be one of: ${validOptions.join(
            ", "
          )}`
        );
        return;
      }
    }
    if (
      type === "date" &&
      (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    ) {
      alert(`Field "${field.name || key}" must be a valid date (YYYY-MM-DD).`);
      return;
    }
    if (
      type === "time" &&
      (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value))
    ) {
      alert(`Field "${field.name || key}" must be a valid time (HH:MM).`);
      return;
    }
    if (
      type === "datetime" &&
      (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
    ) {
      alert(
        `Field "${
          field.name || key
        }" must be a valid datetime (YYYY-MM-DDTHH:MM).`
      );
      return;
    }
  }

  const apiKey = getCookie("apiKey") || "";
  const response = await fetch("api/configuration-save", {
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ fileName, formData }),
  });

  if (!response.ok) throw new Error("Server response was not ok");
  alert("Module saved!");
}
