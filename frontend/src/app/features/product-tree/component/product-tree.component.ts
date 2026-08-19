import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { PoModalComponent, PoPageAction, PoSelectOption } from '@po-ui/ng-components';
import {
  ComponentKind,
  PriceComponent,
  ProductCatalogService,
  ProductComponent,
  ProductComponentOption,
  ProductComponentOptionStatus,
  ProductNode,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type CompositionSource = 'library' | 'composition';
type TreeEditMode = 'create' | 'edit';

@Component({
  selector: 'app-product-tree',
  templateUrl: './product-tree.component.html',
  styleUrls: ['./product-tree.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class ProductTreeComponent {
  @ViewChild('groupModal') groupModal!: PoModalComponent;
  @ViewChild('productModal') productModal!: PoModalComponent;
  @ViewChild('componentOptionModal') componentOptionModal!: PoModalComponent;

  tree: Array<ProductNode> = [];
  products: Array<ProductNode> = [];
  components: Array<ProductComponent> = [];
  priceComponents: Array<PriceComponent> = [];
  selectedProductId = '';
  compositionIds: Array<string> = [];
  priceCompositionIds: Array<string> = [];
  savedCompositionIds: Array<string> = [];
  savedPriceCompositionIds: Array<string> = [];
  statusMessage = '';
  productLibraryOpen = true;
  priceLibraryOpen = true;
  groupMode: TreeEditMode = 'create';
  productMode: TreeEditMode = 'create';
  editingGroupId = '';
  editingProductId = '';
  optionComponent: ProductComponent | undefined;
  optionCode = '';
  optionCostValue = 0;

  groupModel = { code: '', name: '', icon: 'ti-folder' };
  productModel = { groupId: '', code: '', name: '', icon: 'ti-package' };
  groupOptions: Array<PoSelectOption> = [];
  readonly pageActions: Array<PoPageAction> = [
    {
      label: 'Criar grupo',
      icon: 'an an-plus',
      action: () => this.openGroupModal(),
    },
    {
      label: 'Criar produto',
      icon: 'an an-plus',
      action: () => this.openProductModal(),
    },
  ];

  constructor(private readonly catalog: ProductCatalogService) {
    this.refresh();
  }

  get selectedProduct(): ProductNode | undefined {
    return this.products.find((product) => product.id === this.selectedProductId);
  }

  get selectedComponents(): Array<ProductComponent> {
    const effectiveById = new Map(this.catalog.getCompositionComponents(this.selectedProductId).map((component) => [component.id, component]));
    const globalById = new Map(this.components.map((component) => [component.id, component]));
    return this.compositionIds
      .map((componentId) => effectiveById.get(componentId) ?? globalById.get(componentId))
      .filter((component): component is ProductComponent => Boolean(component));
  }

  get selectedPriceComponents(): Array<PriceComponent> {
    return this.resolveComponents(this.priceComponents, this.priceCompositionIds);
  }

  get availableComponents(): Array<ProductComponent> {
    const used = new Set(this.compositionIds);
    return this.components.filter((component) => !used.has(component.id));
  }

  get availablePriceComponents(): Array<PriceComponent> {
    const used = new Set(this.priceCompositionIds);
    return this.priceComponents.filter((component) => !used.has(component.id));
  }

  get groupModalTitle(): string {
    return this.groupMode === 'edit' ? 'Editar grupo' : 'Criar grupo';
  }

  get productModalTitle(): string {
    return this.productMode === 'edit' ? 'Editar produto ou serviço' : 'Criar produto ou serviço';
  }

  get groupSubmitLabel(): string {
    return this.groupMode === 'edit' ? 'Salvar' : 'Criar';
  }

  get productSubmitLabel(): string {
    return this.productMode === 'edit' ? 'Salvar' : 'Criar';
  }

  selectProduct(productId: string): void {
    this.selectedProductId = productId;
    this.catalog.setSelectedProductId(productId);
    this.loadProductComposition(productId);
    this.statusMessage = '';
  }

  addGroup(): void {
    if (!this.groupModel.code.trim() || !this.groupModel.name.trim()) {
      this.statusMessage = 'Informe código e nome do grupo.';
      return;
    }

    const code = this.groupModel.code.trim().toUpperCase();
    if (this.groupCodeExists(code, this.groupMode === 'edit' ? this.editingGroupId : '')) {
      this.statusMessage = 'Código de grupo já existe.';
      return;
    }

    if (this.groupMode === 'edit') {
      this.catalog.updateGroup(this.editingGroupId, {
        code,
        name: this.groupModel.name.trim(),
        icon: this.groupModel.icon.trim() || 'ti-folder',
      });
      this.statusMessage = 'Grupo salvo.';
      this.groupModal?.close();
      this.refresh();
      return;
    }

    this.catalog.createGroup({
      id: `G-${Date.now()}`,
      code,
      name: this.groupModel.name.trim(),
      icon: this.groupModel.icon.trim() || 'ti-folder',
      type: 'group',
      children: [],
    });
    this.groupModel = { code: '', name: '', icon: 'ti-folder' };
    this.refresh();
    this.statusMessage = 'Grupo criado.';
    this.groupModal?.close();
  }

  addProduct(): void {
    if (!this.productModel.groupId || !this.productModel.code.trim() || !this.productModel.name.trim()) {
      this.statusMessage = 'Informe grupo, código e nome do produto.';
      return;
    }

    if (this.productMode === 'edit') {
      this.catalog.updateProduct(this.editingProductId, this.productModel.groupId, {
        code: this.productModel.code.trim().toUpperCase(),
        name: this.productModel.name.trim(),
        icon: this.productModel.icon.trim() || 'ti-package',
      });
      this.refresh();
      this.selectProduct(this.editingProductId);
      this.statusMessage = 'Produto salvo.';
      this.productModal?.close();
      return;
    }

    const product = this.catalog.createProduct(this.productModel.groupId, {
      id: `P-${Date.now()}`,
      code: this.productModel.code.trim().toUpperCase(),
      name: this.productModel.name.trim(),
      icon: this.productModel.icon.trim() || 'ti-package',
      type: 'product',
      children: [],
    });

    if (!product) {
      this.statusMessage = 'Grupo não encontrado.';
      return;
    }

    this.productModel = { groupId: this.tree[0]?.id ?? '', code: '', name: '', icon: 'ti-package' };
    this.refresh();
    this.selectProduct(product.id);
    this.statusMessage = 'Produto criado.';
    this.productModal?.close();
  }

  openGroupModal(): void {
    this.groupMode = 'create';
    this.editingGroupId = '';
    this.groupModel = { code: '', name: '', icon: 'ti-folder' };
    this.groupModal.open();
  }

  openProductModal(): void {
    this.productMode = 'create';
    this.editingProductId = '';
    this.productModel = { groupId: this.productModel.groupId || this.tree[0]?.id || '', code: '', name: '', icon: 'ti-package' };
    this.productModal.open();
  }

  openEditGroupModal(group: ProductNode, event?: Event): void {
    event?.stopPropagation();
    this.groupMode = 'edit';
    this.editingGroupId = group.id;
    this.groupModel = { code: group.code, name: group.name, icon: group.icon || 'ti-folder' };
    this.groupModal.open();
  }

  openEditProductModal(product: ProductNode, groupId: string, event?: Event): void {
    event?.stopPropagation();
    this.productMode = 'edit';
    this.editingProductId = product.id;
    this.productModel = {
      groupId,
      code: product.code,
      name: product.name,
      icon: product.icon || 'ti-package',
    };
    this.productModal.open();
  }

  duplicateProduct(product: ProductNode, groupId: string, event?: Event): void {
    event?.stopPropagation();
    const duplicated = this.catalog.duplicateProduct(product.id, groupId);

    if (!duplicated) {
      this.statusMessage = 'Não foi possível duplicar o produto.';
      return;
    }

    this.refresh();
    this.selectProduct(duplicated.id);
    this.statusMessage = 'Produto duplicado.';
  }

  deleteGroup(): void {
    if (!this.editingGroupId) {
      return;
    }

    this.catalog.removeGroup(this.editingGroupId);
    this.statusMessage = 'Grupo excluído.';
    this.groupModal?.close();
    this.refresh();
  }

  deleteProduct(): void {
    if (!this.editingProductId) {
      return;
    }

    this.catalog.removeProduct(this.editingProductId);
    this.statusMessage = 'Produto excluído.';
    this.productModal?.close();
    this.refresh();
  }

  toggleProductLibrary(): void {
    this.productLibraryOpen = !this.productLibraryOpen;
  }

  togglePriceLibrary(): void {
    this.priceLibraryOpen = !this.priceLibraryOpen;
  }

  addComponent(componentId: string, kind: ComponentKind = 'product'): void {
    const ids = this.idsFor(kind);
    if (!ids.includes(componentId)) {
      this.setIdsFor(kind, [...ids, componentId]);
    }
  }

  removeComponent(componentId: string, kind: ComponentKind = 'product'): void {
    this.setIdsFor(kind, this.idsFor(kind).filter((id) => id !== componentId));
  }

  clearComposition(): void {
    this.compositionIds = [];
    this.priceCompositionIds = [];
    this.statusMessage = 'Composição limpa. Salve para persistir.';
  }

  revertComposition(): void {
    this.compositionIds = [...this.savedCompositionIds];
    this.priceCompositionIds = [...this.savedPriceCompositionIds];
    this.statusMessage = 'Composição revertida para o último salvamento.';
  }

  saveComposition(): void {
    if (!this.selectedProductId) {
      this.statusMessage = 'Selecione um produto.';
      return;
    }

    const saved = this.catalog.saveComposition(this.selectedProductId, this.compositionIds, this.priceCompositionIds);
    this.savedCompositionIds = [...saved.productComponentIds];
    this.savedPriceCompositionIds = [...saved.priceComponentIds];
    this.statusMessage = 'Composição salva localmente.';
  }

  openComponentOptionModal(component: ProductComponent, event?: Event): void {
    event?.stopPropagation();
    if (!component.options.length) {
      return;
    }

    const config = this.catalog.getProductComponentOptionConfig(this.selectedProductId, component.id);
    const selectedOption = component.options.find((option) => option.code === config?.optionCode)
      ?? component.options.find((option) => option.default)
      ?? component.options.find((option) => option.selected)
      ?? component.options[0];

    this.optionComponent = {
      ...component,
      options: component.options.map((option) => ({ ...option })),
    };
    this.optionCode = selectedOption.code;
    this.optionCostValue = config?.costValue ?? selectedOption.costValue;
    this.componentOptionModal.open();
  }

  saveComponentOptionConfig(): void {
    if (!this.selectedProductId || !this.optionComponent || !this.optionCode) {
      return;
    }

    const saved = this.catalog.saveProductComponentOptionConfig(
      this.selectedProductId,
      this.optionComponent.id,
      this.optionCode,
      this.optionCostValue,
    );

    if (!saved) {
      this.statusMessage = 'Nao foi possivel salvar a opcao do componente.';
      return;
    }

    this.componentOptionModal.close();
    this.optionComponent = undefined;
    this.statusMessage = 'Opcao do componente salva.';
  }

  selectComponentOption(optionCode: string): void {
    if (!this.optionComponent) {
      return;
    }

    this.optionCode = optionCode;
    this.optionCostValue = this.optionComponent.options.find((option) => option.code === optionCode)?.costValue ?? 0;
  }

  componentOptionStatus(component: ProductComponent): ProductComponentOptionStatus {
    return this.catalog.getProductComponentOptionStatus(this.selectedProductId, component.id);
  }

  componentOptionStatusLabel(component: ProductComponent): string {
    return this.componentOptionStatus(component) === 'custom' ? 'Personalizado' : 'Padrão';
  }

  selectedOptionDescription(component: ProductComponent): string {
    return component.options.find((option) => option.selected)?.description ?? 'Sem opcao selecionada';
  }

  selectedOptionCostValue(component: ProductComponent): number {
    return component.options.find((option) => option.selected)?.costValue ?? 0;
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatCostInput(value: number): string {
    return this.formatCurrency(value).replace(/\s/g, ' ');
  }

  onOptionCostInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    const costValue = digits ? Number(digits) / 100 : 0;

    this.optionCostValue = costValue;
    input.value = this.formatCostInput(costValue);
  }

  trackByOption(_: number, option: ProductComponentOption): string {
    return option.code;
  }

  beginComponentDrag(
    event: DragEvent,
    componentId: string,
    source: CompositionSource,
    kind: ComponentKind = 'product',
  ): void {
    event.dataTransfer?.setData('application/x-protege-component', JSON.stringify({ componentId, source, kind }));
    event.dataTransfer?.setData('text/plain', componentId);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropOnComposition(event: DragEvent, targetIndex = this.compositionIds.length, kind: ComponentKind = 'product'): void {
    event.preventDefault();
    const data = this.readDrag(event);

    if (!data || data.kind !== kind) {
      return;
    }

    if (data.source === 'composition') {
      this.moveComponent(data.componentId, targetIndex, kind);
      return;
    }

    const currentIds = this.idsFor(kind);
    if (!currentIds.includes(data.componentId)) {
      const ids = [...currentIds];
      ids.splice(targetIndex, 0, data.componentId);
      this.setIdsFor(kind, ids);
    }
  }

  dropOnLibrary(event: DragEvent, kind: ComponentKind = 'product'): void {
    event.preventDefault();
    const data = this.readDrag(event);

    if (data?.source === 'composition' && data.kind === kind) {
      this.removeComponent(data.componentId, kind);
    }
  }

  private refresh(): void {
    this.tree = this.catalog.getTree();
    this.products = this.catalog.getProducts();
    this.components = this.catalog.listComponents(false);
    this.priceComponents = this.catalog.listPriceComponents(false);
    this.groupOptions = this.tree.map((group) => ({ label: `${group.code} - ${group.name}`, value: group.id }));
    this.productModel.groupId = this.productModel.groupId || this.tree[0]?.id || '';
    this.selectedProductId = this.catalog.getSelectedProductId() || this.products[0]?.id || '';
    this.loadProductComposition(this.selectedProductId);
  }

  private loadProductComposition(productId: string): void {
    const composition = this.catalog.getComposition(productId);
    this.compositionIds = [...composition.productComponentIds];
    this.priceCompositionIds = [...composition.priceComponentIds];
    this.savedCompositionIds = [...composition.productComponentIds];
    this.savedPriceCompositionIds = [...composition.priceComponentIds];
  }

  private moveComponent(componentId: string, targetIndex: number, kind: ComponentKind): void {
    const currentIds = this.idsFor(kind);
    const sourceIndex = currentIds.indexOf(componentId);
    if (sourceIndex < 0) {
      return;
    }

    const ids = [...currentIds];
    const [item] = ids.splice(sourceIndex, 1);
    ids.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, item);
    this.setIdsFor(kind, ids);
  }

  private idsFor(kind: ComponentKind): Array<string> {
    return kind === 'price' ? this.priceCompositionIds : this.compositionIds;
  }

  private setIdsFor(kind: ComponentKind, ids: Array<string>): void {
    if (kind === 'price') {
      this.priceCompositionIds = ids;
      return;
    }

    this.compositionIds = ids;
  }

  private resolveComponents<T extends ProductComponent>(source: Array<T>, ids: Array<string>): Array<T> {
    const byId = new Map(source.map((component) => [component.id, component]));
    return ids
      .map((componentId) => byId.get(componentId))
      .filter((component): component is T => Boolean(component));
  }

  private groupCodeExists(code: string, ignoredGroupId = ''): boolean {
    return this.tree.some((group) => group.id !== ignoredGroupId && group.code.toUpperCase() === code);
  }

  private readDrag(event: DragEvent): { componentId: string; source: CompositionSource; kind: ComponentKind } | undefined {
    const payload = event.dataTransfer?.getData('application/x-protege-component');
    if (!payload) {
      return undefined;
    }

    try {
      const data = JSON.parse(payload);
      return {
        componentId: String(data.componentId ?? ''),
        source: data.source === 'composition' ? 'composition' : 'library',
        kind: data.kind === 'price' ? 'price' : 'product',
      };
    } catch {
      return undefined;
    }
  }
}
