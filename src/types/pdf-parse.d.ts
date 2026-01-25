declare module 'pdf-parse' {
  interface PDFParseData {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }

  function pdfParse(buffer: Buffer): Promise<PDFParseData>;
  export = pdfParse;
}
