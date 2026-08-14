import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { PoModalComponent, PoSelectOption, PoTableAction, PoTableColumn } from '@po-ui/ng-components';
import {
  ProductCatalogService,
  ProductComponent,
  ProductComponentOption,
  ProductComponentType,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type StatusFilter = 'all' | 'active' | 'inactive';
type ComponentRow = ProductComponent & { statusLabel: string; optionSummary: string };

@Component({
  selector: 'app-product-components',
  templateUrl: './product-components.component.html',
  styleUrls: ['./product-components.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class ProductComponentsComponent {
  @ViewChild('componentModal') componentModal!: PoModalComponent;

  searchTerm = '';
  groupFilter = '';
  statusFilter: StatusFilter = 'all';
  rows: Array<ComponentRow> = [];
  editModel: ProductComponent = this.catalog.createEmptyComponent();
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

  readonly columns: Array<PoTableColumn> = [
    { property: 'code', label: 'Código' },
    { property: 'description', label: 'Descrição' },
    { property: 'type', label: 'Tipo' },
    { property: 'unit', label: 'Unidade' },
    { property: 'group', label: 'Grupo' },
    { property: 'varAPV', label: 'Variável APV' },
    { property: 'optionSummary', label: 'Opções' },
    { property: 'statusLabel', label: 'Status' },
  ];

  readonly actions: Array<PoTableAction> = [
    {
      label: '',
      icon: 'an an-pencil-simple',
      action: (row: ComponentRow) => this.edit(row),
    },
    {
      label: '',
      icon: 'an an-power',
      action: (row: ComponentRow) => this.toggle(row),
    },
  ];

  constructor(private readonly catalog: ProductCatalogService) {
    this.refresh();
  }

  newComponent(): void {
    this.editModel = this.catalog.createEmptyComponent();
    this.optionDraft = '';
    this.componentModal.open();
  }

  edit(row: ComponentRow): void {
    this.editModel = {
      ...row,
      options: row.options.map((option) => ({ ...option })),
    };
    this.optionDraft = this.optionsToDraft(this.editModel.options);
    this.componentModal.open();
  }

  save(): void {
    this.editModel.options = this.parseOptions(this.optionDraft);
    this.editModel.type = String(this.editModel.type) as ProductComponentType;
    this.catalog.saveComponent(this.editModel);
    this.statusMessage = 'Componente salvo localmente.';
    this.componentModal.close();
    this.refresh();
  }

  toggle(row: ComponentRow): void {
    this.catalog.setComponentActive(row.id, !row.active);
    this.statusMessage = row.active ? 'Componente inativado.' : 'Componente ativado.';
    this.refresh();
  }

  onFilterChange(): void {
    this.refresh();
  }

  private refresh(): void {
    this.groupOptions = [
      { label: 'Todos', value: '' },
      ...this.catalog.getGroups().map((group) => ({ label: group, value: group })),
    ];
    this.rows = this.catalog
      .searchComponents(this.searchTerm, this.groupFilter, this.statusFilter)
      .map((component) => ({
        ...component,
        statusLabel: component.active ? 'Ativo' : 'Inativo',
        optionSummary: component.options.length ? component.options.map((option) => option.label).join(', ') : '-',
      }));
  }

  private parseOptions(value: string): Array<ProductComponentOption> {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelValue, numericValue] = line.split('|').map((part) => part.trim());
        const [label, rawValue] = labelValue.split('=').map((part) => part.trim());
        const valuePart = rawValue || label;

        return {
          label,
          value: valuePart,
          numericValue: Number.isFinite(Number(numericValue)) ? Number(numericValue) : undefined,
        };
      });
  }

  private optionsToDraft(options: Array<ProductComponentOption>): string {
    return options
      .map((option) => `${option.label}=${option.value}${option.numericValue !== undefined ? ` | ${option.numericValue}` : ''}`)
      .join('\n');
  }
}
