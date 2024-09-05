
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

    return nonEmptyLines.join('\n');
  } catch (error) {
    console.error('Erro ao processar o PDF:', error);
    return '';
  }
};

app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  const extractedText = await extractUppercaseFromPdf(file.path);
  res.send(`<pre>${extractedText}</pre>`);
});

