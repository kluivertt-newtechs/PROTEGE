// import { Injectable } from '@angular/core';
// import {
//   PoLookupFilter,
//   PoLookupFilteredItemsParams,
//   PoLookupResponseApi,
// } from '@po-ui/ng-components';
// import { Observable } from 'rxjs';
// import { CategoriaApiService } from '../main/financeiro/categoria/services/categoria-api.service';

// @Injectable({
//   providedIn: 'root',
// })
// export class CategoriaLookupService implements PoLookupFilter {
//   constructor(private categoriaApiService: CategoriaApiService) {}

//   getFilteredItems(
//     params: PoLookupFilteredItemsParams,
//   ): Observable<PoLookupResponseApi> {
//     const data: any = {
//       page: params.page || 1,
//       pageSize: params.pageSize || 10,
//       filter: params.filter,
//       order: params.order,
//     };

//     if (params.filterParams) {
//       Object.keys(params.filterParams).forEach((key) => {
//         data[key] = params.filterParams[key];
//       });
//     }

//     return this.categoriaApiService.getCategorias(data);
//   }

//   getObjectByValue(value: any | any[], filterParams?: any): Observable<any> {
//     return this.categoriaApiService.getCategoria(value, { ...filterParams });
//   }
// }
