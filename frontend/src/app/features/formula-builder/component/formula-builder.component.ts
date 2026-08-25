import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  PoLookupColumn,
  PoLookupFilter,
  PoLookupFilteredItemsParams,
  PoLookupResponseApi,
  PoPageAction,
} from '@po-ui/ng-components';
import { Observable, of } from 'rxjs';
import {
  PRICING_FORMULA_VARIABLES,
  PricingFormulaService,
} from 'src/app/core/pricing-formula.service';
import { PricingBusinessBranch, PricingFormula } from 'src/app/core/mock';
import {
  PriceComponent,
  ProductCatalogService,
  ProductComponent,
  ProductNode,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type FormulaTokenKind = 'variable' | 'formula' | 'function' | 'operator' | 'number' | 'text';

interface FormulaExpressionToken {
  id: string;
  value: string;
  kind: FormulaTokenKind;
}

interface FormulaDragData {
  source: 'palette' | 'editor';
  value?: string;
  index?: number;
}

interface FormulaProductScope {
  productId: string;
  formulas: Array<PricingFormula>;
  selectedFormula?: PricingFormula;
  productComponents: Array<ProductComponent>;
  priceComponents: Array<PriceComponent>;
  productComponentsOpen: boolean;
  priceComponentsOpen: boolean;
  quickFunctionsOpen: boolean;
  selectedFormulaOriginalId: string;
  statusMessage: string;
  statusType: 'success' | 'error' | 'info';
  expressionTokens: Array<FormulaExpressionToken>;
  expressionCursorIndex: number;
}

class DisabledProductLookupService implements PoLookupFilter {
  getFilteredItems(_: PoLookupFilteredItemsParams): Observable<PoLookupResponseApi> {
    return of({ items: [], hasNext: false });
  }

  getObjectByValue(): Observable<undefined> {
    return of(undefined);
  }
}

function normalizeText(value: string): string {
  const text = String(value ?? '');

  if (!/[\u00c3\u00c2\u0080-\u009f\ufffd]/.test(text)) {
    return text;
  }

  try {
    const bytes = new Uint8Array([...text].map((char) => char.charCodeAt(0) & 255));
    return new TextDecoder('utf-8').decode(bytes).replace(/\uFFFD/g, '');
  } catch {
    return text;
  }
}

@Component({
  selector: 'app-formula-builder',
  templateUrl: './formula-builder.component.html',
  styleUrls: ['./formula-builder.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class FormulaBuilderComponent implements OnInit {
  products: Array<ProductNode> = [];
  selectedProductIds: Array<string> = [];
  selectedScopes: Array<FormulaProductScope> = [];
  productSelectorOpen = false;
  activeProductId = '';
  private productScopes: Record<string, FormulaProductScope> = {};

  readonly simulationVariables = PRICING_FORMULA_VARIABLES;
  readonly defaultBusinessBranches: Array<PricingBusinessBranch> = ['transport', 'processing'];
  readonly operatorTokens = ['+', '-', '*', '/', '(', ')', ',', '?', ':'];
  readonly quickFunctionTokens = [
    { id: 'Math.max()', label: 'Maior valor' },
    { id: 'Math.min()', label: 'Menor valor' },
    { id: 'Math.round()', label: 'Arredondar' },
    { id: 'Math.ceil()', label: 'Arredondar para cima' },
    { id: 'Math.floor()', label: 'Arredondar para baixo' },
    { id: 'Math.abs()', label: 'Valor absoluto' },
    { id: 'Math.pow()', label: 'Potenciação' },
    { id: 'Math.sqrt()', label: 'Raiz quadrada' },
    { id: 'value * rate', label: 'Percentual simples' },
    { id: 'value / Math.max(0.01, 1 - rate)', label: 'Base antes do percentual' },
    { id: 'value * (1 + rate)', label: 'Aplicar acréscimo percentual' },
  ];
  readonly pageActions: Array<PoPageAction> = [
    { label: 'Selecionar Produto', icon: 'an an-magnifying-glass', action: () => this.openProductSelector() },
  ];
  readonly productLookupColumns: Array<PoLookupColumn> = [];
  readonly productLookupService = new DisabledProductLookupService();

  constructor(
    private readonly formulaService: PricingFormulaService,
    private readonly catalog: ProductCatalogService,
  ) {}

  get activeScope(): FormulaProductScope | undefined {
    return this.getScope();
  }

  ngOnInit(): void {
    this.products = this.catalog.getProducts();
    const initialProductId = this.catalog.getSelectedProductId() || this.products[0]?.id || '';

    if (initialProductId) {
      this.applySelectedProductIds([initialProductId], initialProductId);
    }
  }

  openProductSelector(): void {
    this.products = this.catalog.getProducts();
    this.productSelectorOpen = !this.productSelectorOpen;
  }

  selectProductFromCatalog(productId: string): void {
    this.applySelectedProductIds([...this.selectedProductIds, productId], productId);
    this.productSelectorOpen = false;
  }

  onProductLookupSelected(_: unknown): void {}

  onProductLookupChange(_: unknown): void {}

  activateProduct(productId: string): void {
    if (!productId || this.activeProductId === productId) {
      return;
    }

    this.activeProductId = productId;
    this.catalog.setSelectedProductId(productId);
  }

  selectedProduct(scope: FormulaProductScope): ProductNode | undefined {
    return this.products.find((product) => product.id === scope.productId)
      ?? this.catalog.getProduct(scope.productId);
  }

  productTabLabel(scope: FormulaProductScope): string {
    const product = this.selectedProduct(scope);

    return product ? this.displayText(product.name || product.code) : scope.productId;
  }

  selectedProductLabel(scope: FormulaProductScope): string {
    const product = this.selectedProduct(scope);

    return product ? this.displayText(`${product.code} - ${product.name}`) : scope.productId;
  }

  formulaVariables(scope: FormulaProductScope): Array<PricingFormula> {
    const selectedIds = new Set([
      scope.selectedFormula?.id,
      scope.selectedFormulaOriginalId,
    ].filter(Boolean));

    return this.buildEditedCatalog(scope)
      .filter((formula) => formula.enabled)
      .filter((formula) => !selectedIds.has(formula.id));
  }

  catalogFormulas(scope: FormulaProductScope): Array<PricingFormula> {
    return this.buildEditedCatalog(scope);
  }

  selectFormula(scope: FormulaProductScope, formula: PricingFormula): void {
    const isPersistedInScope = scope.formulas.some((scopedFormula) => scopedFormula.id === formula.id);
    scope.selectedFormula = { ...formula };
    scope.selectedFormulaOriginalId = isPersistedInScope ? formula.id : '';
    this.refreshExpressionTokens(scope);
    scope.statusMessage = '';
  }

  toggleProductComponents(scope: FormulaProductScope): void {
    scope.productComponentsOpen = !scope.productComponentsOpen;
  }

  togglePriceComponents(scope: FormulaProductScope): void {
    scope.priceComponentsOpen = !scope.priceComponentsOpen;
  }

  toggleQuickFunctions(scope: FormulaProductScope): void {
    scope.quickFunctionsOpen = !scope.quickFunctionsOpen;
  }

  addFormula(scope: FormulaProductScope): void {
    scope.selectedFormula = {
      id: `formula${scope.formulas.length + 1}`,
      label: 'Nova fórmula',
      description: '',
      expression: '0',
      enabled: true,
      category: 'resultado',
      businessBranches: [...this.defaultBusinessBranches],
    };
    scope.selectedFormulaOriginalId = '';
    this.refreshExpressionTokens(scope);
    scope.statusMessage = '';
  }

  removeSelected(scope: FormulaProductScope): void {
    if (!scope.selectedFormula) {
      return;
    }

    const selectedId = scope.selectedFormulaOriginalId || scope.selectedFormula.id;

    if (scope.selectedFormulaOriginalId) {
      const result = this.formulaService.removeFormula(scope.productId, selectedId);
      scope.formulas = result.formulas;
      scope.statusType = result.validation.valid ? 'success' : 'error';
      scope.statusMessage = result.validation.valid
        ? 'Fórmula removida.'
        : `Fórmula removida. ${result.validation.messages.join(' ')}`;
    } else {
      scope.formulas = scope.formulas.filter((formula) => formula.id !== selectedId);
      scope.statusType = 'success';
      scope.statusMessage = 'Fórmula removida.';
    }

    scope.selectedFormula = undefined;
    scope.selectedFormulaOriginalId = '';
    this.refreshExpressionTokens(scope);
  }

  validate(scope: FormulaProductScope): void {
    const validation = this.formulaService.validate(scope.productId, this.buildEditedCatalog(scope));
    scope.statusType = validation.valid ? 'success' : 'error';
    scope.statusMessage = validation.valid
      ? 'Fórmulas válidas para execução.'
      : validation.messages.join(' ');
  }

  save(scope: FormulaProductScope): void {
    const catalog = this.buildEditedCatalog(scope);
    const validation = this.formulaService.saveFormulas(scope.productId, catalog);

    if (!validation.valid) {
      scope.statusType = 'error';
      scope.statusMessage = validation.messages.join(' ');
      return;
    }

    scope.formulas = this.formulaService.getFormulas(scope.productId);
    const selected = scope.formulas.find((formula) => formula.id === scope.selectedFormula?.id);
    scope.selectedFormula = selected ? { ...selected } : undefined;
    scope.selectedFormulaOriginalId = scope.selectedFormula?.id ?? '';
    this.refreshExpressionTokens(scope);
    scope.statusType = 'success';
    scope.statusMessage = 'Fórmulas salvas localmente.';
  }

  insertToken(token: string, scope = this.activeScope): void {
    if (!scope?.selectedFormula) {
      return;
    }

    this.insertTokensAt(scope, this.createTokens(scope, token), scope.expressionCursorIndex);
  }

  removeExpressionToken(scope: FormulaProductScope, index: number, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!scope.selectedFormula) {
      return;
    }

    scope.expressionTokens = scope.expressionTokens.filter((_, tokenIndex) => tokenIndex !== index);
    scope.expressionCursorIndex = this.clampCursorIndex(
      scope,
      index < scope.expressionCursorIndex ? scope.expressionCursorIndex - 1 : scope.expressionCursorIndex,
    );
    this.syncExpressionFromTokens(scope);
  }

  setExpressionCursor(scope: FormulaProductScope, index: number): void {
    scope.expressionCursorIndex = this.clampCursorIndex(scope, index);
  }

  handleExpressionKeydown(scope: FormulaProductScope, event: KeyboardEvent): void {
    if (!scope.selectedFormula || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setExpressionCursor(scope, scope.expressionCursorIndex - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.setExpressionCursor(scope, scope.expressionCursorIndex + 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.setExpressionCursor(scope, 0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.setExpressionCursor(scope, scope.expressionTokens.length);
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.appendNumberCharacter(scope, event.key);
      return;
    }

    if (event.key === '.' || (event.key === ',' && event.code === 'NumpadDecimal')) {
      event.preventDefault();
      this.appendDecimalSeparator(scope);
      return;
    }

    if (this.operatorTokens.includes(event.key)) {
      event.preventDefault();
      this.insertTokensAt(scope, [this.createExpressionToken(scope, event.key)], scope.expressionCursorIndex);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.removeBeforeCursor(scope);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.removeAfterCursor(scope);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
    }
  }

  beginPaletteDrag(event: DragEvent, token: string): void {
    this.setDragData(event, { source: 'palette', value: token });
  }

  beginExpressionTokenDrag(event: DragEvent, index: number): void {
    this.setDragData(event, { source: 'editor', index });
  }

  allowExpressionDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  dropOnExpression(scope: FormulaProductScope, event: DragEvent, targetIndex = scope.expressionTokens.length): void {
    event.preventDefault();
    event.stopPropagation();

    if (!scope.selectedFormula) {
      return;
    }

    const dragData = this.readDragData(event);
    if (!dragData) {
      return;
    }

    if (dragData.source === 'editor' && Number.isInteger(dragData.index)) {
      this.moveExpressionToken(scope, Number(dragData.index), targetIndex);
      return;
    }

    if (dragData.source === 'palette' && dragData.value) {
      this.insertTokensAt(scope, this.createTokens(scope, dragData.value), targetIndex);
    }
  }

  getExpressionTokenLabel(token: FormulaExpressionToken): string {
    if (token.kind === 'variable') {
      return 'Variável de entrada';
    }

    if (token.kind === 'formula') {
      return 'Fórmula disponível';
    }

    if (token.kind === 'function') {
      return 'Função Math';
    }

    return 'Trecho da expressão';
  }

  displayText(value: string): string {
    return normalizeText(value);
  }

  componentMeta(component: ProductComponent): string {
    return [component.code, this.displayText(component.group)].filter(Boolean).join(' - ');
  }

  trackByScope(_: number, scope: FormulaProductScope): string {
    return scope.productId;
  }

  trackByProduct(_: number, product: ProductNode): string {
    return product.id;
  }

  trackByFormula(_: number, formula: PricingFormula): string {
    return formula.id;
  }

  trackByComponent(_: number, component: ProductComponent): string {
    return component.id;
  }

  trackByVariable(_: number, variable: { id: string }): string {
    return variable.id;
  }

  trackByToken(_: number, token: FormulaExpressionToken): string {
    return token.id;
  }

  private applySelectedProductIds(productIds: Array<string>, preferredActiveId = this.activeProductId): void {
    const availableIds = new Set(this.catalog.getProducts().map((product) => product.id));
    const uniqueIds = productIds
      .map((id) => String(id ?? ''))
      .filter((id, index, source) => id && availableIds.has(id) && source.indexOf(id) === index);

    for (const productId of uniqueIds) {
      this.ensureProductScope(productId);
    }

    const nextActiveId = uniqueIds.includes(preferredActiveId)
      ? preferredActiveId
      : uniqueIds.includes(this.activeProductId)
        ? this.activeProductId
        : uniqueIds[0] || '';

    if (
      this.sameProductIds(this.selectedProductIds, uniqueIds)
      && this.activeProductId === nextActiveId
      && this.selectedScopes.length === uniqueIds.length
    ) {
      return;
    }

    this.selectedProductIds = uniqueIds;
    this.selectedScopes = uniqueIds
      .map((productId) => this.productScopes[productId])
      .filter((scope): scope is FormulaProductScope => Boolean(scope));
    this.activeProductId = nextActiveId;

    if (nextActiveId) {
      this.catalog.setSelectedProductId(nextActiveId);
    }
  }

  private sameProductIds(currentIds: Array<string>, nextIds: Array<string>): boolean {
    return currentIds.length === nextIds.length
      && currentIds.every((id, index) => id === nextIds[index]);
  }

  private ensureProductScope(productId: string): FormulaProductScope {
    const existing = this.productScopes[productId];

    if (existing) {
      return existing;
    }

    const scope: FormulaProductScope = {
      productId,
      formulas: this.formulaService.getFormulas(productId),
      selectedFormula: undefined,
      productComponents: this.catalog.getCompositionComponents(productId),
      priceComponents: this.catalog.getCompositionPriceComponents(productId),
      productComponentsOpen: false,
      priceComponentsOpen: false,
      quickFunctionsOpen: false,
      selectedFormulaOriginalId: '',
      statusMessage: '',
      statusType: 'info',
      expressionTokens: [],
      expressionCursorIndex: 0,
    };

    this.productScopes[productId] = scope;
    this.refreshExpressionTokens(scope);

    return scope;
  }

  private getScope(productId = this.activeProductId): FormulaProductScope | undefined {
    return productId ? this.productScopes[productId] : undefined;
  }

  private buildEditedCatalog(scope: FormulaProductScope): Array<PricingFormula> {
    if (!scope.selectedFormula) {
      return scope.formulas;
    }

    const editedFormula: PricingFormula = { ...scope.selectedFormula };
    const selectedId = scope.selectedFormulaOriginalId || editedFormula.id;
    const exists = scope.formulas.some((formula) => formula.id === selectedId);

    return exists
      ? scope.formulas.map((formula) =>
          formula.id === selectedId ? editedFormula : formula,
        )
      : [...scope.formulas, editedFormula];
  }

  private refreshExpressionTokens(scope: FormulaProductScope): void {
    scope.expressionTokens = this.createTokens(scope, scope.selectedFormula?.expression ?? '');
    scope.expressionCursorIndex = scope.expressionTokens.length;
  }

  private createTokens(scope: FormulaProductScope, expression: string): Array<FormulaExpressionToken> {
    const rawTokens =
      expression.match(/Math\.[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?(?:e[+-]?\d+)?|[+\-*/(),?:]|\S+/gi) ?? [];

    return rawTokens.map((value, index) => this.createExpressionToken(scope, value, index));
  }

  private createExpressionToken(
    scope: FormulaProductScope,
    value: string,
    index = scope.expressionTokens.length,
  ): FormulaExpressionToken {
    return {
      id: `${Date.now()}-${index}-${value}`,
      value,
      kind: this.resolveTokenKind(scope, value),
    };
  }

  private appendNumberCharacter(scope: FormulaProductScope, character: string): void {
    const tokens = [...scope.expressionTokens];
    const previousToken = tokens[scope.expressionCursorIndex - 1];

    if (previousToken?.kind === 'number') {
      tokens[scope.expressionCursorIndex - 1] = {
        ...previousToken,
        value: previousToken.value === '0' ? character : `${previousToken.value}${character}`,
      };
      scope.expressionTokens = tokens;
      this.syncExpressionFromTokens(scope);
    } else {
      this.insertTokensAt(scope, [this.createExpressionToken(scope, character, tokens.length)], scope.expressionCursorIndex);
    }
  }

  private appendDecimalSeparator(scope: FormulaProductScope): void {
    const tokens = [...scope.expressionTokens];
    const previousToken = tokens[scope.expressionCursorIndex - 1];

    if (previousToken?.kind === 'number') {
      if (previousToken.value.includes('.')) {
        return;
      }

      tokens[scope.expressionCursorIndex - 1] = {
        ...previousToken,
        value: `${previousToken.value}.`,
      };
      scope.expressionTokens = tokens;
      this.syncExpressionFromTokens(scope);
    } else {
      this.insertTokensAt(scope, [this.createExpressionToken(scope, '0.', tokens.length)], scope.expressionCursorIndex);
    }
  }

  private removeBeforeCursor(scope: FormulaProductScope): void {
    if (scope.expressionCursorIndex <= 0) {
      return;
    }

    const tokens = [...scope.expressionTokens];
    const previousTokenIndex = scope.expressionCursorIndex - 1;
    const previousToken = tokens[previousTokenIndex];

    if (previousToken.kind === 'number' && previousToken.value.length > 1) {
      tokens[previousTokenIndex] = {
        ...previousToken,
        value: previousToken.value.slice(0, -1),
      };
    } else {
      tokens.splice(previousTokenIndex, 1);
      scope.expressionCursorIndex -= 1;
    }

    scope.expressionTokens = tokens;
    this.syncExpressionFromTokens(scope);
  }

  private removeAfterCursor(scope: FormulaProductScope): void {
    if (scope.expressionCursorIndex >= scope.expressionTokens.length) {
      return;
    }

    const tokens = [...scope.expressionTokens];
    const nextToken = tokens[scope.expressionCursorIndex];

    if (nextToken.kind === 'number' && nextToken.value.length > 1) {
      tokens[scope.expressionCursorIndex] = {
        ...nextToken,
        value: nextToken.value.slice(1),
      };
    } else {
      tokens.splice(scope.expressionCursorIndex, 1);
    }

    scope.expressionTokens = tokens;
    scope.expressionCursorIndex = this.clampCursorIndex(scope, scope.expressionCursorIndex);
    this.syncExpressionFromTokens(scope);
  }

  private resolveTokenKind(scope: FormulaProductScope, value: string): FormulaTokenKind {
    const scopedVariables = [
      ...this.simulationVariables,
      ...scope.productComponents.map((component) => ({ id: component.varAPV })),
      ...scope.priceComponents.map((component) => ({ id: component.varAPV })),
    ];

    if (scopedVariables.some((variable) => variable.id === value)) {
      return 'variable';
    }

    if (this.formulaVariables(scope).some((formula) => formula.id === value)) {
      return 'formula';
    }

    if (/^Math\.[A-Za-z_$][\w$]*$/.test(value)) {
      return 'function';
    }

    if (/^[+\-*/(),?:]$/.test(value)) {
      return 'operator';
    }

    if (/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) {
      return 'number';
    }

    return 'text';
  }

  private setDragData(event: DragEvent, dragData: FormulaDragData): void {
    if (!event.dataTransfer) {
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-protege-formula-token', JSON.stringify(dragData));
    event.dataTransfer.setData('text/plain', dragData.value ?? '');
  }

  private readDragData(event: DragEvent): FormulaDragData | undefined {
    const payload = event.dataTransfer?.getData('application/x-protege-formula-token');

    if (!payload) {
      return undefined;
    }

    try {
      return JSON.parse(payload) as FormulaDragData;
    } catch {
      return undefined;
    }
  }

  private moveExpressionToken(scope: FormulaProductScope, sourceIndex: number, targetIndex: number): void {
    if (sourceIndex < 0 || sourceIndex >= scope.expressionTokens.length) {
      return;
    }

    const tokens = [...scope.expressionTokens];
    const [token] = tokens.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    tokens.splice(Math.max(0, adjustedTargetIndex), 0, token);
    scope.expressionTokens = tokens;
    scope.expressionCursorIndex = this.clampCursorIndex(scope, Math.max(0, adjustedTargetIndex) + 1);
    this.syncExpressionFromTokens(scope);
  }

  private insertTokensAt(
    scope: FormulaProductScope,
    tokensToInsert: Array<FormulaExpressionToken>,
    targetIndex: number,
  ): void {
    const tokens = [...scope.expressionTokens];
    const insertionIndex = this.clampCursorIndex(scope, targetIndex);
    tokens.splice(insertionIndex, 0, ...tokensToInsert);
    scope.expressionTokens = tokens;
    scope.expressionCursorIndex = insertionIndex + tokensToInsert.length;
    this.syncExpressionFromTokens(scope);
  }

  private clampCursorIndex(scope: FormulaProductScope, index: number): number {
    return Math.min(Math.max(0, index), scope.expressionTokens.length);
  }

  private syncExpressionFromTokens(scope: FormulaProductScope): void {
    if (!scope.selectedFormula) {
      return;
    }

    scope.selectedFormula.expression = this.serializeTokens(scope.expressionTokens);
  }

  private serializeTokens(tokens: Array<FormulaExpressionToken>): string {
    return tokens.reduce((expression, token, index) => {
      const previous = tokens[index - 1];

      if (!previous) {
        return token.value;
      }

      if (token.value === ')' || token.value === ',') {
        return `${expression.trimEnd()}${token.value}`;
      }

      if (token.value === '(') {
        const separator = previous.kind === 'function' || previous.value === '(' ? '' : ' ';
        return `${expression}${separator}${token.value}`;
      }

      if (previous.value === '(') {
        return `${expression}${token.value}`;
      }

      return `${expression} ${token.value}`;
    }, '').trim();
  }
}
