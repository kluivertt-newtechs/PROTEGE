import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { PoModalComponent, PoPageAction, PoPageSlideComponent, PoSelectOption } from '@po-ui/ng-components';
import {
  CatalogComponentType,
  PriceComponent,
  ProductCatalogService,
  ProductComponentOption,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type StatusFilter = 'all' | 'active' | 'inactive';

interface ComponentFilterDraft {
  searchTerm: string;
  groupFilter: string;
  statusFilter: StatusFilter;
}

@Component({
  selector: 'app-price-components',
  templateUrl: './price-components.component.html',
  styleUrls: ['./price-components.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class PriceComponentsComponent {
  @ViewChild('componentModal') componentModal!: PoModalComponent;
  @ViewChild('filtersSlide') filtersSlide!: PoPageSlideComponent;

  searchTerm = '';
  groupFilter = '';
  statusFilter: StatusFilter = 'all';
  filterDraft: ComponentFilterDraft = this.createFilterDraft();
  rows: Array<PriceComponent> = [];
  expanded = new Set<string>();
  editModel: PriceComponent = this.catalog.createEmptyComponent('price');
  optionDraft = '';
  optionRows: Array<ProductComponentOption> = [];
  formulaInteractionMessage = '';
  statusMessage = '';

  readonly typeOptions: Array<PoSelectOption> = [
    { label: 'Taxa', value: 'rate' },
    { label: 'Número', value: 'number' },
    { label: 'Seleção', value: 'select' },
  ];
  readonly statusOptions: Array<PoSelectOption> = [
    { label: 'Todos', value: 'all' },
    { label: 'Ativos', value: 'active' },
    { label: 'Inativos', value: 'inactive' },
  ];
  readonly operatorTokens = ['+', '-', '*', '/', '(', ')'];
  readonly exampleFormulas = ['PRECO_BRUTO * varAPV', '(PRECO_BRUTO - CUSTOS) / PRECO_BRUTO', 'varAPV / 100'];
  groupOptions: Array<PoSelectOption> = [];
  readonly pageActions: Array<PoPageAction> = [
    { label: 'Filtros', icon: 'an an-funnel', action: () => this.openFilters() },
    { label: 'Novo componente', icon: 'an an-plus', action: () => this.newComponent() },
  ];

  constructor(private readonly catalog: ProductCatalogService) {
    this.refresh();
  }

  newComponent(): void {
    this.editModel = this.catalog.createEmptyComponent('price');
    this.optionDraft = '';
    this.optionRows = [];
    this.formulaInteractionMessage = '';
    this.componentModal.open();
  }

  openFilters(): void {
    this.filterDraft = this.createFilterDraft();
    this.filtersSlide.open();
  }

  applyFilters(): void {
    this.searchTerm = this.filterDraft.searchTerm;
    this.groupFilter = this.filterDraft.groupFilter;
    this.statusFilter = this.filterDraft.statusFilter;
    this.refresh();
    this.filtersSlide.close();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.groupFilter = '';
    this.statusFilter = 'all';
    this.filterDraft = this.createFilterDraft();
    this.refresh();
    this.filtersSlide.close();
  }

  edit(component: PriceComponent): void {
    this.editModel = { ...component, options: component.options.map((option) => ({ ...option })) };
    this.optionDraft = this.optionsToDraft(this.editModel.options);
    this.optionRows = this.cloneOptions(this.editModel.options);
    this.formulaInteractionMessage = '';
    this.componentModal.open();
  }

  save(): void {
    if (this.hasFormulaBlockingError()) {
      this.statusMessage = 'Revise a fórmula: há parênteses desbalanceados ou operadores duplicados.';
      return;
    }

    this.editModel.options = this.normalizeOptionRows();
    this.editModel.type = String(this.editModel.type) as CatalogComponentType;
    this.catalog.savePriceComponent(this.editModel);
    this.statusMessage = 'Componente de preço salvo localmente.';
    this.componentModal.close();
    this.refresh();
  }

  toggle(component: PriceComponent): void {
    this.catalog.setPriceComponentActive(component.id, !component.active);
    this.statusMessage = component.active ? 'Componente inativado.' : 'Componente ativado.';
    this.refresh();
  }

  toggleExpanded(componentId: string): void {
    if (this.expanded.has(componentId)) {
      this.expanded.delete(componentId);
    } else {
      this.expanded.add(componentId);
    }
  }

  isExpanded(componentId: string): boolean {
    return this.expanded.has(componentId);
  }

  selectOption(component: PriceComponent, option: ProductComponentOption): void {
    this.catalog.updateOptionSelection('price', component.id, option.code, !option.selected);
    this.refresh();
  }

  selectedSummary(component: PriceComponent): string {
    const selected = component.options.filter((option) => option.selected);
    if (!selected.length) {
      return '--';
    }

    return selected.length > 1 ? `${selected.length} opções` : this.formatPercent(selected[0].calculatedValue);
  }

  get formulaVariables(): Array<{ id: string; label: string }> {
    const variables = this.catalog.getFormulaVariables();
    const currentVariable = String(this.editModel.varAPV ?? '').trim();

    if (currentVariable && !variables.some((variable) => variable.id === currentVariable)) {
      return [{ id: currentVariable, label: 'Variável deste componente' }, ...variables];
    }

    return variables;
  }

  get formulaPreview(): string {
    const formula = String(this.editModel.formula ?? '').trim();

    if (!formula) {
      return 'Sem fórmula definida.';
    }

    const usedVariable = this.formulaVariables.find((variable) => this.expressionUsesToken(formula, variable.id));
    if (usedVariable) {
      return `Usa variável ${usedVariable.id}`;
    }

    return 'Expressão informativa cadastrada.';
  }

  get formulaIssues(): Array<string> {
    const formula = String(this.editModel.formula ?? '').trim();

    if (!formula) {
      return ['Fórmula vazia.'];
    }

    const issues: Array<string> = [];
    if (!this.hasBalancedParentheses(formula)) {
      issues.push('Parênteses desbalanceados.');
    }

    if (this.hasDuplicatedOperators(formula)) {
      issues.push('Operadores duplicados.');
    }

    return issues;
  }

  get optionsSummary(): string {
    const defaults = this.optionRows.filter((option) => option.default || option.selected).length;
    const total = this.optionRows.length;
    const suffix = defaults === 1 ? '1 padrão/selecionada' : `${defaults} padrão/selecionadas`;

    return `${total} ${total === 1 ? 'opção' : 'opções'} · ${suffix}`;
  }

  get showSelectWithoutOptionsWarning(): boolean {
    return this.editModel.type === 'select' && this.optionRows.length === 0;
  }

  insertFormulaToken(token: string, event?: Event, input?: HTMLInputElement): void {
    event?.preventDefault();
    event?.stopPropagation();

    const current = String(input?.value ?? this.editModel.formula ?? '').trim();
    const separator = current && !current.endsWith('(') && token !== ')' ? ' ' : '';
    this.setFormulaValue(`${current}${separator}${token}`.trim(), input);
    this.formulaInteractionMessage = `Inserido: ${token}`;
  }

  useFormulaExample(example: string, event?: Event, input?: HTMLInputElement): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.setFormulaValue(example.replace(/varAPV/g, this.editModel.varAPV || 'varAPV'), input);
    this.formulaInteractionMessage = 'Exemplo aplicado.';
  }

  addOption(): void {
    const sequence = this.nextOptionSequence();
    this.optionRows = [
      ...this.optionRows,
      {
        sequence,
        code: `OPT${sequence}`,
        description: `Opção ${this.optionRows.length + 1}`,
        calculatedValue: 0,
        costValue: 0,
        default: false,
        selected: false,
      },
    ];
  }

  removeOption(index: number): void {
    this.optionRows = this.optionRows.filter((_, optionIndex) => optionIndex !== index);
  }

  toggleDefault(index: number): void {
    this.optionRows = this.optionRows.map((option, optionIndex) => {
      const selected = optionIndex === index ? !(option.default || option.selected) : this.editModel.multiple && (option.default || option.selected);
      return { ...option, default: selected, selected };
    });
  }

  enforceDefaultMode(): void {
    if (this.editModel.multiple) {
      return;
    }

    let selectedFound = false;
    this.optionRows = this.optionRows.map((option) => {
      const selected = !selectedFound && (option.default || option.selected);
      selectedFound = selectedFound || selected;
      return { ...option, default: selected, selected };
    });
  }

  formatPercent(value: number): string {
    const decimal = Math.abs(value) > 1 ? value / 100 : value;
    return decimal.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 3 });
  }

  private refresh(): void {
    this.groupOptions = [
      { label: 'Todos', value: '' },
      ...this.catalog.getGroups('price').map((group) => ({ label: group, value: group })),
    ];
    this.rows = this.catalog.searchPriceComponents(this.searchTerm, this.groupFilter, this.statusFilter);
  }

  private createFilterDraft(): ComponentFilterDraft {
    return {
      searchTerm: this.searchTerm,
      groupFilter: this.groupFilter,
      statusFilter: this.statusFilter,
    };
  }

  private parseOptions(value: string): Array<ProductComponentOption> {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [left, rawValue, rawCost, rawFlags] = line.split('|').map((part) => part.trim());
        const [code, description] = left.split('=').map((part) => part.trim());
        const selected = /selected|selecionado|default|padrão|padrao/i.test(rawFlags ?? '');
        const numeric = Number(rawValue);
        const cost = Number(rawCost);

        return {
          sequence: (index + 1) * 10,
          code: code || `OPT${(index + 1) * 10}`,
          description: description || code || `Opção ${index + 1}`,
          calculatedValue: Number.isFinite(numeric) ? numeric : 0,
          costValue: Number.isFinite(cost) ? cost : Number.isFinite(numeric) ? numeric : 0,
          default: selected,
          selected,
        };
      });
  }

  private optionsToDraft(options: Array<ProductComponentOption>): string {
    return options
      .map((option) => `${option.code}=${option.description} | ${option.calculatedValue} | ${option.costValue}${option.default ? ' | default' : ''}`)
      .join('\n');
  }

  private setFormulaValue(value: string, input?: HTMLInputElement): void {
    this.editModel.formula = value;

    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      window.setTimeout(() => input.focus());
    }
  }

  private cloneOptions(options: Array<ProductComponentOption>): Array<ProductComponentOption> {
    return options.map((option) => ({ ...option }));
  }

  private normalizeOptionRows(): Array<ProductComponentOption> {
    const rows = this.optionRows.length ? this.optionRows : this.parseOptions(this.optionDraft);
    let selectedFound = false;

    return rows
      .filter((option) => option.code || option.description)
      .map((option, index) => {
        const calculatedValue = Number(option.calculatedValue);
        const costValue = Number(option.costValue);
        const selected = this.editModel.multiple
          ? option.default === true || option.selected === true
          : !selectedFound && (option.default === true || option.selected === true);

        selectedFound = selectedFound || selected;

        return {
          sequence: Number(option.sequence) || (index + 1) * 10,
          code: String(option.code || `OPT${(index + 1) * 10}`).trim(),
          description: String(option.description || option.code || `Opção ${index + 1}`).trim(),
          calculatedValue: Number.isFinite(calculatedValue) ? calculatedValue : 0,
          costValue: Number.isFinite(costValue) ? costValue : Number.isFinite(calculatedValue) ? calculatedValue : 0,
          default: selected,
          selected,
        };
      });
  }

  private nextOptionSequence(): number {
    const maxSequence = this.optionRows.reduce((max, option) => Math.max(max, Number(option.sequence) || 0), 0);
    return Math.max(10, Math.ceil((maxSequence + 1) / 10) * 10);
  }

  private hasFormulaBlockingError(): boolean {
    const formula = String(this.editModel.formula ?? '').trim();
    return Boolean(formula) && (!this.hasBalancedParentheses(formula) || this.hasDuplicatedOperators(formula));
  }

  private hasBalancedParentheses(value: string): boolean {
    let balance = 0;
    for (const char of value) {
      if (char === '(') {
        balance += 1;
      }
      if (char === ')') {
        balance -= 1;
      }
      if (balance < 0) {
        return false;
      }
    }

    return balance === 0;
  }

  private hasDuplicatedOperators(value: string): boolean {
    return /[+*/]{2,}|--|-\+|\+-/.test(value.replace(/\s+/g, ''));
  }

  private expressionUsesToken(expression: string, token: string): boolean {
    return new RegExp(`(^|[^A-Za-z0-9_])${this.escapeRegExp(token)}([^A-Za-z0-9_]|$)`).test(expression);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
