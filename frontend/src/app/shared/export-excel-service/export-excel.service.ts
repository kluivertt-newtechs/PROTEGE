import { Injectable } from '@angular/core';
import { PoTableColumn } from '@po-ui/ng-components';
import * as XLSX from 'xlsx';
import { ExportExcelParams } from './export.excel';
import moment from 'moment';

export interface ExportExcelSheetParams extends Omit<
  ExportExcelParams,
  'nameFile' | 'nameSpreadsheet'
> {
  nameSpreadsheet: string;
}
@Injectable({
  providedIn: 'root',
})
export class ExportExcelService {
  private columns = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ];

  constructor() {}

  export({
    data,
    nameSpreadsheet,
    nameFile,
    header,
    typesColumns,
  }: ExportExcelParams) {
    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        if (moment.isDate(value)) {
          item[key] = moment(value).add(3, 'h').toDate();
        }
      });
    });

    const wb = XLSX.utils.book_new();
    const worksheet = this.buildWorksheet(data, header, typesColumns);

    XLSX.utils.book_append_sheet(wb, worksheet, nameSpreadsheet);
    XLSX.writeFile(wb, nameFile + '.xlsx');
  }

  exportMultipleSheets(
    sheets: ExportExcelSheetParams[],
    nameFile: string,
  ): void {
    const wb = XLSX.utils.book_new();

    sheets.forEach(({ data, nameSpreadsheet, header, typesColumns }) => {
      if (!data || data.length === 0) {
        const emptySheet = XLSX.utils.aoa_to_sheet([['Sem dados para exibir']]);
        XLSX.utils.book_append_sheet(wb, emptySheet, nameSpreadsheet);
        return;
      }

      const worksheet = this.buildWorksheet(data, header, typesColumns);
      XLSX.utils.book_append_sheet(wb, worksheet, nameSpreadsheet);
    });

    XLSX.writeFile(wb, nameFile + '.xlsx');
  }

  private buildWorksheet(
    data: any[],
    header?: string[][],
    typesColumns?: any,
  ): XLSX.WorkSheet {
    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        if (moment.isDate(value)) {
          item[key] = moment(value).add(3, 'h').toDate();
        }
      });
    });

    const worksheet = XLSX.utils.json_to_sheet([]);

    if (header) {
      XLSX.utils.sheet_add_aoa(worksheet, header);
    }

    worksheet['!cols'] = Object.keys(data[0]).map((key) => {
      const minLength = Math.max(key.length, 10);
      const maxLength = data.reduce((w, r) => {
        const length =
          r[key] && !moment.isDate(r[key])
            ? r[key].toString().length
            : minLength;
        return Math.max(w, length);
      }, minLength);
      return { wch: maxLength };
    });

    const firstRow = header?.length ? header.length + 1 : 0;
    XLSX.utils.sheet_add_json(worksheet, data, { origin: firstRow });

    if (typesColumns) {
      Object.entries(typesColumns).forEach(([key, value]: any) => {
        const indexColumn = Object.keys(data[0]).findIndex(
          (col) => col === key,
        );

        if (indexColumn !== -1) {
          const column = this.columns[indexColumn];
          for (let i = 0; i < data.length; i++) {
            const cell = column + (firstRow + 2 + i).toString();
            if (worksheet[cell]?.v != null) {
              worksheet[cell] = { ...worksheet[cell], ...value };
            }
          }
        }
      });
    }

    return worksheet;
  }

  getObjectTypeCellByTableColumns(columns: PoTableColumn[]) {
    const typesColumns: any = {};

    columns.forEach(({ label, type, property }) => {
      label =
        label || property!.charAt(0).toUpperCase() + property!.substring(1);

      const formats: any = {
        number: { t: 'n', z: '0.00' },
        currency: { t: 'n', z: 'R$ 0.00' },
      };

      if (type && Object.prototype.hasOwnProperty.call(formats, type)) {
        typesColumns[label] = formats[type];
      }
    });

    return typesColumns;
  }
}
