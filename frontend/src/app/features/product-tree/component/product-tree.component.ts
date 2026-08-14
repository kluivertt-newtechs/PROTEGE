import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
  statusMessage = '';

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
    this.compositionIds = this.catalog.getComposition(productId).productComponentIds;
    this.statusMessage = '';
  }

  addComponent(componentId: string): void {
    if (!this.compositionIds.includes(componentId)) {
      this.compositionIds = [...this.compositionIds, componentId];
    }
  }

  removeComponent(componentId: string): void {
    this.compositionIds = this.compositionIds.filter((id) => id !== componentId);
  }

  saveComposition(): void {
    this.catalog.saveComposition(this.selectedProductId, this.compositionIds);
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
    this.selectedProductId = this.catalog.getSelectedProductId() || this.products[0]?.id || '';
    this.compositionIds = this.catalog.getComposition(this.selectedProductId).productComponentIds;
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
