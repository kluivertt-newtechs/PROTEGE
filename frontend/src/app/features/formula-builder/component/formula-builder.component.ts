import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PoMultiselectOption, PoSelectOption } from '@po-ui/ng-components';
import {
  DEFAULT_PRICING_FORMULAS,
  PRICING_FORMULA_VARIABLES,
  PricingFormulaService,
} from 'src/app/core/pricing-formula.service';
import { PricingBusinessBranch, PricingFormula, PricingFormulaCategory } from 'src/app/core/mock';
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

@Component({
  selector: 'app-formula-builder',
  templateUrl: './formula-builder.component.html',
  styleUrls: ['./formula-builder.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class FormulaBuilderComponent implements OnInit {
  formulas: Array<PricingFormula> = [];
  selectedFormula?: PricingFormula;
  private selectedFormulaOriginalId = '';
  statusMessage = '';
  statusType: 'success' | 'error' | 'info' = 'info';
  expressionTokens: Array<FormulaExpressionToken> = [];
  expressionCursorIndex = 0;

  readonly variables = PRICING_FORMULA_VARIABLES;
  readonly defaultFormulaIds = DEFAULT_PRICING_FORMULAS.map((formula) => formula.id);
  readonly defaultBusinessBranches: Array<PricingBusinessBranch> = ['transport', 'processing'];
  readonly operatorTokens = ['+', '-', '*', '/', '(', ')', ',', '?', ':'];
  readonly quickFunctionTokens = [
    { id: 'Math.max()', label: 'Maior valor' },
    { id: 'Math.min()', label: 'Menor valor' },
  ];
  readonly categoryOptions: Array<PoSelectOption> = [
    { label: 'Custo', value: 'custo' },
    { label: 'Comercial', value: 'comercial' },
    { label: 'Imposto', value: 'imposto' },
    { label: 'Resultado', value: 'resultado' },
  ];
  readonly businessBranchOptions: Array<PoMultiselectOption> = [
    { label: 'Transporte de Valores', value: 'transport' },
    { label: 'Processamento', value: 'processing' },
  ];

  constructor(private readonly formulaService: PricingFormulaService) {}

  get formulaVariables(): Array<PricingFormula> {
    const selectedIds = new Set([
      this.selectedFormula?.id,
      this.selectedFormulaOriginalId,
    ].filter(Boolean));

    return this.buildEditedCatalog()
      .filter((formula) => formula.enabled)
      .filter((formula) => !selectedIds.has(formula.id));
  }

  ngOnInit(): void {
    this.loadFormulas();
  }

  selectFormula(formula: PricingFormula): void {
    this.selectedFormula = { ...formula };
    this.selectedFormulaOriginalId = formula.id;
    this.refreshExpressionTokens();
    this.statusMessage = '';
  }

  addFormula(): void {
    this.selectedFormula = {
      id: `formula${this.formulas.length + 1}`,
      label: 'Nova fórmula',
      description: '',
      expression: '0',
      enabled: true,
      category: 'resultado',
      businessBranches: [...this.defaultBusinessBranches],
    };
    this.selectedFormulaOriginalId = '';
    this.refreshExpressionTokens();
    this.statusMessage = '';
  }

  removeSelected(): void {
    if (!this.selectedFormula) {
      return;
    }

    const selectedId = this.selectedFormulaOriginalId || this.selectedFormula.id;
    this.formulas = this.formulas.filter((formula) => formula.id !== selectedId);
    this.selectedFormula = this.formulas[0] ? { ...this.formulas[0] } : undefined;
    this.selectedFormulaOriginalId = this.selectedFormula?.id ?? '';
    this.refreshExpressionTokens();
    this.validate();
  }

  validate(): void {
    const validation = this.formulaService.validate(this.buildEditedCatalog());
    this.statusType = validation.valid ? 'success' : 'error';
    this.statusMessage = validation.valid
      ? 'Fórmulas válidas para execução.'
      : validation.messages.join(' ');
  }

  save(): void {
    const catalog = this.buildEditedCatalog();
    const validation = this.formulaService.saveFormulas(catalog);

    if (!validation.valid) {
      this.statusType = 'error';
      this.statusMessage = validation.messages.join(' ');
      return;
    }

    this.formulas = this.formulaService.getFormulas();
    const selected = this.formulas.find((formula) => formula.id === this.selectedFormula?.id);
    this.selectedFormula = selected ? { ...selected } : { ...this.formulas[0] };
    this.selectedFormulaOriginalId = this.selectedFormula?.id ?? '';
    this.refreshExpressionTokens();
    this.statusType = 'success';
    this.statusMessage = 'Fórmulas salvas localmente.';
  }

  resetDefaults(): void {
    this.formulas = this.formulaService.resetToDefault();
    this.selectedFormula = { ...this.formulas[0] };
    this.selectedFormulaOriginalId = this.selectedFormula.id;
    this.refreshExpressionTokens();
    this.statusType = 'info';
    this.statusMessage = 'Catálogo padrão restaurado.';
  }

  insertToken(token: string): void {
    if (!this.selectedFormula) {
      return;
    }

    this.insertTokensAt(this.createTokens(token), this.expressionCursorIndex);
  }

  removeExpressionToken(index: number, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.selectedFormula) {
      return;
    }

    this.expressionTokens = this.expressionTokens.filter((_, tokenIndex) => tokenIndex !== index);
    this.expressionCursorIndex = this.clampCursorIndex(
      index < this.expressionCursorIndex ? this.expressionCursorIndex - 1 : this.expressionCursorIndex,
    );
    this.syncExpressionFromTokens();
  }

  setExpressionCursor(index: number): void {
    this.expressionCursorIndex = this.clampCursorIndex(index);
  }

  handleExpressionKeydown(event: KeyboardEvent): void {
    if (!this.selectedFormula || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.setExpressionCursor(this.expressionCursorIndex - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.setExpressionCursor(this.expressionCursorIndex + 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.setExpressionCursor(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.setExpressionCursor(this.expressionTokens.length);
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.appendNumberCharacter(event.key);
      return;
    }

    if (event.key === '.' || (event.key === ',' && event.code === 'NumpadDecimal')) {
      event.preventDefault();
      this.appendDecimalSeparator();
      return;
    }

    if (this.operatorTokens.includes(event.key)) {
      event.preventDefault();
      this.insertTokensAt([this.createExpressionToken(event.key)], this.expressionCursorIndex);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.removeBeforeCursor();
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.removeAfterCursor();
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

  dropOnExpression(event: DragEvent, targetIndex = this.expressionTokens.length): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.selectedFormula) {
      return;
    }

    const dragData = this.readDragData(event);
    if (!dragData) {
      return;
    }

    if (dragData.source === 'editor' && Number.isInteger(dragData.index)) {
      this.moveExpressionToken(Number(dragData.index), targetIndex);
      return;
    }

    if (dragData.source === 'palette' && dragData.value) {
      this.insertTokensAt(this.createTokens(dragData.value), targetIndex);
    }
  }

  updateSelectedCategory(category: string | number): void {
    if (!this.selectedFormula) {
      return;
    }

    this.selectedFormula.category = String(category) as PricingFormulaCategory;
  }

  getCategoryLabel(category: PricingFormulaCategory): string {
    return this.categoryOptions.find((option) => option.value === category)?.label ?? category;
  }

  getBusinessBranchLabel(branches: Array<PricingBusinessBranch> | undefined): string {
    const selectedBranches = branches?.length ? branches : this.defaultBusinessBranches;

    return selectedBranches
      .map((branch) => this.businessBranchOptions.find((option) => option.value === branch)?.label ?? branch)
      .join(', ');
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

  private loadFormulas(): void {
    this.formulas = this.formulaService.getFormulas();
    this.selectedFormula = this.formulas[0] ? { ...this.formulas[0] } : undefined;
    this.selectedFormulaOriginalId = this.selectedFormula?.id ?? '';
    this.refreshExpressionTokens();
  }

  private buildEditedCatalog(): Array<PricingFormula> {
    if (!this.selectedFormula) {
      return this.formulas;
    }

    const editedFormula: PricingFormula = { ...this.selectedFormula };
    const selectedId = this.selectedFormulaOriginalId || editedFormula.id;
    const exists = this.formulas.some((formula) => formula.id === selectedId);
    const catalog: Array<PricingFormula> = exists
      ? this.formulas.map((formula) =>
          formula.id === selectedId ? editedFormula : formula,
        )
      : [...this.formulas, editedFormula];

    return catalog;
  }

  private refreshExpressionTokens(): void {
    this.expressionTokens = this.createTokens(this.selectedFormula?.expression ?? '');
    this.expressionCursorIndex = this.expressionTokens.length;
  }

  private createTokens(expression: string): Array<FormulaExpressionToken> {
    const rawTokens =
      expression.match(/Math\.[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?(?:e[+-]?\d+)?|[+\-*/(),?:]|\S+/gi) ?? [];

    return rawTokens.map((value, index) => this.createExpressionToken(value, index));
  }

  private createExpressionToken(value: string, index = this.expressionTokens.length): FormulaExpressionToken {
    return {
      id: `${Date.now()}-${index}-${value}`,
      value,
      kind: this.resolveTokenKind(value),
    };
  }

  private appendNumberCharacter(character: string): void {
    const tokens = [...this.expressionTokens];
    const previousToken = tokens[this.expressionCursorIndex - 1];

    if (previousToken?.kind === 'number') {
      tokens[this.expressionCursorIndex - 1] = {
        ...previousToken,
        value: previousToken.value === '0' ? character : `${previousToken.value}${character}`,
      };
      this.expressionTokens = tokens;
      this.syncExpressionFromTokens();
    } else {
      this.insertTokensAt([this.createExpressionToken(character, tokens.length)], this.expressionCursorIndex);
    }
  }

  private appendDecimalSeparator(): void {
    const tokens = [...this.expressionTokens];
    const previousToken = tokens[this.expressionCursorIndex - 1];

    if (previousToken?.kind === 'number') {
      if (previousToken.value.includes('.')) {
        return;
      }

      tokens[this.expressionCursorIndex - 1] = {
        ...previousToken,
        value: `${previousToken.value}.`,
      };
      this.expressionTokens = tokens;
      this.syncExpressionFromTokens();
    } else {
      this.insertTokensAt([this.createExpressionToken('0.', tokens.length)], this.expressionCursorIndex);
    }
  }

  private removeBeforeCursor(): void {
    if (this.expressionCursorIndex <= 0) {
      return;
    }

    const tokens = [...this.expressionTokens];
    const previousTokenIndex = this.expressionCursorIndex - 1;
    const previousToken = tokens[previousTokenIndex];

    if (previousToken.kind === 'number' && previousToken.value.length > 1) {
      tokens[previousTokenIndex] = {
        ...previousToken,
        value: previousToken.value.slice(0, -1),
      };
    } else {
      tokens.splice(previousTokenIndex, 1);
      this.expressionCursorIndex -= 1;
    }

    this.expressionTokens = tokens;
    this.syncExpressionFromTokens();
  }

  private removeAfterCursor(): void {
    if (this.expressionCursorIndex >= this.expressionTokens.length) {
      return;
    }

    const tokens = [...this.expressionTokens];
    const nextToken = tokens[this.expressionCursorIndex];

    if (nextToken.kind === 'number' && nextToken.value.length > 1) {
      tokens[this.expressionCursorIndex] = {
        ...nextToken,
        value: nextToken.value.slice(1),
      };
    } else {
      tokens.splice(this.expressionCursorIndex, 1);
    }

    this.expressionTokens = tokens;
    this.expressionCursorIndex = this.clampCursorIndex(this.expressionCursorIndex);
    this.syncExpressionFromTokens();
  }

  private resolveTokenKind(value: string): FormulaTokenKind {
    if (this.variables.some((variable) => variable.id === value)) {
      return 'variable';
    }

    if (this.formulaVariables.some((formula) => formula.id === value)) {
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

  private moveExpressionToken(sourceIndex: number, targetIndex: number): void {
    if (sourceIndex < 0 || sourceIndex >= this.expressionTokens.length) {
      return;
    }

    const tokens = [...this.expressionTokens];
    const [token] = tokens.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    tokens.splice(Math.max(0, adjustedTargetIndex), 0, token);
    this.expressionTokens = tokens;
    this.expressionCursorIndex = this.clampCursorIndex(Math.max(0, adjustedTargetIndex) + 1);
    this.syncExpressionFromTokens();
  }

  private insertTokensAt(tokensToInsert: Array<FormulaExpressionToken>, targetIndex: number): void {
    const tokens = [...this.expressionTokens];
    const insertionIndex = this.clampCursorIndex(targetIndex);
    tokens.splice(insertionIndex, 0, ...tokensToInsert);
    this.expressionTokens = tokens;
    this.expressionCursorIndex = insertionIndex + tokensToInsert.length;
    this.syncExpressionFromTokens();
  }

  private clampCursorIndex(index: number): number {
    return Math.min(Math.max(0, index), this.expressionTokens.length);
  }

  private syncExpressionFromTokens(): void {
    if (!this.selectedFormula) {
      return;
    }

    this.selectedFormula.expression = this.serializeTokens(this.expressionTokens);
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
