import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import {
  PoLookupColumn,
  PoLookupFilter,
  PoLookupFilteredItemsParams,
  PoLookupResponseApi,
  PoModalComponent,
  PoNotificationService,
  PoTableAction,
  PoTableColumn,
} from '@po-ui/ng-components';
import { Observable, of } from 'rxjs';
import {
  AdjustmentHistoryEntry,
  ComponentKind,
  ProductCatalogService,
  ProductComponent,
  ProductComponentOption,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

interface ComponentLookupItem {
  id: string;
  code: string;
  description: string;
  group: string;
  label: string;
}

interface AdjustmentPreviewItem {
  id: string;
  code: string;
  description: string;
  currentValue: number;
  newValue: number;
  options: Array<ProductComponentOption>;
}

interface HistoryRow {
  id: string;
  dateTime: string;
  user: string;
  percentage: string;
  itemCount: number;
  status: string;
  revertedBy: string;
  entry: AdjustmentHistoryEntry;
}

class ComponentLookupService implements PoLookupFilter {
  constructor(private readonly getComponents: () => Array<ProductComponent>) {}

  getFilteredItems(params: PoLookupFilteredItemsParams): Observable<PoLookupResponseApi> {
    const filter = normalizeText(params.filter ?? '').toLowerCase();
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const filtered = this.items().filter((item) =>
      !filter
        || item.id.toLowerCase().includes(filter)
        || item.code.toLowerCase().includes(filter)
        || item.description.toLowerCase().includes(filter)
        || item.group.toLowerCase().includes(filter)
        || item.label.toLowerCase().includes(filter),
    );
    const start = (page - 1) * pageSize;

    return of({
      items: filtered.slice(start, start + pageSize),
      hasNext: start + pageSize < filtered.length,
    });
  }

  getObjectByValue(value: string | Array<any>): Observable<ComponentLookupItem | Array<ComponentLookupItem> | undefined> {
    const items = this.items();

    if (Array.isArray(value)) {
      const selectedIds = new Set(value.map((item) => lookupId(item)).filter(Boolean));
      return of(items.filter((item) => selectedIds.has(item.id)));
    }

    return of(items.find((item) => item.id === String(value)));
  }

  private items(): Array<ComponentLookupItem> {
    return this.getComponents().map((component) => ({
      id: component.id,
      code: normalizeText(component.code),
      description: normalizeText(component.description),
      group: normalizeText(component.group),
      label: `${normalizeText(component.code)} - ${normalizeText(component.description)}`,
    }));
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

function lookupId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id ?? '');
  }

  return String(value ?? '');
}

