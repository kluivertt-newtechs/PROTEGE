import { Component } from '@angular/core';
import {
  PoMenuModule,
  PoMenuItem,
  PoToolbarModule,
  PoToolbarAction,
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
    // {
    //   label: 'Home',
    //   shortLabel: 'Home',
    //   icon: 'an an-house',
    //   link: 'home',
    // },
    {
      label: 'Precificação',
      shortLabel: 'Preço',
      icon: 'an an-currency-circle-dollar',
      link: 'pricing',
    },
    {
      label: 'Simulação',
      shortLabel: 'Simular',
      icon: 'an an-calculator',
      link: 'simulation',
    },
    {
      label: 'Consolidado',
      shortLabel: 'Consolidado',
      icon: 'an an-chart-line-up',
      link: 'consolidated',
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
