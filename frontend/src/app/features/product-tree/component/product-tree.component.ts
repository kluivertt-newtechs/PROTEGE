import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { PoModalComponent, PoPageAction, PoSelectOption } from '@po-ui/ng-components';
import {
  ComponentKind,
  PriceComponent,
  ProductCatalogService,
  ProductComponent,
  ProductNode,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

type CompositionSource = 'library' | 'composition';

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
    return this.resolveComponents(this.components, this.compositionIds);
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

    const group: ProductNode = {
      id: `G-${Date.now()}`,
      code: this.groupModel.code.trim().toUpperCase(),
      name: this.groupModel.name.trim(),
      icon: this.groupModel.icon.trim() || 'ti-folder',
      type: 'group',
      children: [],
    };

    this.tree = [...this.tree, group];
    this.catalog.saveTree(this.tree);
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

    const product: ProductNode = {
      id: `P-${Date.now()}`,
      code: this.productModel.code.trim().toUpperCase(),
      name: this.productModel.name.trim(),
      icon: this.productModel.icon.trim() || 'ti-package',
      type: 'product',
      children: [],
    };

    this.tree = this.tree.map((group) =>
      group.id === this.productModel.groupId
        ? { ...group, children: [...(group.children ?? []), product] }
        : group,
    );
    this.catalog.saveTree(this.tree);
    this.productModel = { groupId: this.tree[0]?.id ?? '', code: '', name: '', icon: 'ti-package' };
    this.refresh();
    this.selectProduct(product.id);
    this.statusMessage = 'Produto criado.';
    this.productModal?.close();
  }

  openGroupModal(): void {
    this.groupModal.open();
  }

  openProductModal(): void {
    this.productModel.groupId = this.productModel.groupId || this.tree[0]?.id || '';
    this.productModal.open();
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
