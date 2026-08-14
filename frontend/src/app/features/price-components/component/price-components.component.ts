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
    this.componentModal.open();
  }

  save(): void {
    this.editModel.options = this.parseOptions(this.optionDraft);
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
}