@Component({
  selector: 'app-parameters',
  templateUrl: './parameters.component.html',
  styleUrls: ['./parameters.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class ParametersComponent {
  @ViewChild('confirmModal') confirmModal!: PoModalComponent;
  @ViewChild('revertModal') revertModal!: PoModalComponent;

  activeKind: ComponentKind = 'product';
  selectedProductIds: Array<string> = [];
  selectedPriceIds: Array<string> = [];
  percentage = 0;
  loading = false;
  revertCandidate?: AdjustmentHistoryEntry;

  private readonly catalog = inject(ProductCatalogService);
  private readonly poNotification = inject(PoNotificationService);

  readonly lookupColumns: Array<PoLookupColumn> = [
    { property: 'code', label: 'Codigo', width: '20%' },
    { property: 'description', label: 'Componente' },
    { property: 'group', label: 'Grupo', width: '24%' },
  ];
  readonly historyColumns: Array<PoTableColumn> = [
    { property: 'dateTime', label: 'Data/Hora' },
    { property: 'user', label: 'Usuario' },
    { property: 'percentage', label: 'Percentual' },
    { property: 'itemCount', label: 'Itens' },
    { property: 'status', label: 'Status' },
    { property: 'revertedBy', label: 'Revertido por' },
  ];
  readonly historyActions: Array<PoTableAction> = [
    {
      label: 'Reverter',
      action: (row: HistoryRow) => this.openRevert(row.entry),
      disabled: (row: HistoryRow) => row.entry.status === 'Revertido',
    },
  ];
  readonly productLookupService = new ComponentLookupService(() => this.catalog.listComponents(false));
  readonly priceLookupService = new ComponentLookupService(() => this.catalog.listPriceComponents(false));

  get previewItems(): Array<AdjustmentPreviewItem> {
    const percentage = this.normalizedPercentage;
    const componentById = new Map(this.componentsForActiveKind().map((component) => [component.id, component]));

    return this.getSelectedIds(this.activeKind)
      .map((id) => componentById.get(id))
      .filter((component): component is ProductComponent => Boolean(component))
      .map((component) => {
        const options = this.targetOptions(component);
        const currentValue = options.length
          ? options.reduce((sum, option) => sum + this.safeNumber(this.activeKind === 'price' ? option.calculatedValue : option.costValue), 0)
          : this.safeNumber(this.activeKind === 'price' ? component.calculatedValue : component.costValue ?? component.calculatedValue);

        return {
          id: component.id,
          code: component.code,
          description: normalizeText(component.description),
          currentValue,
          newValue: this.isValidPercentage ? this.applyPercentage(currentValue, percentage) : currentValue,
          options,
        };
      });
  }

  get historyRows(): Array<HistoryRow> {
    return this.catalog.listAdjustmentHistory(this.activeKind).map((entry) => ({
      id: entry.id,
      dateTime: this.formatDate(entry.dateTime),
      user: normalizeText(entry.user),
      percentage: this.formatPercent(entry.percentage),
      itemCount: entry.items.length,
      status: entry.status,
      revertedBy: entry.revertedBy ? `${normalizeText(entry.revertedBy)} - ${this.formatDate(entry.revertedAt)}` : '',
      entry,
    }));
  }

  get isValidPercentage(): boolean {
    return Number.isFinite(this.normalizedPercentage) && this.normalizedPercentage !== 0;
  }

  get canApply(): boolean {
    return !this.loading && this.previewItems.length > 0 && this.isValidPercentage && !this.hasNegativePreview;
  }

  get hasNegativePreview(): boolean {
    return this.previewItems.some((item) => item.newValue < 0);
  }

  get normalizedPercentage(): number {
    const value = typeof this.percentage === 'string'
      ? Number(String(this.percentage).replace(',', '.'))
      : Number(this.percentage);

    return Number.isFinite(value) ? value : Number.NaN;
  }

  activate(kind: ComponentKind): void {
    this.activeKind = kind;
  }

  onLookupSelected(kind: ComponentKind, value: unknown): void {
    const ids = this.normalizeLookupIds(value);
    const currentIds = this.getSelectedIds(kind);
    const nextIds = Array.isArray(value) ? ids : [...currentIds, ...ids];
    this.setSelectedIds(kind, nextIds);
  }

  onLookupChange(kind: ComponentKind, value: unknown): void {
    this.setSelectedIds(kind, this.normalizeLookupIds(value));
  }

  removeSelected(id: string): void {
    this.setSelectedIds(this.activeKind, this.getSelectedIds(this.activeKind).filter((selectedId) => selectedId !== id));
  }

  openApplyConfirmation(): void {
    if (!this.canApply) {
      this.poNotification.error(this.hasNegativePreview
        ? 'O reajuste geraria valor negativo em um ou mais itens.'
        : 'Selecione itens e informe um percentual diferente de zero.');
      return;
    }

    this.confirmModal.open();
  }

  applyAdjustment(): void {
    if (!this.canApply) {
      return;
    }

    this.loading = true;

    try {
      this.catalog.applyAdjustment(this.activeKind, this.getSelectedIds(this.activeKind), this.normalizedPercentage, this.currentUser());
      this.setSelectedIds(this.activeKind, []);
      this.percentage = 0;
      this.confirmModal.close();
      this.poNotification.success('Reajuste aplicado com sucesso.');
    } catch (error) {
      this.poNotification.error(error instanceof Error ? error.message : 'Nao foi possivel aplicar o reajuste.');
    } finally {
      this.loading = false;
    }
  }

  openRevert(entry: AdjustmentHistoryEntry): void {
    if (entry.status === 'Revertido') {
      return;
    }

    this.revertCandidate = entry;
    this.revertModal.open();
  }

  revertAdjustment(): void {
    if (!this.revertCandidate) {
      return;
    }

    this.loading = true;

    try {
      this.catalog.revertAdjustment(this.revertCandidate.id, this.currentUser());
      this.revertModal.close();
      this.revertCandidate = undefined;
      this.poNotification.success('Reajuste revertido com sucesso.');
    } catch (error) {
      this.poNotification.error(error instanceof Error ? error.message : 'Nao foi possivel reverter o reajuste.');
    } finally {
      this.loading = false;
    }
  }

  formatCurrency(value: number): string {
    return this.safeNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatPercent(value: number): string {
    return `${this.safeNumber(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }

  formatPreviewValue(value: number): string {
    return this.activeKind === 'price' ? this.formatPercent(value) : this.formatCurrency(value);
  }

  tabTitle(kind: ComponentKind): string {
    return kind === 'price' ? 'Reajuste Preco' : 'Reajuste Produto';
  }

  trackByPreview(_: number, item: AdjustmentPreviewItem): string {
    return item.id;
  }

  private getSelectedIds(kind: ComponentKind): Array<string> {
    const ids = kind === 'price' ? this.selectedPriceIds : this.selectedProductIds;
    return ids.map((item) => lookupId(item)).filter(Boolean);
  }

  private setSelectedIds(kind: ComponentKind, ids: Array<string>): void {
    const availableIds = new Set(this.componentsForKind(kind).map((component) => component.id));
    const uniqueIds = ids
      .map((id) => String(id ?? ''))
      .filter((id, index, source) => id && availableIds.has(id) && source.indexOf(id) === index);

    if (kind === 'price') {
      this.selectedPriceIds = uniqueIds;
    } else {
      this.selectedProductIds = uniqueIds;
    }
  }

  private normalizeLookupIds(value: unknown): Array<string> {
    if (Array.isArray(value)) {
      return value.map((item) => lookupId(item)).filter(Boolean);
    }

    const id = lookupId(value);
    return id ? [id] : [];
  }

  private componentsForActiveKind(): Array<ProductComponent> {
    return this.componentsForKind(this.activeKind);
  }

  private componentsForKind(kind: ComponentKind): Array<ProductComponent> {
    return kind === 'price'
      ? this.catalog.listPriceComponents(false)
      : this.catalog.listComponents(false);
  }

  private targetOptions(component: ProductComponent): Array<ProductComponentOption> {
    return component.options.filter((option) => option.selected || option.default);
  }

  private applyPercentage(value: number, percentage: number): number {
    return Math.round(this.safeNumber(value) * (1 + percentage / 100) * 1000000) / 1000000;
  }

  private safeNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private formatDate(value: string | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('pt-BR');
  }

  private currentUser(): string {
    return 'Super Admin';
  }
}
