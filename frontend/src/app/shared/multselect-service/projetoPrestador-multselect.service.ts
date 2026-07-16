// import { Injectable } from '@angular/core';
// import { map, Observable } from 'rxjs';
// import { PoMultiselectFilter, PoMultiselectOption } from '@po-ui/ng-components';

// import { ProjetoService } from '../main/cadastros/projeto/services/projeto.service';
// import { ProjetoAPI } from '../main/cadastros/projeto/models/projeto';
// import { LoginService } from '../login/login.service';
// import { LoggedUser } from '../login/models/logged-user';

// @Injectable({
//   providedIn: 'root',
// })
// export class ProjetoPrestadorMultselectService implements PoMultiselectFilter {
//   loggedUser: LoggedUser = this.loginService.getLoggedUser();

//   constructor(
//     private service: ProjetoService,
//     private loginService: LoginService,
//   ) {}

//   getFilteredData(params: any): Observable<PoMultiselectOption[]> {
//     const data: any = {
//       page: params.page || 1,
//       pageSize: params.pageSize || 100,
//       status: 'Liberado',
//       idPrestador: this.loginService.getLoggedUser().id,
//     };

//     if (params.value && params.value.trim() !== '') {
//       data.nomeOuCodigo = params.value;
//     }

//     if (params.filterParams) {
//       Object.keys(params.filterParams).forEach((key) => {
//         data[key] = params.filterParams[key];
//       });
//     }

//     return this.service.getProjetos(data).pipe(
//       map((response: ProjetoAPI) =>
//         response.items
//           .filter(
//             (projeto: any) =>
//               projeto.Tarefas?.some((t: any) => t.ativo === true) ?? false,
//           )
//           .map((projeto: any) => ({
//             value: projeto.id,
//             label: projeto.nome,
//           })),
//       ),
//     );
//   }
//   getObjectsByValues(value: any | any[], filterParams?: any): Observable<any> {
//     const data: any = {
//       idPrestador: this.loggedUser.id,
//       idsProjeto: value,
//     };

//     return this.service.getProjetos(data).pipe(
//       map((response: ProjetoAPI) =>
//         response.items.map((projeto) => ({
//           value: projeto.id,
//           label: projeto.nome,
//         })),
//       ),
//     );
//   }
// }
