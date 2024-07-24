const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');

const app = express();
const port = 3000; // Usando porta 3000, você pode alterar se necessário

// Configurar multer para armazenar arquivos em /uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware para servir arquivos estáticos
app.use(express.static('public'));

// Função para extrair a coluna B de uma planilha a partir da linha 3
const getColumnBFromRow3 = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const sheet = workbook.Sheets[sheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Filtra para começar da linha 3 (índice 2, pois o índice começa em 0)
  return data.slice(2).map(row => row[1]);
};

// Rota para upload de arquivo
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  // Obter coluna B do arquivo carregado
  const uploadedColumnB = getColumnBFromRow3(file.path);
  console.log('Coluna B do arquivo carregado:', uploadedColumnB);

  // Obter coluna B da planilha preexistente
  const preexistingFilePath = path.join(__dirname, 'data', 'arq01.xlsx');
  const preexistingColumnB = getColumnBFromRow3(preexistingFilePath);
  console.log('Coluna B da planilha preexistente:', preexistingColumnB);

  // Comparar as colunas B
  const comparisonResult = uploadedColumnB.map((value, index) => ({
    uploaded: value,
    preexisting: preexistingColumnB[index] || null,
    match: value === preexistingColumnB[index]
  }));

  // Enviar resultado da comparação como resposta
  res.json(comparisonResult);
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
