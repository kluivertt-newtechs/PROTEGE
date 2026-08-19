import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import { PoModalComponent, PoNotificationService, PoPageAction, PoPageSlideComponent, PoSelectOption } from '@po-ui/ng-components';
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

  private poNotification = inject(PoNotificationService);

  searchTerm = '';
  groupFilter = '';
  statusFilter: StatusFilter = 'all';
  filterDraft: ComponentFilterDraft = this.createFilterDraft();
  rows: Array<PriceComponent> = [];
  editModel: PriceComponent = this.catalog.createEmptyComponent('price');
  optionDraft = '';
  optionRows: Array<ProductComponentOption> = [];
  statusMessage = '';
  isEditingComponent = false;

  readonly statusOptions: Array<PoSelectOption> = [
    { label: 'Todos', value: 'all' },
    { label: 'Ativos', value: 'active' },
    { label: 'Inativos', value: 'inactive' },
  ];
  groupOptions: Array<PoSelectOption> = [];
  get pageActions(): Array<PoPageAction> {
    return [
      { label: 'Filtros', icon: 'an an-funnel', action: () => this.openFilters() },
      { label: 'Novo componente', icon: 'an an-plus', action: () => this.newComponent() },
    ];
  }

  constructor(private readonly catalog: ProductCatalogService) {
    this.refresh();
  }

  newComponent(): void {
    this.editModel = this.catalog.createEmptyComponent('price');
    this.optionDraft = '';
    this.optionRows = [];
    this.isEditingComponent = false;
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
    this.isEditingComponent = true;
    this.componentModal.open();
  }

  save(): void {
    this.editModel.options = this.normalizeOptionRows();
    this.editModel.type = String(this.editModel.type) as CatalogComponentType;
    this.catalog.savePriceComponent(this.editModel);
    this.statusMessage = 'Componente de preço salvo localmente.';
    this.componentModal.close();
    this.refresh();
  }

  deleteComponent(): void {
    if (!this.isEditingComponent || !this.editModel.id) {
      return;
    }

    if (this.catalog.isComponentLinked(this.editModel.id, 'price')) {
      this.poNotification.warning('Não é possível excluir. Este componente está vinculado a um produto na árvore da família.');
      return;
    }

    this.catalog.removePriceComponent(this.editModel.id);
    this.statusMessage = 'Componente de preco excluido localmente.';
    this.componentModal.close();
    this.refresh();
  }

  activePercentValue(component: PriceComponent): number {
    return component.options
      .filter((option) => option.selected)
      .reduce((sum, option) => {
        const calculatedValue = Number(option.calculatedValue);
        return sum + (Number.isFinite(calculatedValue) ? calculatedValue : 0);
      }, 0);
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

  formatValue(value: number): string {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
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

}
