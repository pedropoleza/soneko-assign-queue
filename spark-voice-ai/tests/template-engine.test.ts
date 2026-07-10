import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTemplate,
  renderTemplate,
  extractVariables,
} from '../supabase/functions/_shared/template-engine.ts';
import { checkContentPolicy } from '../supabase/functions/_shared/content-policy.ts';

test('extrai variáveis referenciadas', () => {
  assert.deepEqual(extractVariables('Oi {{first_name}}, tudo bem?').sort(), ['first_name']);
});

test('rejeita template vazio', () => {
  assert.equal(validateTemplate('   ').ok, false);
});

test('rejeita variável fora da allow-list', () => {
  const r = validateTemplate('Oi {{ssn}}');
  assert.equal(r.ok, false);
  assert.deepEqual(r.unknownVars, ['ssn']);
});

test('aceita template válido', () => {
  assert.equal(validateTemplate('Feliz aniversário, {{first_name}}!').ok, true);
});

test('substitui variáveis e ignora ausentes', () => {
  const r = renderTemplate('Oi {{first_name}} da {{business_name}}', { first_name: 'Ana' });
  assert.equal(r.text, 'Oi Ana da');
});

test('trunca ao teto de caracteres', () => {
  const r = renderTemplate('a'.repeat(1000), {}, 100);
  assert.equal(r.characters, 100);
  assert.equal(r.truncated, true);
});

test('política bloqueia phishing de credencial', () => {
  assert.equal(checkContentPolicy('informe seu código de verificação agora').ok, false);
});

test('política aprova mensagem legítima', () => {
  assert.equal(checkContentPolicy('Feliz aniversário! Passe na clínica para seu check-up.').ok, true);
});
