/**
 * @typedef {object} EmailTemplateDefinition
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {string} sendGridEnvVar
 * @property {string[]} contentFields Fields used when composing body copy at send time
 * @property {string[]} requiredFields Required in dynamic_template_data when sending
 * @property {(baseUrl: string) => Record<string, string>} buildPreviewData
 * @property {() => string} buildSendGridPlainText
 */

export {}
