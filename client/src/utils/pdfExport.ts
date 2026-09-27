import html2pdf from 'html2pdf.js';

export async function exportDashboardToPDF(elementId: string, filterType: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found for PDF export.`);
    return;
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `ThePrimeClasses_BranchHead_Report_${filterType}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}
