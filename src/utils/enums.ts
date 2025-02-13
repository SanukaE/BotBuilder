/**
 * Enumeration representing different types of form fields in NamelessMC.
 * @enum {number}
 * @readonly
 * @description Defines the available form field types that can be used in NamelessMC forms.
 * @property {number} TEXT - Single line text input field
 * @property {number} OPTIONS - Dropdown or select field
 * @property {number} TEXT_AREA - Multi-line text input field
 * @property {number} HELP_BOX - Help text or information box
 * @property {number} BARRIER - Separator or divider element
 * @property {number} NUMBER - Numeric input field
 * @property {number} EMAIL_ADDRESS - Email address input field
 * @property {number} RADIO_CHECKBOX - Radio button input
 * @property {number} CHECKBOX - Checkbox input
 * @property {number} FILE - File upload field
 */
export enum NamelessMCFormFields {
  TEXT = 1,
  OPTIONS,
  TEXT_AREA,
  HELP_BOX,
  BARRIER,
  NUMBER,
  EMAIL_ADDRESS,
  RADIO_CHECKBOX,
  CHECKBOX,
  FILE,
}
