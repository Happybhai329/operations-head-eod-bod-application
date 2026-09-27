declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    enableLinks?: boolean;
    html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean };
    jsPDF?: { unit?: string; format?: string; orientation?: 'portrait' | 'landscape' };
  }

  interface Html2PdfWorker {
    from(element: HTMLElement | string): Html2PdfWorker;
    set(opt: Html2PdfOptions): Html2PdfWorker;
    save(): Promise<void>;
    outputPdf(type?: string): Promise<any>;
  }

  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}
