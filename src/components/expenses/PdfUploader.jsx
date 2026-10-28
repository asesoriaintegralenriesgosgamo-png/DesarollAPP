import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { parsePdfStatementFile } from '../../lib/pdfParser';
import { saveUploadedStatementToIDB } from '../../lib/statementStore';

export default function PdfUploader({ onTransactionsExtracted, compact = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const processFiles = async (fileList) => {
    const files = Array.from(fileList).filter(
      f => f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf')
    );
    if (files.length === 0) {
      alert('Por favor sube al menos un archivo PDF');
      return;
    }

    setLoading(true);
    try {
      let allTxs = [];
      const savedStatements = [];
      for (const file of files) {
        const parsed = await parsePdfStatementFile(file);
        await saveUploadedStatementToIDB(parsed);
        savedStatements.push(parsed.statement);
        allTxs = [...allTxs, ...parsed.transactions];
      }
      if (onTransactionsExtracted) {
        onTransactionsExtracted(allTxs, savedStatements);
      }
    } catch (e) {
      console.error(e);
      alert('Hubo un error al procesar y guardar los PDFs');
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
      className={`border-2 border-dashed rounded-xl ${compact ? 'p-4' : 'p-6'} text-center transition-colors cursor-pointer ${
        isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-700 bg-neutral-900/80 hover:border-neutral-600'
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
          e.target.value = '';
        }}
      />
      <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
        {loading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
        ) : (
          <UploadCloud className={`${compact ? 'h-7 w-7 mb-1.5' : 'h-10 w-10 mb-3'} text-blue-400`} />
        )}
        <h3 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-white mb-0.5`}>
          {loading ? 'Guardando y vinculando PDF...' : 'Subir Estado de Cuenta PDF'}
        </h3>
        <p className="text-neutral-400 text-xs">
          Se guarda el PDF y se ligan todos los cargos (AMEX Crédito, BBVA Crédito o BBVA Débito)
        </p>
      </label>
    </div>
  );
}
