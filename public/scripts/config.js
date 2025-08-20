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

/**
 * Perform a module search from the "moduleSearch" input and re-render matching module UIs.
 *
 * Reads the lowercase trimmed value from the #moduleSearch input, filters the global `configs`
 * array by matching the search term against each module's filename, meta.name, meta.description,
 * and each field's name, description, or key. Updates the #config-container element with a
 * loading indicator while searching, a "no matches" message if nothing matches, or the rendered
 * module forms for each match. Each rendered form is populated with current values and wires a
 * submit handler that converts input values to their typed representations and calls `saveModule`.
 *
 * Side effects:
 * - Modifies DOM elements: #config-container (content replaced) and creates form elements.
 * - Shows an error popup via `showSaveError` if there are no modules to search.
 * - Registers submit handlers that invoke `saveModule(filename, formData)`.
 */
function handleSearch() {
  const searchValue = document
    .getElementById("moduleSearch")
    .value.trim()
    .toLowerCase();
  const configContainer = document.getElementById("config-container");
  if (!configs.length) {
    showSaveError("There are no modules to search for.");
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

/**
 * Save a module's configuration: validate the provided form data, POST it to the server,
 * and update the in-memory configs on success while driving UI popups for loading, validation,
 * success, and error states.
 *
 * Validation is performed per-field using the module's field definitions (types such as
 * boolean, integer/float/number, string/password, string[]/number[], object, select, date,
 * time, datetime). If a field fails validation a validation popup is shown and the save is aborted.
 *
 * @param {string} moduleName - The module filename/key to save.
 * @param {Object} formData - Object mapping field keys to values to persist (must conform to field types).
 * @returns {Promise<void>} Resolves when the save completes (success or handled failure).
 * @throws {Error} If either `moduleName` or `formData` is not provided.
 */
async function saveModule(moduleName, formData) {
  if (!moduleName || !formData) throw new Error("Missing module data.");

  showSaveLoading("Saving your configuration...");

  try {
    const config = configs.find((c) => c.name === moduleName);
    if (!config) throw new Error("Config module couldn't be found.");
    const { name: fileName, data: moduleData } = config;
    const [values, meta, fields] = moduleData;

    for (const [key, field] of Object.entries(fields)) {
      const value = formData[key];
      const type = field.type;
      if (type === "boolean" && typeof value !== "boolean") {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be a boolean.`
        );
        return;
      }

      if (
        (type === "number" || type === "float") &&
        (typeof value !== "number" || isNaN(value))
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be a number.`
        );
        return;
      }

      if (
        type === "integer" &&
        (typeof value !== "number" || !Number.isInteger(value))
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be an integer.`
        );
        return;
      }

      if (
        (type === "string" || type === "password") &&
        typeof value !== "string"
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be a string.`
        );
        return;
      }

      if (
        type === "string[]" &&
        (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be an array of strings.`
        );
        return;
      }

      if (
        type === "number[]" &&
        (!Array.isArray(value) || !value.every((v) => typeof v === "number"))
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be an array of numbers.`
        );
        return;
      }

      if (
        type === "object" &&
        (typeof value !== "object" || value === null || Array.isArray(value))
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be an object.`
        );
        return;
      }

      if (type === "select" && Array.isArray(field.options)) {
        const validOptions = field.options.map((opt) => opt.value ?? opt);
        if (!validOptions.includes(value)) {
          showValidationError(
            field.name || key,
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
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be a valid date (YYYY-MM-DD).`
        );
        return;
      }

      if (
        type === "time" &&
        (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value))
      ) {
        showValidationError(
          field.name || key,
          `Field "${field.name || key}" must be a valid time (HH:MM).`
        );
        return;
      }

      if (
        type === "datetime" &&
        (typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
      ) {
        showValidationError(
          field.name || key,
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

    const configIndex = configs.findIndex((c) => c.name === moduleName);
    configs[configIndex].data[0] = formData;

    closeSavePopup();
    showSaveSuccess("Module saved successfully!");
  } catch (error) {
    console.error("Save error:", error);
    closeSavePopup();
    showSaveError("Failed to save configuration. Please try again.");
  }
}

class SavePopup {
  constructor() {
    this.overlay = document.getElementById("savePopupOverlay");
    this.popup = document.getElementById("savePopup");
    this.icon = document.getElementById("savePopupIcon");
    this.iconContent = document.getElementById("savePopupIconContent");
    this.title = document.getElementById("savePopupTitle");
    this.message = document.getElementById("savePopupMessage");
    this.progress = document.getElementById("savePopupProgress");
    this.actions = document.getElementById("savePopupActions");
    this.primaryBtn = document.getElementById("savePopupPrimary");
    this.closeBtn = document.getElementById("savePopupClose");

    this.bindEvents();
  }

  bindEvents() {
    this.closeBtn.addEventListener("click", () => this.hide());
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  show(type = "success", title, message, options = {}) {
    this.reset();

    // Set content
    this.title.textContent = title;
    this.message.textContent = message;

    // Apply styling based on type
    this.applyStyle(type);

    // Handle options
    if (options.showProgress) {
      this.progress.style.display = "block";
    } else {
      this.progress.style.display = "none";
    }

    if (options.buttons) {
      this.setupButtons(options.buttons);
    }

    if (options.autoClose) {
      setTimeout(() => this.hide(), options.autoClose);
    }

    // Show popup
    this.overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  applyStyle(type) {
    // Reset classes
    this.icon.className = "save-popup-icon";
    this.title.className = "save-popup-title";

    switch (type) {
      case "success":
        this.icon.classList.add("success");
        this.title.classList.add("success");
        this.iconContent.className = "fas fa-check";
        break;
      case "error":
        this.icon.classList.add("error");
        this.title.classList.add("error");
        this.iconContent.className = "fas fa-exclamation-triangle";
        break;
      case "loading":
        this.icon.classList.add("loading");
        this.title.classList.add("loading");
        this.iconContent.className = "fas fa-spinner";
        break;
      case "warning":
        this.icon.classList.add("error");
        this.title.classList.add("error");
        this.iconContent.className = "fas fa-exclamation-circle";
        break;
    }
  }

  setupButtons(buttons) {
    this.actions.innerHTML = "";

    buttons.forEach((btn, index) => {
      const button = document.createElement("button");
      button.className = `save-popup-btn ${btn.secondary ? "secondary" : ""}`;
      button.textContent = btn.text;
      button.onclick = btn.action || (() => this.hide());
      this.actions.appendChild(button);
    });
  }

  reset() {
    this.actions.innerHTML = `
                    <button class="save-popup-btn" onclick="savePopupInstance.hide()">OK</button>
                `;
  }

  hide() {
    this.overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Convenience methods
  success(title, message, options = {}) {
    this.show("success", title, message, options);
  }

  error(title, message, options = {}) {
    this.show("error", title, message, options);
  }

  loading(title, message, options = {}) {
    this.show("loading", title, message, { ...options, showProgress: true });
  }

  warning(title, message, options = {}) {
    this.show("warning", title, message, options);
  }
}

// Initialize popup system
const savePopupInstance = new SavePopup();

/**
 * Show a brief success popup indicating a configuration was saved.
 * @param {string} message - Optional custom message displayed in the popup. Defaults to "Configuration saved successfully!".
 */
function showSaveSuccess(message = "Configuration saved successfully!") {
  savePopupInstance.success("Save Successful", message, { autoClose: 2500 });
}

/**
 * Show a save error popup with the title "Save Failed".
 *
 * Displays an error modal to inform the user that saving the configuration failed.
 *
 * @param {string} [message="Failed to save configuration. Please try again."] - Message displayed inside the popup.
 */
function showSaveError(
  message = "Failed to save configuration. Please try again."
) {
  savePopupInstance.error("Save Failed", message);
}

/**
 * Show a loading popup indicating a save is in progress.
 *
 * Displays the global SavePopup in its loading state with a "Saving" title and the provided message.
 *
 * @param {string} [message="Saving your configuration..."] - Message text shown in the loading popup.
 */
function showSaveLoading(message = "Saving your configuration...") {
  savePopupInstance.loading("Saving", message);
}

/**
 * Show a validation error to the user via the global SavePopup.
 *
 * If `fieldName` is provided the popup title will be `Invalid <fieldName>`; otherwise the title will be `Validation Error`.
 *
 * @param {string|null} fieldName - Optional field name to include in the title.
 * @param {string} message - Human-readable error message shown in the popup.
 */
function showValidationError(fieldName, message) {
  const title = fieldName ? `Invalid ${fieldName}` : "Validation Error";
  savePopupInstance.error(title, message);
}

/**
 * Hides the global save popup overlay and restores page interaction.
 *
 * Uses the shared SavePopup instance to close the popup if it's currently shown.
 */
function closeSavePopup() {
  savePopupInstance.hide();
}

/**
 * Demo helper that shows the SavePopup in one of three predefined states.
 *
 * Shows a loading, success, or error demo flow based on `type`. Valid values:
 * - "loading": displays a loading state then automatically transitions to a success state after ~3s (success popup auto-closes).
 * - "success": displays a success popup.
 * - "error": displays an error popup.
 *
 * @param {("loading"|"success"|"error")} type - Which demo popup flow to display.
 */
function showSavePopup(type) {
  switch (type) {
    case "loading":
      savePopupInstance.loading(
        "Saving Configuration",
        "Please wait while we save your module settings..."
      );
      // Simulate loading completion
      setTimeout(() => {
        savePopupInstance.success(
          "Save Successful",
          "Your configuration has been saved successfully!",
          { autoClose: 2500 }
        );
      }, 3000);
      break;
    case "success":
      savePopupInstance.success(
        "Module Saved!",
        "Your configuration changes have been applied successfully."
      );
      break;
    case "error":
      savePopupInstance.error(
        "Save Failed",
        "Unable to save configuration. Please check your connection and try again."
      );
      break;
  }
}

/**
 * Display a validation error popup indicating the "Server Port" field is out of range.
 *
 * Uses the global savePopupInstance to show an error titled "Invalid Input" with the
 * message: 'The field "Server Port" must be a number between 1 and 65535.'
 */
function showValidationError() {
  savePopupInstance.error(
    "Invalid Input",
    'The field "Server Port" must be a number between 1 and 65535.'
  );
}
