// LocalLens Options Page Script
// Handles loading and saving of user preferences.

import { getDefaultPreferences, validatePreferences } from './preferencesValidator.js';

const PREFERENCES_KEY = 'localLensUserPreferences';

// DOM Elements
let mapProviderSelect;
let autoUpdateIntervalInput;
// let categoriesInput; // Assuming categories might be more complex, e.g., checkboxes or a tag input
let notificationsEnabledCheckbox;
let saveButton;
let statusMessage;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    mapProviderSelect = document.getElementById('mapProvider');
    autoUpdateIntervalInput = document.getElementById('autoUpdateInterval');
    notificationsEnabledCheckbox = document.getElementById('notificationsEnabled');
    saveButton = document.getElementById('saveButton');
    statusMessage = document.getElementById('statusMessage');

    if (saveButton) {
        saveButton.addEventListener('click', saveOptions);
    } else {
        console.error("LocalLens Options: Save button not found.");
    }

    loadOptions();
});

function loadOptions() {
    chrome.storage.sync.get(PREFERENCES_KEY, (data) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading preferences:", chrome.runtime.lastError.message);
            displayStatus("Error loading preferences.", true);
            // Load defaults if error occurs
            populateForm(getDefaultPreferences());
            return;
        }

        const currentPrefs = data[PREFERENCES_KEY];
        const validatedPrefs = validatePreferences(currentPrefs || {}); // Validate or use defaults if nothing stored

        if (!currentPrefs) { // If nothing was stored, save the defaults
            chrome.storage.sync.set({ [PREFERENCES_KEY]: validatedPrefs }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving default preferences:", chrome.runtime.lastError.message);
                } else {
                    console.log("Default preferences saved.");
                }
            });
        }
        populateForm(validatedPrefs);
    });
}

function populateForm(prefs) {
    if (mapProviderSelect) mapProviderSelect.value = prefs.mapProvider;
    if (autoUpdateIntervalInput) autoUpdateIntervalInput.value = prefs.autoUpdateInterval;
    if (notificationsEnabledCheckbox) notificationsEnabledCheckbox.checked = prefs.notificationsEnabled;
    // Handle categories population if the input field exists and is simple
    // e.g., if (document.getElementById('categories')) document.getElementById('categories').value = prefs.categories.join(', ');
}

function saveOptions(event) {
    if(event) event.preventDefault();
    displayStatus("Saving...", false);

    const newPrefs = {
        mapProvider: mapProviderSelect ? mapProviderSelect.value : getDefaultPreferences().mapProvider,
        autoUpdateInterval: autoUpdateIntervalInput ? parseInt(autoUpdateIntervalInput.value, 10) : getDefaultPreferences().autoUpdateInterval,
        notificationsEnabled: notificationsEnabledCheckbox ? notificationsEnabledCheckbox.checked : getDefaultPreferences().notificationsEnabled,
        // categories: categoriesInput ? categoriesInput.value.split(',').map(s => s.trim()).filter(s => s) : getDefaultPreferences().categories,
    };

    // Validate the preferences collected from the form
    const validatedPrefsToSave = validatePreferences(newPrefs);

    chrome.storage.sync.set({ [PREFERENCES_KEY]: validatedPrefsToSave }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving preferences:", chrome.runtime.lastError.message);
            displayStatus("Error saving preferences. Please try again.", true);
            return;
        }
        displayStatus("Preferences saved successfully!", false);
        // Repopulate form with validated values, in case validation changed something (e.g. min/max)
        populateForm(validatedPrefsToSave);
    });
}

function displayStatus(message, isError) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'status-error' : 'status-success';
    setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = '';
    }, 3000);
}

// Make sure preferencesValidator.js is correctly imported and used.
// The HTML (optionspage.html) needs to have elements with IDs:
// - mapProvider (select)
// - autoUpdateInterval (input type number)
// - notificationsEnabled (input type checkbox)
// - saveButton (button)
// - statusMessage (e.g., a p or span)
// - Potentially an input for categories.
console.log("LocalLens optionsscript.js loaded.");
