import { Component } from '@angular/core';
import {
  PoMenuItem,
  PoToolbarAction,
  PoToolbarProfile,
} from '@po-ui/ng-components';
import { Router } from '@angular/router';
import { SHARED_MODULES } from '../shared/shared';

@Component({
  selector: 'app-root',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
  imports: [...SHARED_MODULES],
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
      icon: 'an an-chart-line-up',
      link: 'simulation',
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
