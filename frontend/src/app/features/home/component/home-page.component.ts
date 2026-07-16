import { Component, OnInit } from '@angular/core';
import { SHARED_MODULES } from 'src/app/shared/shared'; // ou '../shared/shared' dependendo do path

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
  imports: [...SHARED_MODULES],
})
export class HomePageComponent implements OnInit {
  images: string[] = [];

  ngOnInit(): void {
    this.images = ['/assets/image_01.jpg', '/assets/image_02.jpg'];
  }
}
