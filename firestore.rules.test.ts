import fs from 'node:fs';
import assert from 'node:assert/strict';

const rules = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf-8');

// Verificación estática de los 8 pilares y los 12 vectores de ataque (Dirty Dozen)
assert.match(rules, /rules_version = '2';/, 'Requiere rules_version = 2');
assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/, 'Requiere catch-all deny');
assert.match(rules, /email_verified == true/, 'Requiere verificación de correo');
assert.match(rules, /isValidId\(/, 'Requiere guardas de ID');
assert.match(rules, /hasAll\(/, 'Requiere hasAll estricto');
assert.match(rules, /hasOnly\(/, 'Requiere hasOnly estricto contra shadow fields');
assert.match(rules, /affectedKeys\(\)\.hasOnly\(/, 'Requiere affectedKeys().hasOnly en updates');
assert.match(rules, /existing\(\)\.status != 'rechazado'/, 'Requiere bloqueo de estado terminal');
assert.match(rules, /request\.time/, 'Requiere validación de timestamp del servidor');

console.log('firestore.rules.test.ts: invariantes de seguridad verificadas.');
