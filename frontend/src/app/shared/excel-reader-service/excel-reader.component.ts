import {
  Component,
  EventEmitter,
  Inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import * as XLSX from 'xlsx';
import {
  PoComponentsModule,
  PoModalComponent,
  PoNotificationService,
  PoUploadComponent,
} from '@po-ui/ng-components';
import { SHARED_MODULES } from '../shared';

@Component({
  selector: 'app-excel-reader',
  templateUrl: './excel-reader.component.html',
  styleUrls: ['./excel-reader.component.css'],
  standalone: true,
  imports: [...SHARED_MODULES],
})
export class ExcelReaderComponent {
  @ViewChild('uploadComponent') uploadComponent!: PoUploadComponent;
  @ViewChild('modal') modal!: PoModalComponent;
  @Output() excelData = new EventEmitter<any>();
  @Input() title: string = 'Upload de Arquivos';
  @Input() sheetName?: string; // nome da aba
  @Input() sheetIndex?: number;
  @Input() descriptionUpload: string =
    'Selecione um arquivo Excel (.xlsx ou .xls) para importar, depois clique em Salvar.';

  private poNotificationService = Inject(PoNotificationService);

  open() {
    this.uploadComponent.clear();
    this.modal.open();
  }

  confirm() {
    const files: any = this.uploadComponent.currentFiles;
    if (!files.length) {
      return;
    }

    const file: any = files[0].rawFile;
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      console.log('namesheet', this.sheetName);

      let sheetNameResolved: string | undefined;

      if (this.sheetName && workbook.SheetNames.includes(this.sheetName)) {
        sheetNameResolved = this.sheetName;
      } else if (
        this.sheetIndex !== undefined &&
        workbook.SheetNames[this.sheetIndex]
      ) {
        sheetNameResolved = workbook.SheetNames[this.sheetIndex];
      } else {
        sheetNameResolved = workbook.SheetNames[0];
      }

      const sheet = workbook.Sheets[sheetNameResolved];

      if (!sheet) {
        this.poNotificationService.error(
          'Aba não encontrada no excel:',
          sheetNameResolved,
        );
        return;
      }

      const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const cleanedJson = rawJson.map((row: any) => {
        const cleanRow: any = {};
        Object.keys(row).forEach((key) => {
          cleanRow[key.trim()] = row[key];
        });
        return cleanRow;
      });

      this.excelData.emit(cleanedJson);

      this.modal.close();
      this.uploadComponent.clear();
    };

    reader.readAsArrayBuffer(file);
  }

  isUploadDisabled(): boolean {
    return (this.uploadComponent?.currentFiles?.length ?? 0) > 0;
  }
}
