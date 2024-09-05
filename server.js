const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Função para ler palavras ignoradas de um arquivo TXT
const getIgnoredWords = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line);
  } catch (error) {
    console.error('Erro ao ler o arquivo de palavras ignoradas:', error);
    return [];
  }
};

// Função para extrair letras maiúsculas do PDF
const extractUppercaseFromPdf = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Lê as palavras a serem ignoradas
    const ignoreFilePath = path.join(__dirname, 'data', 'ignore-uppercase.txt');
    const ignoredWords = getIgnoredWords(ignoreFilePath);

    // Extrai apenas letras maiúsculas e remove letras isoladas
    const lines = text.split('\n');
    const filteredLines = lines.map(line => {
      // Remove todos os caracteres que não são letras maiúsculas
      const uppercaseOnly = line.replace(/[^A-Z\s]/g, '');
      // Divide a linha em palavras e filtra palavras de apenas uma letra
      const words = uppercaseOnly.split(' ');
      const filteredWords = words.filter(word => word.length > 1 && !ignoredWords.includes(word)); // Remove palavras ignoradas
      return filteredWords.join(' ');
    });

    // Remove linhas em branco adicionais no início e no final
    const nonEmptyLines = filteredLines.filter(line => line.length > 0);

    return nonEmptyLines;
  } catch (error) {
    console.error('Erro ao processar o PDF:', error);
    return [];
  }
};

// Rota para upload do PDF
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  const extractedText = await extractUppercaseFromPdf(file.path);

  const preexistingFilePath = path.join(__dirname, 'data', 'names.txt');
  const preexistingNames = getNamesFromTxt(preexistingFilePath);

  const ignoreFilePath = path.join(__dirname, 'data', 'ignore.txt');
  const ignoredNames = getNamesFromTxt(ignoreFilePath);

  const demitted = preexistingNames.filter(name => !extractedText.includes(name) && !ignoredNames.includes(name)).map(name => ({
    name: name,
    message: 'demitido'
  }));

  const admitted = extractedText.filter(name => !preexistingNames.includes(name) && !ignoredNames.includes(name)).map(name => ({
    name: name,
    message: 'admitido'
  }));

  const finalResult = [...demitted, ...admitted];

  res.json(finalResult);
});

// Função para ler nomes do arquivo TXT
const getNamesFromTxt = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line);
  } catch (error) {
    console.error('Erro ao ler o arquivo TXT:', error);
    return [];
  }
};

// Função para escrever nomes no arquivo TXT
const writeNamesToTxt = (filePath, names) => {
  try {
    fs.writeFileSync(filePath, names.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.error('Erro ao escrever no arquivo TXT:', error);
  }
};

// Rota para confirmar alterações e atualizar o arquivo TXT
app.post('/confirm-changes', (req, res) => {
  const changes = req.body.changes;
  if (!Array.isArray(changes)) {
    return res.status(400).send('Alterações inválidas.');
  }

  const preexistingFilePath = path.join(__dirname, 'data', 'names.txt');
  let preexistingNames = getNamesFromTxt(preexistingFilePath);

  changes.forEach(change => {
    if (change.message === 'demitido') {
      preexistingNames = preexistingNames.filter(name => name !== change.name);
    } else if (change.message === 'admitido') {
      if (!preexistingNames.includes(change.name)) {
        preexistingNames.push(change.name);
      }
    }
  });

  preexistingNames.sort(); // Ordena os nomes em ordem alfabética
  writeNamesToTxt(preexistingFilePath, preexistingNames);

  res.json(preexistingNames); // Envia os nomes ordenados como resposta
});

// Rota para adicionar nomes na planilha
app.post('/finalize-file', (req, res) => {
  try {
    const preexistingFilePath = path.join(__dirname, 'data', 'names.txt');
    const preexistingNames = getNamesFromTxt(preexistingFilePath);

    const workbookPath = path.join(__dirname, 'data', 'arq01.xlsx');
    let workbook;
    if (fs.existsSync(workbookPath)) {
      workbook = xlsx.readFile(workbookPath);
    } else {
      workbook = xlsx.utils.book_new();
    }

    // Verifica se já existe uma planilha, senão cria uma nova
    const sheetName = 'Sheet1';
    let worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      worksheet = xlsx.utils.aoa_to_sheet([[]]);
      workbook.Sheets[sheetName] = worksheet;
    }

    // Adiciona os nomes nas células B3 até B64
    const maxRows = 64; // Máximo de linhas na faixa
    const startRow = 3; // Linha inicial
    const endRow = startRow + maxRows - 1; // Linha final

    for (let i = 0; i < preexistingNames.length && (startRow + i) <= endRow; i++) {
      const cellAddress = { c: 1, r: startRow - 1 + i }; // Coluna B (1), Linha 3 (startRow - 1 + i)
      const cellRef = xlsx.utils.encode_cell(cellAddress);
      worksheet[cellRef] = { v: preexistingNames[i], t: 's' };
    }

    // Atualiza a referência da planilha
    worksheet['!ref'] = xlsx.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: 1, r: endRow - 1 }
    });

    // Salva a planilha
    xlsx.writeFile(workbook, workbookPath);

    res.status(200).send('Planilha atualizada com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar a planilha:', error);
    res.status(500).send('Erro ao atualizar a planilha.');
  }
});


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
