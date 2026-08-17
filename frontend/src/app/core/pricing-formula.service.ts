import { Injectable } from '@angular/core';
import {
  FormulaExecutionStep,
  PricingBusinessBranch,
  PricingFormula,
  PricingFormulaCategory,
} from './mock';
import { PriceComponent, ProductCatalogService, ProductComponent } from './product-catalog.service';

export interface FormulaValidationResult {
  valid: boolean;
  messages: Array<string>;
}

export interface FormulaExecutionResult {
  values: Record<string, number>;
  memory: Array<FormulaExecutionStep>;
  warning?: string;
}

interface FormulaDependencyResult {
  formulas: Array<PricingFormula>;
  messages: Array<string>;
}

const STORAGE_KEY = 'protege.pricing.formulas';
const PRODUCT_STORAGE_KEY = 'protege.pricing.formulas.byProduct.v1';
const BUSINESS_BRANCHES: Array<PricingBusinessBranch> = ['transport', 'processing'];

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

const BASE_VARIABLE_IDS = new Set(PRICING_FORMULA_VARIABLES.map((variable) => variable.id));

export const DEFAULT_PRICING_FORMULAS: Array<PricingFormula> = [
  {
    id: 'costTotal',
    label: 'Custo total',
    description: 'Custo direto apurado pela origem operacional selecionada.',
    expression: 'costBase',
    enabled: true,
    category: 'custo',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'netPrice',
    label: 'Preço líquido',
    description: 'Preço antes dos impostos, considerando despesas e margem.',
    expression:
      'costTotal / Math.max(0.01, 1 - (operationalExpensesRate + indirectExpensesRate + targetMarginRate))',
    enabled: true,
    category: 'comercial',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'operationalExpenses',
    label: 'Despesas operacionais',
    description: 'Carga operacional aplicada ao preço líquido.',
    expression: 'netPrice * operationalExpensesRate',
    enabled: true,
    category: 'comercial',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'indirectExpenses',
    label: 'Despesas indiretas',
    description: 'Carga indireta aplicada ao preço líquido.',
    expression: 'netPrice * indirectExpensesRate',
    enabled: true,
    category: 'comercial',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'margin',
    label: 'Margem',
    description: 'Margem alvo aplicada ao preço líquido.',
    expression: 'netPrice * targetMarginRate',
    enabled: true,
    category: 'comercial',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'taxRate',
    label: 'Alíquota total',
    description: 'Soma de PIS/COFINS com ISS ou ICMS.',
    expression: 'pisCofinsRate + mainTaxRate',
    enabled: true,
    category: 'imposto',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'finalPrice',
    label: 'Preço final',
    description: 'Preço unitário com impostos embutidos.',
    expression: 'netPrice / Math.max(0.01, 1 - taxRate)',
    enabled: true,
    category: 'resultado',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'taxes',
    label: 'Impostos',
    description: 'Valor unitário dos impostos.',
    expression: 'finalPrice - netPrice',
    enabled: true,
    category: 'imposto',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'monthlyPrice',
    label: 'Preço mensal',
    description: 'Preço final multiplicado pela quantidade.',
    expression: 'finalPrice * quantity',
    enabled: true,
    category: 'resultado',
    businessBranches: ['transport', 'processing'],
  },
  {
    id: 'ebitdaRate',
    label: 'EBITDA alvo',
    description: 'Percentual usado como EBITDA alvo da simulação.',
    expression: 'targetMarginRate',
    enabled: true,
    category: 'resultado',
    businessBranches: ['transport', 'processing'],
  },
];

@Injectable({ providedIn: 'root' })
export class PricingFormulaService {
  constructor(private readonly productCatalog: ProductCatalogService) {}

  getFormulas(productId: string): Array<PricingFormula> {
    return cloneFormulas(readStoredFormulaCatalog()[productId] ?? []);
  }

  saveFormulas(productId: string, formulas: Array<PricingFormula>): FormulaValidationResult {
    const normalized = normalizeFormulas(formulas);
    const validation = validateFormulasForSave(normalized, this.getAllowedVariableIds(productId));

    if (!validation.valid) {
      return validation;
    }

    writeStoredProductFormulas(productId, normalized);
    return validation;
  }

