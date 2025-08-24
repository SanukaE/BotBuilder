let configs = [];

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}
const apiKey = getCookie("apiKey");

document.addEventListener("DOMContentLoaded", async () => {
  const configResponse = await fetch("/api/configurations", {
    headers: { Authorization: apiKey },
  });
  if (!configResponse.ok) {
    console.error("Failed to load configurations:", configResponse.statusText);
    document.getElementById("config-container").innerHTML = `
                <div class="config-error">
                    <i class="fas fa-exclamation-circle"></i>
                    Unable to load configurations. Please try again later.
                </div>
            `;
    return;
  }
  const configData = (await configResponse.json()).configs;
  configs = configData;
});

// Field type icons mapping
const fieldTypeIcons = {
  string: "fas fa-font",
  number: "fas fa-hashtag",
  boolean: "fas fa-toggle-on",
  "string[]": "fas fa-list",
  "number[]": "fas fa-list-ol",
  select: "fas fa-chevron-down",
  object: "fas fa-code",
  date: "fas fa-calendar",
  time: "fas fa-clock",
  datetime: "fas fa-calendar-alt",
  password: "fas fa-lock",
};

// Module icons mapping
const moduleIcons = {
  application: "fas fa-cog",
  ai: "fas fa-brain",
  moderation: "fas fa-shield-alt",
  experience: "fas fa-star",
  counting: "fas fa-sort-numeric-up",
  events: "fas fa-calendar-day",
  minecraft: "fas fa-cube",
  support: "fas fa-headset",
  misc: "fas fa-ellipsis-h",
};

function getFieldTypeIcon(type) {
  return fieldTypeIcons[type] || "fas fa-question-circle";
}

function getModuleIcon(moduleName) {
  return moduleIcons[moduleName] || "fas fa-puzzle-piece";
}

function createToggleSwitch(field, value, key, filename) {
  const container = document.createElement("div");
  container.className = "config-input-container";

  const toggle = document.createElement("div");
  toggle.className = `toggle-switch ${value ? "active" : ""}`;
  toggle.setAttribute("data-field", key);
  toggle.setAttribute("data-module", filename);

  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
  });

  container.appendChild(toggle);
  return container;
}

function createArrayInput(field, value, key, filename) {
  const container = document.createElement("div");
  container.className = "array-input-container";

  const arrayItems = document.createElement("div");
  arrayItems.className = "array-items";

  // Add existing items
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemElement = createArrayItem(
        item,
        index,
        field.type,
        key,
        filename
      );
      arrayItems.appendChild(itemElement);
    });
  }

  // Add button to add new items
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "array-add-btn";
  addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Item';
  addBtn.addEventListener("click", () => {
    const newIndex = arrayItems.children.length;
    const itemElement = createArrayItem(
      "",
      newIndex,
      field.type,
      key,
      filename
    );
    arrayItems.appendChild(itemElement);
  });

  container.appendChild(arrayItems);
  container.appendChild(addBtn);
  return container;
}

function createArrayItem(value, index, fieldType, key, filename) {
  const item = document.createElement("div");
  item.className = "array-item";

  const input = document.createElement("input");
  input.className = "array-item-input";
  input.type = fieldType === "number[]" ? "number" : "text";
  input.value = value;
  input.placeholder =
    fieldType === "number[]" ? "Enter number..." : "Enter text...";
  input.setAttribute("data-field", key);
  input.setAttribute("data-module", filename);
  input.setAttribute("data-index", index);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "array-remove-btn";
  removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
  removeBtn.addEventListener("click", () => {
    item.remove();
    // Update indices of remaining items
    const remainingItems = item.parentElement.querySelectorAll(".array-item");
    remainingItems.forEach((remainingItem, newIndex) => {
      const input = remainingItem.querySelector(".array-item-input");
      input.setAttribute("data-index", newIndex);
    });
  });

  item.appendChild(input);
  item.appendChild(removeBtn);
  return item;
}

function createSelectInput(field, value, key, filename) {
  const container = document.createElement("div");
  container.className = "select-container";

  const select = document.createElement("select");
  select.className = "config-select";
  select.setAttribute("data-field", key);
  select.setAttribute("data-module", filename);

  field.options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = typeof option === "object" ? option.value : option;
    optionElement.textContent =
      typeof option === "object" ? option.label : option;
    if (value === optionElement.value) {
      optionElement.selected = true;
    }
    select.appendChild(optionElement);
  });

  container.appendChild(select);
  return container;
}

function createObjectInput(field, value, key, filename) {
  const container = document.createElement("div");
  container.className = "config-input-container";

  const textarea = document.createElement("textarea");
  textarea.className = "json-editor";
  textarea.setAttribute("data-field", key);
  textarea.setAttribute("data-module", filename);
  textarea.value =
    typeof value === "object" ? JSON.stringify(value, null, 2) : value || "{}";
  textarea.placeholder = "Enter JSON object...";

  container.appendChild(textarea);
  return container;
}

