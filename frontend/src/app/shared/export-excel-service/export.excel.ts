export interface ExportExcelParams {
  data: any[];
  nameSpreadsheet: string;
  nameFile: string;
  header?: string[][];
  typesColumns?: any;
}