  resetProductFormulas(productId: string): Array<PricingFormula> {
    removeStoredProductFormulas(productId);
    return [];
  }

  validate(productId: string, formulas: Array<PricingFormula>): FormulaValidationResult {
    return validateFormulasForSave(normalizeFormulas(formulas), this.getAllowedVariableIds(productId));
  }

  getAvailableVariables(productId: string): Array<{ id: string; label: string }> {
    const variables = [
      ...PRICING_FORMULA_VARIABLES,
      ...this.getProductComponentVariables(productId),
      ...this.getPriceComponentVariables(productId),
    ];
    const usedIds = new Set<string>();

    return variables.filter((variable) => {
      if (usedIds.has(variable.id)) {
        return false;
      }

      usedIds.add(variable.id);
      return true;
    });
  }

  getProductComponentVariables(productId: string): Array<{ id: string; label: string; component: ProductComponent }> {
    return this.productCatalog.getCompositionComponents(productId)
      .filter((component) => Boolean(component.varAPV))
      .map((component) => ({
        id: component.varAPV,
        label: `${component.description}${component.unit ? ` (${component.unit})` : ''}`,
        component,
      }));
  }

  getPriceComponentVariables(productId: string): Array<{ id: string; label: string; component: PriceComponent }> {
    const linkedPriceComponents = this.productCatalog.getCompositionPriceComponents(productId);
    const priceComponents = linkedPriceComponents.length
      ? linkedPriceComponents
      : this.productCatalog.listPriceComponents(false);

    return priceComponents
      .filter((component) => Boolean(component.varAPV))
      .map((component) => ({
        id: component.varAPV,
        label: `${component.description}${component.unit ? ` (${component.unit})` : ''}`,
        component,
      }));
  }

  private getAllowedVariableIds(productId: string): Set<string> {
    return new Set(this.getAvailableVariables(productId).map((variable) => variable.id));
  }
}

