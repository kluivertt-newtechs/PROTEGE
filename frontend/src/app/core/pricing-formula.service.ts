import { Injectable } from '@angular/core';
import {
  FormulaExecutionStep,
  PricingFormula,
  PricingFormulaCategory,
} from './mock';

export interface FormulaValidationResult {
  valid: boolean;
  messages: Array<string>;
}

export interface FormulaExecutionResult {
  values: Record<string, number>;
  memory: Array<FormulaExecutionStep>;
  warning?: string;
}

const STORAGE_KEY = 'protege.pricing.formulas';

const ALLOWED_MATH_FUNCTIONS = [
  'abs',
  'ceil',
  'floor',
  'max',
  'min',
  'pow',
  'round',
  'sqrt',
];

const RESERVED_IDENTIFIERS = new Set([
  'Math',
  'true',
  'false',
  'null',
  'undefined',
]);

export const PRICING_FORMULA_VARIABLES: Array<{ id: string; label: string }> = [
  { id: 'costBase', label: 'Custo base calculado por CPE/SOP/processamento' },
  { id: 'quantity', label: 'Quantidade ou volume mensal' },
  { id: 'operationalExpensesRate', label: 'Percentual de despesas operacionais' },
  { id: 'indirectExpensesRate', label: 'Percentual de despesas indiretas' },
  { id: 'targetMarginRate', label: 'Margem alvo' },
  { id: 'pisCofinsRate', label: 'PIS/COFINS' },
  { id: 'mainTaxRate', label: 'ISS/ICMS principal' },
];

export const DEFAULT_PRICING_FORMULAS: Array<PricingFormula> = [
  {
    id: 'costTotal',
    label: 'Custo total',
    description: 'Custo direto apurado pela origem operacional selecionada.',
    expression: 'costBase',
    order: 10,
    enabled: true,
    category: 'custo',
  },
  {
    id: 'netPrice',
    label: 'Preco liquido',
    description: 'Preco antes dos impostos, considerando despesas e margem.',
    expression:
      'costTotal / Math.max(0.01, 1 - (operationalExpensesRate + indirectExpensesRate + targetMarginRate))',
    order: 20,
    enabled: true,
    category: 'comercial',
  },
  {
    id: 'operationalExpenses',
    label: 'Despesas operacionais',
    description: 'Carga operacional aplicada ao preco liquido.',
    expression: 'netPrice * operationalExpensesRate',
    order: 30,
    enabled: true,
    category: 'comercial',
  },
  {
    id: 'indirectExpenses',
    label: 'Despesas indiretas',
    description: 'Carga indireta aplicada ao preco liquido.',
    expression: 'netPrice * indirectExpensesRate',
    order: 40,
    enabled: true,
    category: 'comercial',
  },
  {
    id: 'margin',
    label: 'Margem',
    description: 'Margem alvo aplicada ao preco liquido.',
    expression: 'netPrice * targetMarginRate',
    order: 50,
    enabled: true,
    category: 'comercial',
  },
  {
    id: 'taxRate',
    label: 'Aliquota total',
    description: 'Soma de PIS/COFINS com ISS ou ICMS.',
    expression: 'pisCofinsRate + mainTaxRate',
    order: 60,
    enabled: true,
    category: 'imposto',
  },
  {
    id: 'finalPrice',
    label: 'Preco final',
    description: 'Preco unitario com impostos embutidos.',
    expression: 'netPrice / Math.max(0.01, 1 - taxRate)',
    order: 70,
    enabled: true,
    category: 'resultado',
  },
  {
    id: 'taxes',
    label: 'Impostos',
    description: 'Valor unitario dos impostos.',
    expression: 'finalPrice - netPrice',
    order: 80,
    enabled: true,
    category: 'imposto',
  },
  {
    id: 'monthlyPrice',
    label: 'Preco mensal',
    description: 'Preco final multiplicado pela quantidade.',
    expression: 'finalPrice * quantity',
    order: 90,
    enabled: true,
    category: 'resultado',
  },
  {
    id: 'ebitdaRate',
    label: 'EBITDA alvo',
    description: 'Percentual usado como EBITDA alvo da simulacao.',
    expression: 'targetMarginRate',
    order: 100,
    enabled: true,
    category: 'resultado',
  },
];

