document.getElementById('finalizeButton').addEventListener('click', async () => {
  try {
    const response = await fetch('/finalize-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const message = await response.text();
      alert(message);
    } else {
      const errorText = await response.text();
      alert('Erro ao finalizar o arquivo: ' + errorText);
    }
  } catch (error) {
    alert('Erro ao comunicar com o servidor: ' + error.message);
  }
});
