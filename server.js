const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Questa è la rotta di callback che Google chiamerà!
app.get('/api/auth/google/callback', (req, res) => {
  const code = req.query.code; // Qui ricevi il codice da Google
  console.log("Codice ricevuto da Google:", code);

  res.send("Autenticazione riuscita! Puoi chiudere questa pagina.");
});

app.listen(port, () => {
  console.log(`Backend in ascolto sulla porta ${port}`);
});
