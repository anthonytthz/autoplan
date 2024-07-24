const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Garantir que os diretórios necessários existem
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

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

// Middleware para parsing de JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Função para extrair a coluna B de uma planilha a partir da linha 1
const getColumnBFromRow1 = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new Error('Nenhuma planilha encontrada no arquivo.');
    }
    const sheet = workbook.Sheets[sheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Filtra a partir da linha 1
    return data.map(row => row[1]);
  } catch (error) {
    console.error('Erro ao processar o arquivo:', error);
    return [];
  }
};

// Função para ler os nomes de um arquivo TXT
const getNamesFromTxt = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line);
  } catch (error) {
    console.error('Erro ao ler o arquivo TXT:', error);
    return [];
  }
};

// Função para escrever os nomes em um arquivo TXT
const writeNamesToTxt = (filePath, names) => {
  try {
    fs.writeFileSync(filePath, names.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.error('Erro ao escrever no arquivo TXT:', error);
  }
};

// Função para atualizar o arquivo XLSX com os nomes
const updateXlsxFile = (filePath, names) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const sheet = workbook.Sheets[sheetNames[0]];

    // Define o intervalo de células a serem atualizadas (B3 a B63)
    const startRow = 3;
    const endRow = 63;

    // Prepara os dados para escrever na planilha
    for (let i = startRow; i <= endRow; i++) {
      const cellAddress = `B${i}`;
      if (i - startRow < names.length) {
        // Atualiza o valor da célula se houver nome disponível
        sheet[cellAddress] = { v: names[i - startRow] };
      } else {
        // Limpa as células além do número de nomes
        sheet[cellAddress] = { v: null };
      }
    }

    // Atualiza a planilha e salva o arquivo
    xlsx.writeFile(workbook, filePath);
  } catch (error) {
    console.error('Erro ao atualizar o arquivo XLSX:', error);
  }
};

// Rota para upload de arquivo
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  // Obter coluna B do arquivo carregado (a partir da linha 1)
  const uploadedColumnB = getColumnBFromRow1(file.path);
  console.log('Coluna B do arquivo carregado:', uploadedColumnB);

  // Obter os nomes do arquivo TXT
  const preexistingFilePath = path.join(__dirname, 'data', 'names.txt');
  const preexistingNames = getNamesFromTxt(preexistingFilePath);
  console.log('Nomes preexistentes do arquivo TXT:', preexistingNames);

  // Obter os nomes a serem ignorados do arquivo TXT
  const ignoreFilePath = path.join(__dirname, 'data', 'ignore.txt');
  const ignoredNames = getNamesFromTxt(ignoreFilePath);
  console.log('Nomes a serem ignorados do arquivo TXT:', ignoredNames);

  // Verificar quais nomes da lista preexistente não estão na lista carregada e não estão na lista de ignorados
  const demitted = preexistingNames.filter(name => !uploadedColumnB.includes(name) && !ignoredNames.includes(name)).map(name => ({
    name: name,
    message: 'demitido'
  }));

  // Verificar quais nomes estão apenas na lista carregada
  const admitted = uploadedColumnB.filter(name => !preexistingNames.includes(name) && !ignoredNames.includes(name)).map(name => ({
    name: name,
    message: 'admitido'
  }));

  // Combinar os resultados
  const finalResult = [...demitted, ...admitted];

  // Enviar resultado da comparação como resposta
  res.json(finalResult);
});

// Rota para confirmar alterações
app.post('/confirm-changes', (req, res) => {
  const changes = req.body.changes;
  if (!Array.isArray(changes)) {
    return res.status(400).send('Alterações inválidas.');
  }

  const preexistingFilePath = path.join(__dirname, 'data', 'names.txt');
  let preexistingNames = getNamesFromTxt(preexistingFilePath);

  const admittedNames = changes.filter(change => change.message === 'admitido').map(change => change.name);
  const demittedNames = changes.filter(change => change.message === 'demitido').map(change => change.name);

  // Atualiza a lista de nomes
  preexistingNames = preexistingNames.filter(name => !demittedNames.includes(name));
  admittedNames.forEach(name => {
    if (!preexistingNames.includes(name)) {
      preexistingNames.push(name);
    }
  });

  // Ordena os nomes em ordem alfabética
  preexistingNames.sort();

  // Atualiza o arquivo names.txt
  writeNamesToTxt(preexistingFilePath, preexistingNames);

  // Atualiza o arquivo XLSX
  const xlsxFilePath = path.join(__dirname, 'data', 'arq01.xlsx');
  updateXlsxFile(xlsxFilePath, preexistingNames);

  res.send('Alterações confirmadas e aplicadas com sucesso.');
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