function createStandardInput(field, value, key, filename) {
  const container = document.createElement("div");
  container.className = "config-input-container";

  const input = document.createElement(
    field.type === "object" ? "textarea" : "input"
  );
  input.className = field.type === "object" ? "json-editor" : "config-input";

  if (field.type !== "object") {
    input.type =
      field.type === "password"
        ? "password"
        : field.type === "number" ||
          field.type === "integer" ||
          field.type === "float"
        ? "number"
        : field.type === "date"
        ? "date"
        : field.type === "time"
        ? "time"
        : field.type === "datetime"
        ? "datetime-local"
        : "text";

    if (field.type === "integer") input.step = "1";
    if (field.type === "float") input.step = "any";
  }

  input.value = value || "";
  input.setAttribute("data-field", key);
  input.setAttribute("data-module", filename);
  input.placeholder = field.description || `Enter ${field.name || key}...`;

  container.appendChild(input);
  return container;
}

function renderConfigModule(config) {
  const { name: filename, data: moduleData } = config;
  if (!Array.isArray(moduleData) || moduleData.length < 3) return null;

  const [values, meta, fields] = moduleData;

  const moduleDiv = document.createElement("div");
  moduleDiv.className = "config-module";
  moduleDiv.setAttribute("data-module", filename);

  // Module Header
  const header = document.createElement("div");
  header.className = "config-module-header";

  const title = document.createElement("h2");
  title.className = "config-module-title";

  const icon = document.createElement("div");
  icon.className = "config-module-icon";
  icon.innerHTML = `<i class="${getModuleIcon(filename)}"></i>`;

  const titleText = document.createElement("span");
  titleText.textContent = meta.name || filename.replace(/\.json$/, "");

  title.appendChild(icon);
  title.appendChild(titleText);
  header.appendChild(title);

  if (meta.description) {
    const desc = document.createElement("p");
    desc.className = "config-module-description";
    desc.textContent = meta.description;
    header.appendChild(desc);
  }

  moduleDiv.appendChild(header);

  // Module Body
  const body = document.createElement("div");
  body.className = "config-module-body";

  // Create fields
  Object.entries(fields).forEach(([key, field]) => {
    const value = values[key];

    const fieldDiv = document.createElement("div");
    fieldDiv.className = "config-field";

    // Field Label
    const labelContainer = document.createElement("div");
    labelContainer.className = "config-field-label";

    const label = document.createElement("label");
    label.className = "config-label";
    label.htmlFor = `${filename}-${key}`;

    const labelIcon = document.createElement("i");
    labelIcon.className = getFieldTypeIcon(field.type);

    const labelText = document.createElement("span");
    labelText.textContent = field.name || key;

    label.appendChild(labelIcon);
    label.appendChild(labelText);

    const typeTag = document.createElement("span");
    typeTag.className = "config-field-type";
    typeTag.textContent = field.type;

    labelContainer.appendChild(label);
    labelContainer.appendChild(typeTag);
    fieldDiv.appendChild(labelContainer);

    // Create input based on type
    let inputContainer;
    switch (field.type) {
      case "boolean":
        inputContainer = createToggleSwitch(field, value, key, filename);
        break;
      case "string[]":
      case "number[]":
        inputContainer = createArrayInput(field, value, key, filename);
        break;
      case "select":
        inputContainer = createSelectInput(field, value, key, filename);
        break;
      case "object":
        inputContainer = createObjectInput(field, value, key, filename);
        break;
      default:
        inputContainer = createStandardInput(field, value, key, filename);
    }

    fieldDiv.appendChild(inputContainer);

    // Field Description
    if (field.description) {
      const fieldDesc = document.createElement("p");
      fieldDesc.className = "config-field-description";
      fieldDesc.textContent = field.description;
      fieldDiv.appendChild(fieldDesc);
    }

    body.appendChild(fieldDiv);
  });

  // Save Button
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "config-save-btn";
  saveBtn.setAttribute("data-module", filename);
  saveBtn.innerHTML = `
                <i class="fas fa-save"></i>
                <span>Save Configuration</span>
            `;

  saveBtn.addEventListener("click", () => saveConfiguration(filename));
  body.appendChild(saveBtn);

  moduleDiv.appendChild(body);
  return moduleDiv;
}

