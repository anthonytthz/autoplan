const fs = require('fs');
const pdf = require('pdf-parse');
const ExcelJS = require('exceljs');

// Função para converter PDF para XLSX
async function convertPdfToXlsx(pdfPath, xlsxPath) {
    // Ler o arquivo PDF
    const dataBuffer = fs.readFileSync(pdfPath);
    
    const data = await pdf(dataBuffer);
    
    // Processar o texto extraído para identificar tabelas
    const rows = processPdfData(data.text);
    
    // Criar uma nova planilha
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');
    
    // Adicionar dados na planilha
    rows.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
            worksheet.getCell(String.fromCharCode(65 + cellIndex) + (rowIndex + 1)).value = cell;
        });
    });
    
    // Salvar o arquivo XLSX
    await workbook.xlsx.writeFile(xlsxPath);
    console.log('Arquivo XLSX salvo com sucesso!');
}

// Função para processar o texto extraído do PDF e identificar tabelas
function processPdfData(text) {
    // Supondo que as tabelas são delimitadas por quebras de linha e espaços
    const rows = text.split('\n').map(line => line.trim().split(/\s+/));
    return rows;
}

// Caminhos dos arquivos PDF e XLSX
const pdfPath = 'Empregados.pdf';
const xlsxPath = 'output.xlsx';

// Executar a conversão
convertPdfToXlsx(pdfPath, xlsxPath);
