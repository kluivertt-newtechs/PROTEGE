import { Component } from '@angular/core';
import {
  PoMenuItem,
  PoMenuModule,
  PoToolbarAction,
  PoToolbarModule,
  PoToolbarProfile,
} from '@po-ui/ng-components';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
  imports: [RouterOutlet, PoMenuModule, PoToolbarModule],
})
export class MainComponent {
  toolbarProfile: PoToolbarProfile = {
    title: 'Super Admin',
    subtitle: 'super@admin.com',
  };

  profileActions: Array<PoToolbarAction> = [
    {
      icon: 'an an-user',
      label: 'Perfil',
      action: this.onProfile.bind(this),
    },
    {
      icon: 'an an-lock',
      label: 'Alterar senha',
      action: this.goToChangePassword.bind(this),
    },
    {
      icon: 'an an-sign-out',
      label: 'Sair',
      type: 'danger',
      separator: true,
      action: this.onLogout.bind(this),
    },
  ];

  menu: Array<PoMenuItem> = [
    {
      label: 'Componentes de Produto',
      shortLabel: 'Produto',
      icon: 'an an-package',
      link: 'product-components',
    },
    {
      label: 'Componentes de Preço',
      shortLabel: 'Preço',
      icon: 'an an-currency-circle-dollar',
      link: 'price-components',
    },
    {
      label: 'Reajuste',
      shortLabel: 'Reajuste',
      icon: 'an an-sliders-horizontal',
      link: 'parameters',
    },
    {
      label: 'Árvore de Produto',
      shortLabel: 'Árvore',
      icon: 'an an-tree-structure',
      link: 'product-tree',
    },
    {
      label: 'Construtor de Fórmulas',
      shortLabel: 'Fórmulas',
      icon: 'an an-function',
      link: 'formula-builder',
    },
    {
      label: 'Simulação',
      shortLabel: 'Simulação',
      icon: 'an an-calculator',
      link: 'sale-price',
    },
  ];

  constructor(private router: Router) {}

  onProfile() {}

  onLogout() {
    this.router.navigate(['/login']);
  }

  goToChangePassword() {
    this.router.navigate(['/alterar-senha']);
  }
}
