/**
 * Setup para tests de CSS
 * Carga el archivo CSS en el entorno de pruebas
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill para TextEncoder/TextDecoder en Node.js
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Leer el archivo CSS
const cssPath = join(__dirname, '../utility-classes.css');
const cssContent = readFileSync(cssPath, 'utf8');

// Crear elemento <style> e inyectar CSS
const style = document.createElement('style');
style.textContent = cssContent;
document.head.appendChild(style);
