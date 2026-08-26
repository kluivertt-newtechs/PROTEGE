import { ProductCatalogService, ProductComponent } from './product-catalog.service';

function option(code: string, costValue: number, selected = false) {
  return {
    sequence: costValue,
    code,
    description: `Option ${code}`,
    calculatedValue: costValue,
    costValue,
    default: selected,
    selected,
  };
}

function component(id: string, multiple: boolean): ProductComponent {
  return {
    id,
    code: id.toUpperCase(),
    description: `Component ${id}`,
    type: 'select',
    unit: '',
    group: 'Spec',
    status: 'Ativo',
    active: true,
    multiple,
    options: [option('A', 10, true), option('B', 20), option('C', 30)],
    varAPV: id,
    formula: '',
  };
}

describe('ProductCatalogService product component option configs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves only one option for a single-selection product component', () => {
    const catalog = new ProductCatalogService();
    const savedComponent = catalog.saveComponent(component('single-comp', false));

    catalog.saveComposition('P12', [savedComponent.id], []);
    catalog.saveProductComponentOptionConfigs('P12', savedComponent.id, [
      { componentId: savedComponent.id, optionCode: 'B', costValue: 21, quantity: 2 },
      { componentId: savedComponent.id, optionCode: 'C', costValue: 31, quantity: 2 },
    ]);

    const configs = catalog.getProductComponentOptionConfigs('P12', savedComponent.id);
    const composed = catalog.getCompositionComponents('P12')[0];

    expect(configs.length).toBe(1);
    expect(configs[0].optionCode).toBe('B');
    expect(composed.options.filter((item) => item.selected).map((item) => item.code)).toEqual(['B']);
  });

  it('saves several options for a multiple product component', () => {
    const catalog = new ProductCatalogService();
    const savedComponent = catalog.saveComponent(component('multi-comp', true));

    catalog.saveComposition('P12', [savedComponent.id], []);
    catalog.saveProductComponentOptionConfigs('P12', savedComponent.id, [
      { componentId: savedComponent.id, optionCode: 'B', costValue: 22, quantity: 3 },
      { componentId: savedComponent.id, optionCode: 'C', costValue: 33, quantity: 3 },
    ]);

    const configs = catalog.getProductComponentOptionConfigs('P12', savedComponent.id);
    const composed = catalog.getCompositionComponents('P12')[0];
    const selected = composed.options.filter((item) => item.selected);

    expect(configs.map((item) => item.optionCode)).toEqual(['B', 'C']);
    expect(selected.map((item) => item.code)).toEqual(['B', 'C']);
    expect(selected.reduce((sum, item) => sum + item.costValue, 0)).toBe(55);
    expect(configs.every((item) => item.quantity === 3)).toBeTrue();
  });

  it('keeps loading legacy single-option configs', () => {
    const catalog = new ProductCatalogService();
    const savedComponent = catalog.saveComponent(component('legacy-comp', true));

    catalog.saveComposition('P12', [savedComponent.id], []);
    catalog.saveProductComponentOptionConfig('P12', savedComponent.id, 'B', 24, 4);

    const configs = catalog.getProductComponentOptionConfigs('P12', savedComponent.id);
    const composed = catalog.getCompositionComponents('P12')[0];

    expect(configs.length).toBe(1);
    expect(configs[0]).toEqual({ componentId: savedComponent.id, optionCode: 'B', costValue: 24, quantity: 4 });
    expect(composed.options.filter((item) => item.selected).map((item) => item.code)).toEqual(['B']);
  });

  it('removes saved option configs when the component leaves the composition', () => {
    const catalog = new ProductCatalogService();
    const savedComponent = catalog.saveComponent(component('removed-comp', true));

    catalog.saveComposition('P12', [savedComponent.id], []);
    catalog.saveProductComponentOptionConfigs('P12', savedComponent.id, [
      { componentId: savedComponent.id, optionCode: 'B', costValue: 20, quantity: 1 },
      { componentId: savedComponent.id, optionCode: 'C', costValue: 30, quantity: 1 },
    ]);
    catalog.saveComposition('P12', [], []);

    expect(catalog.getProductComponentOptionConfigs('P12', savedComponent.id)).toEqual([]);
  });

  it('always normalizes price components as single-selection', () => {
    const catalog = new ProductCatalogService();
    const priceComponent = catalog.createEmptyComponent('price');
    priceComponent.id = 'price-single';
    priceComponent.multiple = true;
    priceComponent.options = [option('A', 5, true), option('B', 10)];

    catalog.savePriceComponent(priceComponent);
    catalog.updateOptionSelection('price', priceComponent.id, 'B', true);

    const saved = catalog.listPriceComponents().find((item) => item.id === priceComponent.id);

    expect(saved?.multiple).toBeFalse();
    expect(saved?.options.filter((item) => item.selected).map((item) => item.code)).toEqual(['B']);
  });
});
