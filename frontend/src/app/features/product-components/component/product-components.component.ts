import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { PoModalComponent, PoPageAction, PoPageSlideComponent, PoSelectOption } from '@po-ui/ng-components';
import {
  CatalogComponentType,
  ProductCatalogService,
  ProductComponent,
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
  selector: 'app-product-components',
  templateUrl: './product-components.component.html',
  styleUrls: ['./product-components.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class ProductComponentsComponent {
  @ViewChild('componentModal') componentModal!: PoModalComponent;
  @ViewChild('filtersSlide') filtersSlide!: PoPageSlideComponent;

  searchTerm = '';
  groupFilter = '';
  statusFilter: StatusFilter = 'all';
  filterDraft: ComponentFilterDraft = this.createFilterDraft();
  rows: Array<ProductComponent> = [];
  expanded = new Set<string>();
  editModel: ProductComponent = this.catalog.createEmptyComponent('product');
  optionDraft = '';
  statusMessage = '';

  readonly typeOptions: Array<PoSelectOption> = [
    { label: 'Número', value: 'number' },
    { label: 'Texto', value: 'text' },
    { label: 'Seleção', value: 'select' },
    { label: 'Booleano', value: 'boolean' },
    { label: 'Taxa', value: 'rate' },
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
    this.editModel = this.catalog.createEmptyComponent('product');
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

  edit(component: ProductComponent): void {
    this.editModel = {
      ...component,
      options: component.options.map((option) => ({ ...option })),
    };
    this.optionDraft = this.optionsToDraft(this.editModel.options);
    this.componentModal.open();
  }

  save(): void {
    this.editModel.options = this.parseOptions(this.optionDraft);
    this.editModel.type = String(this.editModel.type) as CatalogComponentType;
    this.catalog.saveComponent(this.editModel);
    this.statusMessage = 'Componente salvo localmente.';
    this.componentModal.close();
    this.refresh();
  }

  toggle(component: ProductComponent): void {
    this.catalog.setComponentActive(component.id, !component.active);
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

  selectOption(component: ProductComponent, option: ProductComponentOption): void {
    this.catalog.updateOptionSelection('product', component.id, option.code, !option.selected);
    this.refresh();
  }

  selectedSummary(component: ProductComponent): string {
    const selected = component.options.filter((option) => option.selected);
    if (!selected.length) {
      return '--';
    }

    if (selected.length > 1) {
      return `${selected.length} opções`;
    }

    return this.formatValue(selected[0].calculatedValue);
  }

  formatValue(value: number): string {
    if (Math.abs(value) > 0 && Math.abs(value) < 1) {
      return value.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 3 });
    }

    return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  private refresh(): void {
    this.groupOptions = [
      { label: 'Todos', value: '' },
      ...this.catalog.getGroups('product').map((group) => ({ label: group, value: group })),
    ];
    this.rows = this.catalog.searchComponents(this.searchTerm, this.groupFilter, this.statusFilter);
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
