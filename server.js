const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

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

const getColumnBFromRow1 = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new Error('Nenhuma planilha encontrada no arquivo.');
    }
    const sheet = workbook.Sheets[sheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    return data.map(row => row[1]);
  } catch (error) {
    console.error('Erro ao processar o arquivo:', error);
    return [];
  }
};

const getNamesFromTxt = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line);
  } catch (error) {
    console.error('Erro ao ler o arquivo TXT:', error);
    return [];
  }
};

const writeNamesToTxt = (filePath, names) => {
  try {
    fs.writeFileSync(filePath, names.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.error('Erro ao escrever no arquivo TXT:', error);
  }
};

app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  const uploadedColumnB = getColumnBFromRow1(file.path);

  const preexistingFilePath = path.join(__dirname, 'data', 'names.txt');
  const preexistingNames = getNamesFromTxt(preexistingFilePath);

  const ignoreFilePath = path.join(__dirname, 'data', 'ignore.txt');
  const ignoredNames = getNamesFromTxt(ignoreFilePath);

  const demitted = preexistingNames.filter(name => !uploadedColumnB.includes(name) && !ignoredNames.includes(name)).map(name => ({
    name: name,
    message: 'demitido'
  }));

  const admitted = uploadedColumnB.filter(name => !preexistingNames.includes(name) && !ignoredNames.includes(name)).map(name => ({
    name: name,
    message: 'admitido'
  }));

  const finalResult = [...demitted, ...admitted];

  res.json(finalResult);
});

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

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
