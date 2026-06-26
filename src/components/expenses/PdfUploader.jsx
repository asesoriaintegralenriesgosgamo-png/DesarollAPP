import React, { useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { extractLinesFromPDF, parseTransactions } from '../../lib/pdfParser';

export default function PdfUploader({ onTransactionsExtracted }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const processFiles = async (fileList) => {
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf');
    if (files.length === 0) {
      alert('Por favor sube al menos un archivo PDF');
      return;
    }
    
    setLoading(true);
    try {
      let allTxs = [];
      for (const file of files) {
        const lines = await extractLinesFromPDF(file);
        const txs = parseTransactions(lines);
        allTxs = [...allTxs, ...txs];
      }
      onTransactionsExtracted(allTxs);
    } catch (e) {
      console.error(e);
      alert('Hubo un error al procesar los PDFs');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-700 bg-neutral-900'
      }`}
    >
      <input 
        type="file" 
        accept=".pdf" 
        multiple
        className="hidden" 
        id="pdf-upload" 
        onChange={(e) => {
          if (e.target.files.length > 0) processFiles(e.target.files);
        }}
      />
      <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
        {loading ? (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        ) : (
          <UploadCloud className="h-12 w-12 text-neutral-400 mb-4" />
        )}
        <h3 className="text-lg font-semibold text-white mb-2">
          {loading ? 'Procesando PDF...' : 'Sube tu estado de cuenta PDF'}
        </h3>
        <p className="text-neutral-400 text-sm">
          Arrastra y suelta aquí, o haz clic para seleccionar (BBVA o Amex)
        </p>
      </label>
    </div>
  );
}