export function executePricingFormulas(
  baseContext: Record<string, number>,
  formulas: Array<PricingFormula> = [],
  businessBranch?: PricingBusinessBranch,
): FormulaExecutionResult {
  const normalized = filterFormulasByBusinessBranch(normalizeFormulas(formulas), businessBranch);
  const validation = validateFormulas(
    normalized,
    new Set([...BASE_VARIABLE_IDS, ...Object.keys(baseContext)]),
  );

  if (!validation.valid) {
    return {
      values: {},
      memory: validation.messages.map((message) => ({
        id: 'formula-validation',
        label: 'Validação das fórmulas',
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
  const dependencyResult = resolveFormulaExecutionOrder(normalized);

  if (dependencyResult.messages.length) {
    return {
      values: {},
      memory: dependencyResult.messages.map((message) => ({
        id: 'formula-validation',
        label: 'Validação das fórmulas',
        category: 'resultado',
        expression: '',
        value: 0,
        status: 'error',
        message,
      })),
      warning: dependencyResult.messages.join(' '),
    };
  }

  for (const formula of dependencyResult.formulas) {
    if (!formula.enabled) {
      memory.push({
        id: formula.id,
        label: formula.label,
        category: formula.category,
        expression: formula.expression,
        value: 0,
        status: 'disabled',
        message: 'Fórmula desabilitada.',
      });
      continue;
    }

    try {
      const value = evaluateExpression(formula.expression, context);
      if (!Number.isFinite(value)) {
        throw new Error('Resultado não numérico.');
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
      const message = error instanceof Error ? error.message : 'Erro ao executar fórmula.';
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
        warning: `Fórmula ${formula.id}: ${message}`,
      };
    }
  }

  return { values, memory };
}

function validateFormulas(
  formulas: Array<PricingFormula>,
  allowedVariableIds: Set<string> = BASE_VARIABLE_IDS,
): FormulaValidationResult {
  const messages: Array<string> = [];
  const ids = new Set<string>();

  for (const formula of formulas) {
    if (!formula.id.trim()) {
      messages.push('Identificador vazio.');
      continue;
    }

    if (ids.has(formula.id)) {
      messages.push(`Identificador duplicado: ${formula.id}.`);
    }
    ids.add(formula.id);
  }

  const enabledIds = new Set(
    formulas
      .filter((formula) => formula.enabled)
      .map((formula) => formula.id),
  );

  for (const formula of formulas) {
    if (!formula.expression.trim()) {
      messages.push(`Expressão vazia em ${formula.id}.`);
    }

    if (!isValidCategory(formula.category)) {
      messages.push(`Categoria inválida em ${formula.id}.`);
    }

    const expressionValidation = validateExpressionReferences(formula.expression, ids, allowedVariableIds);
    messages.push(...expressionValidation.map((message) => `${formula.id}: ${message}`));

    if (formula.enabled) {
      const disabledReferences = extractFormulaReferences(formula.expression, ids)
        .filter((reference) => !enabledIds.has(reference));
      messages.push(
        ...disabledReferences.map((reference) => `${formula.id}: referência a fórmula desabilitada: ${reference}.`),
      );
    }
  }

  const dependencyResult = resolveFormulaExecutionOrder(formulas);
  if (dependencyResult.messages.length) {
    messages.push(...dependencyResult.messages);
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}

function validateFormulasForSave(
  formulas: Array<PricingFormula>,
  allowedVariableIds: Set<string> = BASE_VARIABLE_IDS,
): FormulaValidationResult {
  const validation = validateFormulas(formulas, allowedVariableIds);

  if (!validation.valid) {
    return validation;
  }

  const branchValidationMessages = BUSINESS_BRANCHES.flatMap((branch) =>
    validateFormulas(filterFormulasByBusinessBranch(formulas, branch), allowedVariableIds).messages,
  );

  if (branchValidationMessages.length) {
    return {
      valid: false,
      messages: [...new Set(branchValidationMessages)],
    };
  }

  const sampleContext = {
    ...Object.fromEntries([...allowedVariableIds].map((id) => [id, 0])),
    costBase: 1000,
    quantity: 10,
    operationalExpensesRate: 0.14,
    indirectExpensesRate: 0.141,
    targetMarginRate: 0.08,
    pisCofinsRate: 0.0365,
    mainTaxRate: 0.05,
    riskRate: 0.03,
    insuranceEnabled: 1,
  };
  const executionErrors = BUSINESS_BRANCHES.flatMap((branch) =>
    executePricingFormulas(sampleContext, formulas, branch).memory,
  )
    .filter((step) => step.status === 'error')
    .map((step) => `${step.id}: ${step.message ?? 'erro de execução.'}`);

  return {
    valid: executionErrors.length === 0,
    messages: [...new Set(executionErrors)],
  };
}

function validateExpressionReferences(
  expression: string,
  formulaIds: Set<string>,
  allowedVariableIds: Set<string>,
): Array<string> {
  const messages: Array<string> = [];

  if (/[^-+*/%().,\s?:<>=!&|0-9A-Za-z_]/.test(expression)) {
    messages.push('use apenas operadores matemáticos, ternário e identificadores.');
  }

  const mathMemberMatches = expression.matchAll(/\bMath\.([A-Za-z_][A-Za-z0-9_]*)/g);
  for (const match of mathMemberMatches) {
    if (!ALLOWED_MATH_FUNCTIONS.includes(match[1])) {
      messages.push(`função Math.${match[1]} não permitida.`);
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

    if (!allowedVariableIds.has(identifier) && !formulaIds.has(identifier)) {
      messages.push(`referência inexistente: ${identifier}.`);
    }
  }

  if (/(^|[^A-Za-z0-9_])\.(?!\s*$)/.test(expression.replace(/\bMath\./g, 'Math'))) {
    messages.push('acesso a propriedades não é permitido fora de Math.');
  }

  return [...new Set(messages)];
}

function resolveFormulaExecutionOrder(formulas: Array<PricingFormula>): FormulaDependencyResult {
  const enabledById = new Map(
    formulas
      .filter((formula) => formula.enabled)
      .map((formula) => [formula.id, formula]),
  );
  const states = new Map<string, 'visiting' | 'visited'>();
  const sorted: Array<PricingFormula> = [];
  const messages: Array<string> = [];

  const visit = (formula: PricingFormula, path: Array<string>): void => {
    const state = states.get(formula.id);

    if (state === 'visited') {
      return;
    }

    if (state === 'visiting') {
      const cycleStart = path.indexOf(formula.id);
      const cycle = [...path.slice(Math.max(0, cycleStart)), formula.id].join(' -> ');
      messages.push(`Referência circular entre fórmulas: ${cycle}.`);
      return;
    }

    states.set(formula.id, 'visiting');

    for (const dependencyId of extractFormulaReferences(formula.expression, new Set(enabledById.keys()))) {
      const dependency = enabledById.get(dependencyId);

      if (dependency) {
        visit(dependency, [...path, formula.id]);
      }
    }

    states.set(formula.id, 'visited');
    sorted.push(formula);
  };

  for (const formula of enabledById.values()) {
    visit(formula, []);
  }

  return {
    formulas: [
      ...sorted,
      ...formulas.filter((formula) => !formula.enabled),
    ],
    messages: [...new Set(messages)],
  };
}

function extractFormulaReferences(expression: string, formulaIds: Set<string>): Array<string> {
  return extractIdentifiers(expression).filter((identifier) => formulaIds.has(identifier));
}

function extractIdentifiers(expression: string): Array<string> {
  const identifiers = expression.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];

  return [...new Set(identifiers.filter((identifier) =>
    !RESERVED_IDENTIFIERS.has(identifier) &&
    !ALLOWED_MATH_FUNCTIONS.includes(identifier)
  ))];
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
    enabled: formula.enabled !== false,
    category: formula.category,
    businessBranches: normalizeBusinessBranches(formula.businessBranches),
  }));
}

function cloneFormulas(formulas: Array<PricingFormula>): Array<PricingFormula> {
  return normalizeFormulas(formulas);
}

function isValidCategory(category: PricingFormulaCategory): boolean {
  return ['custo', 'comercial', 'imposto', 'resultado'].includes(category);
}

function normalizeBusinessBranches(branches: Array<PricingBusinessBranch> | undefined): Array<PricingBusinessBranch> {
  const normalized = (branches ?? [])
    .filter((branch): branch is PricingBusinessBranch => BUSINESS_BRANCHES.includes(branch));

  return normalized.length ? [...new Set(normalized)] : [...BUSINESS_BRANCHES];
}

function filterFormulasByBusinessBranch(
  formulas: Array<PricingFormula>,
  businessBranch?: PricingBusinessBranch,
): Array<PricingFormula> {
  if (!businessBranch) {
    return formulas;
  }

  return formulas.filter((formula) => formula.businessBranches.includes(businessBranch));
}

function readStoredFormulaCatalog(): Record<string, Array<PricingFormula>> {
  if (!canUseStorage()) {
    return {};
  }

  const value = localStorage.getItem(PRODUCT_STORAGE_KEY);
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, Array<PricingFormula>>;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, formulas]) => Array.isArray(formulas))
        .map(([productId, formulas]) => [productId, normalizeFormulas(formulas)]),
    );
  } catch {
    localStorage.removeItem(PRODUCT_STORAGE_KEY);
    return {};
  }
}

function writeStoredProductFormulas(productId: string, formulas: Array<PricingFormula>): void {
  if (!canUseStorage()) {
    return;
  }

  const catalog = readStoredFormulaCatalog();
  catalog[productId] = formulas;
  localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(catalog));
  localStorage.removeItem(STORAGE_KEY);
}

function removeStoredProductFormulas(productId: string): void {
  if (!canUseStorage()) {
    return;
  }

  const catalog = readStoredFormulaCatalog();
  delete catalog[productId];
  localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(catalog));
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}
