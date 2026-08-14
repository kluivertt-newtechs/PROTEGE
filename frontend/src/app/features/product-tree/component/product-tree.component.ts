import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PoSelectOption } from '@po-ui/ng-components';
import {
  ProductCatalogService,
  ProductComponent,
  ProductNode,
} from 'src/app/core/product-catalog.service';
import { SHARED_MODULES } from 'src/app/shared/shared';

@Component({
  selector: 'app-product-tree',
  templateUrl: './product-tree.component.html',
  styleUrls: ['./product-tree.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES, CommonModule],
})
export class ProductTreeComponent {
  tree: Array<ProductNode> = [];
  products: Array<ProductNode> = [];
  components: Array<ProductComponent> = [];
  selectedProductId = '';
  compositionIds: Array<string> = [];
  savedCompositionIds: Array<string> = [];
  statusMessage = '';

  groupModel = { code: '', name: '', icon: 'ti-folder' };
  productModel = { groupId: '', code: '', name: '', icon: 'ti-package' };
  groupOptions: Array<PoSelectOption> = [];

  constructor(private readonly catalog: ProductCatalogService) {
    this.refresh();
  }

  get selectedProduct(): ProductNode | undefined {
    return this.products.find((product) => product.id === this.selectedProductId);
  }

  get selectedComponents(): Array<ProductComponent> {
    const byId = new Map(this.components.map((component) => [component.id, component]));
    return this.compositionIds
      .map((componentId) => byId.get(componentId))
      .filter((component): component is ProductComponent => Boolean(component));
  }

  get availableComponents(): Array<ProductComponent> {
    const used = new Set(this.compositionIds);
    return this.components.filter((component) => !used.has(component.id));
  }

  selectProduct(productId: string): void {
    this.selectedProductId = productId;
    this.catalog.setSelectedProductId(productId);
    const ids = this.catalog.getComposition(productId).productComponentIds;
    this.compositionIds = [...ids];
    this.savedCompositionIds = [...ids];
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
  }

  addComponent(componentId: string): void {
    if (!this.compositionIds.includes(componentId)) {
      this.compositionIds = [...this.compositionIds, componentId];
    }
  }

  removeComponent(componentId: string): void {
    this.compositionIds = this.compositionIds.filter((id) => id !== componentId);
  }

  clearComposition(): void {
    this.compositionIds = [];
    this.statusMessage = 'Composição limpa. Salve para persistir.';
  }

  revertComposition(): void {
    this.compositionIds = [...this.savedCompositionIds];
    this.statusMessage = 'Composição revertida para o último salvamento.';
  }

  saveComposition(): void {
    if (!this.selectedProductId) {
      this.statusMessage = 'Selecione um produto.';
      return;
    }

    const saved = this.catalog.saveComposition(this.selectedProductId, this.compositionIds);
    this.savedCompositionIds = [...saved.productComponentIds];
    this.statusMessage = 'Composição salva localmente.';
  }

  beginComponentDrag(event: DragEvent, componentId: string, source: 'library' | 'composition'): void {
    event.dataTransfer?.setData('application/x-protege-component', JSON.stringify({ componentId, source }));
    event.dataTransfer?.setData('text/plain', componentId);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropOnComposition(event: DragEvent, targetIndex = this.compositionIds.length): void {
    event.preventDefault();
    const data = this.readDrag(event);

    if (!data) {
      return;
    }

    if (data.source === 'composition') {
      this.moveComponent(data.componentId, targetIndex);
      return;
    }

    if (!this.compositionIds.includes(data.componentId)) {
      const ids = [...this.compositionIds];
      ids.splice(targetIndex, 0, data.componentId);
      this.compositionIds = ids;
    }
  }

  dropOnLibrary(event: DragEvent): void {
    event.preventDefault();
    const data = this.readDrag(event);

    if (data?.source === 'composition') {
      this.removeComponent(data.componentId);
    }
  }

  private refresh(): void {
    this.tree = this.catalog.getTree();
    this.products = this.catalog.getProducts();
    this.components = this.catalog.listComponents(false);
    this.groupOptions = this.tree.map((group) => ({ label: `${group.code} - ${group.name}`, value: group.id }));
    this.productModel.groupId = this.productModel.groupId || this.tree[0]?.id || '';
    this.selectedProductId = this.catalog.getSelectedProductId() || this.products[0]?.id || '';
    const ids = this.catalog.getComposition(this.selectedProductId).productComponentIds;
    this.compositionIds = [...ids];
    this.savedCompositionIds = [...ids];
  }

  private moveComponent(componentId: string, targetIndex: number): void {
    const sourceIndex = this.compositionIds.indexOf(componentId);
    if (sourceIndex < 0) {
      return;
    }

    const ids = [...this.compositionIds];
    const [item] = ids.splice(sourceIndex, 1);
    ids.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, item);
    this.compositionIds = ids;
  }

  private readDrag(event: DragEvent): { componentId: string; source: 'library' | 'composition' } | undefined {
    const payload = event.dataTransfer?.getData('application/x-protege-component');
    if (!payload) {
      return undefined;
    }

    try {
      return JSON.parse(payload);
    } catch {
      return undefined;
    }
  }
}
