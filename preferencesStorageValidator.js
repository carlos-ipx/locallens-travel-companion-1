const preferenceSchema = {
  mapProvider: {
    type: "string",
    allowed: ["google", "openstreetmap"],
    default: "google"
  },
  autoUpdateInterval: {
    type: "number",
    integer: true,
    min: 1,
    max: 1440,
    default: 15
  },
  categories: {
    type: "array",
    elementType: "string",
    default: []
  },
  notificationsEnabled: {
    type: "boolean",
    default: true
  }
};

function getDefaultPreferences() {
  const defaults = {};
  Object.keys(preferenceSchema).forEach(key => {
    const def = preferenceSchema[key].default;
    if (Array.isArray(def)) {
      defaults[key] = [...def];
    } else if (def && typeof def === "object") {
      defaults[key] = JSON.parse(JSON.stringify(def));
    } else {
      defaults[key] = def;
    }
  });
  return defaults;
}

function validatePreferences(input = {}) {
  const validated = {};
  Object.keys(preferenceSchema).forEach(key => {
    const rule = preferenceSchema[key];
    const value = input[key];
    switch (rule.type) {
      case "string":
        if (
          typeof value === "string" &&
          (!rule.allowed || rule.allowed.includes(value))
        ) {
          validated[key] = value;
        } else {
          validated[key] = rule.default;
        }
        break;
      case "number":
        if (typeof value === "number" && !isNaN(value)) {
          let num = value;
          if (rule.integer) {
            num = Math.round(num);
          }
          if (rule.min !== undefined) {
            num = Math.max(num, rule.min);
          }
          if (rule.max !== undefined) {
            num = Math.min(num, rule.max);
          }
          validated[key] = num;
        } else {
          validated[key] = rule.default;
        }
        break;
      case "boolean":
        if (typeof value === "boolean") {
          validated[key] = value;
        } else {
          validated[key] = rule.default;
        }
        break;
      case "array":
        if (Array.isArray(value)) {
          validated[key] = value.filter(
            item => typeof item === rule.elementType
          );
        } else {
          const def = rule.default;
          validated[key] = Array.isArray(def) ? [...def] : [];
        }
        break;
      default:
        validated[key] = rule.default;
    }
  });
  return validated;
}

export { getDefaultPreferences, validatePreferences };