async function saveConfiguration(filename) {
  const moduleElement = document.querySelector(`[data-module="${filename}"]`);
  const formData = {};

  // Get all inputs for this module
  const inputs = moduleElement.querySelectorAll("[data-field]");

  inputs.forEach((input) => {
    const fieldName = input.getAttribute("data-field");
    const fieldType = getFieldTypeFromInput(input);

    let value;

    if (input.classList.contains("toggle-switch")) {
      value = input.classList.contains("active");
    } else if (input.classList.contains("array-item-input")) {
      // Handle array inputs separately
      return;
    } else if (input.tagName === "SELECT") {
      value = input.value;
    } else if (input.classList.contains("json-editor")) {
      try {
        value = input.value ? JSON.parse(input.value) : {};
      } catch (e) {
        value = {};
        console.warn(`Invalid JSON for field ${fieldName}:`, e);
      }
    } else {
      value = input.value;

      // Type conversion
      if (fieldType === "number" || fieldType === "float") {
        value = value === "" ? null : parseFloat(value);
      } else if (fieldType === "integer") {
        value = value === "" ? null : parseInt(value, 10);
      }
    }

    formData[fieldName] = value;
  });

  // Handle array fields
  const arrayContainers = moduleElement.querySelectorAll(
    ".array-input-container"
  );
  arrayContainers.forEach((container) => {
    const arrayItems = container.querySelectorAll(".array-item-input");
    const fieldName =
      arrayItems.length > 0 ? arrayItems[0].getAttribute("data-field") : null;

    if (fieldName) {
      const arrayValues = Array.from(arrayItems)
        .map((input) => {
          const value = input.value.trim();
          return input.type === "number"
            ? value === ""
              ? 0
              : Number(value)
            : value;
        })
        .filter((value) => value !== "" && value !== 0);

      formData[fieldName] = arrayValues;
    }
  });

  const saveBtn = moduleElement.querySelector(".config-save-btn");
  const originalContent = saveBtn.innerHTML;

  try {
    // Show loading state
    saveBtn.innerHTML = `
      <div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
      <span>Saving...</span>
    `;
    saveBtn.disabled = true;

    // Fixed fetch call with proper headers and body structure
    const response = await fetch("/api/configuration-save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        fileName: filename.replace(".json", ""), // Remove .json extension to match backend expectation
        formData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Show success state
      saveBtn.innerHTML = `
        <i class="fas fa-check"></i>
        <span>Saved!</span>
      `;
      saveBtn.style.background = "var(--success-color)";

      // Reset after 2 seconds
      setTimeout(() => {
        saveBtn.innerHTML = originalContent;
        saveBtn.style.background = "";
        saveBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error(result.message || "Save failed");
    }
  } catch (error) {
    console.error("Save failed:", error);

    // Show error state
    saveBtn.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <span>Save Failed</span>
    `;
    saveBtn.style.background = "var(--error-color, #e74c3c)";

    // Reset after 3 seconds
    setTimeout(() => {
      saveBtn.innerHTML = originalContent;
      saveBtn.style.background = "";
      saveBtn.disabled = false;
    }, 3000);
  }
}

function getFieldTypeFromInput(input) {
  // This would need to be enhanced based on your field metadata
  if (input.type === "number") return "number";
  if (input.type === "checkbox") return "boolean";
  if (input.tagName === "SELECT") return "select";
  if (input.classList.contains("json-editor")) return "object";
  return "string";
}

function handleSearch() {
  const searchValue = document
    .getElementById("moduleSearch")
    .value.trim()
    .toLowerCase();
  const container = document.getElementById("config-container");

  if (!configs.length) {
    container.innerHTML = `
                    <div class="config-error">
                        <i class="fas fa-exclamation-circle"></i>
                        No configuration modules found.
                    </div>
                `;
    return;
  }

  let filteredConfigs = configs;

  if (searchValue) {
    filteredConfigs = configs.filter((config) => {
      const { name: filename, data: moduleData } = config;
      if (!Array.isArray(moduleData) || moduleData.length < 3) return false;

      const [values, meta, fields] = moduleData;

      return (
        filename.toLowerCase().includes(searchValue) ||
        (meta.name && meta.name.toLowerCase().includes(searchValue)) ||
        (meta.description &&
          meta.description.toLowerCase().includes(searchValue)) ||
        Object.entries(fields).some(
          ([key, field]) =>
            key.toLowerCase().includes(searchValue) ||
            (field.name && field.name.toLowerCase().includes(searchValue)) ||
            (field.description &&
              field.description.toLowerCase().includes(searchValue))
        )
      );
    });
  }

  if (!filteredConfigs.length) {
    container.innerHTML = `
                    <div class="config-error">
                        <i class="fas fa-search"></i>
                        No configurations match your search.
                    </div>
                `;
    return;
  }

  container.innerHTML = "";
  filteredConfigs.forEach((config) => {
    const moduleElement = renderConfigModule(config);
    if (moduleElement) {
      container.appendChild(moduleElement);
    }
  });
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("config-container");

  // Simulate loading
  setTimeout(() => {
    container.innerHTML = "";
    configs.forEach((config) => {
      const moduleElement = renderConfigModule(config);
      if (moduleElement) {
        container.appendChild(moduleElement);
      }
    });
  }, 1500);

  // Setup search
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("moduleSearch");

  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  });

  // Enable search after loading
  setTimeout(() => {
    searchInput.disabled = false;
    searchBtn.disabled = false;
  }, 1500);
});