@Injectable({ providedIn: 'root' })
export class PricingFormulaService {
  getFormulas(): Array<PricingFormula> {
    return cloneFormulas(readStoredFormulas() ?? DEFAULT_PRICING_FORMULAS);
  }

  saveFormulas(formulas: Array<PricingFormula>): FormulaValidationResult {
    const normalized = normalizeFormulas(formulas);
    const validation = validateFormulasForSave(normalized);

    if (!validation.valid) {
      return validation;
    }

    writeStoredFormulas(normalized);
    return validation;
  }

  resetToDefault(): Array<PricingFormula> {
    removeStoredFormulas();
    return cloneFormulas(DEFAULT_PRICING_FORMULAS);
  }

  validate(formulas: Array<PricingFormula>): FormulaValidationResult {
    return validateFormulasForSave(normalizeFormulas(formulas));
  }
}

export function executePricingFormulas(
  baseContext: Record<string, number>,
  formulas: Array<PricingFormula> = readStoredFormulas() ?? DEFAULT_PRICING_FORMULAS,
): FormulaExecutionResult {
  const normalized = normalizeFormulas(formulas);
  const validation = validateFormulas(normalized);

  if (!validation.valid) {
    return {
      values: {},
      memory: validation.messages.map((message) => ({
        id: 'formula-validation',
        label: 'Validacao das formulas',
        category: 'resultado',
        expression: '',
        value: 0,
        status: 'error',
        message,
      })),
      warning: validation.messages.join(' '),
    };
  }

  const values: Record<string, number> = {};
  const context: Record<string, number> = { ...baseContext };
  const memory: Array<FormulaExecutionStep> = [];

  for (const formula of sortFormulas(normalized)) {
    if (!formula.enabled) {
      memory.push({
        id: formula.id,
        label: formula.label,
        category: formula.category,
        expression: formula.expression,
        value: 0,
        status: 'disabled',
        message: 'Formula desabilitada.',
      });
      continue;
    }

    try {
      const value = evaluateExpression(formula.expression, context);
      if (!Number.isFinite(value)) {
        throw new Error('Resultado nao numerico.');
      }

      context[formula.id] = value;
      values[formula.id] = value;
      memory.push({
        id: formula.id,
        label: formula.label,
        category: formula.category,
        expression: formula.expression,
        value,
        status: 'ok',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao executar formula.';
      memory.push({
        id: formula.id,
        label: formula.label,
        category: formula.category,
        expression: formula.expression,
        value: 0,
        status: 'error',
        message,
      });
      return {
        values,
        memory,
        warning: `Formula ${formula.id}: ${message}`,
      };
    }
  }

  return { values, memory };
}

function validateFormulas(formulas: Array<PricingFormula>): FormulaValidationResult {
  const messages: Array<string> = [];
  const ids = new Set<string>();
  const available = new Set(PRICING_FORMULA_VARIABLES.map((variable) => variable.id));

  for (const formula of sortFormulas(formulas)) {
    if (!formula.id.trim()) {
      messages.push('Identificador vazio.');
      continue;
    }

    if (ids.has(formula.id)) {
      messages.push(`Identificador duplicado: ${formula.id}.`);
    }
    ids.add(formula.id);

    if (!formula.expression.trim()) {
      messages.push(`Expressao vazia em ${formula.id}.`);
    }

    if (!isValidCategory(formula.category)) {
      messages.push(`Categoria invalida em ${formula.id}.`);
    }

    const expressionValidation = validateExpressionReferences(formula.expression, available);
    messages.push(...expressionValidation.map((message) => `${formula.id}: ${message}`));

    available.add(formula.id);
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}

function validateFormulasForSave(formulas: Array<PricingFormula>): FormulaValidationResult {
  const validation = validateFormulas(formulas);

  if (!validation.valid) {
    return validation;
  }

  const execution = executePricingFormulas(
    {
      costBase: 1000,
      quantity: 10,
      operationalExpensesRate: 0.14,
      indirectExpensesRate: 0.141,
      targetMarginRate: 0.08,
      pisCofinsRate: 0.0365,
      mainTaxRate: 0.05,
    },
    formulas,
  );
  const executionErrors = execution.memory
    .filter((step) => step.status === 'error')
    .map((step) => `${step.id}: ${step.message ?? 'erro de execucao.'}`);

  return {
    valid: executionErrors.length === 0,
    messages: executionErrors,
  };
}

function validateExpressionReferences(
  expression: string,
  available: Set<string>,
): Array<string> {
  const messages: Array<string> = [];

  if (/[^-+*/%().,\s?:<>=!&|0-9A-Za-z_]/.test(expression)) {
    messages.push('use apenas operadores matematicos, ternario e identificadores.');
  }

  const mathMemberMatches = expression.matchAll(/\bMath\.([A-Za-z_][A-Za-z0-9_]*)/g);
  for (const match of mathMemberMatches) {
    if (!ALLOWED_MATH_FUNCTIONS.includes(match[1])) {
      messages.push(`funcao Math.${match[1]} nao permitida.`);
    }
  }

  const identifiers = expression.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  for (const identifier of identifiers) {
    if (
      RESERVED_IDENTIFIERS.has(identifier) ||
      ALLOWED_MATH_FUNCTIONS.includes(identifier)
    ) {
      continue;
    }

    if (!available.has(identifier)) {
      messages.push(`referencia inexistente: ${identifier}.`);
    }
  }

  if (/(^|[^A-Za-z0-9_])\.(?!\s*$)/.test(expression.replace(/\bMath\./g, 'Math'))) {
    messages.push('acesso a propriedades nao e permitido fora de Math.');
  }

  return [...new Set(messages)];
}

function evaluateExpression(expression: string, context: Record<string, number>): number {
  const functionContext = {
    ...Object.fromEntries(ALLOWED_MATH_FUNCTIONS.map((name) => [name, Math[name as keyof Math]])),
    Math: Object.fromEntries(ALLOWED_MATH_FUNCTIONS.map((name) => [name, Math[name as keyof Math]])),
    ...context,
  };
  const argNames = Object.keys(functionContext);
  const argValues = Object.values(functionContext);
  const evaluator = new Function(...argNames, `"use strict"; return (${expression});`);
  return Number(evaluator(...argValues));
}

function normalizeFormulas(formulas: Array<PricingFormula>): Array<PricingFormula> {
  return formulas.map((formula) => ({
    id: String(formula.id ?? '').trim(),
    label: String(formula.label ?? '').trim() || String(formula.id ?? '').trim(),
    description: String(formula.description ?? '').trim(),
    expression: String(formula.expression ?? '').trim(),
    order: Number.isFinite(Number(formula.order)) ? Number(formula.order) : 0,
    enabled: formula.enabled !== false,
    category: formula.category,
  }));
}

function sortFormulas(formulas: Array<PricingFormula>): Array<PricingFormula> {
  return [...formulas].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function cloneFormulas(formulas: Array<PricingFormula>): Array<PricingFormula> {
  return formulas.map((formula) => ({ ...formula }));
}

function isValidCategory(category: PricingFormulaCategory): boolean {
  return ['custo', 'comercial', 'imposto', 'resultado'].includes(category);
}

function readStoredFormulas(): Array<PricingFormula> | undefined {
  if (!canUseStorage()) {
    return undefined;
  }

  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Array<PricingFormula>;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    removeStoredFormulas();
    return undefined;
  }
}

function writeStoredFormulas(formulas: Array<PricingFormula>): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(formulas));
}

function removeStoredFormulas(): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}
